/**
 * Graph implementation - LangGraph-compatible API
 */

import { NodeFunction, ConditionFunction, GraphConfig, ExecutionResult } from './types';
import { State } from './state';

/**
 * StateGraph - Main graph for state-based workflows
 * Compatible with LangGraph Python API
 */
export class StateGraph<T = any> {
  private name: string;
  private nodes: Map<string, NodeFunction<T>>;
  private edges: Array<{ from: string; to: string; condition?: ConditionFunction<T> }>;
  private entry: string | null;
  private exits: Set<string>;
  private compiled: boolean;
  private config: GraphConfig;

  constructor(config: GraphConfig = {}) {
    this.name = config.name || 'StateGraph';
    this.nodes = new Map();
    this.edges = [];
    this.entry = null;
    this.exits = new Set();
    this.compiled = false;
    this.config = config;
  }

  /**
   * Add a node to the graph
   */
  addNode(name: string, fn: NodeFunction<T>): this {
    if (this.compiled) {
      throw new Error('Cannot add nodes after compilation');
    }
    this.nodes.set(name, fn);
    return this;
  }

  /**
   * Add an edge between two nodes
   */
  addEdge(from: string, to: string): this {
    if (this.compiled) {
      throw new Error('Cannot add edges after compilation');
    }
    this.edges.push({ from, to });
    return this;
  }

  /**
   * Add a conditional edge
   */
  addConditionalEdge(
    from: string,
    to: string,
    condition: ConditionFunction<T>
  ): this {
    if (this.compiled) {
      throw new Error('Cannot add edges after compilation');
    }
    this.edges.push({ from, to, condition });
    return this;
  }

  /**
   * Set the entry point
   */
  setEntry(nodeName: string): this {
    this.entry = nodeName;
    return this;
  }

  /**
   * Set exit points
   */
  setFinish(nodeName: string): this {
    this.exits.add(nodeName);
    return this;
  }

  /**
   * Compile the graph (validate structure)
   */
  compile(): this {
    if (this.compiled) {
      return this;
    }

    // Validate entry point
    if (!this.entry) {
      throw new Error('Entry point not set');
    }
    if (!this.nodes.has(this.entry)) {
      throw new Error(`Entry node '${this.entry}' not found`);
    }

    // Validate all edges reference existing nodes
    for (const edge of this.edges) {
      if (!this.nodes.has(edge.from)) {
        throw new Error(`Edge source node '${edge.from}' not found`);
      }
      if (!this.nodes.has(edge.to)) {
        throw new Error(`Edge target node '${edge.to}' not found`);
      }
    }

    // Validate exits
    for (const exit of this.exits) {
      if (!this.nodes.has(exit)) {
        throw new Error(`Exit node '${exit}' not found`);
      }
    }

    this.compiled = true;
    if (this.config.enableLogging) {
      console.log(`✓ Graph '${this.name}' compiled successfully`);
    }
    return this;
  }

  /**
   * Execute the graph
   */
  async invoke(initialState: T): Promise<ExecutionResult<T>> {
    if (!this.compiled) {
      throw new Error('Graph must be compiled before execution');
    }

    const startTime = performance.now();
    const nodesExecuted: string[] = [];
    let currentState = initialState;
    let currentNode = this.entry!;
    const visited = new Set<string>();
    const maxIterations = 1000;
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      // Execute current node
      const nodeFn = this.nodes.get(currentNode);
      if (!nodeFn) {
        throw new Error(`Node '${currentNode}' not found`);
      }

      if (this.config.enableLogging) {
        console.log(`→ Executing node: ${currentNode}`);
      }

      currentState = await Promise.resolve(nodeFn(currentState));
      nodesExecuted.push(currentNode);

      // Check if we've reached an exit
      if (this.exits.has(currentNode)) {
        break;
      }

      // Find next node
      const outgoingEdges = this.edges.filter(e => e.from === currentNode);
      if (outgoingEdges.length === 0) {
        break;
      }

      // Select next edge based on conditions
      const nextEdge = outgoingEdges.find(edge =>
        edge.condition ? edge.condition(currentState) : true
      );

      if (!nextEdge) {
        throw new Error(`No valid edge found from node '${currentNode}'`);
      }

      currentNode = nextEdge.to;
      visited.add(currentNode);
    }

    if (iteration >= maxIterations) {
      throw new Error('Maximum iterations exceeded (possible infinite loop)');
    }

    const executionTime = performance.now() - startTime;

    if (this.config.enableLogging) {
      console.log(`✓ Execution completed in ${executionTime.toFixed(3)}ms`);
    }

    return {
      state: currentState,
      executionTime,
      nodesExecuted
    };
  }

  /**
   * Stream execution (yields state after each node)
   */
  async *stream(initialState: T): AsyncGenerator<{ node: string; state: T }> {
    if (!this.compiled) {
      throw new Error('Graph must be compiled before execution');
    }

    let currentState = initialState;
    let currentNode = this.entry!;
    const visited = new Set<string>();
    const maxIterations = 1000;
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      // Execute current node
      const nodeFn = this.nodes.get(currentNode);
      if (!nodeFn) {
        throw new Error(`Node '${currentNode}' not found`);
      }

      currentState = await Promise.resolve(nodeFn(currentState));
      yield { node: currentNode, state: currentState };

      // Check if we've reached an exit
      if (this.exits.has(currentNode)) {
        break;
      }

      // Find next node
      const outgoingEdges = this.edges.filter(e => e.from === currentNode);
      if (outgoingEdges.length === 0) {
        break;
      }

      const nextEdge = outgoingEdges.find(edge =>
        edge.condition ? edge.condition(currentState) : true
      );

      if (!nextEdge) {
        throw new Error(`No valid edge found from node '${currentNode}'`);
      }

      currentNode = nextEdge.to;
      visited.add(currentNode);
    }
  }

  /**
   * Get graph statistics
   */
  getStats() {
    return {
      name: this.name,
      nodeCount: this.nodes.size,
      edgeCount: this.edges.length,
      entry: this.entry,
      exits: Array.from(this.exits),
      compiled: this.compiled
    };
  }
}

/**
 * MessageGraph - Specialized graph for message-based workflows
 * Compatible with LangGraph Python API
 */
export class MessageGraph extends StateGraph<any> {
  constructor(config: GraphConfig = {}) {
    super({ ...config, name: config.name || 'MessageGraph' });
  }

  /**
   * Add a message node (automatically handles message list)
   */
  addMessageNode(name: string, fn: (messages: any[]) => Promise<any[]> | any[]): this {
    const wrappedFn = async (state: any) => {
      const messages = state.messages || [];
      const result = await Promise.resolve(fn(messages));
      return { ...state, messages: result };
    };
    return this.addNode(name, wrappedFn);
  }
}
