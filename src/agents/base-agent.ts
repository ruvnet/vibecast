/**
 * Base Agent Implementation
 *
 * Abstract base class for all agents in the system
 */

import { Agent, AgentTask, AgentResult } from './index';

export abstract class BaseAgent implements Agent {
  public readonly id: string;
  public readonly name: string;
  public readonly role: string;

  constructor(id: string, name: string, role: string) {
    this.id = id;
    this.name = name;
    this.role = role;
  }

  abstract execute(task: AgentTask): Promise<AgentResult>;

  protected async log(message: string): Promise<void> {
    console.log(`[${this.name}] ${message}`);
  }

  protected async handleError(error: Error): Promise<AgentResult> {
    await this.log(`Error: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}
