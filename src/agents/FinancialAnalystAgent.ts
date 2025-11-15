import { BaseAgent } from './BaseAgent';
import { AgentType, AgentResponse, FinancialMetrics } from '../types';

/**
 * Financial analysis agent specializing in revenue, expenses, and profitability
 */
export class FinancialAnalystAgent extends BaseAgent {
  constructor() {
    super(AgentType.FINANCIAL_ANALYST, {
      type: AgentType.FINANCIAL_ANALYST,
      name: 'Financial Analyst',
      description: 'Analyzes financial performance, profitability, and cash flow',
      skills: ['Revenue Analysis', 'Expense Tracking', 'Profit Optimization', 'Financial Forecasting']
    });
  }

  async analyze(data: any): Promise<AgentResponse> {
    const taskId = 'fin-' + Date.now();
    this.emitStarted(taskId);
    this.log('Starting financial analysis...');

    try {
      const { locations, metrics } = data;

      // Calculate aggregate financial metrics
      const totalRevenue = this.calculateTotalRevenue(metrics);
      const totalExpenses = this.calculateTotalExpenses(metrics);
      const totalProfit = totalRevenue - totalExpenses;
      const profitMargin = (totalProfit / totalRevenue) * 100;

      // Generate insights
      const insights = this.generateInsights(totalRevenue, totalExpenses, totalProfit, profitMargin, locations);
      const recommendations = this.generateRecommendations(profitMargin, metrics);

      const response = this.createResponse(taskId, true, {
        summary: {
          totalRevenue,
          totalExpenses,
          totalProfit,
          profitMargin,
          locationCount: locations?.length || 0
        },
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

  private calculateTotalRevenue(metrics: any[]): number {
    if (!metrics || metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + (m.revenue || 0), 0);
  }

  private calculateTotalExpenses(metrics: any[]): number {
    if (!metrics || metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + (m.expenses || 0), 0);
  }

  private generateInsights(revenue: number, expenses: number, profit: number, margin: number, locations: any[]): string[] {
    const insights: string[] = [];

    insights.push('Total revenue across all locations: $' + revenue.toLocaleString());
    insights.push('Total expenses: $' + expenses.toLocaleString());
    insights.push('Net profit: $' + profit.toLocaleString());
    insights.push('Profit margin: ' + margin.toFixed(2) + '%');

    if (margin > 20) {
      insights.push('Strong profit margin indicates healthy financial performance');
    } else if (margin > 10) {
      insights.push('Moderate profit margin with room for improvement');
    } else {
      insights.push('Low profit margin requires immediate attention');
    }

    return insights;
  }

  private generateRecommendations(margin: number, metrics: any[]): string[] {
    const recommendations: string[] = [];

    if (margin < 15) {
      recommendations.push('Focus on cost reduction initiatives to improve profit margins');
      recommendations.push('Review pricing strategy to increase revenue per transaction');
    }

    if (metrics.length > 0) {
      recommendations.push('Implement financial tracking dashboard for real-time monitoring');
      recommendations.push('Conduct monthly financial reviews with location managers');
    }

    recommendations.push('Explore opportunities for bulk purchasing to reduce supply costs');
    recommendations.push('Consider implementing automated expense management systems');

    return recommendations;
  }
}
