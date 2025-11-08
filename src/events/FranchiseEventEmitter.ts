import { EventEmitter } from 'events';
import { EventData, AgentResponse, GrowthOpportunity } from '../types';

/**
 * Event emitter for real-time franchise management updates
 */
export class FranchiseEventEmitter extends EventEmitter {
  constructor() {
    super();
  }

  emitAgentStarted(agentType: string, taskId: string): void {
    this.emit('agent:started', {
      type: 'agent:started',
      timestamp: new Date(),
      data: { agentType, taskId }
    } as EventData);
  }

  emitAgentCompleted(response: AgentResponse): void {
    this.emit('agent:completed', {
      type: 'agent:completed',
      timestamp: new Date(),
      data: response
    } as EventData);
  }

  emitAnalysisStarted(analysisType: string): void {
    this.emit('analysis:started', {
      type: 'analysis:started',
      timestamp: new Date(),
      data: { analysisType }
    } as EventData);
  }

  emitAnalysisCompleted(results: any): void {
    this.emit('analysis:completed', {
      type: 'analysis:completed',
      timestamp: new Date(),
      data: results
    } as EventData);
  }

  emitLocationAdded(locationId: string, name: string): void {
    this.emit('location:added', {
      type: 'location:added',
      timestamp: new Date(),
      data: { locationId, name }
    } as EventData);
  }

  emitOpportunityDiscovered(opportunity: GrowthOpportunity): void {
    this.emit('opportunity:discovered', {
      type: 'opportunity:discovered',
      timestamp: new Date(),
      data: opportunity
    } as EventData);
  }

  emitError(error: Error, context?: string): void {
    this.emit('error', {
      type: 'error',
      timestamp: new Date(),
      data: { error: error.message, stack: error.stack, context }
    } as EventData);
  }

  emitMetricsUpdated(locationId: string, metrics: any): void {
    this.emit('metrics:updated', {
      type: 'metrics:updated',
      timestamp: new Date(),
      data: { locationId, metrics }
    } as EventData);
  }
}

export const franchiseEvents = new FranchiseEventEmitter();
