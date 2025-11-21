/**
 * Flow-Nexus Integration example
 * Demonstrates workflow orchestration patterns
 */

import {
  PubNubService,
  FlowNexusIntegration,
  FlowStep
} from '../src';

async function main() {
  console.log('=== Flow-Nexus Integration Example ===\n');

  // Initialize PubNub
  const pubnub = new PubNubService({
    publishKey: 'demo',
    subscribeKey: 'demo',
    userId: 'flow-orchestrator',
    logVerbosity: false,
  });

  // Initialize Flow-Nexus
  const flowNexus = new FlowNexusIntegration(pubnub);

  // Wait for connection
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Example 1: Simple Sequential Flow
  console.log('🌊 Creating Simple Sequential Flow...\n');

  const simpleSteps: FlowStep[] = [
    {
      id: 'step1',
      name: 'Initialize',
      type: 'task',
      status: 'pending',
      action: async (data) => {
        console.log('   📥 Initializing workflow...');
        await new Promise(resolve => setTimeout(resolve, 500));
        return { initialized: true, timestamp: Date.now() };
      }
    },
    {
      id: 'step2',
      name: 'Fetch Data',
      type: 'task',
      status: 'pending',
      action: async (data) => {
        console.log('   📊 Fetching data...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { records: 150, source: 'database' };
      }
    },
    {
      id: 'step3',
      name: 'Process Data',
      type: 'task',
      status: 'pending',
      action: async (data) => {
        console.log(`   ⚙️  Processing ${data.records} records...`);
        await new Promise(resolve => setTimeout(resolve, 800));
        return { processed: data.records, errors: 0 };
      }
    },
    {
      id: 'step4',
      name: 'Generate Report',
      type: 'task',
      status: 'pending',
      action: async (data) => {
        console.log('   📄 Generating report...');
        await new Promise(resolve => setTimeout(resolve, 600));
        return { reportId: `RPT-${Date.now()}`, format: 'pdf' };
      }
    }
  ];

  const flowId1 = flowNexus.createFlow('Simple ETL Pipeline', simpleSteps);
  await flowNexus.startFlow(flowId1);

  const flow1 = flowNexus.getFlow(flowId1);
  console.log(`\n✅ Flow completed: ${flow1?.status}`);
  console.log('   Final data:', flow1?.data);

  // Example 2: Decision Flow
  console.log('\n\n🔀 Creating Decision Flow...\n');

  const decisionSteps: FlowStep[] = [
    {
      id: 'check',
      name: 'Check Conditions',
      type: 'task',
      status: 'pending',
      action: async (data) => {
        console.log('   🔍 Checking conditions...');
        await new Promise(resolve => setTimeout(resolve, 500));
        return { temperature: 85, threshold: 80 };
      }
    },
    {
      id: 'decision',
      name: 'Decide Action',
      type: 'decision',
      status: 'pending',
      condition: (data) => {
        const shouldAlert = data.temperature > data.threshold;
        console.log(`   🤔 Decision: ${shouldAlert ? 'Alert needed' : 'All normal'}`);
        return shouldAlert;
      },
      steps: [
        {
          id: 'alert',
          name: 'Send Alert',
          type: 'task',
          status: 'pending',
          action: async (data) => {
            console.log('   🚨 Sending alert!');
            await new Promise(resolve => setTimeout(resolve, 500));
            return { alertSent: true, recipients: ['admin@example.com'] };
          }
        }
      ]
    },
    {
      id: 'log',
      name: 'Log Event',
      type: 'task',
      status: 'pending',
      action: async (data) => {
        console.log('   📝 Logging event...');
        await new Promise(resolve => setTimeout(resolve, 300));
        return { logged: true };
      }
    }
  ];

  const flowId2 = flowNexus.createFlow('Temperature Monitor', decisionSteps);
  await flowNexus.startFlow(flowId2);

  const flow2 = flowNexus.getFlow(flowId2);
  console.log(`\n✅ Flow completed: ${flow2?.status}`);
  console.log('   Final data:', flow2?.data);

  // Example 3: Parallel Execution Flow
  console.log('\n\n⚡ Creating Parallel Execution Flow...\n');

  const parallelSteps: FlowStep[] = [
    {
      id: 'prepare',
      name: 'Prepare',
      type: 'task',
      status: 'pending',
      action: async (data) => {
        console.log('   📦 Preparing resources...');
        await new Promise(resolve => setTimeout(resolve, 500));
        return { resources: ['cpu', 'memory', 'storage'] };
      }
    },
    {
      id: 'parallel',
      name: 'Parallel Processing',
      type: 'parallel',
      status: 'pending',
      steps: [
        {
          id: 'task_a',
          name: 'Process A',
          type: 'task',
          status: 'pending',
          action: async (data) => {
            console.log('   🔵 Processing A...');
            await new Promise(resolve => setTimeout(resolve, 1200));
            return { taskA: 'completed', result: 42 };
          }
        },
        {
          id: 'task_b',
          name: 'Process B',
          type: 'task',
          status: 'pending',
          action: async (data) => {
            console.log('   🟢 Processing B...');
            await new Promise(resolve => setTimeout(resolve, 900));
            return { taskB: 'completed', result: 84 };
          }
        },
        {
          id: 'task_c',
          name: 'Process C',
          type: 'task',
          status: 'pending',
          action: async (data) => {
            console.log('   🟡 Processing C...');
            await new Promise(resolve => setTimeout(resolve, 1500));
            return { taskC: 'completed', result: 126 };
          }
        }
      ]
    },
    {
      id: 'aggregate',
      name: 'Aggregate Results',
      type: 'task',
      status: 'pending',
      action: async (data) => {
        console.log('   📊 Aggregating results...');
        const total = (data.taskA?.result || 0) + (data.taskB?.result || 0) + (data.taskC?.result || 0);
        await new Promise(resolve => setTimeout(resolve, 400));
        return { total, average: total / 3 };
      }
    }
  ];

  const flowId3 = flowNexus.createFlow('Parallel Data Pipeline', parallelSteps);
  await flowNexus.startFlow(flowId3);

  const flow3 = flowNexus.getFlow(flowId3);
  console.log(`\n✅ Flow completed: ${flow3?.status}`);
  console.log('   Final data:', flow3?.data);

  // Example 4: Loop Flow
  console.log('\n\n🔁 Creating Loop Flow...\n');

  const loopSteps: FlowStep[] = [
    {
      id: 'init',
      name: 'Initialize Counter',
      type: 'task',
      status: 'pending',
      action: async (data) => {
        console.log('   🎬 Initializing counter...');
        return { counter: 0, target: 5 };
      }
    },
    {
      id: 'loop',
      name: 'Processing Loop',
      type: 'loop',
      status: 'pending',
      condition: (data) => data.counter < data.target,
      steps: [
        {
          id: 'increment',
          name: 'Increment',
          type: 'task',
          status: 'pending',
          action: async (data) => {
            console.log(`   🔢 Counter: ${data.counter + 1}/${data.target}`);
            await new Promise(resolve => setTimeout(resolve, 400));
            return { counter: data.counter + 1 };
          }
        }
      ]
    },
    {
      id: 'complete',
      name: 'Complete',
      type: 'task',
      status: 'pending',
      action: async (data) => {
        console.log('   🎉 Loop completed!');
        return { completed: true, iterations: data.counter };
      }
    }
  ];

  const flowId4 = flowNexus.createFlow('Counter Loop', loopSteps);
  await flowNexus.startFlow(flowId4);

  const flow4 = flowNexus.getFlow(flowId4);
  console.log(`\n✅ Flow completed: ${flow4?.status}`);
  console.log('   Final data:', flow4?.data);

  // Display all flows
  console.log('\n\n📊 All Flows Summary:');
  const allFlows = flowNexus.getAllFlows();
  allFlows.forEach(flow => {
    const duration = flow.endTime && flow.startTime ? flow.endTime - flow.startTime : 0;
    console.log(`   ${flow.name}: ${flow.status} (${duration}ms, ${flow.steps.length} steps)`);
  });

  // Cleanup
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('\n🔌 Disconnecting...');
  pubnub.disconnect();
  console.log('✅ Done!\n');
}

// Run example
main().catch(console.error);
