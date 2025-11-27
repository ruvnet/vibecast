/**
 * MAKER Framework - Main Entry Point
 *
 * Exports all MAKER framework components for integration
 * with VibeCast's multi-agent recommendation system.
 */

// Types and configuration
export {
  MAKERConfig,
  DEFAULT_MAKER_CONFIG,
  VotingResult,
  MicroagentResult,
  DecomposedStep,
  MAKERStats,
  calculateFullTaskSuccess,
  calculateMinimumK,
  calculateExpectedCost
} from './types';

// Voting mechanism
export {
  FirstToAheadVoter,
  createVoter,
  majorityVote,
  Candidate,
  VotingSession
} from './voting';

// Microagent execution
export {
  MicroagentExecutor,
  createMicroagent,
  createStep,
  wrapAsStep,
  RedFlagDetector,
  standardRedFlagDetectors
} from './microagent';

// Main executor
export {
  MAKERExecutor,
  createMAKERExecutor,
  getMAKERExecutor,
  resetMAKERExecutor,
  StepExecutionResult,
  PipelineResult
} from './executor';
