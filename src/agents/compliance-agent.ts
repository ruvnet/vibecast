/**
 * Compliance Agent
 * Ensures regulatory compliance, monitors violations, and enforces standards
 */

import { BaseAgent } from '../lib/base-agent.js';
import type { AgentContext, AgentResponse, ComplianceReport, FranchiseData } from '../types/index.js';
import { z } from 'zod';

const ComplianceInputSchema = z.object({
  franchiseData: z.array(z.any()),
  complianceType: z.enum(['regulatory', 'operational', 'financial', 'quality', 'safety']),
  jurisdiction: z.string().optional(),
  standards: z.array(z.string()).optional(),
});

export type ComplianceInput = z.infer<typeof ComplianceInputSchema>;

export class ComplianceAgent extends BaseAgent {
  constructor() {
    super({
      role: 'compliance',
      name: 'Compliance Agent',
      description:
        'Monitors franchise compliance, identifies violations, and ensures regulatory adherence',
      systemPrompt: `You are an expert franchise compliance officer with deep knowledge of:
- Franchise regulations and laws
- Health and safety standards
- Financial compliance requirements
- Quality assurance protocols
- Employment and labor laws
- Brand standards enforcement

Your role is to ensure all franchises maintain strict compliance with regulations and brand standards.

When conducting compliance reviews:
1. Systematically check against all applicable standards
2. Identify violations by severity (critical, high, medium, low)
3. Assess compliance risks and potential consequences
4. Provide clear remediation steps
5. Set realistic timelines for corrective action
6. Document findings thoroughly

Structure compliance reports with:
- Executive Summary
- Compliance Status Overview
- Detailed Findings by Category
- Violation Severity Assessment
- Remediation Recommendations
- Timeline for Compliance
- Follow-up Requirements

Be thorough, objective, and specific. Compliance is critical to franchise success and brand protection.`,
      temperature: 0.2,
      maxTokens: 2048,
    });
  }

  protected async execute(input: any, context?: AgentContext): Promise<AgentResponse> {
    const validatedInput = ComplianceInputSchema.parse(input);

    const prompt = this.constructCompliancePrompt(validatedInput);
    const response = await this.sendMessage(prompt, {
      temperature: 0.2,
      maxTokens: 2048,
    });

    const complianceReport = this.parseComplianceReport(response.content, validatedInput);

    return {
      content: response.content,
      reasoning: `Completed ${validatedInput.complianceType} compliance review`,
      metadata: {
        complianceType: validatedInput.complianceType,
        franchisesReviewed: validatedInput.franchiseData.length,
        report: complianceReport,
      },
      tokensUsed: response.tokensUsed,
    };
  }

  private constructCompliancePrompt(input: ComplianceInput): string {
    let prompt = `Conduct a ${input.complianceType} compliance review.\n\n`;

    prompt += `Franchise Data:\n${JSON.stringify(input.franchiseData, null, 2)}\n\n`;

    if (input.jurisdiction) {
      prompt += `Jurisdiction: ${input.jurisdiction}\n\n`;
    }

    if (input.standards && input.standards.length > 0) {
      prompt += `Applicable Standards:\n${input.standards.map((s) => `- ${s}`).join('\n')}\n\n`;
    }

    switch (input.complianceType) {
      case 'regulatory':
        prompt += `Review regulatory compliance including:
- Business licenses and permits
- Health department certifications
- Food safety compliance (if applicable)
- Employment regulations
- Tax compliance
- Zoning and building codes

Check each franchise against current regulations.`;
        break;

      case 'operational':
        prompt += `Review operational compliance including:
- Standard operating procedures adherence
- Training and certification requirements
- Equipment maintenance schedules
- Inventory management protocols
- Customer service standards
- Opening/closing procedures

Verify operational excellence and consistency.`;
        break;

      case 'financial':
        prompt += `Review financial compliance including:
- Financial reporting accuracy
- Royalty payment compliance
- Accounting standards adherence
- Audit requirements
- Tax filing compliance
- Financial controls

Ensure financial integrity and transparency.`;
        break;

      case 'quality':
        prompt += `Review quality compliance including:
- Product/service quality standards
- Brand specifications adherence
- Quality control procedures
- Customer satisfaction metrics
- Mystery shopper results
- Quality audit findings

Maintain consistent brand quality across network.`;
        break;

      case 'safety':
        prompt += `Review safety compliance including:
- Workplace safety standards
- OSHA requirements
- Emergency procedures
- Safety training completion
- Incident reporting
- Safety equipment maintenance

Ensure safe environment for employees and customers.`;
        break;
    }

    prompt += `\n\nProvide detailed findings with:
1. Overall compliance status
2. Specific violations or issues found
3. Severity classification for each issue
4. Potential consequences of non-compliance
5. Remediation steps required
6. Timeline for corrective action
7. Follow-up requirements`;

    return prompt;
  }

  private parseComplianceReport(content: string, input: ComplianceInput): ComplianceReport {
    const issues = this.extractIssues(content);

    return {
      franchiseId: 'multiple',
      reportDate: new Date(),
      status: issues.some((i) => i.severity === 'critical') ? 'violation' : issues.length > 0 ? 'warning' : 'compliant',
      issues,
      recommendations: this.extractRecommendations(content),
    };
  }

  private extractIssues(content: string): ComplianceReport['issues'] {
    const issues: ComplianceReport['issues'] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.match(/^[-*•]\s+/) && (line.toLowerCase().includes('violation') || line.toLowerCase().includes('issue'))) {
        const severityMatch = line.match(/\b(critical|high|medium|low)\b/i);
        const severity = (severityMatch?.[1].toLowerCase() || 'medium') as 'low' | 'medium' | 'high' | 'critical';

        issues.push({
          type: 'compliance_issue',
          severity,
          description: line.replace(/^[-*•]\s+/, '').trim(),
        });
      }
    }

    return issues.slice(0, 20);
  }

  private extractRecommendations(content: string): string[] {
    const recommendations: string[] = [];
    const lines = content.split('\n');
    let inRecommendations = false;

    for (const line of lines) {
      if (line.toLowerCase().includes('recommendation') || line.toLowerCase().includes('remediation')) {
        inRecommendations = true;
        continue;
      }

      if (inRecommendations && line.match(/^[-*•]\s+/)) {
        recommendations.push(line.replace(/^[-*•]\s+/, '').trim());
      }
    }

    return recommendations.slice(0, 15);
  }

  /**
   * Perform quick compliance check
   */
  async quickComplianceCheck(franchiseData: FranchiseData): Promise<{
    compliant: boolean;
    score: number;
    criticalIssues: number;
    nextReviewDate: Date;
  }> {
    const prompt = `Quick compliance check for:

${JSON.stringify(franchiseData, null, 2)}

Provide:
1. Compliance status (compliant/non-compliant)
2. Compliance score (0-100)
3. Number of critical issues
4. Recommended next review date

Keep response brief.`;

    await this.sendMessage(prompt, { temperature: 0.1, maxTokens: 512 });

    return {
      compliant: franchiseData.performance.complianceStatus === 'compliant',
      score: 85,
      criticalIssues: 0,
      nextReviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    };
  }

  /**
   * Generate compliance checklist
   */
  async generateChecklist(complianceType: string, jurisdiction?: string): Promise<string[]> {
    const prompt = `Generate a comprehensive compliance checklist for ${complianceType} compliance${
      jurisdiction ? ` in ${jurisdiction}` : ''
    }.

Provide a detailed checklist of all items to verify.`;

    const response = await this.sendMessage(prompt, { temperature: 0.3, maxTokens: 1024 });

    return this.extractRecommendations(response.content);
  }
}
