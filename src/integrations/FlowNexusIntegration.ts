import { PubNubService } from '../core/PubNubService';
import { Message, MessageType } from '../core/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Flow state definition
 */
export interface FlowState {
  flowId: string;
  name: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  steps: FlowStep[];
  currentStep: number;
  data: Record<string, any>;
  startTime?: number;
  endTime?: number;
  error?: string;
}

export interface FlowStep {
  id: string;
  name: string;
  type: 'task' | 'decision' | 'parallel' | 'loop';
  action?: (data: any) => Promise<any>;
  condition?: (data: any) => boolean;
  steps?: FlowStep[]; // For nested flows
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: any;
}

/**
 * Flow-Nexus Integration for workflow orchestration via PubNub
 * Implements MCP-inspired patterns from ruv.io
 */
export class FlowNexusIntegration {
  private pubnub: PubNubService;
  private flows: Map<string, FlowState> = new Map();
  private flowHandlers: Map<string, (flow: FlowState) => void> = new Map();

  constructor(pubnub: PubNubService) {
    this.pubnub = pubnub;
    this.setupFlowChannels();
  }

  /**
   * Setup channels for flow coordination
   */
  private setupFlowChannels(): void {
    this.pubnub.subscribe('flows:control');
    this.pubnub.subscribe('flows:status');

    // Listen for flow messages
    this.pubnub.onMessage('flows:control', async (message: Message) => {
      switch (message.type) {
        case MessageType.FLOW_START:
          await this.handleFlowStart(message.payload);
          break;
        case MessageType.FLOW_UPDATE:
          await this.handleFlowUpdate(message.payload);
          break;
        case MessageType.FLOW_END:
          await this.handleFlowEnd(message.payload);
          break;
      }
    });

    console.log('Flow-Nexus integration initialized');
  }

  /**
   * Create a new flow
   */
  createFlow(name: string, steps: FlowStep[]): string {
    const flowId = uuidv4();
    const flow: FlowState = {
      flowId,
      name,
      status: 'idle',
      steps,
      currentStep: 0,
      data: {},
    };

    this.flows.set(flowId, flow);
    console.log(`Created flow: ${flowId} - ${name}`);
    return flowId;
  }

  /**
   * Start a flow
   */
  async startFlow(flowId: string, initialData?: Record<string, any>): Promise<void> {
    const flow = this.flows.get(flowId);
    if (!flow) {
      throw new Error(`Flow not found: ${flowId}`);
    }

    flow.status = 'running';
    flow.startTime = Date.now();
    flow.currentStep = 0;
    if (initialData) {
      flow.data = { ...flow.data, ...initialData };
    }

    // Announce flow start
    await this.pubnub.publish(
      'flows:status',
      MessageType.FLOW_START,
      {
        flowId,
        name: flow.name,
        steps: flow.steps.length,
        timestamp: flow.startTime,
      }
    );

    // Execute flow
    await this.executeFlow(flow);
  }

  /**
   * Execute flow steps
   */
  private async executeFlow(flow: FlowState): Promise<void> {
    try {
      while (flow.currentStep < flow.steps.length && flow.status === 'running') {
        const step = flow.steps[flow.currentStep];
        await this.executeStep(flow, step);

        if (step.status === 'error') {
          flow.status = 'error';
          flow.error = step.result?.error || 'Step execution failed';
          break;
        }

        flow.currentStep++;

        // Publish flow update
        await this.publishFlowUpdate(flow);
      }

      if (flow.status === 'running') {
        flow.status = 'completed';
        flow.endTime = Date.now();
      }

      // Announce flow completion
      await this.publishFlowEnd(flow);

      // Call flow handlers
      const handler = this.flowHandlers.get(flow.flowId);
      if (handler) {
        handler(flow);
      }
    } catch (error) {
      flow.status = 'error';
      flow.error = error instanceof Error ? error.message : String(error);
      flow.endTime = Date.now();
      await this.publishFlowEnd(flow);
    }
  }

  /**
   * Execute a single flow step
   */
  private async executeStep(flow: FlowState, step: FlowStep): Promise<void> {
    step.status = 'running';
    console.log(`Executing step: ${step.name} in flow: ${flow.flowId}`);

    try {
      switch (step.type) {
        case 'task':
          if (step.action) {
            step.result = await step.action(flow.data);
            flow.data = { ...flow.data, ...step.result };
          }
          break;

        case 'decision':
          if (step.condition) {
            const shouldProceed = step.condition(flow.data);
            step.result = { decision: shouldProceed };
            if (!shouldProceed && step.steps) {
              // Skip nested steps if condition is false
              return;
            }
          }
          if (step.steps) {
            await this.executeNestedSteps(flow, step.steps);
          }
          break;

        case 'parallel':
          if (step.steps) {
            await this.executeParallelSteps(flow, step.steps);
          }
          break;

        case 'loop':
          if (step.steps) {
            await this.executeLoopSteps(flow, step);
          }
          break;
      }

      step.status = 'completed';
    } catch (error) {
      step.status = 'error';
      step.result = {
        error: error instanceof Error ? error.message : String(error),
      };
      throw error;
    }
  }

  /**
   * Execute nested steps sequentially
   */
  private async executeNestedSteps(
    flow: FlowState,
    steps: FlowStep[]
  ): Promise<void> {
    for (const step of steps) {
      await this.executeStep(flow, step);
      if (step.status === 'error') {
        throw new Error(`Nested step failed: ${step.name}`);
      }
    }
  }

  /**
   * Execute steps in parallel
   */
  private async executeParallelSteps(
    flow: FlowState,
    steps: FlowStep[]
  ): Promise<void> {
    const promises = steps.map(step => this.executeStep(flow, step));
    await Promise.all(promises);

    const failedStep = steps.find(s => s.status === 'error');
    if (failedStep) {
      throw new Error(`Parallel step failed: ${failedStep.name}`);
    }
  }

  /**
   * Execute loop steps
   */
  private async executeLoopSteps(
    flow: FlowState,
    loopStep: FlowStep
  ): Promise<void> {
    if (!loopStep.steps) return;

    let iterations = 0;
    const maxIterations = 100; // Safety limit

    while (iterations < maxIterations) {
      if (loopStep.condition && !loopStep.condition(flow.data)) {
        break;
      }

      for (const step of loopStep.steps) {
        await this.executeStep(flow, step);
        if (step.status === 'error') {
          throw new Error(`Loop step failed: ${step.name}`);
        }
      }

      iterations++;
    }

    loopStep.result = { iterations };
  }

  /**
   * Pause a flow
   */
  async pauseFlow(flowId: string): Promise<void> {
    const flow = this.flows.get(flowId);
    if (!flow) {
      throw new Error(`Flow not found: ${flowId}`);
    }

    flow.status = 'paused';
    await this.publishFlowUpdate(flow);
    console.log(`Flow paused: ${flowId}`);
  }

  /**
   * Resume a flow
   */
  async resumeFlow(flowId: string): Promise<void> {
    const flow = this.flows.get(flowId);
    if (!flow) {
      throw new Error(`Flow not found: ${flowId}`);
    }

    if (flow.status !== 'paused') {
      throw new Error(`Flow is not paused: ${flowId}`);
    }

    flow.status = 'running';
    await this.publishFlowUpdate(flow);
    await this.executeFlow(flow);
    console.log(`Flow resumed: ${flowId}`);
  }

  /**
   * Publish flow update
   */
  private async publishFlowUpdate(flow: FlowState): Promise<void> {
    await this.pubnub.publish(
      'flows:status',
      MessageType.FLOW_UPDATE,
      {
        flowId: flow.flowId,
        status: flow.status,
        currentStep: flow.currentStep,
        totalSteps: flow.steps.length,
        progress: (flow.currentStep / flow.steps.length) * 100,
      }
    );
  }

  /**
   * Publish flow end
   */
  private async publishFlowEnd(flow: FlowState): Promise<void> {
    const duration = flow.endTime && flow.startTime
      ? flow.endTime - flow.startTime
      : 0;

    await this.pubnub.publish(
      'flows:status',
      MessageType.FLOW_END,
      {
        flowId: flow.flowId,
        status: flow.status,
        duration,
        error: flow.error,
        data: flow.data,
      }
    );

    console.log(`Flow ${flow.status}: ${flow.flowId} (${duration}ms)`);
  }

  /**
   * Handle flow start message
   */
  private async handleFlowStart(payload: any): Promise<void> {
    console.log('Flow started:', payload);
  }

  /**
   * Handle flow update message
   */
  private async handleFlowUpdate(payload: any): Promise<void> {
    console.log('Flow updated:', payload);
  }

  /**
   * Handle flow end message
   */
  private async handleFlowEnd(payload: any): Promise<void> {
    console.log('Flow ended:', payload);
  }

  /**
   * Register flow completion handler
   */
  onFlowComplete(flowId: string, handler: (flow: FlowState) => void): void {
    this.flowHandlers.set(flowId, handler);
  }

  /**
   * Get flow state
   */
  getFlow(flowId: string): FlowState | undefined {
    return this.flows.get(flowId);
  }

  /**
   * Get all flows
   */
  getAllFlows(): FlowState[] {
    return Array.from(this.flows.values());
  }
}
