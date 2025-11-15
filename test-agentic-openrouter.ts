#!/usr/bin/env tsx
/**
 * Test Agentic with OpenRouter
 * Verify the agentic library works with OpenRouter API
 */

import * as dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

console.log('\n' + '═'.repeat(70));
console.log('     🤖 AGENTIC + OPENROUTER VERIFICATION TEST');
console.log('═'.repeat(70) + '\n');

// Configure OpenRouter client
const openrouter = new OpenAI({
  baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/vibecast/franchise-manager',
    'X-Title': 'Vibecast Franchise Manager - Agent Test',
  }
});

const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek/deepseek-chat';

interface AgentConfig {
  name: string;
  role: string;
  systemPrompt: string;
}

class SimpleAgent {
  private name: string;
  private role: string;
  private systemPrompt: string;

  constructor(config: AgentConfig) {
    this.name = config.name;
    this.role = config.role;
    this.systemPrompt = config.systemPrompt;
  }

  async execute(userPrompt: string): Promise<any> {
    console.log(`\n🤖 Agent: ${this.name} (${this.role})`);
    console.log(`📝 Task: ${userPrompt.substring(0, 60)}...`);

    const startTime = Date.now();

    try {
      const completion = await openrouter.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const result = completion.choices[0]?.message?.content || 'No response';
      const duration = Date.now() - startTime;
      const tokens = completion.usage?.total_tokens || 0;

      console.log(`✅ Success in ${duration}ms (${tokens} tokens)`);
      console.log(`📊 Response preview: ${result.substring(0, 100)}...`);

      return {
        success: true,
        agent: this.name,
        result,
        duration,
        tokens,
        model: MODEL
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      console.log(`❌ Failed after ${duration}ms`);
      console.log(`⚠️  Error: ${errorMsg}`);

      return {
        success: false,
        agent: this.name,
        error: errorMsg,
        duration
      };
    }
  }
}

// Create test agents for franchise management
const agents = [
  new SimpleAgent({
    name: 'Financial Analyst',
    role: 'finance',
    systemPrompt: 'You are a financial analyst specializing in franchise performance. Provide concise financial insights.'
  }),
  new SimpleAgent({
    name: 'Growth Strategist',
    role: 'strategy',
    systemPrompt: 'You are a growth strategist for franchises. Provide concise expansion recommendations.'
  }),
  new SimpleAgent({
    name: 'Market Researcher',
    role: 'research',
    systemPrompt: 'You are a market researcher. Provide concise market analysis and insights.'
  })
];

// Test data
const testScenario = {
  franchise: {
    name: 'Tech Hub Franchise',
    locations: 3,
    totalRevenue: 2700000,
    totalExpenses: 1880000,
    avgProfitMargin: 0.30
  },
  market: {
    industry: 'Technology Services',
    growthRate: 0.15,
    competition: 'moderate'
  }
};

async function runAgentTests() {
  console.log('📋 Test Configuration:');
  console.log(`   Model: ${MODEL}`);
  console.log(`   Agents: ${agents.length}`);
  console.log(`   API Key: ${process.env.OPENROUTER_API_KEY?.substring(0, 20)}...`);
  console.log('');

  const results = [];

  // Test 1: Financial Analysis
  console.log('\n' + '─'.repeat(70));
  console.log('TEST 1: Financial Analysis Agent');
  console.log('─'.repeat(70));

  const financialTask = `Analyze this franchise financial data and provide 3 key insights:
Revenue: $2.7M, Expenses: $1.88M, Profit Margin: 30%, Locations: 3`;

  const result1 = await agents[0].execute(financialTask);
  results.push(result1);

  // Test 2: Growth Strategy
  console.log('\n' + '─'.repeat(70));
  console.log('TEST 2: Growth Strategy Agent');
  console.log('─'.repeat(70));

  const growthTask = `Recommend 3 growth strategies for a technology services franchise with 3 locations and 15% market growth rate.`;

  const result2 = await agents[1].execute(growthTask);
  results.push(result2);

  // Test 3: Market Research
  console.log('\n' + '─'.repeat(70));
  console.log('TEST 3: Market Research Agent');
  console.log('─'.repeat(70));

  const researchTask = `Analyze the technology services market with 15% growth and moderate competition. Provide 3 key opportunities.`;

  const result3 = await agents[2].execute(researchTask);
  results.push(result3);

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('                    TEST SUMMARY');
  console.log('═'.repeat(70) + '\n');

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalTokens = results.reduce((sum, r) => sum + (r.tokens || 0), 0);
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

  console.log(`Tests Run:        ${results.length}`);
  console.log(`✅ Successful:    ${successful}`);
  console.log(`❌ Failed:        ${failed}`);
  console.log(`📊 Total Tokens:  ${totalTokens}`);
  console.log(`⏱️  Avg Duration:  ${avgDuration.toFixed(0)}ms`);
  console.log('');

  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} Test ${index + 1}: ${result.agent}`);
  });

  console.log('\n' + '═'.repeat(70));

  if (successful === results.length) {
    console.log('🎉 ALL AGENTS WORKING WITH OPENROUTER! 🎉');
    console.log('✅ OpenRouter API connection successful');
    console.log('✅ DeepSeek-Chat model accessible');
    console.log('✅ Agent framework operational');
  } else {
    console.log('⚠️  SOME AGENTS FAILED - CHECK DETAILS ABOVE');
  }

  console.log('═'.repeat(70) + '\n');

  return successful === results.length;
}

// Run the tests
runAgentTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
  });
