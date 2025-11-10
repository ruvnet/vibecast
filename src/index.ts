/**
 * Vibecast Self-Learning Research System
 *
 * A production-ready AI research system featuring:
 * - Agentic-Flow: Multi-agent orchestration platform
 * - AgentDB: Vector-based memory with reflexion learning
 * - Kimi K2: 1T parameter MoE model via OpenRouter
 * - Research Swarm: Collaborative agent teams
 *
 * @example
 * ```typescript
 * import { ResearchSystem } from './research-system';
 *
 * const system = new ResearchSystem({ agentCount: 5 });
 * const result = await system.research(
 *   'Artificial Intelligence',
 *   'Latest trends in AI agents',
 *   'hierarchical'
 * );
 * ```
 */

export { ResearchSystem } from './research-system';
export type { ResearchSystemConfig } from './research-system';
export { ResearchSwarm } from './agents/research-swarm';
export type { SwarmTask, SwarmResult } from './agents/research-swarm';
export { ResearchAgent } from './agents/research-agent';
export type { ResearchTask, ResearchResult } from './agents/research-agent';
export { AgentMemory } from './memory/agent-memory';
export type { MemoryEntry, ReflexionEntry } from './memory/agent-memory';
export { openRouterConfig, validateConfig } from './config/openrouter';
export { researchConfig } from './config/research';

// Default export
import { ResearchSystem } from './research-system';
export default ResearchSystem;
