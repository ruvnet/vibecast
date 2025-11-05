/**
 * Workflow DSL - Domain-Specific Language for Agentic Workflows
 *
 * Enables declarative workflow definition using YAML/JSON
 * Makes it easy for domain experts and engineers to collaborate
 *
 * Example:
 * ```yaml
 * workflow: order-fulfillment
 * description: Process customer orders from submission to shipping
 *
 * steps:
 *   - name: validate-order
 *     agent: data-validator
 *     input: order_data
 *     on_success: check-inventory
 *     on_failure: notify-customer
 *
 *   - name: check-inventory
 *     agent: inventory-checker
 *     input: order_items
 *     on_success: process-payment
 *     on_failure: backorder-items
 * ```
 */

import yaml from 'js-yaml';
import { AgenticPlatform } from './AgenticPlatform.js';
import { connectAgentDB } from '../db/agentdb.js';

export class WorkflowDSL {
  constructor(platform) {
    this.platform = platform || new AgenticPlatform();
    this.db = connectAgentDB();
    this.workflows = new Map();
  }

  /**
   * Parse workflow definition from YAML
   */
  parseYAML(yamlString) {
    try {
      const definition = yaml.load(yamlString);
      return this.validateDefinition(definition);
    } catch (error) {
      throw new Error(`Failed to parse workflow YAML: ${error.message}`);
    }
  }

  /**
   * Parse workflow definition from JSON
   */
  parseJSON(jsonString) {
    try {
      const definition = JSON.parse(jsonString);
      return this.validateDefinition(definition);
    } catch (error) {
      throw new Error(`Failed to parse workflow JSON: ${error.message}`);
    }
  }

  /**
   * Validate workflow definition
   */
  validateDefinition(definition) {
    const required = ['workflow', 'steps'];

    for (const field of required) {
      if (!definition[field]) {
        throw new Error(`Workflow definition missing required field: ${field}`);
      }
    }

    // Validate steps
    if (!Array.isArray(definition.steps) || definition.steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }

    for (const step of definition.steps) {
      if (!step.name) {
        throw new Error('Step missing required field: name');
      }

      if (!step.agent && !step.action) {
        throw new Error(`Step '${step.name}' must specify either 'agent' or 'action'`);
      }
    }

    return definition;
  }

  /**
   * Compile workflow definition into executable workflow
   */
  async compile(definition) {
    console.log(`\n🔧 Compiling workflow: ${definition.workflow}`);

    const workflow = {
      name: definition.workflow,
      description: definition.description || '',
      steps: [],
      metadata: definition.metadata || {}
    };

    // Compile each step
    for (const stepDef of definition.steps) {
      const step = await this._compileStep(stepDef);
      workflow.steps.push(step);
    }

    // Register workflow
    this.workflows.set(workflow.name, workflow);

    // Save to database
    await this.db.insert('workflows', {
      name: workflow.name,
      description: workflow.description,
      definition: workflow,
      compiled_at: new Date().toISOString()
    });

    console.log(`✅ Workflow compiled: ${workflow.name} (${workflow.steps.length} steps)`);

    return workflow;
  }

  /**
   * Compile a single step
   */
  async _compileStep(stepDef) {
    const step = {
      name: stepDef.name,
      description: stepDef.description || '',
      type: stepDef.agent ? 'agent' : 'action',
      config: {}
    };

    if (stepDef.agent) {
      // Agent-based step
      step.config.agentName = stepDef.agent;
      step.config.input = stepDef.input;
      step.config.output = stepDef.output;

      // Verify agent exists or can be created
      let agent = this.platform.getAgent(stepDef.agent);

      if (!agent && stepDef.agent_spec) {
        // Create agent on the fly
        console.log(`   📦 Creating agent: ${stepDef.agent}`);
        const { agent: newAgent } = await this.platform.scaffoldAgent(stepDef.agent_spec);
        agent = newAgent;
      }

      if (!agent) {
        throw new Error(`Agent '${stepDef.agent}' not found and no spec provided`);
      }
    } else if (stepDef.action) {
      // Action-based step
      step.config.action = stepDef.action;
      step.config.parameters = stepDef.parameters || {};
    }

    // Transitions
    step.transitions = {
      on_success: stepDef.on_success || null,
      on_failure: stepDef.on_failure || null,
      on_timeout: stepDef.on_timeout || null
    };

    // Conditions
    if (stepDef.condition) {
      step.condition = this._compileCondition(stepDef.condition);
    }

    // Retries
    step.retries = stepDef.retries || 0;
    step.timeout = stepDef.timeout || 30000; // 30 second default

    return step;
  }

  /**
   * Compile a condition expression
   */
  _compileCondition(condition) {
    // Support simple condition expressions
    // Example: "order.total > 1000" or "status == 'approved'"

    return {
      expression: condition,
      evaluate: (context) => {
        // Safe evaluation of condition
        try {
          // In production, use a safe expression evaluator
          // For now, support basic comparisons
          const parts = condition.match(/(\w+\.?\w*)\s*(==|!=|>|<|>=|<=)\s*(['"]?\w+['"]?|\d+)/);

          if (!parts) {
            return true; // Default to true if can't parse
          }

          const [, left, operator, right] = parts;
          const leftValue = this._resolveValue(left, context);
          const rightValue = right.replace(/['"]/g, '');

          switch (operator) {
            case '==': return leftValue == rightValue;
            case '!=': return leftValue != rightValue;
            case '>': return parseFloat(leftValue) > parseFloat(rightValue);
            case '<': return parseFloat(leftValue) < parseFloat(rightValue);
            case '>=': return parseFloat(leftValue) >= parseFloat(rightValue);
            case '<=': return parseFloat(leftValue) <= parseFloat(rightValue);
            default: return true;
          }
        } catch (error) {
          console.error(`Condition evaluation error: ${error.message}`);
          return false;
        }
      }
    };
  }

  /**
   * Resolve a value from context
   */
  _resolveValue(path, context) {
    const parts = path.split('.');
    let value = context;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Execute a workflow
   */
  async execute(workflowName, initialInput, context = {}) {
    const workflow = this.workflows.get(workflowName);

    if (!workflow) {
      throw new Error(`Workflow '${workflowName}' not found`);
    }

    console.log(`\n▶️  Executing workflow: ${workflowName}`);
    console.log('━'.repeat(80));

    const execution = {
      workflowName,
      startTime: Date.now(),
      steps: [],
      status: 'running',
      context: {
        ...context,
        input: initialInput
      }
    };

    // Create execution record
    const executionRecord = await this.db.insert('workflow_executions', {
      workflow_name: workflowName,
      status: 'running',
      started_at: new Date().toISOString(),
      context: execution.context
    });

    execution.id = executionRecord.id;

    // Execute steps in order
    let currentStep = workflow.steps[0];
    let stepIndex = 0;

    while (currentStep) {
      console.log(`\n📍 Step ${stepIndex + 1}/${workflow.steps.length}: ${currentStep.name}`);

      // Check condition
      if (currentStep.condition && !currentStep.condition.evaluate(execution.context)) {
        console.log('   ⏭️  Condition not met, skipping');
        execution.steps.push({
          name: currentStep.name,
          status: 'skipped',
          reason: 'Condition not met'
        });

        currentStep = this._getNextStep(workflow, currentStep, 'skipped');
        stepIndex++;
        continue;
      }

      // Execute step with retries
      let attempts = 0;
      let success = false;
      let result = null;
      let error = null;

      while (attempts <= currentStep.retries && !success) {
        try {
          if (attempts > 0) {
            console.log(`   🔄 Retry attempt ${attempts}/${currentStep.retries}`);
          }

          result = await this._executeStep(currentStep, execution.context);
          success = true;

          console.log('   ✅ Step completed');

        } catch (err) {
          error = err;
          attempts++;

          if (attempts > currentStep.retries) {
            console.log(`   ❌ Step failed after ${attempts} attempts: ${err.message}`);
          }
        }
      }

      // Record step execution
      execution.steps.push({
        name: currentStep.name,
        status: success ? 'completed' : 'failed',
        attempts,
        result,
        error: error?.message,
        duration: Date.now() - execution.startTime
      });

      // Update workflow context with step result
      execution.context[currentStep.name] = result;

      // Determine next step
      const transitionKey = success ? 'on_success' : 'on_failure';
      currentStep = this._getNextStep(workflow, currentStep, transitionKey);
      stepIndex++;

      // Break if no more steps or max iterations reached
      if (!currentStep || stepIndex > 100) {
        break;
      }
    }

    // Finalize execution
    execution.endTime = Date.now();
    execution.duration = execution.endTime - execution.startTime;
    execution.status = execution.steps.every(s => s.status === 'completed' || s.status === 'skipped')
      ? 'completed'
      : 'failed';

    // Update execution record
    await this.db.update('workflow_executions',
      { id: execution.id },
      {
        status: execution.status,
        completed_at: new Date().toISOString(),
        duration: execution.duration,
        result: execution.context
      }
    );

    console.log('\n━'.repeat(80));
    console.log(`⏹️  Workflow ${execution.status}: ${workflowName}`);
    console.log(`   Duration: ${execution.duration}ms`);
    console.log(`   Steps: ${execution.steps.length}`);
    console.log('━'.repeat(80));

    return execution;
  }

  /**
   * Execute a single step
   */
  async _executeStep(step, context) {
    const startTime = Date.now();

    if (step.type === 'agent') {
      // Execute agent
      const agentName = step.config.agentName;
      const input = this._resolveValue(step.config.input, context) || context.input;

      const prompt = typeof input === 'string'
        ? input
        : `Process this data: ${JSON.stringify(input)}`;

      const result = await this.platform.runAgent(agentName, prompt, context);

      return {
        type: 'agent',
        agent: agentName,
        result,
        duration: Date.now() - startTime
      };

    } else if (step.type === 'action') {
      // Execute action
      const action = step.config.action;
      const parameters = step.config.parameters;

      // Built-in actions
      switch (action) {
        case 'log':
          console.log('   📝', parameters.message);
          return { type: 'action', action: 'log', message: parameters.message };

        case 'wait':
          await new Promise(resolve => setTimeout(resolve, parameters.duration || 1000));
          return { type: 'action', action: 'wait', duration: parameters.duration };

        case 'transform':
          // Apply transformation to data
          const transformed = this._transform(context.input, parameters.transformation);
          return { type: 'action', action: 'transform', result: transformed };

        case 'branch':
          // Branching logic
          const conditionMet = this._compileCondition(parameters.condition).evaluate(context);
          return { type: 'action', action: 'branch', conditionMet };

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    }

    throw new Error(`Unknown step type: ${step.type}`);
  }

  /**
   * Get next step based on transition
   */
  _getNextStep(workflow, currentStep, transitionKey) {
    const nextStepName = currentStep.transitions[transitionKey];

    if (!nextStepName) {
      // No explicit transition, try next step in sequence
      const currentIndex = workflow.steps.findIndex(s => s.name === currentStep.name);
      return workflow.steps[currentIndex + 1] || null;
    }

    // Find step by name
    return workflow.steps.find(s => s.name === nextStepName) || null;
  }

  /**
   * Transform data
   */
  _transform(data, transformation) {
    // Simple transformations
    // In production, support JSONPath, jq, etc.
    return data;
  }

  /**
   * List available workflows
   */
  listWorkflows() {
    return Array.from(this.workflows.entries()).map(([name, workflow]) => ({
      name,
      description: workflow.description,
      steps: workflow.steps.length,
      metadata: workflow.metadata
    }));
  }

  /**
   * Get workflow definition
   */
  getWorkflow(name) {
    return this.workflows.get(name);
  }
}

export default WorkflowDSL;
