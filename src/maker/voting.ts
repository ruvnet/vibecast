/**
 * First-to-Ahead-by-k Voting Mechanism
 *
 * Implements the voting algorithm from "Solving a Million-Step LLM Task with Zero Errors"
 * (arXiv:2511.09030)
 *
 * Key insight: A correct step will eventually win if its probability > 0.5
 * The algorithm terminates when one candidate is k votes ahead of all others.
 */

import type { VotingResult, MAKERConfig, MicroagentResult } from './types';

/**
 * Candidate in the voting process
 */
export interface Candidate<T> {
  /** The candidate value */
  value: T;
  /** Serialized form for comparison */
  serialized: string;
  /** Vote count */
  votes: number;
  /** Source results that produced this candidate */
  sources: MicroagentResult<T>[];
}

/**
 * Voting session state
 */
export interface VotingSession<T> {
  /** All candidates seen so far */
  candidates: Map<string, Candidate<T>>;
  /** Total votes cast */
  totalVotes: number;
  /** Current leader */
  leader: Candidate<T> | null;
  /** Second place candidate */
  runnerUp: Candidate<T> | null;
  /** Whether consensus has been reached */
  consensusReached: boolean;
  /** Red flags detected during voting */
  redFlags: string[];
}

/**
 * First-to-Ahead-by-k Voter
 *
 * Implements the core voting algorithm:
 * 1. Sample candidates until one is k votes ahead
 * 2. Return that candidate as the winner
 * 3. Detect anomalies via red-flagging
 */
export class FirstToAheadVoter<T> {
  private config: MAKERConfig;

  constructor(config: MAKERConfig) {
    this.config = config;
  }

  /**
   * Create a new voting session
   */
  createSession(): VotingSession<T> {
    return {
      candidates: new Map(),
      totalVotes: 0,
      leader: null,
      runnerUp: null,
      consensusReached: false,
      redFlags: []
    };
  }

  /**
   * Add a vote for a candidate
   *
   * @param session - Current voting session
   * @param result - Microagent result to vote for
   * @param serialize - Function to serialize the value for comparison
   * @returns Updated session with new vote counted
   */
  addVote(
    session: VotingSession<T>,
    result: MicroagentResult<T>,
    serialize: (value: T) => string
  ): VotingSession<T> {
    // Check for red flags
    if (result.redFlags.length > 0) {
      session.redFlags.push(...result.redFlags);
    }

    // Skip invalid results
    if (!result.isValid) {
      return session;
    }

    const serialized = serialize(result.value);

    // Get or create candidate
    let candidate = session.candidates.get(serialized);
    if (!candidate) {
      candidate = {
        value: result.value,
        serialized,
        votes: 0,
        sources: []
      };
      session.candidates.set(serialized, candidate);
    }

    // Add vote
    candidate.votes++;
    candidate.sources.push(result);
    session.totalVotes++;

    // Update leader and runner-up
    this.updateLeaderboard(session);

    // Check for consensus
    session.consensusReached = this.checkConsensus(session);

    return session;
  }

  /**
   * Update the leaderboard after a vote
   */
  private updateLeaderboard(session: VotingSession<T>): void {
    let leader: Candidate<T> | null = null;
    let runnerUp: Candidate<T> | null = null;

    for (const candidate of session.candidates.values()) {
      if (!leader || candidate.votes > leader.votes) {
        runnerUp = leader;
        leader = candidate;
      } else if (!runnerUp || candidate.votes > runnerUp.votes) {
        runnerUp = candidate;
      }
    }

    session.leader = leader;
    session.runnerUp = runnerUp;
  }

  /**
   * Check if consensus has been reached (leader is k ahead)
   */
  private checkConsensus(session: VotingSession<T>): boolean {
    if (!session.leader) {
      return false;
    }

    const leaderVotes = session.leader.votes;
    const runnerUpVotes = session.runnerUp?.votes ?? 0;

    return (leaderVotes - runnerUpVotes) >= this.config.votingThreshold;
  }

  /**
   * Get the current vote margin
   */
  getMargin(session: VotingSession<T>): number {
    if (!session.leader) {
      return 0;
    }

    const runnerUpVotes = session.runnerUp?.votes ?? 0;
    return session.leader.votes - runnerUpVotes;
  }

  /**
   * Calculate confidence based on vote distribution
   * Higher margin = higher confidence
   */
  calculateConfidence(session: VotingSession<T>): number {
    if (session.totalVotes === 0 || !session.leader) {
      return 0;
    }

    // Confidence based on leader's share of votes
    const leaderShare = session.leader.votes / session.totalVotes;

    // Confidence based on margin over runner-up
    const margin = this.getMargin(session);
    const marginConfidence = Math.min(margin / this.config.votingThreshold, 1);

    // Combined confidence
    return (leaderShare + marginConfidence) / 2;
  }

  /**
   * Get voting result from session
   */
  getResult(session: VotingSession<T>): VotingResult<T> | null {
    if (!session.leader) {
      return null;
    }

    const voteCounts = new Map<string, number>();
    for (const [serialized, candidate] of session.candidates) {
      voteCounts.set(serialized, candidate.votes);
    }

    return {
      winner: session.leader.value,
      voteCounts,
      totalVotes: session.totalVotes,
      consensusReached: session.consensusReached,
      confidence: this.calculateConfidence(session),
      redFlags: session.redFlags
    };
  }

  /**
   * Check if more votes are needed
   */
  needsMoreVotes(session: VotingSession<T>): boolean {
    return !session.consensusReached &&
           session.totalVotes < this.config.maxCandidates;
  }

  /**
   * Run full voting process with a candidate generator
   *
   * @param generateCandidate - Async function that generates a new candidate
   * @param serialize - Function to serialize candidates for comparison
   * @returns Final voting result
   */
  async runVoting(
    generateCandidate: () => Promise<MicroagentResult<T>>,
    serialize: (value: T) => string
  ): Promise<VotingResult<T>> {
    const session = this.createSession();

    while (this.needsMoreVotes(session)) {
      const result = await generateCandidate();
      this.addVote(session, result, serialize);
    }

    const finalResult = this.getResult(session);

    if (!finalResult) {
      throw new Error('Voting failed: No valid candidates produced');
    }

    return finalResult;
  }

  /**
   * Run parallel voting for performance
   * Launches multiple voters simultaneously
   *
   * @param generateCandidate - Async function that generates a new candidate
   * @param serialize - Function to serialize candidates for comparison
   * @returns Final voting result
   */
  async runParallelVoting(
    generateCandidate: () => Promise<MicroagentResult<T>>,
    serialize: (value: T) => string
  ): Promise<VotingResult<T>> {
    const session = this.createSession();

    // Initial batch of parallel votes
    const batchSize = this.config.voterCount;

    while (this.needsMoreVotes(session)) {
      // Generate batch of candidates in parallel
      const batch = await Promise.all(
        Array.from({ length: batchSize }, () => generateCandidate())
      );

      // Add all votes
      for (const result of batch) {
        this.addVote(session, result, serialize);

        // Early exit if consensus reached
        if (session.consensusReached) {
          break;
        }
      }
    }

    const finalResult = this.getResult(session);

    if (!finalResult) {
      throw new Error('Voting failed: No valid candidates produced');
    }

    return finalResult;
  }
}

/**
 * Create a voter with the given configuration
 */
export function createVoter<T>(config: MAKERConfig): FirstToAheadVoter<T> {
  return new FirstToAheadVoter<T>(config);
}

/**
 * Utility: Simple majority vote (non-MAKER fallback)
 * Returns the candidate with the most votes
 */
export function majorityVote<T>(
  results: MicroagentResult<T>[],
  serialize: (value: T) => string
): T | null {
  const votes = new Map<string, { value: T; count: number }>();

  for (const result of results) {
    if (!result.isValid) continue;

    const key = serialize(result.value);
    const existing = votes.get(key);

    if (existing) {
      existing.count++;
    } else {
      votes.set(key, { value: result.value, count: 1 });
    }
  }

  let winner: { value: T; count: number } | null = null;
  for (const candidate of votes.values()) {
    if (!winner || candidate.count > winner.count) {
      winner = candidate;
    }
  }

  return winner?.value ?? null;
}
