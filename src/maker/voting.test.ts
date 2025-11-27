import {
  FirstToAheadVoter,
  createVoter,
  majorityVote,
  VotingSession
} from './voting';
import type { MAKERConfig, MicroagentResult } from './types';
import { DEFAULT_MAKER_CONFIG } from './types';

describe('FirstToAheadVoter', () => {
  const config: MAKERConfig = {
    ...DEFAULT_MAKER_CONFIG,
    votingThreshold: 3,
    maxCandidates: 20
  };

  describe('createSession', () => {
    it('should create empty session', () => {
      const voter = new FirstToAheadVoter<string>(config);
      const session = voter.createSession();

      expect(session.candidates.size).toBe(0);
      expect(session.totalVotes).toBe(0);
      expect(session.leader).toBeNull();
      expect(session.consensusReached).toBe(false);
    });
  });

  describe('addVote', () => {
    it('should add vote for valid result', () => {
      const voter = new FirstToAheadVoter<string>(config);
      let session = voter.createSession();

      const result: MicroagentResult<string> = {
        value: 'candidate-a',
        executionTime: 100,
        isValid: true,
        validationErrors: [],
        redFlags: []
      };

      session = voter.addVote(session, result, (v) => v);

      expect(session.totalVotes).toBe(1);
      expect(session.candidates.get('candidate-a')?.votes).toBe(1);
      expect(session.leader?.value).toBe('candidate-a');
    });

    it('should skip invalid results', () => {
      const voter = new FirstToAheadVoter<string>(config);
      let session = voter.createSession();

      const result: MicroagentResult<string> = {
        value: 'invalid',
        executionTime: 100,
        isValid: false,
        validationErrors: ['error'],
        redFlags: []
      };

      session = voter.addVote(session, result, (v) => v);

      expect(session.totalVotes).toBe(0);
      expect(session.candidates.size).toBe(0);
    });

    it('should collect red flags', () => {
      const voter = new FirstToAheadVoter<string>(config);
      let session = voter.createSession();

      const result: MicroagentResult<string> = {
        value: 'candidate',
        executionTime: 100,
        isValid: true,
        validationErrors: [],
        redFlags: ['warning-1', 'warning-2']
      };

      session = voter.addVote(session, result, (v) => v);

      expect(session.redFlags).toContain('warning-1');
      expect(session.redFlags).toContain('warning-2');
    });

    it('should reach consensus when leader is k ahead', () => {
      const voter = new FirstToAheadVoter<string>(config);
      let session = voter.createSession();

      const winnerResult: MicroagentResult<string> = {
        value: 'winner',
        executionTime: 100,
        isValid: true,
        validationErrors: [],
        redFlags: []
      };

      // Add 3 votes for winner (k=3)
      session = voter.addVote(session, winnerResult, (v) => v);
      session = voter.addVote(session, winnerResult, (v) => v);
      session = voter.addVote(session, winnerResult, (v) => v);

      expect(session.consensusReached).toBe(true);
      expect(session.leader?.value).toBe('winner');
    });

    it('should not reach consensus without k-ahead margin', () => {
      const voter = new FirstToAheadVoter<string>(config);
      let session = voter.createSession();

      const resultA: MicroagentResult<string> = {
        value: 'a',
        executionTime: 100,
        isValid: true,
        validationErrors: [],
        redFlags: []
      };

      const resultB: MicroagentResult<string> = {
        value: 'b',
        executionTime: 100,
        isValid: true,
        validationErrors: [],
        redFlags: []
      };

      // Add alternating votes
      session = voter.addVote(session, resultA, (v) => v);
      session = voter.addVote(session, resultB, (v) => v);
      session = voter.addVote(session, resultA, (v) => v);
      session = voter.addVote(session, resultB, (v) => v);

      expect(session.consensusReached).toBe(false);
    });
  });

  describe('calculateConfidence', () => {
    it('should return 0 for empty session', () => {
      const voter = new FirstToAheadVoter<string>(config);
      const session = voter.createSession();

      expect(voter.calculateConfidence(session)).toBe(0);
    });

    it('should return high confidence for clear leader', () => {
      const voter = new FirstToAheadVoter<string>(config);
      let session = voter.createSession();

      const result: MicroagentResult<string> = {
        value: 'winner',
        executionTime: 100,
        isValid: true,
        validationErrors: [],
        redFlags: []
      };

      // Add 5 votes for same candidate
      for (let i = 0; i < 5; i++) {
        session = voter.addVote(session, result, (v) => v);
      }

      const confidence = voter.calculateConfidence(session);
      expect(confidence).toBeGreaterThan(0.8);
    });
  });

  describe('runVoting', () => {
    it('should complete when consensus reached', async () => {
      const voter = new FirstToAheadVoter<number>(config);

      let callCount = 0;
      const generateCandidate = async (): Promise<MicroagentResult<number>> => {
        callCount++;
        return {
          value: 42, // Always return same value
          executionTime: 10,
          isValid: true,
          validationErrors: [],
          redFlags: []
        };
      };

      const result = await voter.runVoting(generateCandidate, (v) => v.toString());

      expect(result.winner).toBe(42);
      expect(result.consensusReached).toBe(true);
      expect(callCount).toBe(config.votingThreshold); // Should stop at k votes
    });

    it('should stop at maxCandidates if no consensus', async () => {
      const limitedConfig: MAKERConfig = { ...config, maxCandidates: 10 };
      const voter = new FirstToAheadVoter<number>(limitedConfig);

      let counter = 0;
      const generateCandidate = async (): Promise<MicroagentResult<number>> => {
        counter++;
        return {
          value: counter, // Always different value
          executionTime: 10,
          isValid: true,
          validationErrors: [],
          redFlags: []
        };
      };

      const result = await voter.runVoting(generateCandidate, (v) => v.toString());

      expect(result.totalVotes).toBe(10);
      expect(result.consensusReached).toBe(false);
    });
  });

  describe('runParallelVoting', () => {
    it('should run candidates in parallel batches', async () => {
      const parallelConfig: MAKERConfig = { ...config, voterCount: 5 };
      const voter = new FirstToAheadVoter<string>(parallelConfig);

      const generateCandidate = async (): Promise<MicroagentResult<string>> => {
        return {
          value: 'consistent',
          executionTime: 10,
          isValid: true,
          validationErrors: [],
          redFlags: []
        };
      };

      const result = await voter.runParallelVoting(generateCandidate, (v) => v);

      expect(result.winner).toBe('consistent');
      expect(result.consensusReached).toBe(true);
    });
  });
});

describe('createVoter', () => {
  it('should create voter with config', () => {
    const voter = createVoter<string>(DEFAULT_MAKER_CONFIG);
    expect(voter).toBeInstanceOf(FirstToAheadVoter);
  });
});

describe('majorityVote', () => {
  it('should return candidate with most votes', () => {
    const results: MicroagentResult<string>[] = [
      { value: 'a', executionTime: 10, isValid: true, validationErrors: [], redFlags: [] },
      { value: 'b', executionTime: 10, isValid: true, validationErrors: [], redFlags: [] },
      { value: 'a', executionTime: 10, isValid: true, validationErrors: [], redFlags: [] },
      { value: 'a', executionTime: 10, isValid: true, validationErrors: [], redFlags: [] }
    ];

    const winner = majorityVote(results, (v) => v);
    expect(winner).toBe('a');
  });

  it('should skip invalid results', () => {
    const results: MicroagentResult<string>[] = [
      { value: 'invalid', executionTime: 10, isValid: false, validationErrors: [], redFlags: [] },
      { value: 'valid', executionTime: 10, isValid: true, validationErrors: [], redFlags: [] }
    ];

    const winner = majorityVote(results, (v) => v);
    expect(winner).toBe('valid');
  });

  it('should return null for empty results', () => {
    const winner = majorityVote<string>([], (v) => v);
    expect(winner).toBeNull();
  });
});
