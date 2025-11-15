/**
 * Agent Swarm Example
 * Demonstrates multi-agent coordination and orchestration
 */

import { createFranchiseSwarm } from '../src/orchestration';
import type { SwarmTask, FranchiseData } from '../src/types';

async function main() {
  console.log('=== Agent Swarm Orchestration Example ===\n');

  // Create the swarm
  const swarm = createFranchiseSwarm();

  console.log('Agents in swarm:', swarm.listAgents().map((a) => a.role));
  console.log('');

  // Sample data
  const franchiseData: FranchiseData[] = [
    {
      franchiseId: 'FR-001',
      name: 'Location Alpha',
      location: {
        address: '100 Tech Blvd',
        city: 'San Francisco',
        state: 'CA',
        zip: '94102',
      },
      metrics: {
        revenue: 1200000,
        expenses: 850000,
        profit: 350000,
        customerCount: 35000,
        employeeCount: 18,
      },
      performance: {
        score: 92,
        rating: 4.7,
        complianceStatus: 'compliant',
      },
    },
    {
      franchiseId: 'FR-002',
      name: 'Location Beta',
      location: {
        address: '200 Market St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94103',
      },
      metrics: {
        revenue: 980000,
        expenses: 720000,
        profit: 260000,
        customerCount: 28000,
        employeeCount: 15,
      },
      performance: {
        score: 88,
        rating: 4.5,
        complianceStatus: 'compliant',
      },
    },
  ];

  // Example 1: Sequential Execution
  console.log('1. Sequential Analysis Pipeline...');
  const sequentialTask: SwarmTask = {
    id: 'seq-analysis',
    name: 'Sequential Analysis',
    agents: ['franchise-analysis', 'compliance', 'reporting'],
    coordination: 'sequential',
    input: {
      franchiseData,
      analysisType: 'performance',
      complianceType: 'operational',
      reportType: 'executive-summary',
    },
  };

  const sequentialResult = await swarm.executeSwarmTask(sequentialTask);
  console.log(`Completed in ${Date.now() - sequentialResult.startTime.getTime()}ms`);
  console.log(`Agents executed: ${sequentialResult.results.size}`);
  console.log('');

  // Example 2: Parallel Execution
  console.log('2. Parallel Multi-Analysis...');
  const parallelTask: SwarmTask = {
    id: 'parallel-analysis',
    name: 'Parallel Analysis',
    agents: ['franchise-analysis', 'territory-management', 'compliance'],
    coordination: 'parallel',
    input: {
      franchiseData,
      territories: [
        {
          territoryId: 'T-SF',
          name: 'San Francisco',
          population: 900000,
          franchises: ['FR-001', 'FR-002'],
        },
      ],
    },
  };

  const parallelResult = await swarm.executeSwarmTask(parallelTask);
  console.log(`Completed in ${Date.now() - parallelResult.startTime.getTime()}ms`);
  console.log(`Agents executed in parallel: ${parallelResult.results.size}`);
  console.log('');

  // Example 3: Conditional Execution
  console.log('3. Conditional Workflow...');
  const conditionalTask: SwarmTask = {
    id: 'conditional-flow',
    name: 'Conditional Growth Planning',
    agents: ['franchise-analysis', 'growth-planning'],
    coordination: 'conditional',
    input: {
      franchiseData,
      budget: 2000000,
      timeframe: '24 months',
    },
    condition: (results) => {
      // Execute growth planning only if analysis shows strong performance
      const analysisResult = results.get('franchise-analysis');
      if (!analysisResult?.metadata?.result) return true;

      const metrics = analysisResult.metadata.result.metrics;
      return metrics.averageMargin > 20; // 20% margin threshold
    },
  };

  const conditionalResult = await swarm.executeSwarmTask(conditionalTask);
  console.log(`Completed with ${conditionalResult.results.size} agents`);
  console.log('Agents executed:', Array.from(conditionalResult.results.keys()));
  console.log('');

  // Example 4: Message Passing
  console.log('4. Inter-Agent Communication...');
  const messageResponse = await swarm.sendMessage(
    'franchise-analysis',
    'growth-planning',
    {
      analysisResults: {
        topPerformers: ['FR-001'],
        growthOpportunity: true,
        recommendedBudget: 1500000,
      },
    }
  );

  console.log('Message sent and response received');
  console.log(`Response length: ${messageResponse.content.length} chars`);
  console.log('');

  // Example 5: Queue Status Monitoring
  console.log('5. Queue Status:');
  const queueStatus = swarm.getQueueStatus();
  console.log(JSON.stringify(queueStatus, null, 2));
  console.log('');

  // Cleanup
  await swarm.shutdown();
  console.log('=== Example Complete ===');
}

// Run example
if (require.main === module) {
  main().catch(console.error);
}

export { main };
