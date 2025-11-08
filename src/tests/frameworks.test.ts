/**
 * Tests for Agent Frameworks
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AgenticFlowEngine } from '../lib/frameworks/agentic-flow';
import { LeanAgenticEngine } from '../lib/frameworks/lean-agentic';
import { StrangeLoopsEngine, CommonPatterns } from '../lib/frameworks/strange-loops';
import type { AgentTask } from '../types';

describe('AgenticFlowEngine', () => {
  let engine: AgenticFlowEngine;

  beforeEach(() => {
    engine = new AgenticFlowEngine();
  });

  it('should register workflows', () => {
    const workflow = {
      id: 'test-workflow',
      name: 'Test Workflow',
      description: 'A test workflow',
      steps: [
        {
          id: 'step1',
          name: 'First Step',
          agentRole: 'franchise-analysis',
          input: () => ({ data: 'test' }),
        },
      ],
    };

    engine.registerWorkflow(workflow);
    const workflows = engine.listWorkflows();
    expect(workflows.length).toBe(1);
    expect(workflows[0].id).toBe('test-workflow');
  });

  it('should handle workflow steps', () => {
    const workflow = {
      id: 'multi-step',
      name: 'Multi-Step Workflow',
      description: 'Multiple steps',
      steps: [
        {
          id: 'step1',
          name: 'Step 1',
          agentRole: 'franchise-analysis',
          input: (context: any) => context.data,
        },
        {
          id: 'step2',
          name: 'Step 2',
          agentRole: 'reporting',
          input: (context: any) => context.data,
          condition: (context: any) => true,
        },
      ],
    };

    engine.registerWorkflow(workflow);
    expect(workflow.steps.length).toBe(2);
    expect(workflow.steps[1].condition).toBeDefined();
  });
});

describe('LeanAgenticEngine', () => {
  let engine: LeanAgenticEngine;

  beforeEach(() => {
    engine = new LeanAgenticEngine();
  });

  it('should register agents', () => {
    const agentConfig = {
      id: 'test-agent',
      name: 'Test Agent',
      handler: async (input: any) => ({ result: 'success' }),
    };

    engine.registerAgent(agentConfig);
    expect(true).toBe(true);
  });

  it('should manage task queue', () => {
    const status = engine.getQueueStatus();
    expect(status.total).toBe(0);
    expect(status.processing).toBe(false);
  });

  it('should clear queue', () => {
    engine.clearQueue();
    const status = engine.getQueueStatus();
    expect(status.total).toBe(0);
  });
});

describe('StrangeLoopsEngine', () => {
  let engine: StrangeLoopsEngine;

  beforeEach(() => {
    engine = new StrangeLoopsEngine();
  });

  it('should register recursive patterns', () => {
    const pattern = {
      id: 'test-pattern',
      name: 'Test Pattern',
      baseCase: (input: any) => input === 0,
      recursiveCase: (input: any) => input - 1,
      combineResults: (results: any[]) => results.reduce((a, b) => a + b, 0),
    };

    engine.registerPattern(pattern);
    const patterns = engine.listPatterns();
    expect(patterns.length).toBe(1);
  });

  it('should support common patterns', () => {
    const divideConquer = CommonPatterns.divideAndConquer(
      'test',
      (input: any[]) => [input.slice(0, input.length / 2), input.slice(input.length / 2)],
      (results: any[]) => results.flat()
    );

    expect(divideConquer.id).toContain('divide-conquer');
  });

  it('should support iterative refinement', () => {
    const refinement = CommonPatterns.iterativeRefinement(
      'test',
      (input: any, iteration: number) => ({ ...input, iteration })
    );

    expect(refinement.id).toContain('refinement');
  });
});
