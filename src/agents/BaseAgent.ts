import { AgentType, AgentResponse, AgentCapabilities } from '../types';
import { franchiseEvents } from '../events/FranchiseEventEmitter';

/**
 * Base class for all franchise analysis agents
 */
export abstract class BaseAgent {
  protected type: AgentType;
  protected capabilities: AgentCapabilities;

  constructor(type: AgentType, capabilities: AgentCapabilities) {
    this.type = type;
    this.capabilities = capabilities;
  }

  abstract analyze(data: any): Promise<AgentResponse>;

  getType(): AgentType {
    return this.type;
  }

  getCapabilities(): AgentCapabilities {
    return this.capabilities;
  }

  protected createResponse(taskId: string, success: boolean, data?: any, error?: string): AgentResponse {
    return {
      agentType: this.type,
      taskId,
      success,
      data,
      insights: data?.insights || [],
      recommendations: data?.recommendations || [],
      error
    };
  }

  protected log(message: string): void {
    console.log(`[${this.type}] ${message}`);
  }

  protected emitStarted(taskId: string): void {
    franchiseEvents.emitAgentStarted(this.type, taskId);
  }

  protected emitCompleted(response: AgentResponse): void {
    franchiseEvents.emitAgentCompleted(response);
  }
}
