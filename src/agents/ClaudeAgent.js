/**
 * Claude-Flow Agent
 * Implements an agentic workflow with PreToolUse/PostToolUse hooks
 */

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { nanoid } from 'nanoid';

dotenv.config();

export class ClaudeAgent {
  constructor(config) {
    this.name = config.name || 'ClaudeAgent';
    this.settingSources = config.settingSources || ['project'];
    this.tools = config.tools || {};
    this.preToolUse = config.preToolUse || null;
    this.postToolUse = config.postToolUse || null;
    this.model = config.model || 'claude-3-5-sonnet-20241022';
    this.maxTokens = config.maxTokens || 4096;

    // Initialize Anthropic client
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Session tracking
    this.sessionId = nanoid();
    this.conversationHistory = [];
  }

  /**
   * Convert tools object to Anthropic tool format
   * @returns {Array}
   */
  getToolDefinitions() {
    return Object.entries(this.tools).map(([name, func]) => {
      // Extract parameter info from function if available
      const params = func.parameters || {
        type: 'object',
        properties: {},
        required: []
      };

      return {
        name,
        description: func.description || `Tool: ${name}`,
        input_schema: params
      };
    });
  }

  /**
   * Execute a tool
   * @param {string} toolName - Tool name
   * @param {object} toolInput - Tool input
   * @param {object} context - Execution context
   * @returns {Promise<any>}
   */
  async executeTool(toolName, toolInput, context) {
    if (!this.tools[toolName]) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    // Execute pre-tool hook if defined
    if (this.preToolUse) {
      await this.preToolUse(context, toolName, toolInput);
    }

    // Execute the tool
    const startTime = Date.now();
    let result;
    let error = null;

    try {
      result = await this.tools[toolName](toolInput, context);
    } catch (err) {
      error = err;
      console.error(`Tool execution error (${toolName}):`, err);
      result = { error: err.message };
    }

    const executionTime = Date.now() - startTime;

    // Execute post-tool hook if defined
    if (this.postToolUse) {
      await this.postToolUse(context, toolName, toolInput, result, executionTime, error);
    }

    return result;
  }

  /**
   * Run the agent with a given prompt
   * @param {string} prompt - User prompt
   * @param {object} context - Execution context
   * @returns {Promise<object>}
   */
  async run(prompt, context = {}) {
    console.log(`\n🤖 [${this.name}] Starting execution...`);
    console.log(`📋 Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}\n`);

    // Add session info to context
    context.sessionId = this.sessionId;
    context.agentName = this.name;

    // Initialize conversation with user message
    const messages = [
      {
        role: 'user',
        content: prompt
      }
    ];

    let continueLoop = true;
    let finalResponse = null;
    let toolUseCount = 0;

    while (continueLoop) {
      try {
        // Call Claude API
        const response = await this.anthropic.messages.create({
          model: this.model,
          max_tokens: this.maxTokens,
          tools: this.getToolDefinitions(),
          messages
        });

        // Process response
        const { content, stop_reason } = response;

        // Check if Claude wants to use tools
        const toolUses = content.filter(block => block.type === 'tool_use');
        const textBlocks = content.filter(block => block.type === 'text');

        // Display any text responses
        textBlocks.forEach(block => {
          console.log(`💬 [${this.name}]: ${block.text}\n`);
        });

        if (toolUses.length > 0) {
          // Execute tools
          const toolResults = [];

          for (const toolUse of toolUses) {
            toolUseCount++;
            console.log(`🔧 Tool ${toolUseCount}: ${toolUse.name}`);
            console.log(`   Input:`, JSON.stringify(toolUse.input, null, 2));

            const result = await this.executeTool(toolUse.name, toolUse.input, context);

            console.log(`   Result:`, JSON.stringify(result, null, 2).substring(0, 200));

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify(result)
            });
          }

          // Add assistant message with tool uses
          messages.push({
            role: 'assistant',
            content
          });

          // Add tool results
          messages.push({
            role: 'user',
            content: toolResults
          });

          // Continue the loop to let Claude process tool results
          continueLoop = true;

        } else {
          // No more tool uses, conversation complete
          continueLoop = false;
          finalResponse = {
            text: textBlocks.map(b => b.text).join('\n'),
            toolUseCount,
            stopReason: stop_reason
          };
        }

      } catch (error) {
        console.error(`❌ [${this.name}] Error:`, error.message);
        throw error;
      }
    }

    console.log(`✅ [${this.name}] Execution complete (${toolUseCount} tool uses)\n`);

    return finalResponse;
  }

  /**
   * Reset conversation history
   */
  reset() {
    this.sessionId = nanoid();
    this.conversationHistory = [];
  }
}

export default ClaudeAgent;
