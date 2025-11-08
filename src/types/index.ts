/**
 * Core types and interfaces for the Franchise Management Platform
 */

export interface FranchiseConfig {
  name: string;
  industry: string;
  databasePath?: string;
  enableApi?: boolean;
  apiPort?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface FranchiseLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  opened: Date;
  status: 'active' | 'pending' | 'closed';
}

export interface FinancialMetrics {
  revenue: number;
  expenses: number;
  profit: number;
  profitMargin: number;
  period: string;
}

export interface OperationalMetrics {
  employeeCount: number;
  customerCount: number;
  averageTransactionValue: number;
  customerSatisfactionScore: number;
  operationalEfficiency: number;
}

export interface MarketAnalysis {
  marketSize: number;
  marketGrowthRate: number;
  competitorCount: number;
  marketShare: number;
  targetDemographics: string[];
}

export interface GrowthOpportunity {
  id: string;
  type: 'location' | 'service' | 'market' | 'optimization';
  description: string;
  potentialRevenue: number;
  investmentRequired: number;
  roi: number;
  timeframe: string;
  priority: 'high' | 'medium' | 'low';
}

export interface AgentTask {
  id: string;
  agentType: AgentType;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export enum AgentType {
  FINANCIAL_ANALYST = 'financial_analyst',
  MARKET_RESEARCHER = 'market_researcher',
  OPERATIONS_SPECIALIST = 'operations_specialist',
  GROWTH_STRATEGIST = 'growth_strategist',
  DATA_ANALYST = 'data_analyst'
}

export interface AgentCapabilities {
  type: AgentType;
  name: string;
  description: string;
  skills: string[];
}

export interface AgentResponse {
  agentType: AgentType;
  taskId: string;
  success: boolean;
  data?: any;
  insights?: string[];
  recommendations?: string[];
  error?: string;
}

export interface SwarmCoordinationResult {
  taskId: string;
  agents: AgentType[];
  results: AgentResponse[];
  aggregatedInsights: string[];
  recommendations: string[];
  completedAt: Date;
}

export interface DatabaseConfig {
  path: string;
  verbose?: boolean;
}

export interface ApiConfig {
  port: number;
  enableCors?: boolean;
  corsOrigins?: string[];
  enableAuth?: boolean;
  apiKey?: string;
}

export interface EventData {
  type: string;
  timestamp: Date;
  data: any;
}

export interface FranchiseReport {
  id: string;
  title: string;
  generatedAt: Date;
  locations: FranchiseLocation[];
  financialSummary: FinancialMetrics;
  operationalSummary: OperationalMetrics;
  marketInsights: MarketAnalysis;
  growthOpportunities: GrowthOpportunity[];
  recommendations: string[];
}

export interface AgentMessage {
  from: AgentType;
  to?: AgentType;
  type: 'request' | 'response' | 'broadcast';
  content: any;
  timestamp: Date;
}

export interface AnalysisRequest {
  type: 'financial' | 'market' | 'operational' | 'growth' | 'comprehensive';
  locationIds?: string[];
  timeframe?: string;
  parameters?: Record<string, any>;
}
