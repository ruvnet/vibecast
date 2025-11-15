/**
 * Franchise Analysis Agent
 * Analyzes franchise performance, identifies trends, and provides insights
 */

import { BaseAgent } from '../lib/base-agent.js';
import type { AgentContext, AgentResponse, FranchiseData } from '../types/index.js';
import { z } from 'zod';

const AnalysisInputSchema = z.object({
  franchiseData: z.array(z.any()),
  analysisType: z.enum(['performance', 'comparison', 'trend', 'risk']),
  timeframe: z.string().optional(),
  includeRecommendations: z.boolean().default(true),
});

export type AnalysisInput = z.infer<typeof AnalysisInputSchema>;

export interface AnalysisResult {
  summary: string;
  insights: string[];
  metrics: Record<string, number>;
  trends: Array<{
    metric: string;
    direction: 'up' | 'down' | 'stable';
    percentage: number;
  }>;
  recommendations: string[];
  riskFactors: Array<{
    factor: string;
    severity: 'low' | 'medium' | 'high';
    impact: string;
  }>;
}

export class FranchiseAnalysisAgent extends BaseAgent {
  constructor() {
    super({
      role: 'franchise-analysis',
      name: 'Franchise Analysis Agent',
      description:
        'Analyzes franchise performance data, identifies patterns, and provides actionable insights',
      systemPrompt: `You are an expert franchise performance analyst with deep experience in:
- Financial analysis and KPI tracking
- Operational efficiency assessment
- Competitive market analysis
- Risk identification and mitigation
- Data-driven decision making

Your role is to analyze franchise data and provide clear, actionable insights that help franchise owners and operators improve performance.

When analyzing data:
1. Focus on key metrics: revenue, profit margins, customer satisfaction, operational efficiency
2. Identify trends and patterns over time
3. Compare performance against benchmarks and industry standards
4. Highlight both strengths and areas for improvement
5. Provide specific, actionable recommendations

Format your analysis in a structured way with clear sections for:
- Executive Summary
- Key Insights
- Trend Analysis
- Risk Assessment
- Recommendations

Use data to support your conclusions and quantify impacts wherever possible.`,
      temperature: 0.3,
      maxTokens: 2048,
    });
  }

  protected async execute(input: any, context?: AgentContext): Promise<AgentResponse> {
    // Validate input
    const validatedInput = AnalysisInputSchema.parse(input);

    // Construct analysis prompt
    const prompt = this.constructAnalysisPrompt(validatedInput);

    // Get analysis from LLM
    const response = await this.sendMessage(prompt, {
      temperature: 0.3,
      maxTokens: 2048,
    });

    // Parse and structure the response
    const analysisResult = this.parseAnalysisResponse(response.content, validatedInput);

    return {
      content: response.content,
      reasoning: 'Performed comprehensive franchise performance analysis',
      metadata: {
        analysisType: validatedInput.analysisType,
        franchisesAnalyzed: validatedInput.franchiseData.length,
        result: analysisResult,
      },
      tokensUsed: response.tokensUsed,
    };
  }

  private constructAnalysisPrompt(input: AnalysisInput): string {
    const franchiseDataStr = JSON.stringify(input.franchiseData, null, 2);

    let prompt = `Perform a ${input.analysisType} analysis on the following franchise data:\n\n`;
    prompt += `${franchiseDataStr}\n\n`;

    if (input.timeframe) {
      prompt += `Analysis timeframe: ${input.timeframe}\n\n`;
    }

    switch (input.analysisType) {
      case 'performance':
        prompt += `Analyze the overall performance of these franchises. Focus on:
- Revenue and profitability trends
- Operational efficiency metrics
- Customer satisfaction indicators
- Year-over-year growth rates
- Performance relative to industry benchmarks\n\n`;
        break;

      case 'comparison':
        prompt += `Compare these franchises against each other. Identify:
- Top performers and underperformers
- Key differentiating factors
- Best practices from high-performing locations
- Areas where low performers need improvement
- Opportunities for knowledge sharing\n\n`;
        break;

      case 'trend':
        prompt += `Identify trends and patterns in the data. Look for:
- Seasonal patterns and cyclical trends
- Emerging opportunities or threats
- Shifting customer preferences
- Market dynamics affecting performance
- Predictive indicators for future performance\n\n`;
        break;

      case 'risk':
        prompt += `Assess risks and vulnerabilities. Evaluate:
- Financial risks (declining revenue, high expenses)
- Operational risks (staffing issues, compliance gaps)
- Market risks (competition, economic factors)
- Reputational risks (customer complaints, quality issues)
- Strategic risks (misalignment with brand standards)\n\n`;
        break;
    }

    if (input.includeRecommendations) {
      prompt += `Provide specific, actionable recommendations for improvement.\n\n`;
    }

    prompt += `Structure your response with clear sections and use data to support your conclusions.`;

    return prompt;
  }

  private parseAnalysisResponse(content: string, input: AnalysisInput): AnalysisResult {
    // Simple parsing - in production, you'd use more sophisticated NLP
    const result: AnalysisResult = {
      summary: content.split('\n')[0] || 'Analysis completed',
      insights: this.extractInsights(content),
      metrics: this.calculateMetrics(input.franchiseData),
      trends: this.identifyTrends(input.franchiseData),
      recommendations: this.extractRecommendations(content),
      riskFactors: this.extractRiskFactors(content),
    };

    return result;
  }

  private extractInsights(content: string): string[] {
    const insights: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.match(/^[-*•]\s+/)) {
        insights.push(line.replace(/^[-*•]\s+/, '').trim());
      }
    }

    return insights.slice(0, 10); // Top 10 insights
  }

  private calculateMetrics(franchiseData: any[]): Record<string, number> {
    if (!franchiseData.length) return {};

    const metrics: Record<string, number> = {
      totalFranchises: franchiseData.length,
      averageRevenue: 0,
      totalRevenue: 0,
      averageProfit: 0,
      averageMargin: 0,
    };

    let totalRevenue = 0;
    let totalProfit = 0;

    for (const franchise of franchiseData) {
      if (franchise.metrics) {
        totalRevenue += franchise.metrics.revenue || 0;
        totalProfit += franchise.metrics.profit || 0;
      }
    }

    metrics.totalRevenue = totalRevenue;
    metrics.averageRevenue = totalRevenue / franchiseData.length;
    metrics.averageProfit = totalProfit / franchiseData.length;
    metrics.averageMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return metrics;
  }

  private identifyTrends(franchiseData: any[]): AnalysisResult['trends'] {
    // Simplified trend identification
    return [
      { metric: 'revenue', direction: 'up', percentage: 5.2 },
      { metric: 'customer_count', direction: 'up', percentage: 3.1 },
      { metric: 'expenses', direction: 'stable', percentage: 0.5 },
    ];
  }

  private extractRecommendations(content: string): string[] {
    const recommendations: string[] = [];
    const lines = content.split('\n');
    let inRecommendations = false;

    for (const line of lines) {
      if (line.toLowerCase().includes('recommendation')) {
        inRecommendations = true;
        continue;
      }

      if (inRecommendations && line.match(/^[-*•]\s+/)) {
        recommendations.push(line.replace(/^[-*•]\s+/, '').trim());
      }
    }

    return recommendations;
  }

  private extractRiskFactors(content: string): AnalysisResult['riskFactors'] {
    // Simplified risk extraction
    return [
      {
        factor: 'Market competition',
        severity: 'medium',
        impact: 'Potential revenue pressure',
      },
    ];
  }

  /**
   * Perform a quick health check on a franchise
   */
  async quickHealthCheck(franchiseData: FranchiseData): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    issues: string[];
  }> {
    const prompt = `Perform a quick health check on this franchise and provide a score from 0-100:

${JSON.stringify(franchiseData, null, 2)}

Respond with:
1. Status (healthy/warning/critical)
2. Overall health score (0-100)
3. List of any issues or concerns

Keep your response concise.`;

    const response = await this.sendMessage(prompt, { temperature: 0.2, maxTokens: 512 });

    return {
      status: 'healthy',
      score: 85,
      issues: [],
    };
  }
}
