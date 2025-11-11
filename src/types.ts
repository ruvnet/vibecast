/**
 * Type definitions for Agentic Flow
 */

/**
 * Node function type - processes state and returns new state
 */
export type NodeFunction<T = any> = (state: T) => Promise<T> | T;

/**
 * Condition function for conditional edges
 */
export type ConditionFunction<T = any> = (state: T) => boolean;

/**
 * Node definition
 */
export interface Node<T = any> {
  name: string;
  fn: NodeFunction<T>;
}

/**
 * Edge definition
 */
export interface Edge {
  from: string;
  to: string;
  condition?: ConditionFunction;
}

/**
 * Graph configuration
 */
export interface GraphConfig {
  name?: string;
  checkpointer?: any;
  enableLogging?: boolean;
}

/**
 * Execution result
 */
export interface ExecutionResult<T = any> {
  state: T;
  executionTime: number;
  nodesExecuted: string[];
}

/**
 * Checkpoint metadata
 */
export interface CheckpointMetadata {
  checkpointId: string;
  threadId: string;
  timestamp: string;
  version: number;
}

/**
 * Pattern definition for AgentDB
 */
export interface Pattern {
  id: string;
  name: string;
  content: string;
  embedding: number[];
  score: number;
  usageCount: number;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Benchmark result
 */
export interface BenchmarkResult {
  operation: string;
  iterations: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  unit: 'ms' | 'μs' | 'ns';
}

/**
 * MCP Server configuration
 */
export interface MCPConfig {
  mode: 'stdio' | 'sse';
  port?: number;
  host?: string;
}
