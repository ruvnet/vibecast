/**
 * Agentic-Flow Framework Integration
 * Provides workflow orchestration and multi-step agent processes
 */

import { EventEmitter } from 'eventemitter3';
import type { AgentTask } from '../../types/index.js';

export interface WorkflowStep {
  id: string;
  name: string;
  agentRole: string;
  input: (context: WorkflowContext) => any;
  output?: string; // Key to store result in context
  condition?: (context: WorkflowContext) => boolean;
  retries?: number;
}

export interface WorkflowContext {
  workflowId: string;
  data: Record<string, any>;
  results: Record<string, any>;
  errors: Record<string, Error>;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  onComplete?: (context: WorkflowContext) => void;
  onError?: (context: WorkflowContext, error: Error) => void;
}

export class AgenticFlowEngine extends EventEmitter {
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private activeWorkflows: Map<string, WorkflowContext> = new Map();

  /**
   * Register a workflow definition
   */
  registerWorkflow(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.id, workflow);
    this.emit('workflow-registered', { workflowId: workflow.id, name: workflow.name });
  }

  /**
   * Execute a workflow with given initial data
   */
  async executeWorkflow(
    workflowId: string,
    initialData: Record<string, any>,
    agentExecutor: (agentRole: string, task: AgentTask) => Promise<any>
  ): Promise<WorkflowContext> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const context: WorkflowContext = {
      workflowId,
      data: initialData,
      results: {},
      errors: {},
    };

    this.activeWorkflows.set(workflowId, context);
    this.emit('workflow-start', { workflowId, workflow: workflow.name });

    try {
      for (const step of workflow.steps) {
        // Check condition if present
        if (step.condition && !step.condition(context)) {
          this.emit('step-skipped', { workflowId, step: step.name });
          continue;
        }

        this.emit('step-start', { workflowId, step: step.name });

        try {
          const stepInput = step.input(context);
          const task: AgentTask = {
            id: `${workflowId}-${step.id}`,
            type: step.name,
            input: stepInput,
            priority: 1,
            status: 'pending',
          };

          const result = await this.executeStepWithRetries(
            step,
            task,
            agentExecutor,
            step.retries ?? 0
          );

          if (step.output) {
            context.results[step.output] = result;
          }

          this.emit('step-complete', { workflowId, step: step.name, result });
        } catch (error: any) {
          context.errors[step.id] = error;
          this.emit('step-error', { workflowId, step: step.name, error });

          if (workflow.onError) {
            workflow.onError(context, error);
          }

          throw error;
        }
      }

      this.emit('workflow-complete', { workflowId, context });

      if (workflow.onComplete) {
        workflow.onComplete(context);
      }

      return context;
    } finally {
      this.activeWorkflows.delete(workflowId);
    }
  }

  private async executeStepWithRetries(
    step: WorkflowStep,
    task: AgentTask,
    agentExecutor: (agentRole: string, task: AgentTask) => Promise<any>,
    maxRetries: number
  ): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await agentExecutor(step.agentRole, task);
      } catch (error: any) {
        lastError = error;
        if (attempt < maxRetries) {
          this.emit('step-retry', {
            step: step.name,
            attempt: attempt + 1,
            maxRetries,
          });
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError || new Error('Step execution failed');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get active workflow status
   */
  getWorkflowStatus(workflowId: string): WorkflowContext | undefined {
    return this.activeWorkflows.get(workflowId);
  }

  /**
   * List all registered workflows
   */
  listWorkflows(): Array<{ id: string; name: string; description: string }> {
    return Array.from(this.workflows.values()).map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
    }));
  }
}
