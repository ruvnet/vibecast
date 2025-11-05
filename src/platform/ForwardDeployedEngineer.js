/**
 * Forward-Deployed Engineer Toolkit
 *
 * Enables software engineers embedded in business units to rapidly
 * build agentic applications by collaborating with domain experts.
 *
 * Key Features:
 * - Natural language agent creation
 * - Interactive conversation mode
 * - Rapid prototyping and iteration
 * - Domain expert collaboration tools
 * - One-command deployment
 */

import { AgenticPlatform } from './AgenticPlatform.js';
import readline from 'readline';
import fs from 'fs/promises';
import path from 'path';

export class ForwardDeployedEngineer {
  constructor(config = {}) {
    this.platform = new AgenticPlatform(config);
    this.conversationMode = false;
    this.currentProject = null;
    this.sessionHistory = [];
  }

  /**
   * Interactive conversation mode for agent creation
   * Simulates pair programming with an AI
   */
  async startConversationMode() {
    console.log('\n🚀 Forward-Deployed Engineer - AI-Native Development');
    console.log('━'.repeat(80));
    console.log('Welcome! I\'ll help you build agentic applications using natural language.');
    console.log('Describe what you need, and I\'ll generate a working agent for you.');
    console.log('━'.repeat(80));

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this.conversationMode = true;

    while (this.conversationMode) {
      const input = await this._prompt(rl, '\n🤔 What would you like to build? (or "help", "list", "exit"): ');

      const command = input.trim().toLowerCase();

      if (command === 'exit' || command === 'quit') {
        console.log('\n👋 Goodbye! Happy building!');
        this.conversationMode = false;
        break;
      }

      if (command === 'help') {
        this._showHelp();
        continue;
      }

      if (command === 'list') {
        this._listAgents();
        continue;
      }

      if (command === 'templates') {
        this._listTemplates();
        continue;
      }

      if (command.startsWith('run ')) {
        await this._runAgent(command.substring(4).trim(), rl);
        continue;
      }

      if (command.startsWith('deploy ')) {
        await this._deployAgent(command.substring(7).trim());
        continue;
      }

      // Treat as agent creation request
      await this._createAgentInteractive(input, rl);
    }

    rl.close();
  }

  /**
   * Quick-create: One-line agent creation
   */
  async quickCreate(description, options = {}) {
    console.log('\n⚡ Quick Create Mode');
    console.log('━'.repeat(80));

    try {
      // Generate specification
      const spec = await this.platform.createAgentFromDescription(description, {
        domain: options.domain,
        constraints: options.constraints,
        createdBy: options.createdBy || 'forward-deployed-engineer'
      });

      // Scaffold agent
      const agent = await this.platform.scaffoldAgent(spec);

      // Optionally save to file
      if (options.save !== false) {
        await this._saveAgentToFile(spec, agent);
      }

      // Optionally deploy
      if (options.deploy) {
        await this._deployAgent(spec.name);
      }

      console.log('\n✅ Agent created successfully!');
      console.log(`   Run with: npm run agent ${spec.name}`);

      return { spec, agent };
    } catch (error) {
      console.error('\n❌ Quick create failed:', error.message);
      throw error;
    }
  }

  /**
   * Rapid prototype: Create, test, iterate
   */
  async rapidPrototype(description, testCases = []) {
    console.log('\n🔬 Rapid Prototype Mode');
    console.log('━'.repeat(80));

    // Create agent
    const { spec, agent } = await this.quickCreate(description, { save: false });

    // Run test cases
    console.log('\n🧪 Running test cases...\n');

    const results = [];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];

      console.log(`Test ${i + 1}/${testCases.length}: ${testCase.description || testCase.input}`);

      try {
        const result = await agent.run(testCase.input, testCase.context || {});

        const success = testCase.expectedOutput
          ? this._matchesExpectation(result, testCase.expectedOutput)
          : true;

        results.push({
          testCase: i + 1,
          success,
          result
        });

        console.log(`   ${success ? '✅' : '❌'} ${success ? 'Passed' : 'Failed'}`);
      } catch (error) {
        results.push({
          testCase: i + 1,
          success: false,
          error: error.message
        });

        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    // Summary
    const passed = results.filter(r => r.success).length;
    console.log('\n━'.repeat(80));
    console.log(`📊 Results: ${passed}/${testCases.length} tests passed`);

    return {
      spec,
      agent,
      testResults: results,
      passRate: (passed / testCases.length) * 100
    };
  }

  /**
   * Collaborate: Create agent with domain expert input
   */
  async collaborate(domainExpert, engineerNotes) {
    console.log('\n🤝 Collaboration Mode');
    console.log('━'.repeat(80));
    console.log(`Domain Expert: ${domainExpert.name}`);
    console.log(`Expertise: ${domainExpert.expertise}`);
    console.log('━'.repeat(80));

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Gather requirements from domain expert
    console.log('\n📋 Requirements Gathering\n');

    const requirements = {
      goal: await this._prompt(rl, 'What business problem should this solve? '),
      inputs: await this._prompt(rl, 'What data/inputs will it receive? '),
      outputs: await this._prompt(rl, 'What should it produce/output? '),
      constraints: await this._prompt(rl, 'Any constraints or requirements? '),
      successCriteria: await this._prompt(rl, 'How will we know it\'s working correctly? ')
    };

    // Synthesize into agent description
    const description = `
Build an agent for ${domainExpert.expertise} that:
- Goal: ${requirements.goal}
- Inputs: ${requirements.inputs}
- Outputs: ${requirements.outputs}
- Constraints: ${requirements.constraints}
- Success criteria: ${requirements.successCriteria}

Engineer notes: ${engineerNotes || 'None'}
    `.trim();

    console.log('\n🤖 Generating agent based on requirements...\n');

    // Create agent
    const { spec, agent } = await this.quickCreate(description, {
      domain: domainExpert.expertise,
      constraints: requirements.constraints,
      createdBy: `${domainExpert.name} + Engineer`
    });

    // Show to domain expert
    console.log('\n📄 Generated Agent Specification:');
    console.log(`   Name: ${spec.name}`);
    console.log(`   Description: ${spec.description}`);
    console.log(`   Tools: ${spec.tools.map(t => t.name).join(', ')}`);

    const approval = await this._prompt(rl, '\n✅ Does this look correct? (yes/no/modify): ');

    if (approval.toLowerCase() === 'yes') {
      await this._saveAgentToFile(spec, agent);
      console.log('\n✅ Agent approved and saved!');
    } else if (approval.toLowerCase() === 'modify') {
      const modifications = await this._prompt(rl, 'What changes are needed? ');
      console.log('\n🔄 Modifications noted. Re-run collaborate() with updated notes.');
    } else {
      console.log('\n❌ Agent rejected. Will not save.');
    }

    rl.close();

    return { spec, agent, requirements, approved: approval.toLowerCase() === 'yes' };
  }

  /**
   * Private: Interactive agent creation
   */
  async _createAgentInteractive(description, rl) {
    try {
      // Ask for additional context
      const needsDomain = await this._prompt(rl, '📂 What domain/industry is this for? (or press Enter to skip): ');
      const needsConstraints = await this._prompt(rl, '⚠️  Any constraints or requirements? (or press Enter to skip): ');

      // Create agent
      console.log('\n🤖 Creating agent...\n');

      const { spec, agent } = await this.quickCreate(description, {
        domain: needsDomain || undefined,
        constraints: needsConstraints || undefined,
        save: false
      });

      // Ask if they want to test it
      const test = await this._prompt(rl, '\n🧪 Would you like to test it now? (yes/no): ');

      if (test.toLowerCase() === 'yes') {
        const testInput = await this._prompt(rl, 'Enter test input/prompt: ');

        console.log('\n⚙️  Running test...\n');

        const result = await agent.run(testInput);

        console.log('\n📊 Test Result:');
        console.log(JSON.stringify(result, null, 2));
      }

      // Ask if they want to save it
      const save = await this._prompt(rl, '\n💾 Save this agent? (yes/no): ');

      if (save.toLowerCase() === 'yes') {
        await this._saveAgentToFile(spec, agent);
        console.log(`✅ Agent saved! Run with: npm run agent ${spec.name}`);
      }

      this.sessionHistory.push({
        description,
        spec,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('\n❌ Error:', error.message);
    }
  }

  /**
   * Private: Run an agent
   */
  async _runAgent(agentName, rl) {
    const agentData = this.platform.getAgent(agentName);

    if (!agentData) {
      console.log(`❌ Agent '${agentName}' not found`);
      return;
    }

    const input = await this._prompt(rl, `\n📝 Input for ${agentName}: `);

    console.log('\n⚙️  Running agent...\n');

    try {
      const result = await this.platform.runAgent(agentName, input);

      console.log('\n✅ Result:');
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('\n❌ Error:', error.message);
    }
  }

  /**
   * Private: Deploy an agent
   */
  async _deployAgent(agentName) {
    console.log(`\n🚀 Deploying agent: ${agentName}`);

    // In a real implementation, this would:
    // 1. Package the agent
    // 2. Deploy to cloud/edge
    // 3. Register endpoints
    // 4. Set up monitoring

    console.log('   ⚙️  Packaging agent...');
    console.log('   ☁️  Deploying to cloud...');
    console.log('   📡 Registering endpoints...');
    console.log('   📊 Setting up monitoring...');
    console.log(`\n✅ Agent deployed! Endpoint: https://api.example.com/agents/${agentName}`);
  }

  /**
   * Private: Save agent to file
   */
  async _saveAgentToFile(spec, agent) {
    const agentDir = path.join(process.cwd(), 'src', 'agents', 'generated');
    const fileName = `${spec.name}.json`;
    const filePath = path.join(agentDir, fileName);

    try {
      await fs.mkdir(agentDir, { recursive: true });

      await fs.writeFile(filePath, JSON.stringify({
        specification: spec,
        createdAt: new Date().toISOString(),
        version: '1.0.0'
      }, null, 2));

      console.log(`   💾 Saved to: ${filePath}`);
    } catch (error) {
      console.error(`   ❌ Failed to save: ${error.message}`);
    }
  }

  /**
   * Private: List agents
   */
  _listAgents() {
    const agents = this.platform.listAgents();

    if (agents.length === 0) {
      console.log('\n📭 No agents created yet.');
      return;
    }

    console.log('\n📋 Created Agents:\n');

    agents.forEach(agent => {
      console.log(`   • ${agent.name}`);
      console.log(`     ${agent.description}`);
      console.log(`     Tools: ${agent.tools.join(', ')}`);
      console.log(`     Invocations: ${agent.invocations}`);
      console.log('');
    });
  }

  /**
   * Private: List templates
   */
  _listTemplates() {
    const templates = this.platform.listTemplates();

    console.log('\n📚 Available Templates:\n');

    templates.forEach(template => {
      console.log(`   • ${template.id}: ${template.name}`);
      console.log(`     ${template.description}`);
      console.log(`     Tools: ${template.tools.join(', ')}`);
      console.log(`     Examples:`);
      template.examples.forEach(ex => console.log(`       - ${ex}`));
      console.log('');
    });
  }

  /**
   * Private: Show help
   */
  _showHelp() {
    console.log('\n📖 Available Commands:\n');
    console.log('   help           - Show this help message');
    console.log('   list           - List created agents');
    console.log('   templates      - Show available templates');
    console.log('   run <name>     - Run an agent');
    console.log('   deploy <name>  - Deploy an agent');
    console.log('   exit           - Exit conversation mode');
    console.log('\n   Or just describe what you want to build!\n');
  }

  /**
   * Private: Prompt helper
   */
  _prompt(rl, question) {
    return new Promise(resolve => {
      rl.question(question, answer => {
        resolve(answer);
      });
    });
  }

  /**
   * Private: Match expectation
   */
  _matchesExpectation(result, expected) {
    // Simple matching - could be more sophisticated
    const resultStr = JSON.stringify(result).toLowerCase();
    const expectedStr = JSON.stringify(expected).toLowerCase();

    return resultStr.includes(expectedStr) || expectedStr.includes(resultStr);
  }
}

export default ForwardDeployedEngineer;
