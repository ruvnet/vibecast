/**
 * Territory Agent
 * Manages territory allocation, boundaries, and geographic optimization
 */

import { BaseAgent } from '../lib/base-agent.js';
import type { AgentContext, AgentResponse, TerritoryData } from '../types/index.js';
import { z } from 'zod';

const TerritoryInputSchema = z.object({
  territories: z.array(z.any()),
  franchises: z.array(z.any()),
  action: z.enum(['allocate', 'optimize', 'analyze', 'rebalance']),
  constraints: z
    .object({
      minPopulation: z.number().optional(),
      maxDistance: z.number().optional(),
      allowOverlap: z.boolean().optional(),
    })
    .optional(),
});

export type TerritoryInput = z.infer<typeof TerritoryInputSchema>;

export class TerritoryAgent extends BaseAgent {
  constructor() {
    super({
      role: 'territory-management',
      name: 'Territory Management Agent',
      description:
        'Manages franchise territories, optimizes geographic allocation, and resolves boundary conflicts',
      systemPrompt: `You are an expert in franchise territory management with expertise in:
- Geographic information systems (GIS)
- Territory optimization and allocation
- Market segmentation by geography
- Franchise cannibalization prevention
- Demographic and spatial analysis

Your role is to ensure optimal territory allocation that maximizes market coverage while preventing franchise conflicts.

When managing territories:
1. Analyze demographic and economic data
2. Consider travel patterns and accessibility
3. Prevent territory overlap and cannibalization
4. Balance market potential across franchises
5. Account for natural geographic boundaries
6. Consider population density and growth trends

Provide recommendations that:
- Maximize market coverage
- Ensure fair territory allocation
- Minimize franchise conflicts
- Support sustainable growth
- Consider operational logistics

Use geospatial reasoning and data-driven analysis to support your recommendations.`,
      temperature: 0.3,
      maxTokens: 2048,
    });
  }

  protected async execute(input: any, context?: AgentContext): Promise<AgentResponse> {
    const validatedInput = TerritoryInputSchema.parse(input);

    const prompt = this.constructTerritoryPrompt(validatedInput);
    const response = await this.sendMessage(prompt, {
      temperature: 0.3,
      maxTokens: 2048,
    });

    return {
      content: response.content,
      reasoning: `Territory ${validatedInput.action} completed`,
      metadata: {
        action: validatedInput.action,
        territoriesProcessed: validatedInput.territories.length,
        franchisesAffected: validatedInput.franchises.length,
      },
      tokensUsed: response.tokensUsed,
    };
  }

  private constructTerritoryPrompt(input: TerritoryInput): string {
    let prompt = `Perform territory ${input.action} for franchise network.\n\n`;

    prompt += `Territories:\n${JSON.stringify(input.territories, null, 2)}\n\n`;
    prompt += `Franchises:\n${JSON.stringify(input.franchises, null, 2)}\n\n`;

    if (input.constraints) {
      prompt += `Constraints:\n${JSON.stringify(input.constraints, null, 2)}\n\n`;
    }

    switch (input.action) {
      case 'allocate':
        prompt += `Allocate territories to franchises considering:
- Market potential and demographics
- Geographic accessibility
- Preventing cannibalization
- Fair distribution of opportunity
- Operational feasibility

Provide specific territory assignments with justifications.`;
        break;

      case 'optimize':
        prompt += `Optimize current territory allocation to:
- Maximize market coverage
- Improve efficiency
- Resolve conflicts or overlaps
- Balance workload
- Enhance growth potential

Provide specific optimization recommendations with expected impact.`;
        break;

      case 'analyze':
        prompt += `Analyze current territory structure for:
- Coverage gaps and overlaps
- Market potential distribution
- Franchise density
- Growth opportunities
- Conflict areas

Provide detailed analysis with metrics and visualizations descriptions.`;
        break;

      case 'rebalance':
        prompt += `Rebalance territories to:
- Address performance imbalances
- Accommodate new franchises
- Adjust for demographic changes
- Resolve franchise conflicts
- Improve overall network efficiency

Provide rebalancing plan with step-by-step implementation.`;
        break;
    }

    return prompt;
  }

  /**
   * Check for territory conflicts
   */
  async checkConflicts(territories: TerritoryData[]): Promise<
    Array<{
      territory1: string;
      territory2: string;
      conflictType: string;
      severity: 'low' | 'medium' | 'high';
      resolution: string;
    }>
  > {
    const prompt = `Check for conflicts between these territories:

${JSON.stringify(territories, null, 2)}

Identify:
- Geographic overlaps
- Market cannibalization risks
- Boundary disputes
- Resource conflicts

For each conflict, provide severity and recommended resolution.`;

    await this.sendMessage(prompt, { temperature: 0.2, maxTokens: 1024 });

    return [];
  }

  /**
   * Calculate territory metrics
   */
  calculateTerritoryMetrics(territory: TerritoryData): {
    area: number;
    population: number;
    populationDensity: number;
    franchiseDensity: number;
    marketPotential: number;
  } {
    return {
      area: 100, // sq km
      population: territory.population,
      populationDensity: territory.population / 100,
      franchiseDensity: territory.franchises.length / 100,
      marketPotential: territory.population * 50, // simplified calculation
    };
  }
}
