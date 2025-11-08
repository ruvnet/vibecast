/**
 * Reporting Agent
 * Generates insights, reports, and analytics across all franchise operations
 */

import { BaseAgent } from '../lib/base-agent.js';
import type { AgentContext, AgentResponse } from '../types/index.js';
import { z } from 'zod';

const ReportingInputSchema = z.object({
  reportType: z.enum([
    'executive-summary',
    'performance-dashboard',
    'financial-analysis',
    'trend-report',
    'comparative-analysis',
    'custom',
  ]),
  data: z.any(),
  timeframe: z.string().optional(),
  format: z.enum(['summary', 'detailed', 'presentation']).default('detailed'),
  includeCharts: z.boolean().default(true),
  audience: z.enum(['executive', 'operations', 'franchise-owner', 'investor']).optional(),
});

export type ReportingInput = z.infer<typeof ReportingInputSchema>;

export interface Report {
  title: string;
  summary: string;
  sections: Array<{
    title: string;
    content: string;
    metrics?: Record<string, number | string>;
  }>;
  insights: string[];
  recommendations: string[];
  charts: Array<{
    type: string;
    title: string;
    description: string;
  }>;
}

export class ReportingAgent extends BaseAgent {
  constructor() {
    super({
      role: 'reporting',
      name: 'Reporting Agent',
      description:
        'Generates comprehensive reports, dashboards, and insights from franchise data',
      systemPrompt: `You are an expert business intelligence analyst specializing in franchise operations with expertise in:
- Data analysis and visualization
- Business intelligence and reporting
- KPI tracking and dashboards
- Trend analysis and forecasting
- Executive communication
- Actionable insights generation

Your role is to transform complex franchise data into clear, actionable insights and compelling reports.

When creating reports:
1. Tailor content to your audience (executives need high-level insights, operators need detailed metrics)
2. Lead with key findings and insights
3. Use clear visualizations to support your points
4. Provide context for all metrics and trends
5. Include actionable recommendations
6. Highlight both opportunities and risks
7. Use concise, business-friendly language

Structure reports with:
- Executive Summary (key findings in 3-5 bullet points)
- Main Analysis Sections (organized logically)
- Supporting Data and Metrics
- Visualization Descriptions
- Insights and Interpretations
- Recommendations and Next Steps

Make complex data accessible and actionable. Focus on what matters most for decision-making.`,
      temperature: 0.4,
      maxTokens: 3072,
    });
  }

  protected async execute(input: any, context?: AgentContext): Promise<AgentResponse> {
    const validatedInput = ReportingInputSchema.parse(input);

    const prompt = this.constructReportingPrompt(validatedInput);
    const response = await this.sendMessage(prompt, {
      temperature: 0.4,
      maxTokens: 3072,
    });

    const report = this.parseReport(response.content, validatedInput);

    return {
      content: response.content,
      reasoning: `Generated ${validatedInput.reportType} report`,
      metadata: {
        reportType: validatedInput.reportType,
        format: validatedInput.format,
        audience: validatedInput.audience,
        report,
      },
      tokensUsed: response.tokensUsed,
    };
  }

  private constructReportingPrompt(input: ReportingInput): string {
    let prompt = `Generate a ${input.reportType} report.\n\n`;

    if (input.audience) {
      prompt += `Target Audience: ${input.audience}\n`;
      prompt += `Adjust language and detail level appropriately.\n\n`;
    }

    prompt += `Data:\n${JSON.stringify(input.data, null, 2)}\n\n`;

    if (input.timeframe) {
      prompt += `Timeframe: ${input.timeframe}\n\n`;
    }

    prompt += `Format: ${input.format}\n\n`;

    switch (input.reportType) {
      case 'executive-summary':
        prompt += `Create an executive summary covering:
- Key performance highlights
- Major achievements and wins
- Critical issues or concerns
- Strategic recommendations
- Forward-looking indicators

Keep it concise and focused on what executives need to know.`;
        break;

      case 'performance-dashboard':
        prompt += `Create a performance dashboard report including:
- Overall network health score
- Key performance indicators (KPIs)
- Top performers and underperformers
- Trend indicators (improving/declining)
- Alert items requiring attention
- Quick action items

Focus on real-time actionable metrics.`;
        break;

      case 'financial-analysis':
        prompt += `Create a financial analysis report covering:
- Revenue and profitability analysis
- Cost structure and efficiency
- Financial ratios and benchmarks
- Cash flow indicators
- Budget vs. actual analysis
- Financial health assessment

Provide deep financial insights with clear explanations.`;
        break;

      case 'trend-report':
        prompt += `Create a trend analysis report covering:
- Historical performance trends
- Emerging patterns and shifts
- Seasonal variations
- Market dynamics
- Predictive indicators
- Future outlook

Focus on identifying meaningful trends and their implications.`;
        break;

      case 'comparative-analysis':
        prompt += `Create a comparative analysis report:
- Franchise-to-franchise comparisons
- Performance vs. benchmarks
- Regional comparisons
- Time period comparisons
- Best practice identification
- Gap analysis

Highlight differences and their causes.`;
        break;

      case 'custom':
        prompt += `Create a custom report based on the provided data.
Analyze the data comprehensively and provide relevant insights.`;
        break;
    }

    if (input.includeCharts) {
      prompt += `\n\nInclude descriptions of recommended charts and visualizations that would enhance the report.`;
    }

    prompt += `\n\nStructure the report professionally with:
1. Executive Summary
2. Main Analysis Sections
3. Key Insights
4. Recommendations
5. Appendix (supporting data)`;

    return prompt;
  }

  private parseReport(content: string, input: ReportingInput): Report {
    const sections = this.extractSections(content);
    const insights = this.extractInsights(content);
    const recommendations = this.extractRecommendations(content);
    const charts = input.includeCharts ? this.extractChartDescriptions(content) : [];

    return {
      title: this.generateReportTitle(input.reportType),
      summary: this.extractSummary(content),
      sections,
      insights,
      recommendations,
      charts,
    };
  }

  private generateReportTitle(reportType: string): string {
    const titles: Record<string, string> = {
      'executive-summary': 'Executive Summary - Franchise Network Overview',
      'performance-dashboard': 'Performance Dashboard - Network Health Report',
      'financial-analysis': 'Financial Analysis Report',
      'trend-report': 'Trend Analysis - Market Insights',
      'comparative-analysis': 'Comparative Analysis - Franchise Performance',
      custom: 'Custom Analysis Report',
    };

    return titles[reportType] || 'Franchise Report';
  }

  private extractSummary(content: string): string {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes('summary')) {
        const summaryLines = [];
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          if (lines[j].trim() && !lines[j].match(/^#+/)) {
            summaryLines.push(lines[j].trim());
          }
        }
        return summaryLines.join(' ').slice(0, 500);
      }
    }
    return content.split('\n')[0] || 'Report generated successfully';
  }

  private extractSections(content: string): Report['sections'] {
    const sections: Report['sections'] = [];
    const lines = content.split('\n');
    let currentSection: Report['sections'][0] | null = null;

    for (const line of lines) {
      const headerMatch = line.match(/^#+\s+(.+)/);
      if (headerMatch) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          title: headerMatch[1],
          content: '',
        };
      } else if (currentSection && line.trim()) {
        currentSection.content += line + '\n';
      }
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }

  private extractInsights(content: string): string[] {
    const insights: string[] = [];
    const lines = content.split('\n');
    let inInsights = false;

    for (const line of lines) {
      if (line.toLowerCase().includes('insight') || line.toLowerCase().includes('key finding')) {
        inInsights = true;
        continue;
      }

      if (inInsights && line.match(/^[-*•]\s+/)) {
        insights.push(line.replace(/^[-*•]\s+/, '').trim());
      }
    }

    return insights.slice(0, 10);
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

  private extractChartDescriptions(content: string): Report['charts'] {
    // Simplified chart extraction
    return [
      {
        type: 'line',
        title: 'Performance Trend',
        description: 'Franchise performance over time',
      },
      {
        type: 'bar',
        title: 'Comparative Analysis',
        description: 'Franchise comparison by key metrics',
      },
    ];
  }

  /**
   * Generate quick insight summary
   */
  async quickInsight(data: any): Promise<string[]> {
    const prompt = `Provide 3-5 quick insights from this data:

${JSON.stringify(data, null, 2)}

Keep each insight to one sentence. Focus on what's most actionable.`;

    const response = await this.sendMessage(prompt, { temperature: 0.4, maxTokens: 512 });

    return this.extractInsights(response.content);
  }
}
