#!/usr/bin/env tsx
/**
 * Real Multi-Agent Franchise Management System
 * Uses actual OpenRouter API with DeepSeek-Chat model
 * Spawns 5 concurrent agent swarms for franchise operations
 */

import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { EventEmitter } from 'events';

dotenv.config();

// Configure OpenRouter client
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/vibecast/franchise-manager',
    'X-Title': 'Vibecast Franchise Manager',
  }
});

const MODEL = 'deepseek/deepseek-chat';

interface AgentTask {
  id: string;
  name: string;
  role: string;
  prompt: string;
  context?: any;
}

interface AgentResult {
  agentId: string;
  agentName: string;
  result: string;
  tokensUsed: number;
  duration: number;
  success: boolean;
  error?: string;
}

class FranchiseAgent extends EventEmitter {
  private id: string;
  private name: string;
  private role: string;
  private systemPrompt: string;

  constructor(id: string, name: string, role: string, systemPrompt: string) {
    super();
    this.id = id;
    this.name = name;
    this.role = role;
    this.systemPrompt = systemPrompt;
  }

  async execute(prompt: string, context?: any): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      this.emit('start', { agentId: this.id, agentName: this.name });

      console.log(`\n🤖 [${this.name}] Starting task...`);

      const fullPrompt = context
        ? `${prompt}\n\nContext:\n${JSON.stringify(context, null, 2)}`
        : prompt;

      const completion = await openrouter.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: fullPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const result = completion.choices[0]?.message?.content || 'No response';
      const tokensUsed = completion.usage?.total_tokens || 0;
      const duration = Date.now() - startTime;

      console.log(`✅ [${this.name}] Completed in ${duration}ms (${tokensUsed} tokens)`);

      this.emit('complete', {
        agentId: this.id,
        agentName: this.name,
        tokensUsed,
        duration
      });

      return {
        agentId: this.id,
        agentName: this.name,
        result,
        tokensUsed,
        duration,
        success: true
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error(`❌ [${this.name}] Failed: ${errorMessage}`);

      this.emit('error', {
        agentId: this.id,
        agentName: this.name,
        error: errorMessage
      });

      return {
        agentId: this.id,
        agentName: this.name,
        result: '',
        tokensUsed: 0,
        duration,
        success: false,
        error: errorMessage
      };
    }
  }
}

class FranchiseAgentSwarm {
  private agents: Map<string, FranchiseAgent> = new Map();
  private results: Map<string, AgentResult> = new Map();

  constructor() {
    this.initializeAgents();
  }

  private initializeAgents() {
    // Agent 1: Franchise Analyzer
    const analyzer = new FranchiseAgent(
      'agent-1-analyzer',
      'Franchise Performance Analyzer',
      'analyst',
      `You are an expert franchise performance analyst. You analyze franchise data including revenue, expenses, growth rates, and operational metrics. Provide detailed insights, identify trends, and recommend improvements.`
    );

    // Agent 2: Growth Strategist
    const strategist = new FranchiseAgent(
      'agent-2-strategist',
      'Growth Strategy Expert',
      'strategist',
      `You are a franchise growth strategist. You develop expansion plans, identify new market opportunities, assess territory potential, and create ROI projections. Focus on scalable growth strategies.`
    );

    // Agent 3: Territory Optimizer
    const territorial = new FranchiseAgent(
      'agent-3-territorial',
      'Territory Management Specialist',
      'territorial',
      `You are a territory management expert. You analyze geographic data, optimize territory boundaries, resolve conflicts, and ensure efficient market coverage. Use data-driven approaches.`
    );

    // Agent 4: Compliance Monitor
    const compliance = new FranchiseAgent(
      'agent-4-compliance',
      'Regulatory Compliance Officer',
      'compliance',
      `You are a franchise compliance expert. You monitor regulatory requirements, ensure operational compliance, track contract adherence, and identify risk factors. Provide actionable compliance recommendations.`
    );

    // Agent 5: Financial Planner
    const financial = new FranchiseAgent(
      'agent-5-financial',
      'Financial Planning Expert',
      'financial',
      `You are a franchise financial planner. You analyze revenue streams, optimize cost structures, calculate ROI, manage royalty structures, and provide financial forecasts. Focus on profitability and sustainability.`
    );

    this.agents.set(analyzer.id, analyzer);
    this.agents.set(strategist.id, strategist);
    this.agents.set(territorial.id, territorial);
    this.agents.set(compliance.id, compliance);
    this.agents.set(financial.id, financial);

    // Set up event listeners
    this.agents.forEach(agent => {
      agent.on('start', (data) => console.log(`⏳ Agent started: ${data.agentName}`));
      agent.on('complete', (data) => console.log(`✅ Agent completed: ${data.agentName}`));
      agent.on('error', (data) => console.error(`❌ Agent error: ${data.agentName} - ${data.error}`));
    });
  }

  async executeSwarmTask(task: string, context?: any): Promise<Map<string, AgentResult>> {
    console.log(`\n🚀 Starting 5-Agent Swarm on task: "${task}"\n`);
    console.log('=' .repeat(80));

    const agentArray = Array.from(this.agents.values());

    // Execute all agents concurrently
    const promises = agentArray.map(agent =>
      agent.execute(task, context)
    );

    const results = await Promise.all(promises);

    // Store results
    results.forEach(result => {
      this.results.set(result.agentId, result);
    });

    console.log('\n' + '='.repeat(80));
    this.printSummary(results);

    return this.results;
  }

  private printSummary(results: AgentResult[]) {
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0);
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const avgDuration = totalDuration / results.length;

    console.log('\n📊 Swarm Execution Summary:');
    console.log(`   ✅ Successful: ${successful}/5`);
    console.log(`   ❌ Failed: ${failed}/5`);
    console.log(`   🎯 Total Tokens: ${totalTokens}`);
    console.log(`   ⏱️  Average Duration: ${avgDuration.toFixed(0)}ms`);
    console.log(`   ⚡ Total Duration: ${totalDuration.toFixed(0)}ms`);
  }

  getResults(): Map<string, AgentResult> {
    return this.results;
  }

  printDetailedResults() {
    console.log('\n\n' + '='.repeat(80));
    console.log('📋 DETAILED AGENT RESULTS');
    console.log('='.repeat(80));

    this.results.forEach((result, agentId) => {
      console.log(`\n\n🤖 ${result.agentName} (${agentId})`);
      console.log('-'.repeat(80));
      if (result.success) {
        console.log(result.result);
        console.log(`\n📊 Tokens: ${result.tokensUsed} | Duration: ${result.duration}ms`);
      } else {
        console.log(`❌ Error: ${result.error}`);
      }
    });

    console.log('\n' + '='.repeat(80));
  }
}

// Example franchise data for testing
const exampleFranchiseData = {
  franchises: [
    {
      id: 'fr-001',
      name: 'Downtown Tech Hub',
      location: 'New York, NY',
      revenue: 850000,
      expenses: 620000,
      profit: 230000,
      employees: 12,
      openDate: '2022-03-15',
      status: 'active'
    },
    {
      id: 'fr-002',
      name: 'Silicon Valley Center',
      location: 'San Jose, CA',
      revenue: 1200000,
      expenses: 780000,
      profit: 420000,
      employees: 18,
      openDate: '2021-08-01',
      status: 'active'
    },
    {
      id: 'fr-003',
      name: 'Austin Innovation Lab',
      location: 'Austin, TX',
      revenue: 650000,
      expenses: 480000,
      profit: 170000,
      employees: 10,
      openDate: '2023-01-10',
      status: 'active'
    }
  ],
  marketData: {
    totalMarketSize: 50000000,
    growthRate: 0.15,
    competition: 'moderate',
    opportunityScore: 7.5
  }
};

// Main execution
async function main() {
  console.log('🚀 Vibecast Franchise Manager - Multi-Agent Swarm System\n');
  console.log(`📡 Using Model: ${MODEL}`);
  console.log(`🔑 API Key: ${process.env.OPENROUTER_API_KEY?.substring(0, 20)}...`);
  console.log('');

  const swarm = new FranchiseAgentSwarm();

  const task = `Analyze the following franchise portfolio and provide comprehensive insights:

1. Performance analysis of each franchise
2. Growth opportunities and expansion recommendations
3. Territory optimization strategies
4. Compliance and risk assessment
5. Financial projections and ROI analysis

Be specific, data-driven, and actionable in your recommendations.`;

  try {
    await swarm.executeSwarmTask(task, exampleFranchiseData);
    swarm.printDetailedResults();

    console.log('\n\n✨ Multi-Agent Swarm execution completed successfully!');
    console.log('📦 Results saved and ready for review.\n');

  } catch (error) {
    console.error('\n❌ Swarm execution failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

export { FranchiseAgent, FranchiseAgentSwarm, AgentTask, AgentResult };
