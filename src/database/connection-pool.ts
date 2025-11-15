/**
 * Connection Pool
 *
 * Manages database connection pooling for efficient resource usage
 */

import { AgentDBAdapter } from './agentdb-adapter';
import { DatabaseConfig, DatabaseConnection } from './index';

export interface ConnectionPoolConfig extends DatabaseConfig {
  minConnections?: number;
  maxConnections?: number;
}

export class ConnectionPool {
  private config: ConnectionPoolConfig;
  private connections: AgentDBAdapter[] = [];
  private availableConnections: AgentDBAdapter[] = [];
  private minConnections: number;
  private maxConnections: number;

  constructor(config: ConnectionPoolConfig) {
    this.config = config;
    this.minConnections = config.minConnections || 2;
    this.maxConnections = config.maxConnections || 10;
  }

  async initialize(): Promise<void> {
    console.log(`Initializing connection pool (min: ${this.minConnections}, max: ${this.maxConnections})`);

    for (let i = 0; i < this.minConnections; i++) {
      const connection = new AgentDBAdapter(this.config);
      await connection.connect();
      this.connections.push(connection);
      this.availableConnections.push(connection);
    }

    console.log(`Connection pool initialized with ${this.connections.length} connections`);
  }

  async getConnection(): Promise<DatabaseConnection> {
    if (this.availableConnections.length > 0) {
      const connection = this.availableConnections.pop()!;
      return connection;
    }

    if (this.connections.length < this.maxConnections) {
      const connection = new AgentDBAdapter(this.config);
      await connection.connect();
      this.connections.push(connection);
      return connection;
    }

    // Wait for a connection to become available
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.availableConnections.length > 0) {
          clearInterval(checkInterval);
          const connection = this.availableConnections.pop()!;
          resolve(connection);
        }
      }, 100);
    });
  }

  async releaseConnection(connection: DatabaseConnection): Promise<void> {
    if (connection instanceof AgentDBAdapter) {
      this.availableConnections.push(connection);
    }
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down connection pool...');

    for (const connection of this.connections) {
      await connection.disconnect();
    }

    this.connections = [];
    this.availableConnections = [];

    console.log('Connection pool shut down');
  }
}
