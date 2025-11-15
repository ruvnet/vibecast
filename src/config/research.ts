import dotenv from 'dotenv';

dotenv.config();

export interface ResearchConfig {
  maxDepth: number;
  maxConcurrentAgents: number;
  memoryRetentionDays: number;
  agentDbPath: string;
  enableVectorSearch: boolean;
  enableReflexionMemory: boolean;
  logLevel: string;
}

export const researchConfig: ResearchConfig = {
  maxDepth: parseInt(process.env.MAX_RESEARCH_DEPTH || '3'),
  maxConcurrentAgents: parseInt(process.env.MAX_CONCURRENT_AGENTS || '5'),
  memoryRetentionDays: parseInt(process.env.MEMORY_RETENTION_DAYS || '30'),
  agentDbPath: process.env.AGENTDB_PATH || './data/agentdb',
  enableVectorSearch: process.env.ENABLE_VECTOR_SEARCH === 'true',
  enableReflexionMemory: process.env.ENABLE_REFLEXION_MEMORY === 'true',
  logLevel: process.env.LOG_LEVEL || 'info',
};
