/**
 * Data Processor Agent
 * Main agent for processing data entries with validation and enrichment
 */

import { ClaudeAgent } from './agents/ClaudeAgent.js';
import { connectAgentDB } from './db/agentdb.js';
import { createCryptographicProof } from './utils/proofs.js';
import dotenv from 'dotenv';

dotenv.config();

// Connect to AgentDB
const db = connectAgentDB();

/**
 * Validate a record against rules
 * @param {object} record - Record to validate
 * @param {Array} rules - Validation rules
 * @returns {object}
 */
function validateRecord(record, rules) {
  const errors = [];
  const appliedRules = [];

  for (const rule of rules) {
    if (rule.rule_type !== 'validation') continue;

    const { field, operator, value } = rule.condition;

    appliedRules.push(rule.id);

    // Handle different operators
    switch (operator) {
      case 'gt':
        if (!(record.data[field] > value)) {
          errors.push({
            rule: rule.name,
            field,
            message: rule.action.message || `${field} must be greater than ${value}`
          });
        }
        break;

      case 'lt':
        if (!(record.data[field] < value)) {
          errors.push({
            rule: rule.name,
            field,
            message: rule.action.message || `${field} must be less than ${value}`
          });
        }
        break;

      case 'eq':
        if (record.data[field] !== value) {
          errors.push({
            rule: rule.name,
            field,
            message: rule.action.message || `${field} must equal ${value}`
          });
        }
        break;

      case 'regex':
        const regex = new RegExp(value);
        if (!regex.test(record.data[field])) {
          errors.push({
            rule: rule.name,
            field,
            message: rule.action.message || `${field} format is invalid`
          });
        }
        break;

      case 'exists':
        if (!(field in record.data) || record.data[field] === null || record.data[field] === undefined) {
          errors.push({
            rule: rule.name,
            field,
            message: rule.action.message || `${field} is required`
          });
        }
        break;

      default:
        console.warn(`Unknown operator: ${operator}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    appliedRules
  };
}

/**
 * Enrich a record with additional data
 * @param {object} record - Record to enrich
 * @param {Array} rules - Enrichment rules
 * @returns {object}
 */
function enrichRecord(record, rules) {
  const enrichedData = { ...record.data };
  const appliedRules = [];

  for (const rule of rules) {
    if (rule.rule_type !== 'enrichment') continue;

    appliedRules.push(rule.id);

    const { type, field, value } = rule.action;

    switch (type) {
      case 'add_field':
        if (value === 'NOW()') {
          enrichedData[field] = new Date().toISOString();
        } else if (value === 'COMPUTE_CATEGORY') {
          // Example: Categorize by amount
          if (enrichedData.amount) {
            enrichedData[field] = enrichedData.amount > 1000 ? 'high' :
                                 enrichedData.amount > 100 ? 'medium' : 'low';
          }
        } else {
          enrichedData[field] = value;
        }
        break;

      case 'transform':
        // Apply transformation logic
        if (enrichedData[field]) {
          enrichedData[field] = eval(value.replace('$value', enrichedData[field]));
        }
        break;

      default:
        console.warn(`Unknown enrichment type: ${type}`);
    }
  }

  return {
    data: enrichedData,
    appliedRules
  };
}

// Create the data processor agent
export const dataProcessor = new ClaudeAgent({
  name: 'DataProcessor',
  settingSources: ['project'],
  model: 'claude-3-5-sonnet-20241022',

  // Pre-tool hook: Load rules and memory
  preToolUse: async (context, toolName, toolInput) => {
    console.log(`📝 [PreToolUse] Preparing context for ${toolName}...`);

    // Load active rules
    context.rules = await db.getActiveRules();
    console.log(`   Loaded ${context.rules.length} active rules`);

    // Load agent memory for reflexion
    context.memory = await db.getMemory('DataProcessor', 'pattern');
    console.log(`   Loaded ${context.memory.length} memory patterns`);

    // Create audit trail for tool invocation
    context.auditTrailId = await db.createAuditTrail({
      eventType: 'tool_invoked',
      entityType: 'tool',
      entityId: toolName,
      actor: context.agentName,
      action: `invoke_${toolName}`,
      beforeState: { input: toolInput },
      afterState: null,
      changes: null,
      sessionId: context.sessionId,
      metadata: { timestamp: new Date().toISOString() }
    });
  },

  // Post-tool hook: Handle results and exceptions
  postToolUse: async (context, toolName, toolInput, result, executionTime, error) => {
    console.log(`📊 [PostToolUse] Processing results from ${toolName}...`);

    // Update audit trail
    if (context.auditTrailId) {
      await db.update('audit_trail',
        { id: context.auditTrailId },
        {
          after_state: { result, executionTime, error: error?.message },
          changes: { executionTime }
        }
      );

      // Create cryptographic proof if enabled
      if (process.env.ENABLE_LEAN_PROOFS === 'true') {
        const proof = await createCryptographicProof(context.auditTrailId, {
          toolName,
          toolInput,
          result,
          executionTime
        });

        await db.insert('cryptographic_proofs', proof);
        console.log(`   🔐 Cryptographic proof created: ${proof.hash}`);
      }
    }

    // Handle validation failures
    if (toolName === 'validate' && result && !result.valid) {
      console.log(`   ⚠️  Validation failed, creating exception...`);

      await db.insert('exceptions', {
        record_id: toolInput.recordId,
        exception_type: 'validation_failed',
        error_message: 'Record failed validation',
        error_details: { errors: result.errors },
        severity: result.errors.length > 3 ? 'high' : 'medium',
        reviewed: false
      });

      // Store reflexion memory
      await db.storeMemory({
        agentName: 'DataProcessor',
        memoryType: 'failure',
        content: `Validation failed for record ${toolInput.recordId}: ${result.errors.map(e => e.message).join(', ')}`,
        context: { errors: result.errors, rules: result.appliedRules },
        confidenceScore: 0.8
      });
    }

    // Store execution metric
    await db.storeMetric({
      metricType: 'tool_execution_time',
      metricValue: executionTime,
      metricUnit: 'ms',
      dimension: { tool: toolName, agent: context.agentName },
      aggregationPeriod: 'minute'
    });
  },

  // Tool definitions
  tools: {
    validate: {
      description: 'Validate a record against defined rules',
      parameters: {
        type: 'object',
        properties: {
          recordId: { type: 'string', description: 'Record ID to validate' },
          data: { type: 'object', description: 'Record data to validate' }
        },
        required: ['recordId', 'data']
      },
      execute: async (input, context) => {
        const validation = validateRecord(
          { id: input.recordId, data: input.data },
          context.rules
        );

        // Update record in database
        await db.update('records',
          { id: input.recordId },
          {
            valid: validation.valid,
            validation_errors: validation.errors,
            rules_applied: validation.appliedRules,
            status: validation.valid ? 'valid' : 'invalid'
          }
        );

        return validation;
      }
    },

    enrich: {
      description: 'Enrich a record with additional metadata',
      parameters: {
        type: 'object',
        properties: {
          recordId: { type: 'string', description: 'Record ID to enrich' },
          data: { type: 'object', description: 'Record data to enrich' }
        },
        required: ['recordId', 'data']
      },
      execute: async (input, context) => {
        const enrichment = enrichRecord(
          { id: input.recordId, data: input.data },
          context.rules
        );

        // Update record in database
        await db.update('records',
          { id: input.recordId },
          {
            data: enrichment.data,
            enriched: true,
            rules_applied: enrichment.appliedRules
          }
        );

        return enrichment;
      }
    },

    store: {
      description: 'Store a processed record',
      parameters: {
        type: 'object',
        properties: {
          data: { type: 'object', description: 'Record data to store' },
          externalId: { type: 'string', description: 'External reference ID' }
        },
        required: ['data']
      },
      execute: async (input, context) => {
        const startTime = Date.now();

        const record = await db.insert('records', {
          external_id: input.externalId,
          data: input.data,
          status: 'pending',
          process_time: null
        });

        const processTime = Date.now() - startTime;

        await db.update('records',
          { id: record.id },
          { process_time: processTime, processed_at: new Date().toISOString() }
        );

        return {
          success: true,
          recordId: record.id,
          processTime
        };
      }
    },

    fetch_csv: {
      description: 'Fetch and parse CSV data from a URL',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to fetch CSV from' }
        },
        required: ['url']
      },
      execute: async (input, context) => {
        // Mock implementation - in production, use actual CSV parser
        return {
          success: true,
          records: [],
          message: 'CSV parsing would happen here'
        };
      }
    }
  }
});

// Export function to process a single record
export async function processRecord(data, externalId = null) {
  const prompt = `
Process the following data record:

${JSON.stringify(data, null, 2)}

External ID: ${externalId || 'N/A'}

Steps:
1. Store the record using the 'store' tool
2. Validate the record using the 'validate' tool
3. If valid, enrich the record using the 'enrich' tool
4. Provide a summary of the processing results

Be thorough and use all available tools as needed.
  `.trim();

  const result = await dataProcessor.run(prompt);
  return result;
}

export default dataProcessor;
