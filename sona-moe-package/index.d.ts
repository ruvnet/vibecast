/**
 * SONA MoE Type Definitions
 */

export interface ExpertConfig {
  name: string;
  description: string;
  baseModel: string;
  domains: string[];
  keywords: string[];
}

export interface TinyModelConfig {
  name: string;
  hiddenDim: number;
  numLayers: number;
  numHeads: number;
  headDim: number;
  params: string;
  contextLength: number;
  strengths: string[];
}

export interface QuantizationConfig {
  name: string;
  bitsPerWeight: number;
  memoryReduction: number;
  qualityLoss: number;
  onnxType: string;
  method?: string;
}

export interface RoutingResult {
  expert: string;
  weight: number;
  rawConfidence: number;
}

export interface ProcessResult {
  routing: RoutingResult[];
  responses: Array<{
    embedding: number[];
    confidence: number;
    expert: string;
    weight: number;
  }>;
  combined: number[];
  primaryExpert: string;
}

export interface ExpertStats {
  expert: string;
  name: string;
  baseModel: string;
  trainingCount: number;
  avgQuality: string;
  activations: number;
}

export interface MoEStats {
  totalExperts: number;
  processCount: number;
  router: {
    totalRoutes: number;
    expertDistribution: Record<string, number>;
  };
  experts: Record<string, ExpertStats>;
}

export interface TrainingProgress {
  expert: string;
  trained: number;
  total: number;
}

export interface MoEOptions {
  topK?: number;
  threshold?: number;
  baseLoraRank?: number;
  learningRate?: number;
  trajectoryCapacity?: number;
  patternClusters?: number;
}

export interface TrainingOptions {
  trajectoriesPerExpert?: number;
  onProgress?: (progress: TrainingProgress) => void;
}

export interface PipelineOptions {
  quantization?: string;
  microLoraRank?: number;
  baseLoraRank?: number;
  learningRate?: number;
  trajectoryCapacity?: number;
  patternClusters?: number;
  exportDir?: string;
}

export interface OptimalConfig {
  microLoraRank: number;
  baseLoraRank: number;
  learningRate: number;
  expectedThroughput: number;
  expectedQualityGain: string;
}

// Classes
export class Expert {
  constructor(expertKey: string, config?: Partial<MoEOptions>);
  train(trajectories: Array<{ input: any; quality: number }>): void;
  process(input: any): { embedding: number[]; confidence: number; expert: string };
  getStats(): ExpertStats;
}

export class Router {
  constructor(config?: { topK?: number; threshold?: number });
  route(input: any, experts: Record<string, Expert>): RoutingResult[];
  getStats(): { totalRoutes: number; expertDistribution: Record<string, number> };
}

export class SonaMoE {
  constructor(config?: MoEOptions);
  addExpert(expertKey: string, config?: Partial<MoEOptions>): this;
  addAllExperts(config?: Partial<MoEOptions>): this;
  trainExpert(expertKey: string, trajectories: Array<{ input: any; quality: number }>): this;
  process(input: any): ProcessResult;
  getStats(): MoEStats;
  export(exportDir: string): { directory: string; manifest: any };
}

export class FederatedCoordinator {
  constructor(modelKey: string, options?: PipelineOptions);
  registerAgent(agentId: string, metadata?: any): string;
  ingestTrajectories(agentId: string, trajectories: Array<{ embedding: number[]; quality: number }>): { ingested: number; filtered: number };
  consolidate(): void;
  getStats(): any;
  exportAdapter(format?: string): Promise<any>;
}

export class EphemeralAgent {
  constructor(coordinatorRef: FederatedCoordinator, agentId?: string);
  process(input: any, qualityFn: number | ((enhanced: number[]) => number | Promise<number>)): Promise<{ enhanced: number[]; quality: number }>;
  sync(): Promise<{ synced: number } | { ingested: number; filtered: number }>;
  shutdown(): Promise<{ agentId: string; status: string }>;
}

export class TrainingPipeline {
  constructor(modelKey: string, options?: PipelineOptions);
  spawnAgents(count: number): string[];
  train(dataset: Array<{ input: any; quality: number }>, options?: { batchSize?: number; epochs?: number; agentCount?: number; onProgress?: (p: any) => void }): Promise<any>;
  export(format?: string): Promise<any>;
  getStats(): any;
}

export class ONNXExporter {
  static getConfig(modelKey: string, quantization?: string): {
    model: string;
    onnxType: string;
    estimatedMemoryMB: number;
    qualityRetention: string;
    exportCommand: string;
    quantizeCommand: string;
  };
  static listModels(): Array<{
    key: string;
    name: string;
    params: string;
    hiddenDim: number;
    contextLength: number;
    strengths: string[];
  }>;
  static getMemoryEstimates(modelKey: string): Array<{
    quantization: string;
    name: string;
    memoryMB: number;
    qualityRetention: string;
  }>;
}

// Functions
export function createMoE(options?: MoEOptions): SonaMoE;
export function createTrainedMoE(options?: MoEOptions & TrainingOptions): Promise<SonaMoE>;
export function createPipeline(modelKey: string, options?: PipelineOptions): TrainingPipeline;
export function getOptimalConfig(modelKey: string): OptimalConfig;
export function trainMoE(moe: SonaMoE, options?: TrainingOptions): Promise<number>;
export function generateExpertTrainingData(expertKey: string, count?: number): Array<{ input: any; quality: number }>;

// Constants
export const EXPERT_CONFIGS: Record<string, ExpertConfig>;
export const TINY_MODELS: Record<string, TinyModelConfig>;
export const QUANTIZATION_CONFIGS: Record<string, QuantizationConfig>;

// Re-export from @ruvector/sona
export { SonaEngine } from '@ruvector/sona';
