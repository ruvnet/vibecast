import { test } from 'node:test';
import assert from 'node:assert';
import { QuantumState } from '../src/index.js';

test('QuantumState: Create superposition', () => {
  const quantum = new QuantumState();

  const agents = [
    { id: 'agent1', capabilities: ['coding', 'testing'] },
    { id: 'agent2', capabilities: ['coding', 'review'] },
    { id: 'agent3', capabilities: ['testing', 'deployment'] }
  ];

  const task = {
    description: 'Implement authentication',
    requirements: ['coding', 'testing']
  };

  const result = quantum.createSuperposition('task1', task, agents);

  assert.strictEqual(result.agents, 3);
  assert.strictEqual(result.taskId, 'task1');
  assert.ok(result.entangledPairs > 0);
  assert.ok(result.expectedCollapseTime > 0);

  const superposition = quantum.superpositions.get('task1');
  assert.strictEqual(superposition.length, 3);
  assert.strictEqual(superposition[0].probability, 1/3);
});

test('QuantumState: Measure superposition', () => {
  const quantum = new QuantumState();

  const agents = [
    { id: 'agent1', capabilities: ['coding'] },
    { id: 'agent2', capabilities: ['coding'] }
  ];

  quantum.createSuperposition('task2', { description: 'Test' }, agents);

  // Simulate agent completions
  quantum.updateAgentState('task2', 'agent1', 'completed', { code: 'result1' });
  quantum.updateAgentState('task2', 'agent2', 'completed', { code: 'result2' });

  const measurement = quantum.measureSuperposition('task2', 'best');

  assert.ok(measurement);
  assert.strictEqual(measurement.taskId, 'task2');
  assert.ok(measurement.collapsedState);
  assert.strictEqual(measurement.alternatives, 1);
});

test('QuantumState: Detect decoherence', () => {
  const quantum = new QuantumState();

  const agents = [
    { id: 'agent1', capabilities: [] },
    { id: 'agent2', capabilities: [] },
    { id: 'agent3', capabilities: [] }
  ];

  quantum.createSuperposition('task3', { description: 'Test' }, agents);

  // All agents produce same result - no decoherence
  quantum.updateAgentState('task3', 'agent1', 'completed', { answer: 42 });
  quantum.updateAgentState('task3', 'agent2', 'completed', { answer: 42 });
  quantum.updateAgentState('task3', 'agent3', 'completed', { answer: 42 });

  const decoherence1 = quantum.detectDecoherence('task3');
  assert.strictEqual(decoherence1.detected, false);

  // Now add divergent result
  quantum.updateAgentState('task3', 'agent3', 'completed', { answer: 99 });

  const decoherence2 = quantum.detectDecoherence('task3');
  assert.ok(decoherence2.divergence > 0);
});

test('QuantumState: Calculate compatibility', () => {
  const quantum = new QuantumState();

  const capabilities = ['coding', 'testing', 'deployment'];
  const requirements1 = ['coding', 'testing'];
  const requirements2 = ['coding', 'testing', 'deployment'];
  const requirements3 = ['security'];

  assert.strictEqual(quantum.calculateCompatibility(capabilities, requirements1), 2/2);
  assert.strictEqual(quantum.calculateCompatibility(capabilities, requirements2), 3/3);
  assert.strictEqual(quantum.calculateCompatibility(capabilities, requirements3), 0/1);
});

test('QuantumState: Multiverse branching', () => {
  const quantum = new QuantumState();

  const state = { tasks: ['task1'], agents: ['agent1'] };
  const branchId = quantum.branchUniverse('main', state);

  assert.ok(branchId.startsWith('main-'));
  assert.ok(quantum.multiverses.has(branchId));

  const branch = quantum.multiverses.get(branchId);
  assert.strictEqual(branch.parentUniverse, 'main');
  assert.deepStrictEqual(branch.state, state);
});

console.log('✅ All Quantum State tests passed!');
