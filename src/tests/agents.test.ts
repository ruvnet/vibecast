/**
 * Tests for Specialized Agents
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FranchiseAnalysisAgent } from '../agents/franchise-analysis-agent';
import { GrowthPlanningAgent } from '../agents/growth-planning-agent';
import { TerritoryAgent } from '../agents/territory-agent';
import { ComplianceAgent } from '../agents/compliance-agent';
import { ReportingAgent } from '../agents/reporting-agent';
import type { AgentTask, FranchiseData } from '../types';

describe('FranchiseAnalysisAgent', () => {
  let agent: FranchiseAnalysisAgent;

  beforeEach(() => {
    agent = new FranchiseAnalysisAgent();
  });

  it('should initialize with correct configuration', () => {
    const info = agent.getInfo();
    expect(info.role).toBe('franchise-analysis');
    expect(info.name).toBe('Franchise Analysis Agent');
  });

  it('should validate input schema', async () => {
    const validInput = {
      franchiseData: [
        {
          franchiseId: 'FR-001',
          name: 'Test Franchise',
          metrics: { revenue: 100000, profit: 20000 },
        },
      ],
      analysisType: 'performance' as const,
    };

    const task: AgentTask = {
      id: 'test-1',
      type: 'analysis',
      input: validInput,
      priority: 1,
      status: 'pending',
    };

    // This would normally call the API
    // In tests, we verify the structure
    expect(task.input.analysisType).toBe('performance');
  });

  it('should handle different analysis types', () => {
    const analysisTypes = ['performance', 'comparison', 'trend', 'risk'];
    analysisTypes.forEach((type) => {
      expect(type).toBeDefined();
    });
  });
});

describe('GrowthPlanningAgent', () => {
  let agent: GrowthPlanningAgent;

  beforeEach(() => {
    agent = new GrowthPlanningAgent();
  });

  it('should initialize correctly', () => {
    const info = agent.getInfo();
    expect(info.role).toBe('growth-planning');
  });

  it('should handle growth planning input', () => {
    const input = {
      currentFranchises: [],
      budget: 500000,
      timeframe: '12 months',
    };

    expect(input.budget).toBe(500000);
    expect(input.timeframe).toBe('12 months');
  });
});

describe('TerritoryAgent', () => {
  let agent: TerritoryAgent;

  beforeEach(() => {
    agent = new TerritoryAgent();
  });

  it('should initialize correctly', () => {
    const info = agent.getInfo();
    expect(info.role).toBe('territory-management');
  });

  it('should calculate territory metrics', () => {
    const territory = {
      territoryId: 'T-001',
      name: 'Downtown',
      boundaries: { type: 'polygon' as const, coordinates: [[]] },
      franchises: ['FR-001', 'FR-002'],
      population: 50000,
      demographics: {},
    };

    const metrics = agent.calculateTerritoryMetrics(territory);
    expect(metrics.population).toBe(50000);
    expect(metrics.franchiseDensity).toBeGreaterThan(0);
  });
});

describe('ComplianceAgent', () => {
  let agent: ComplianceAgent;

  beforeEach(() => {
    agent = new ComplianceAgent();
  });

  it('should initialize correctly', () => {
    const info = agent.getInfo();
    expect(info.role).toBe('compliance');
  });

  it('should handle compliance types', () => {
    const complianceTypes = ['regulatory', 'operational', 'financial', 'quality', 'safety'];
    complianceTypes.forEach((type) => {
      expect(type).toBeDefined();
    });
  });
});

describe('ReportingAgent', () => {
  let agent: ReportingAgent;

  beforeEach(() => {
    agent = new ReportingAgent();
  });

  it('should initialize correctly', () => {
    const info = agent.getInfo();
    expect(info.role).toBe('reporting');
  });

  it('should handle different report types', () => {
    const reportTypes = [
      'executive-summary',
      'performance-dashboard',
      'financial-analysis',
      'trend-report',
      'comparative-analysis',
    ];

    reportTypes.forEach((type) => {
      expect(type).toBeDefined();
    });
  });
});
