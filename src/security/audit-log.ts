/**
 * Audit Logging
 * Comprehensive audit logging for security and compliance
 */

import fs from 'fs/promises';
import path from 'path';
import { AuditLogEntry, ResponseStatus } from '../types/protocol.js';

export class AuditLogger {
  private logFilePath: string;
  private enabled: boolean;

  constructor(logDirectory: string = './logs', enabled: boolean = true) {
    this.logFilePath = path.join(logDirectory, 'audit.log');
    this.enabled = enabled;
  }

  /**
   * Initialize the audit logger
   */
  async initialize(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      // Ensure log directory exists
      const logDir = path.dirname(this.logFilePath);
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      console.error('[Audit Log] Failed to initialize:', error);
    }
  }

  /**
   * Log an audit entry
   */
  async log(entry: AuditLogEntry): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const logLine = JSON.stringify({
        ...entry,
        timestamp: new Date().toISOString(),
      }) + '\n';

      await fs.appendFile(this.logFilePath, logLine, 'utf-8');
    } catch (error) {
      console.error('[Audit Log] Failed to write log:', error);
    }
  }

  /**
   * Log a tool invocation
   */
  async logInvocation(
    requestId: string,
    toolId: string,
    status: ResponseStatus,
    duration: number,
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      requestId,
      toolId,
      userId,
      action: 'invoke',
      status,
      duration,
      metadata,
    });
  }

  /**
   * Log a discovery request
   */
  async logDiscovery(
    requestId: string,
    toolId: string,
    userId?: string
  ): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      requestId,
      toolId,
      userId,
      action: 'discover',
      status: ResponseStatus.SUCCESS,
      duration: 0,
    });
  }

  /**
   * Log an authentication attempt
   */
  async logAuthentication(
    requestId: string,
    status: ResponseStatus,
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      requestId,
      toolId: 'auth',
      userId,
      action: 'authenticate',
      status,
      duration: 0,
      metadata,
    });
  }

  /**
   * Read recent audit logs
   */
  async readLogs(limit: number = 100): Promise<AuditLogEntry[]> {
    try {
      const content = await fs.readFile(this.logFilePath, 'utf-8');
      const lines = content.trim().split('\n');
      const recentLines = lines.slice(-limit);
      return recentLines.map((line) => JSON.parse(line));
    } catch (error) {
      console.error('[Audit Log] Failed to read logs:', error);
      return [];
    }
  }
}
