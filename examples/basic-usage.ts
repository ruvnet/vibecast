/**
 * Basic Usage Example
 * Demonstrates simple agent usage for franchise analysis
 */

import { initializeMultiAgentPlatform } from '../src';
import type { FranchiseData } from '../src/types';

async function main() {
  console.log('=== Basic Multi-Agent Platform Usage ===\n');

  // Initialize the platform
  const system = await initializeMultiAgentPlatform();

  // Sample franchise data
  const franchiseData: FranchiseData[] = [
    {
      franchiseId: 'FR-001',
      name: 'Downtown Coffee Shop',
      location: {
        address: '123 Main St',
        city: 'Boston',
        state: 'MA',
        zip: '02101',
      },
      metrics: {
        revenue: 750000,
        expenses: 550000,
        profit: 200000,
        customerCount: 25000,
        employeeCount: 12,
      },
      performance: {
        score: 85,
        rating: 4.5,
        complianceStatus: 'compliant',
      },
    },
    {
      franchiseId: 'FR-002',
      name: 'Waterfront Coffee Shop',
      location: {
        address: '456 Harbor Blvd',
        city: 'Boston',
        state: 'MA',
        zip: '02110',
      },
      metrics: {
        revenue: 650000,
        expenses: 480000,
        profit: 170000,
        customerCount: 20000,
        employeeCount: 10,
      },
      performance: {
        score: 78,
        rating: 4.2,
        complianceStatus: 'warning',
      },
    },
  ];

  // Example 1: Franchise Performance Analysis
  console.log('1. Analyzing franchise performance...');
  const analysisResult = await system.agents.franchiseAnalysis.processTask({
    id: 'analysis-1',
    type: 'performance-analysis',
    input: {
      franchiseData,
      analysisType: 'performance',
      timeframe: 'Q4 2024',
      includeRecommendations: true,
    },
    priority: 1,
    status: 'pending',
  });

  console.log('Analysis Complete:');
  console.log(analysisResult.content.substring(0, 500) + '...\n');

  // Example 2: Compliance Check
  console.log('2. Checking compliance status...');
  const complianceResult = await system.agents.compliance.processTask({
    id: 'compliance-1',
    type: 'compliance-check',
    input: {
      franchiseData,
      complianceType: 'operational',
      standards: ['Food Safety', 'Labor Laws', 'Brand Standards'],
    },
    priority: 1,
    status: 'pending',
  });

  console.log('Compliance Check Complete:');
  console.log(complianceResult.content.substring(0, 500) + '...\n');

  // Example 3: Generate Report
  console.log('3. Generating executive summary report...');
  const reportResult = await system.agents.reporting.processTask({
    id: 'report-1',
    type: 'executive-summary',
    input: {
      reportType: 'executive-summary',
      data: franchiseData,
      timeframe: 'Q4 2024',
      format: 'detailed',
      audience: 'executive',
      includeCharts: true,
    },
    priority: 1,
    status: 'pending',
  });

  console.log('Report Generated:');
  console.log(reportResult.content.substring(0, 500) + '...\n');

  // Example 4: Quick Health Check
  console.log('4. Running quick health check...');
  const healthCheck = await system.agents.franchiseAnalysis.quickHealthCheck(
    franchiseData[1]
  );

  console.log('Health Check Results:');
  console.log(`Status: ${healthCheck.status}`);
  console.log(`Score: ${healthCheck.score}/100`);
  console.log(`Critical Issues: ${healthCheck.criticalIssues}\n`);

  // Example 5: Territory Metrics
  console.log('5. Calculating territory metrics...');
  const territoryMetrics = system.agents.territory.calculateTerritoryMetrics({
    territoryId: 'T-001',
    name: 'Greater Boston Area',
    boundaries: {
      type: 'polygon',
      coordinates: [[]],
    },
    franchises: ['FR-001', 'FR-002'],
    population: 500000,
    demographics: {
      medianIncome: 75000,
      age18to65: 0.65,
    },
  });

  console.log('Territory Metrics:');
  console.log(JSON.stringify(territoryMetrics, null, 2));

  console.log('\n=== Example Complete ===');
}

// Run example
if (require.main === module) {
  main().catch(console.error);
}

export { main };
