/**
 * Model Context Protocol (MCP) Server
 * Supports both stdio and SSE modes
 */

import { StateGraph } from './graph';
import { State } from './state';
import { AgentDB, ReflexionMemory, MockEmbeddingModel } from './agentdb';
import { Benchmark } from './benchmark';
import { MCPConfig } from './types';
import express from 'express';
import { WebSocketServer } from 'ws';

interface MCPRequest {
  id: string;
  method: string;
  params: any;
}

interface MCPResponse {
  id: string;
  result?: any;
  error?: string;
}

/**
 * MCP Server class
 */
export class MCPServer {
  private config: MCPConfig;
  private graphs: Map<string, StateGraph>;
  private agentDb: AgentDB;
  private reflexion: ReflexionMemory;

  constructor(config: MCPConfig) {
    this.config = config;
    this.graphs = new Map();
    this.agentDb = new AgentDB(new MockEmbeddingModel());
    this.reflexion = new ReflexionMemory(this.agentDb);
  }

  /**
   * Handle MCP request
   */
  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      const result = await this.processMethod(request.method, request.params);
      return {
        id: request.id,
        result
      };
    } catch (error: any) {
      return {
        id: request.id,
        error: error.message
      };
    }
  }

  /**
   * Process individual methods
   */
  private async processMethod(method: string, params: any): Promise<any> {
    switch (method) {
      // Graph methods
      case 'graph.create':
        return this.createGraph(params);

      case 'graph.execute':
        return this.executeGraph(params);

      case 'graph.list':
        return this.listGraphs();

      case 'graph.delete':
        return this.deleteGraph(params);

      // AgentDB methods
      case 'agentdb.store':
        return this.storePattern(params);

      case 'agentdb.search':
        return this.searchPatterns(params);

      case 'agentdb.stats':
        return this.getAgentDBStats();

      // Reflexion methods
      case 'reflexion.recordSuccess':
        return this.recordSuccess(params);

      case 'reflexion.recordFailure':
        return this.recordFailure(params);

      case 'reflexion.recall':
        return this.recallSimilar(params);

      // Benchmark methods
      case 'benchmark.run':
        return this.runBenchmark(params);

      // Info methods
      case 'info.version':
        return { version: '0.1.0' };

      case 'info.methods':
        return this.listMethods();

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  // Graph operations
  private createGraph(params: any): any {
    const { name, nodes, edges, entry, exits } = params;
    const graph = new StateGraph({ name });

    for (const node of nodes) {
      graph.addNode(node.name, eval(node.function));
    }

    for (const edge of edges) {
      if (edge.condition) {
        graph.addConditionalEdge(edge.from, edge.to, eval(edge.condition));
      } else {
        graph.addEdge(edge.from, edge.to);
      }
    }

    graph.setEntry(entry);
    if (exits) {
      for (const exit of exits) {
        graph.setFinish(exit);
      }
    }

    graph.compile();
    this.graphs.set(name, graph);

    return { success: true, name, stats: graph.getStats() };
  }

  private async executeGraph(params: any): Promise<any> {
    const { name, initialState } = params;
    const graph = this.graphs.get(name);

    if (!graph) {
      throw new Error(`Graph not found: ${name}`);
    }

    const result = await graph.invoke(initialState);
    return result;
  }

  private listGraphs(): any {
    return Array.from(this.graphs.entries()).map(([name, graph]) => ({
      name,
      stats: graph.getStats()
    }));
  }

  private deleteGraph(params: any): any {
    const { name } = params;
    const deleted = this.graphs.delete(name);
    return { success: deleted };
  }

  // AgentDB operations
  private async storePattern(params: any): Promise<any> {
    const { name, content, metadata } = params;
    const id = await this.agentDb.storePattern(name, content, metadata || {});
    return { id };
  }

  private async searchPatterns(params: any): Promise<any> {
    const { query, limit = 5 } = params;
    const patterns = await this.agentDb.searchSimilar(query, limit);
    return { patterns };
  }

  private getAgentDBStats(): any {
    return this.agentDb.getStats();
  }

  // Reflexion operations
  private async recordSuccess(params: any): Promise<any> {
    const { name, state, score = 1.0 } = params;
    const stateObj = new State(state);
    const id = await this.reflexion.recordSuccess(name, stateObj, score);
    return { id };
  }

  private async recordFailure(params: any): Promise<any> {
    const { name, state, error } = params;
    const stateObj = new State(state);
    const id = await this.reflexion.recordFailure(name, stateObj, error);
    return { id };
  }

  private async recallSimilar(params: any): Promise<any> {
    const { state, limit = 5 } = params;
    const stateObj = new State(state);
    const patterns = await this.reflexion.recallSimilar(stateObj, limit);
    return { patterns };
  }

  // Benchmark operations
  private async runBenchmark(params: any): Promise<any> {
    const { type = 'all' } = params;

    if (type === 'all') {
      return await Benchmark.runAll();
    } else if (type === 'compilation') {
      return await Benchmark.benchmarkCompilation();
    } else if (type === 'execution') {
      return await Benchmark.benchmarkNodeExecution();
    } else {
      throw new Error(`Unknown benchmark type: ${type}`);
    }
  }

  // List available methods
  private listMethods(): any {
    return {
      graph: [
        'graph.create',
        'graph.execute',
        'graph.list',
        'graph.delete'
      ],
      agentdb: [
        'agentdb.store',
        'agentdb.search',
        'agentdb.stats'
      ],
      reflexion: [
        'reflexion.recordSuccess',
        'reflexion.recordFailure',
        'reflexion.recall'
      ],
      benchmark: [
        'benchmark.run'
      ],
      info: [
        'info.version',
        'info.methods'
      ]
    };
  }

  /**
   * Start stdio server
   */
  startStdio(): void {
    console.log('MCP Server started in stdio mode');
    console.log('Waiting for requests on stdin...\n');

    process.stdin.setEncoding('utf8');
    let buffer = '';

    process.stdin.on('data', async (chunk) => {
      buffer += chunk;

      // Process complete lines
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        if (line.trim()) {
          try {
            const request = JSON.parse(line);
            const response = await this.handleRequest(request);
            process.stdout.write(JSON.stringify(response) + '\n');
          } catch (error: any) {
            process.stdout.write(JSON.stringify({
              id: 'error',
              error: error.message
            }) + '\n');
          }
        }
      }
    });

    process.stdin.on('end', () => {
      console.log('\nStdin closed, shutting down...');
      process.exit(0);
    });
  }

  /**
   * Start SSE server
   */
  startSSE(): void {
    const app = express();
    const port = this.config.port || 3000;
    const host = this.config.host || 'localhost';

    app.use(express.json());

    // Health check
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', mode: 'sse' });
    });

    // MCP endpoint
    app.post('/mcp', async (req, res) => {
      try {
        const request = req.body as MCPRequest;
        const response = await this.handleRequest(request);
        res.json(response);
      } catch (error: any) {
        res.status(500).json({
          id: 'error',
          error: error.message
        });
      }
    });

    // SSE endpoint for streaming
    app.get('/mcp/stream', (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Send initial connection message
      res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

      // Keep connection alive
      const keepAlive = setInterval(() => {
        res.write(`:keepalive\n\n`);
      }, 30000);

      req.on('close', () => {
        clearInterval(keepAlive);
      });
    });

    app.listen(port, host, () => {
      console.log(`MCP Server started in SSE mode`);
      console.log(`Listening on http://${host}:${port}`);
      console.log(`\nEndpoints:`);
      console.log(`  GET  /health       - Health check`);
      console.log(`  POST /mcp          - MCP requests`);
      console.log(`  GET  /mcp/stream   - SSE streaming`);
      console.log();
    });
  }
}

/**
 * Start MCP server with given config
 */
export async function startMCPServer(config: MCPConfig): Promise<void> {
  const server = new MCPServer(config);

  if (config.mode === 'stdio') {
    server.startStdio();
  } else if (config.mode === 'sse') {
    server.startSSE();
  } else {
    throw new Error(`Unknown MCP mode: ${config.mode}`);
  }
}
