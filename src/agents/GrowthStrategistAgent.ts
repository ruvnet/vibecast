import { BaseAgent } from './BaseAgent';
import { AgentType, AgentResponse, GrowthOpportunity } from '../types';

/**
 * Growth strategy agent for identifying expansion opportunities
 */
export class GrowthStrategistAgent extends BaseAgent {
  constructor() {
    super(AgentType.GROWTH_STRATEGIST, {
      type: AgentType.GROWTH_STRATEGIST,
      name: 'Growth Strategist',
      description: 'Identifies growth opportunities and expansion strategies',
      skills: ['Opportunity Identification', 'ROI Analysis', 'Expansion Planning', 'Strategic Prioritization']
    });
  }

  async analyze(data: any): Promise<AgentResponse> {
    const taskId = 'grow-' + Date.now();
    this.emitStarted(taskId);
    this.log('Starting growth strategy analysis...');

    try {
      const { locations, financialData, marketData } = data;

      const opportunities = this.identifyOpportunities(locations, financialData, marketData);
      const insights = this.generateInsights(opportunities);
      const recommendations = this.prioritizeOpportunities(opportunities);

      const response = this.createResponse(taskId, true, {
        opportunities,
        insights,
        recommendations
      });

      this.emitCompleted(response);
      return response;
    } catch (error) {
      const errorResponse = this.createResponse(taskId, false, undefined, (error as Error).message);
      this.emitCompleted(errorResponse);
      return errorResponse;
    }
  }

  private identifyOpportunities(locations: any[], financial: any, market: any): GrowthOpportunity[] {
    const opportunities: GrowthOpportunity[] = [];

    // New location opportunity
    opportunities.push({
      id: 'opp-loc-' + Date.now(),
      type: 'location',
      description: 'Open new location in high-growth suburban market',
      potentialRevenue: 850000,
      investmentRequired: 350000,
      roi: 143,
      timeframe: '18-24 months',
      priority: 'high'
    });

    // Service expansion opportunity
    opportunities.push({
      id: 'opp-svc-' + Date.now(),
      type: 'service',
      description: 'Launch digital ordering platform with delivery service',
      potentialRevenue: 450000,
      investmentRequired: 120000,
      roi: 275,
      timeframe: '6-12 months',
      priority: 'high'
    });

    // Market expansion opportunity
    opportunities.push({
      id: 'opp-mkt-' + Date.now(),
      type: 'market',
      description: 'Expand into adjacent market segment (corporate catering)',
      potentialRevenue: 320000,
      investmentRequired: 80000,
      roi: 300,
      timeframe: '3-6 months',
      priority: 'medium'
    });

    // Optimization opportunity
    opportunities.push({
      id: 'opp-opt-' + Date.now(),
      type: 'optimization',
      description: 'Implement automation to reduce operational costs',
      potentialRevenue: 180000,
      investmentRequired: 60000,
      roi: 200,
      timeframe: '3-6 months',
      priority: 'medium'
    });

    return opportunities;
  }

  private generateInsights(opportunities: GrowthOpportunity[]): string[] {
    const insights: string[] = [];
    const totalPotentialRevenue = opportunities.reduce((sum, opp) => sum + opp.potentialRevenue, 0);
    const totalInvestment = opportunities.reduce((sum, opp) => sum + opp.investmentRequired, 0);

    insights.push('Identified ' + opportunities.length + ' high-potential growth opportunities');
    insights.push('Combined potential revenue: $' + totalPotentialRevenue.toLocaleString());
    insights.push('Total investment required: $' + totalInvestment.toLocaleString());
    insights.push('Average ROI across opportunities: ' + 
      (opportunities.reduce((sum, opp) => sum + opp.roi, 0) / opportunities.length).toFixed(0) + '%');
    
    const highPriority = opportunities.filter(o => o.priority === 'high').length;
    insights.push(highPriority + ' opportunities classified as high priority');

    return insights;
  }

  private prioritizeOpportunities(opportunities: GrowthOpportunity[]): string[] {
    const sorted = [...opportunities].sort((a, b) => b.roi - a.roi);

    return [
      'Prioritize ' + sorted[0].type + ' opportunity with highest ROI (' + sorted[0].roi + '%)',
      'Quick wins: Focus on opportunities with 3-6 month timeframes first',
      'Balance high-revenue opportunities with quick implementation wins',
      'Secure funding for top 2-3 opportunities to maximize growth',
      'Implement phased rollout approach to manage risk'
    ];
  }
}
