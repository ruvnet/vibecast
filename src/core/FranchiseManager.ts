import { FranchiseConfig, FranchiseLocation, FinancialMetrics, OperationalMetrics, AnalysisRequest, AgentType, FranchiseReport, GrowthOpportunity } from '../types';
import { FranchiseDatabase } from '../database/FranchiseDatabase';
import { AgentSwarm } from '../agents/AgentSwarm';
import { FranchiseEventEmitter, franchiseEvents } from '../events/FranchiseEventEmitter';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * FranchiseManager - Main API entry point for franchise management
 */
export class FranchiseManager {
  private config: FranchiseConfig;
  private database: FranchiseDatabase;
  private agentSwarm: AgentSwarm;
  public events: FranchiseEventEmitter;

  constructor(config: FranchiseConfig) {
    this.config = {
      databasePath: './franchise.db',
      enableApi: false,
      apiPort: 3000,
      logLevel: 'info',
      ...config
    };

    this.database = new FranchiseDatabase({
      path: this.config.databasePath!,
      verbose: this.config.logLevel === 'debug'
    });

    this.agentSwarm = new AgentSwarm();
    this.events = franchiseEvents;

    this.log('FranchiseManager initialized');
  }

  // Location Management
  async addLocation(location: Omit<FranchiseLocation, 'id'>): Promise<FranchiseLocation> {
    const newLocation: FranchiseLocation = {
      id: this.generateId('loc'),
      ...location
    };

    this.database.addLocation(newLocation);
    this.events.emitLocationAdded(newLocation.id, newLocation.name);
    this.log('Location added: ' + newLocation.name);

    return newLocation;
  }

  async getLocation(id: string): Promise<FranchiseLocation | undefined> {
    return this.database.getLocation(id);
  }

  async getAllLocations(): Promise<FranchiseLocation[]> {
    return this.database.getAllLocations();
  }

  async updateLocationStatus(id: string, status: 'active' | 'pending' | 'closed'): Promise<void> {
    this.database.updateLocationStatus(id, status);
    this.log('Location status updated: ' + id + ' -> ' + status);
  }

  // Metrics Management
  async addFinancialMetrics(locationId: string, metrics: FinancialMetrics): Promise<void> {
    this.database.addFinancialMetrics(locationId, metrics);
    this.events.emitMetricsUpdated(locationId, metrics);
    this.log('Financial metrics added for location: ' + locationId);
  }

  async getFinancialMetrics(locationId: string, limit?: number): Promise<FinancialMetrics[]> {
    return this.database.getFinancialMetrics(locationId, limit);
  }

  async addOperationalMetrics(locationId: string, metrics: OperationalMetrics): Promise<void> {
    this.database.addOperationalMetrics(locationId, metrics);
    this.events.emitMetricsUpdated(locationId, metrics);
    this.log('Operational metrics added for location: ' + locationId);
  }

  async getOperationalMetrics(locationId: string, limit?: number): Promise<OperationalMetrics[]> {
    return this.database.getOperationalMetrics(locationId, limit);
  }

  // Agent-based Analysis
  async runAnalysis(request: AnalysisRequest): Promise<any> {
    this.log('Running analysis: ' + request.type);
    this.events.emitAnalysisStarted(request.type);

    const locations = await this.getAllLocations();
    const data = {
      locations,
      industry: this.config.industry,
      ...request.parameters
    };

    let result;

    switch (request.type) {
      case 'financial':
        result = await this.agentSwarm.runSingleAgent(AgentType.FINANCIAL_ANALYST, data);
        break;
      case 'market':
        result = await this.agentSwarm.runSingleAgent(AgentType.MARKET_RESEARCHER, data);
        break;
      case 'growth':
        result = await this.agentSwarm.runSingleAgent(AgentType.GROWTH_STRATEGIST, data);
        break;
      case 'comprehensive':
        result = await this.agentSwarm.coordinateAnalysis(data);
        break;
      default:
        throw new Error('Unknown analysis type: ' + request.type);
    }

    const analysisId = this.generateId('analysis');
    this.database.saveAnalysis(analysisId, request.type, result);
    this.events.emitAnalysisCompleted(result);

    return result;
  }

  async getComprehensiveReport(): Promise<FranchiseReport> {
    const locations = await this.getAllLocations();
    
    const analysisResult = await this.agentSwarm.coordinateAnalysis({
      locations,
      industry: this.config.industry
    });

    const report: FranchiseReport = {
      id: this.generateId('report'),
      title: this.config.name + ' - Comprehensive Analysis Report',
      generatedAt: new Date(),
      locations,
      financialSummary: {
        revenue: 0,
        expenses: 0,
        profit: 0,
        profitMargin: 0,
        period: 'Current'
      },
      operationalSummary: {
        employeeCount: 0,
        customerCount: 0,
        averageTransactionValue: 0,
        customerSatisfactionScore: 0,
        operationalEfficiency: 0
      },
      marketInsights: {
        marketSize: 0,
        marketGrowthRate: 0,
        competitorCount: 0,
        marketShare: 0,
        targetDemographics: []
      },
      growthOpportunities: [],
      recommendations: analysisResult.recommendations
    };

    return report;
  }

  // Growth Opportunities
  async addGrowthOpportunity(opportunity: Omit<GrowthOpportunity, 'id'>): Promise<GrowthOpportunity> {
    const newOpportunity: GrowthOpportunity = {
      id: this.generateId('opp'),
      ...opportunity
    };

    this.database.addGrowthOpportunity(newOpportunity);
    this.events.emitOpportunityDiscovered(newOpportunity);
    this.log('Growth opportunity added: ' + newOpportunity.description);

    return newOpportunity;
  }

  async getGrowthOpportunities(limit?: number): Promise<GrowthOpportunity[]> {
    return this.database.getGrowthOpportunities(limit);
  }

  // Agent Management
  getAgentCapabilities(): any[] {
    return this.agentSwarm.getAgentCapabilities();
  }

  async runAgentTask(agentType: AgentType, data: any): Promise<any> {
    return await this.agentSwarm.runSingleAgent(agentType, data);
  }

  // History and Reporting
  async getAnalysisHistory(limit?: number): Promise<any[]> {
    return this.database.getAnalysisHistory(limit);
  }

  // Lifecycle Methods
  async close(): Promise<void> {
    this.database.close();
    this.log('FranchiseManager closed');
  }

  // Utility Methods
  private generateId(prefix: string): string {
    return prefix + '-' + crypto.randomBytes(8).toString('hex');
  }

  private log(message: string): void {
    if (this.config.logLevel === 'debug' || this.config.logLevel === 'info') {
      console.log('[FranchiseManager] ' + message);
    }
  }

  getConfig(): FranchiseConfig {
    return { ...this.config };
  }
}
