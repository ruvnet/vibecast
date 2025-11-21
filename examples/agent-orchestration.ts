/**
 * Agent Orchestration example
 * Demonstrates distributed agent task execution
 */

import {
  PubNubService,
  AgentOrchestrator,
  AgentTask
} from '../src';

async function main() {
  console.log('=== Agent Orchestration Example ===\n');

  // Initialize PubNub
  const pubnub = new PubNubService({
    publishKey: 'demo',
    subscribeKey: 'demo',
    userId: 'orchestrator',
    logVerbosity: false,
  });

  // Create multiple agents
  console.log('🤖 Creating agents...');
  const dataAgent = new AgentOrchestrator(pubnub, 'data-processor');
  const analyzerAgent = new AgentOrchestrator(pubnub, 'analyzer');
  const reporterAgent = new AgentOrchestrator(pubnub, 'reporter');

  // Register task handlers for data processor
  dataAgent.registerTaskHandler('process_data', async (task: AgentTask) => {
    console.log(`   📊 Data agent processing: ${task.payload.dataType}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      processed: true,
      records: task.payload.count * 2,
      dataType: task.payload.dataType
    };
  });

  // Register task handlers for analyzer
  analyzerAgent.registerTaskHandler('analyze', async (task: AgentTask) => {
    console.log(`   🔍 Analyzer agent analyzing: ${task.payload.dataType}`);
    await new Promise(resolve => setTimeout(resolve, 1500));
    return {
      insights: [
        'Pattern A detected',
        'Anomaly in sector 7',
        'Trend: upward'
      ],
      confidence: 0.87
    };
  });

  // Register task handlers for reporter
  reporterAgent.registerTaskHandler('generate_report', async (task: AgentTask) => {
    console.log(`   📄 Reporter agent generating report`);
    await new Promise(resolve => setTimeout(resolve, 800));
    return {
      reportId: `RPT-${Date.now()}`,
      format: 'markdown',
      sections: ['summary', 'details', 'recommendations']
    };
  });

  // Wait for agents to initialize
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n✅ Agents ready!\n');
  console.log(`   ${dataAgent.getAgentId()}: ${dataAgent.getCapabilities().join(', ')}`);
  console.log(`   ${analyzerAgent.getAgentId()}: ${analyzerAgent.getCapabilities().join(', ')}`);
  console.log(`   ${reporterAgent.getAgentId()}: ${reporterAgent.getCapabilities().join(', ')}`);

  // Execute tasks
  console.log('\n📋 Assigning tasks...\n');

  // Task 1: Process data
  const task1Id = await dataAgent.assignTask(
    'process_data',
    { dataType: 'sensor_readings', count: 1000 },
    'data-processor'
  );

  // Task 2: Analyze data
  const task2Id = await analyzerAgent.assignTask(
    'analyze',
    { dataType: 'sensor_readings' },
    'analyzer'
  );

  // Task 3: Generate report
  const task3Id = await reporterAgent.assignTask(
    'generate_report',
    { type: 'weekly_summary' },
    'reporter'
  );

  // Wait for responses
  console.log('⏳ Waiting for task completion...\n');

  const [response1, response2, response3] = await Promise.all([
    dataAgent.waitForResponse(task1Id),
    analyzerAgent.waitForResponse(task2Id),
    reporterAgent.waitForResponse(task3Id),
  ]);

  // Display results
  console.log('📥 Results:\n');
  console.log('Task 1 (Data Processing):', response1.status);
  console.log('  Result:', response1.result);
  console.log();

  console.log('Task 2 (Analysis):', response2.status);
  console.log('  Result:', response2.result);
  console.log();

  console.log('Task 3 (Reporting):', response3.status);
  console.log('  Result:', response3.result);
  console.log();

  // Sequential task chain
  console.log('\n🔗 Executing sequential task chain...\n');

  const chainTask1 = await dataAgent.assignTask(
    'process_data',
    { dataType: 'user_events', count: 500 },
    'data-processor'
  );

  const chainResponse1 = await dataAgent.waitForResponse(chainTask1);
  console.log('✓ Step 1 complete:', chainResponse1.result);

  const chainTask2 = await analyzerAgent.assignTask(
    'analyze',
    { dataType: 'user_events', processedRecords: chainResponse1.result.records },
    'analyzer'
  );

  const chainResponse2 = await analyzerAgent.waitForResponse(chainTask2);
  console.log('✓ Step 2 complete:', chainResponse2.result);

  const chainTask3 = await reporterAgent.assignTask(
    'generate_report',
    {
      type: 'analysis_report',
      insights: chainResponse2.result.insights
    },
    'reporter'
  );

  const chainResponse3 = await reporterAgent.waitForResponse(chainTask3);
  console.log('✓ Step 3 complete:', chainResponse3.result);

  console.log('\n✅ Sequential chain completed!\n');

  // Cleanup
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('🔌 Disconnecting...');
  pubnub.disconnect();
  console.log('✅ Done!\n');
}

// Run example
main().catch(console.error);
