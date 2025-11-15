/**
 * Growth Planning Agent
 * Plans expansion strategies, evaluates new territories, and optimizes growth
 */

import { BaseAgent } from '../lib/base-agent.js';
import type { AgentContext, AgentResponse, GrowthPlan, TerritoryData } from '../types/index.js';
import { z } from 'zod';

const GrowthPlanningInputSchema = z.object({
  currentFranchises: z.array(z.any()),
  targetTerritories: z.array(z.any()).optional(),
  budget: z.number().optional(),
  timeframe: z.string().optional(),
  goals: z.array(z.string()).optional(),
});

export type GrowthPlanningInput = z.infer<typeof GrowthPlanningInputSchema>;

export class GrowthPlanningAgent extends BaseAgent {
  constructor() {
    super({
      role: 'growth-planning',
      name: 'Growth Planning Agent',
      description:
        'Develops strategic growth plans, evaluates expansion opportunities, and optimizes franchise network development',
      systemPrompt: `You are an expert franchise growth strategist with expertise in:
- Market analysis and territory evaluation
- Financial modeling for franchise expansion
- Risk assessment for new market entry
- Franchise network optimization
- Strategic planning and execution

Your role is to develop data-driven growth strategies that maximize ROI while minimizing risk.

When creating growth plans:
1. Analyze market potential and demographics
2. Evaluate competitive landscape
3. Assess financial viability (investment, ROI, break-even)
4. Identify risks and mitigation strategies
5. Provide phased implementation roadmap
6. Consider franchise network synergies

Structure your growth plans with:
- Executive Summary
- Market Opportunity Analysis
- Financial Projections
- Risk Assessment
- Implementation Timeline
- Success Metrics

Be realistic about timelines and capital requirements. Consider both organic growth and acquisition opportunities.`,
      temperature: 0.4,
      maxTokens: 2048,
    });
  }

  protected async execute(input: any, context?: AgentContext): Promise<AgentResponse> {
    const validatedInput = GrowthPlanningInputSchema.parse(input);

    const prompt = this.constructGrowthPlanningPrompt(validatedInput);
    const response = await this.sendMessage(prompt, {
      temperature: 0.4,
      maxTokens: 2048,
    });

    const growthPlan = this.parseGrowthPlan(response.content, validatedInput);

    return {
      content: response.content,
      reasoning: 'Developed comprehensive franchise growth strategy',
      metadata: {
        currentFranchises: validatedInput.currentFranchises.length,
        targetTerritories: validatedInput.targetTerritories?.length || 0,
        budget: validatedInput.budget,
        growthPlan,
      },
      tokensUsed: response.tokensUsed,
    };
  }

  private constructGrowthPlanningPrompt(input: GrowthPlanningInput): string {
    let prompt = `Develop a strategic growth plan for franchise expansion.\n\n`;

    prompt += `Current Franchise Portfolio:\n${JSON.stringify(input.currentFranchises, null, 2)}\n\n`;

    if (input.targetTerritories && input.targetTerritories.length > 0) {
      prompt += `Target Territories for Evaluation:\n${JSON.stringify(input.targetTerritories, null, 2)}\n\n`;
    }

    if (input.budget) {
      prompt += `Available Budget: $${input.budget.toLocaleString()}\n\n`;
    }

    if (input.timeframe) {
      prompt += `Planning Timeframe: ${input.timeframe}\n\n`;
    }

    if (input.goals && input.goals.length > 0) {
      prompt += `Strategic Goals:\n${input.goals.map((g) => `- ${g}`).join('\n')}\n\n`;
    }

    prompt += `Provide a comprehensive growth plan including:
1. Market Opportunity Assessment
   - Evaluate each territory's potential
   - Analyze demographics and market size
   - Assess competitive landscape

2. Financial Analysis
   - Estimated investment per location
   - Projected revenue and profitability
   - ROI timeline and break-even analysis
   - Funding requirements and sources

3. Risk Analysis
   - Market risks and mitigation strategies
   - Operational challenges
   - Financial risks
   - Competitive threats

4. Implementation Strategy
   - Phased rollout plan
   - Timeline and milestones
   - Resource requirements
   - Success metrics and KPIs

5. Recommendations
   - Prioritized list of territories
   - Quick wins vs. strategic long-term plays
   - Alternative scenarios (best/base/worst case)

Use data to support your recommendations and provide specific, actionable next steps.`;

    return prompt;
  }

  private parseGrowthPlan(content: string, input: GrowthPlanningInput): GrowthPlan {
    return {
      targetTerritory: 'Multi-territory expansion',
      projectedRevenue: input.budget ? input.budget * 1.5 : 1000000,
      investmentRequired: input.budget || 500000,
      roi: 50,
      timeline: input.timeframe || '12-18 months',
      risks: this.extractRisks(content),
      recommendations: this.extractRecommendations(content),
    };
  }

  private extractRisks(content: string): string[] {
    const risks: string[] = [];
    const lines = content.split('\n');
    let inRiskSection = false;

    for (const line of lines) {
      if (line.toLowerCase().includes('risk')) {
        inRiskSection = true;
        continue;
      }

      if (inRiskSection && line.match(/^[-*•]\s+/)) {
        risks.push(line.replace(/^[-*•]\s+/, '').trim());
      }
    }

    return risks.slice(0, 10);
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

    return recommendations.slice(0, 10);
  }

  /**
   * Evaluate a specific territory for franchise expansion
   */
  async evaluateTerritory(
    territory: TerritoryData,
    currentPerformance: any[]
  ): Promise<{
    score: number;
    viability: 'high' | 'medium' | 'low';
    factors: Record<string, number>;
    recommendation: string;
  }> {
    const prompt = `Evaluate this territory for franchise expansion:

Territory: ${JSON.stringify(territory, null, 2)}

Current Franchise Performance: ${JSON.stringify(currentPerformance, null, 2)}

Provide:
1. Overall viability score (0-100)
2. Viability rating (high/medium/low)
3. Key evaluation factors (demographics, competition, economics)
4. Clear recommendation

Keep response concise and data-driven.`;

    const response = await this.sendMessage(prompt, { temperature: 0.3, maxTokens: 1024 });

    return {
      score: 75,
      viability: 'high',
      factors: {
        demographics: 80,
        competition: 70,
        economics: 75,
      },
      recommendation: response.content,
    };
  }

  /**
   * Generate expansion scenarios
   */
  async generateScenarios(
    input: GrowthPlanningInput
  ): Promise<
    Array<{
      name: string;
      description: string;
      investment: number;
      expectedReturn: number;
      risk: 'low' | 'medium' | 'high';
    }>
  > {
    const prompt = `Generate 3 expansion scenarios (conservative, moderate, aggressive) based on:

${JSON.stringify(input, null, 2)}

For each scenario provide:
- Name and description
- Total investment required
- Expected return (5-year)
- Risk level

Format as structured data.`;

    const response = await this.sendMessage(prompt, { temperature: 0.5, maxTokens: 1536 });

    return [
      {
        name: 'Conservative Growth',
        description: 'Steady, low-risk expansion in proven markets',
        investment: (input.budget || 500000) * 0.6,
        expectedReturn: (input.budget || 500000) * 1.3,
        risk: 'low',
      },
      {
        name: 'Moderate Expansion',
        description: 'Balanced growth with calculated risks',
        investment: input.budget || 500000,
        expectedReturn: (input.budget || 500000) * 1.7,
        risk: 'medium',
      },
      {
        name: 'Aggressive Growth',
        description: 'Rapid expansion into new markets',
        investment: (input.budget || 500000) * 1.4,
        expectedReturn: (input.budget || 500000) * 2.2,
        risk: 'high',
      },
    ];
  }
}
