/**
 * STDIO Transport
 * Handles communication via standard input/output streams
 */

import * as readline from 'readline';
import { MCPServer } from '../core/mcp-server.js';

export class STDIOTransport {
  private server: MCPServer;
  private rl: readline.Interface;

  constructor(server: MCPServer) {
    this.server = server;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });
  }

  /**
   * Start listening for requests
   */
  start(): void {
    console.log('[STDIO Transport] Listening for requests on STDIN...');
    console.log('[STDIO Transport] Send JSON-formatted tool requests');
    console.log('[STDIO Transport] Special commands: /help, /tools, /info, /exit');
    console.log('---');

    this.rl.on('line', async (line) => {
      await this.handleLine(line.trim());
    });

    this.rl.on('close', () => {
      console.log('[STDIO Transport] Connection closed');
      process.exit(0);
    });
  }

  /**
   * Handle a single line of input
   */
  private async handleLine(line: string): Promise<void> {
    if (!line) {
      return;
    }

    try {
      // Handle special commands
      if (line.startsWith('/')) {
        await this.handleCommand(line);
        return;
      }

      // Parse JSON request
      const request = JSON.parse(line);

      // Handle request
      const response = await this.server.handleRequest(request);

      // Send response
      this.sendResponse(response);
    } catch (error) {
      this.sendError(
        error instanceof Error ? error.message : 'Invalid request format'
      );
    }
  }

  /**
   * Handle special commands
   */
  private async handleCommand(command: string): Promise<void> {
    const [cmd, ...args] = command.slice(1).split(' ');

    switch (cmd.toLowerCase()) {
      case 'help':
        this.sendMessage({
          type: 'help',
          commands: {
            '/help': 'Show this help message',
            '/tools': 'List all available tools',
            '/info': 'Show server information',
            '/search <keyword>': 'Search tools by keyword',
            '/reload': 'Reload tools from disk',
            '/exit': 'Exit the server',
          },
          format: {
            request: {
              requestId: 'uuid-v4',
              toolId: 'tool-id',
              arguments: {},
              executionMode: 'sync|async',
            },
          },
        });
        break;

      case 'tools':
        const tools = this.server.getTools();
        this.sendMessage({
          type: 'tools',
          count: tools.length,
          tools: tools.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            tags: t.metadata?.tags,
          })),
        });
        break;

      case 'info':
        this.sendMessage({
          type: 'info',
          server: this.server.getInfo(),
        });
        break;

      case 'search':
        if (args.length === 0) {
          this.sendError('Usage: /search <keyword>');
          return;
        }
        const keyword = args.join(' ');
        const results = this.server.searchTools(keyword);
        this.sendMessage({
          type: 'search',
          keyword,
          count: results.length,
          tools: results.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
          })),
        });
        break;

      case 'reload':
        await this.server.reloadTools();
        this.sendMessage({
          type: 'reload',
          message: 'Tools reloaded successfully',
          count: this.server.getTools().length,
        });
        break;

      case 'exit':
        this.sendMessage({ type: 'goodbye', message: 'Server shutting down' });
        process.exit(0);
        break;

      default:
        this.sendError(`Unknown command: ${cmd}`);
    }
  }

  /**
   * Send a response
   */
  private sendResponse(response: any): void {
    console.log(JSON.stringify(response));
  }

  /**
   * Send a message
   */
  private sendMessage(message: any): void {
    console.log(JSON.stringify(message));
  }

  /**
   * Send an error
   */
  private sendError(message: string): void {
    console.log(
      JSON.stringify({
        type: 'error',
        error: message,
      })
    );
  }

  /**
   * Stop the transport
   */
  stop(): void {
    this.rl.close();
  }
}
