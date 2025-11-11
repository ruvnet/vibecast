import { StateGraph, MessageGraph } from '../graph';
import { State } from '../state';

describe('StateGraph', () => {
  test('should create and compile a simple graph', () => {
    const graph = new StateGraph({ name: 'TestGraph' });

    graph.addNode('start', (state: any) => ({ ...state, step: 1 }));
    graph.addNode('end', (state: any) => ({ ...state, step: 2 }));
    graph.addEdge('start', 'end');
    graph.setEntry('start');
    graph.setFinish('end');

    expect(() => graph.compile()).not.toThrow();

    const stats = graph.getStats();
    expect(stats.nodeCount).toBe(2);
    expect(stats.edgeCount).toBe(1);
    expect(stats.compiled).toBe(true);
  });

  test('should execute a simple workflow', async () => {
    const graph = new StateGraph({ name: 'ExecTest' });

    graph.addNode('start', (state: any) => ({ ...state, count: (state.count || 0) + 1 }));
    graph.addNode('process', (state: any) => ({ ...state, count: state.count * 2 }));
    graph.addNode('finish', (state: any) => ({ ...state, done: true }));

    graph.addEdge('start', 'process');
    graph.addEdge('process', 'finish');
    graph.setEntry('start');
    graph.setFinish('finish');
    graph.compile();

    const result = await graph.invoke({ count: 0 });

    expect(result.state.count).toBe(2); // (0 + 1) * 2
    expect(result.state.done).toBe(true);
    expect(result.nodesExecuted).toEqual(['start', 'process', 'finish']);
  });

  test('should handle conditional edges', async () => {
    const graph = new StateGraph({ name: 'ConditionalTest' });

    graph.addNode('start', (state: any) => ({ ...state, value: 10 }));
    graph.addNode('high', (state: any) => ({ ...state, branch: 'high' }));
    graph.addNode('low', (state: any) => ({ ...state, branch: 'low' }));

    graph.addConditionalEdge('start', 'high', (state: any) => state.value > 5);
    graph.addConditionalEdge('start', 'low', (state: any) => state.value <= 5);

    graph.setEntry('start');
    graph.setFinish('high');
    graph.setFinish('low');
    graph.compile();

    const result = await graph.invoke({});
    expect(result.state.branch).toBe('high');
  });

  test('should throw error if not compiled', async () => {
    const graph = new StateGraph();
    graph.addNode('node', (s) => s);
    graph.setEntry('node');
    graph.setFinish('node');

    await expect(graph.invoke({})).rejects.toThrow('must be compiled');
  });

  test('should throw error for missing entry point', () => {
    const graph = new StateGraph();
    graph.addNode('node', (s) => s);

    expect(() => graph.compile()).toThrow('Entry point not set');
  });

  test('should stream execution', async () => {
    const graph = new StateGraph();

    graph.addNode('n1', (s: any) => ({ ...s, step: 1 }));
    graph.addNode('n2', (s: any) => ({ ...s, step: 2 }));
    graph.addEdge('n1', 'n2');
    graph.setEntry('n1');
    graph.setFinish('n2');
    graph.compile();

    const steps: any[] = [];
    for await (const step of graph.stream({})) {
      steps.push(step);
    }

    expect(steps).toHaveLength(2);
    expect(steps[0].node).toBe('n1');
    expect(steps[1].node).toBe('n2');
  });
});

describe('MessageGraph', () => {
  test('should handle message nodes', async () => {
    const graph = new MessageGraph({ name: 'MessageTest' });

    graph.addMessageNode('process', (messages) => {
      return [...messages, { role: 'assistant', content: 'Hello!' }];
    });

    graph.setEntry('process');
    graph.setFinish('process');
    graph.compile();

    const result = await graph.invoke({ messages: [{ role: 'user', content: 'Hi' }] });

    expect(result.state.messages).toHaveLength(2);
    expect(result.state.messages[1].content).toBe('Hello!');
  });
});
