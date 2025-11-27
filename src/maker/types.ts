/**
 * VibeCast Pro - MAKER Framework Integration
 *
 * Implements concepts from "Solving a Million-Step LLM Task with Zero Errors"
 * (arXiv:2511.09030) by Meyerson et al.
 *
 * Key concepts:
 * - Massively Decomposed Agentic Processes (MDAPs)
 * - First-to-Ahead-by-k voting for error correction
 * - Microagent architecture for focused execution
 * - Red-flagging for detecting confused states
 */

/**
 * Configuration for the MAKER framework
 */
export interface MAKERConfig {
  /** Number of votes ahead required for consensus (k parameter) */
  votingThreshold: number;
  /** Maximum candidates to sample before giving up */
  maxCandidates: number;
  /** Enable red-flagging for anomaly detection */
  enableRedFlagging: boolean;
  /** Maximum response length before red-flag (tokens) */
  maxResponseLength: number;
  /** Enable parallel voting for performance */
  parallelVoting: boolean;
  /** Number of parallel voters */
  voterCount: number;
}

/**
 * Default MAKER configuration
 * Based on paper recommendations: k scales as Θ(ln s)
 */
export const DEFAULT_MAKER_CONFIG: MAKERConfig = {
  votingThreshold: 3,        // k=3 provides good error correction
  maxCandidates: 20,         // Maximum attempts before failure
  enableRedFlagging: true,   // Detect confused states
  maxResponseLength: 700,    // Paper's red-flag threshold
  parallelVoting: true,      // Enable parallel execution
  voterCount: 5              // Number of parallel voters
};

/**
 * Result of a voting round
 */
export interface VotingResult<T> {
  /** The winning candidate */
  winner: T;
  /** Vote counts for each candidate */
  voteCounts: Map<string, number>;
  /** Total votes cast */
  totalVotes: number;
  /** Whether consensus was reached */
  consensusReached: boolean;
  /** Confidence based on vote margin */
  confidence: number;
  /** Any red flags detected */
  redFlags: string[];
}

/**
 * Microagent execution result
 */
export interface MicroagentResult<T> {
  /** The output value */
  value: T;
  /** Execution time in ms */
  executionTime: number;
  /** Whether output passed validation */
  isValid: boolean;
  /** Validation errors if any */
  validationErrors: string[];
  /** Red flags detected */
  redFlags: string[];
  /** Raw response for debugging */
  rawResponse?: string;
}

/**
 * Task decomposition step
 */
export interface DecomposedStep<TInput, TOutput> {
  /** Step identifier */
  id: string;
  /** Step name */
  name: string;
  /** Execute the step */
  execute: (input: TInput) => Promise<MicroagentResult<TOutput>>;
  /** Validate the output */
  validate: (output: TOutput) => boolean;
  /** Serialize output for voting comparison */
  serialize: (output: TOutput) => string;
}

/**
 * Statistics for MAKER execution
 */
export interface MAKERStats {
  totalSteps: number;
  successfulSteps: number;
  failedSteps: number;
  totalVotesCast: number;
  averageVotesPerStep: number;
  redFlagsDetected: number;
  totalExecutionTime: number;
  perStepAccuracy: number;
  estimatedFullTaskSuccess: number;
}

/**
 * Calculate theoretical full task success probability
 * Formula from paper: p_full = (1 + ((1-p)/p)^k)^(-s/m)
 *
 * @param perStepAccuracy - Per-step success probability (p)
 * @param votingThreshold - Voting threshold (k)
 * @param totalSteps - Total number of steps (s)
 * @param stepsPerAgent - Steps per agent (m), default 1 for MAD
 */
export function calculateFullTaskSuccess(
  perStepAccuracy: number,
  votingThreshold: number,
  totalSteps: number,
  stepsPerAgent: number = 1
): number {
  if (perStepAccuracy <= 0 || perStepAccuracy >= 1) {
    return perStepAccuracy >= 1 ? 1 : 0;
  }

  const p = perStepAccuracy;
  const k = votingThreshold;
  const s = totalSteps;
  const m = stepsPerAgent;

  // p_full = (1 + ((1-p)/p)^k)^(-s/m)
  const ratio = Math.pow((1 - p) / p, k);
  const base = 1 + ratio;
  const exponent = -s / m;

  return Math.pow(base, exponent);
}

/**
 * Calculate minimum k required for target success rate
 * k_min = Θ(ln s) for scaling
 *
 * @param totalSteps - Total number of steps
 * @param targetSuccess - Target success probability
 * @param perStepAccuracy - Per-step accuracy
 */
export function calculateMinimumK(
  totalSteps: number,
  targetSuccess: number,
  perStepAccuracy: number
): number {
  // Approximate: k ≈ ln(s) / ln(p/(1-p)) for high success
  const p = perStepAccuracy;
  if (p <= 0.5) return Infinity;

  const logRatio = Math.log(p / (1 - p));
  const logSteps = Math.log(totalSteps);

  // Add safety margin
  return Math.ceil(logSteps / logRatio * 1.5);
}

/**
 * Calculate expected cost for Maximal Agentic Decomposition (MAD)
 * E[cost] ≈ cs * k_min / (v(2p-1)) = Θ(cs ln s / (vp))
 *
 * @param costPerResponse - Cost per LLM response (c)
 * @param totalSteps - Total steps (s)
 * @param validityRate - Validity rate (v)
 * @param perStepAccuracy - Per-step accuracy (p)
 */
export function calculateExpectedCost(
  costPerResponse: number,
  totalSteps: number,
  validityRate: number,
  perStepAccuracy: number
): number {
  const c = costPerResponse;
  const s = totalSteps;
  const v = validityRate;
  const p = perStepAccuracy;

  const kMin = calculateMinimumK(s, 0.99, p);

  return (c * s * kMin) / (v * (2 * p - 1));
}
