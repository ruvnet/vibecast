#!/usr/bin/env node

/**
 * AI-Native Platform CLI
 *
 * Command-line interface for forward-deployed engineers
 * to rapidly build and deploy agentic applications.
 *
 * Usage:
 *   npm run platform                    - Interactive mode
 *   npm run platform create "..."       - Quick create agent
 *   npm run platform collaborate        - Collaborate with domain expert
 *   npm run platform prototype "..."    - Rapid prototype
 *   npm run platform workflow <file>    - Execute workflow
 *   npm run platform list               - List agents
 *   npm run platform templates          - Show templates
 */

import { ForwardDeployedEngineer } from './platform/ForwardDeployedEngineer.js';
import { WorkflowDSL } from './platform/WorkflowDSL.js';
import { AgenticPlatform } from './platform/AgenticPlatform.js';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Main CLI handler
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║        AI-NATIVE DEVELOPMENT PLATFORM                         ║');
  console.log('║        Build Agentic Applications with Natural Language       ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  const fde = new ForwardDeployedEngineer();

  try {
    switch (command) {
      case undefined:
      case 'interactive':
        // Interactive conversation mode
        await fde.startConversationMode();
        break;

      case 'create':
        // Quick create mode
        const description = args[1];

        if (!description) {
          console.error('\n❌ Error: Please provide a description');
          console.error('   Usage: npm run platform create "Validate customer emails"');
          process.exit(1);
        }

        await fde.quickCreate(description, {
          save: true,
          deploy: args.includes('--deploy')
        });
        break;

      case 'collaborate':
        // Collaboration mode with domain expert
        console.log('\n🤝 Collaboration Mode - Build with Domain Experts\n');

        // Get domain expert info
        const expertName = args[1] || 'Domain Expert';
        const expertise = args[2] || 'Business Operations';

        await fde.collaborate(
          {
            name: expertName,
            expertise
          },
          args[3] // Engineer notes
        );
        break;

      case 'prototype':
        // Rapid prototype mode
        const prototypeDesc = args[1];

        if (!prototypeDesc) {
          console.error('\n❌ Error: Please provide a description');
          console.error('   Usage: npm run platform prototype "Order validation agent"');
          process.exit(1);
        }

        // Create sample test cases
        const testCases = [
          {
            description: 'Test with valid data',
            input: 'Process order: customer@example.com, amount: $150.00',
            context: {}
          },
          {
            description: 'Test with invalid data',
            input: 'Process order: invalid-email, amount: -50',
            context: {}
          }
        ];

        const results = await fde.rapidPrototype(prototypeDesc, testCases);

        console.log(`\n✅ Prototype complete: ${results.passRate}% tests passed`);
        break;

      case 'workflow':
        // Execute workflow
        const workflowFile = args[1];

        if (!workflowFile) {
          console.error('\n❌ Error: Please provide workflow file');
          console.error('   Usage: npm run platform workflow workflows/order-fulfillment.yaml');
          process.exit(1);
        }

        if (!existsSync(workflowFile)) {
          console.error(`\n❌ Error: Workflow file not found: ${workflowFile}`);
          process.exit(1);
        }

        const workflowContent = await fs.readFile(workflowFile, 'utf-8');

        const dsl = new WorkflowDSL(fde.platform);
        const definition = workflowFile.endsWith('.yaml') || workflowFile.endsWith('.yml')
          ? dsl.parseYAML(workflowContent)
          : dsl.parseJSON(workflowContent);

        const workflow = await dsl.compile(definition);

        // Execute if --run flag provided
        if (args.includes('--run')) {
          const input = args.includes('--input')
            ? JSON.parse(args[args.indexOf('--input') + 1])
            : {};

          await dsl.execute(workflow.name, input);
        } else {
          console.log('\n✅ Workflow compiled successfully');
          console.log('   Run with: npm run platform workflow', workflowFile, '--run');
        }
        break;

      case 'list':
        // List agents
        const agents = fde.platform.listAgents();

        if (agents.length === 0) {
          console.log('\n📭 No agents created yet.');
          console.log('   Create one with: npm run platform create "Your description"');
        } else {
          console.log('\n📋 Created Agents:\n');

          agents.forEach(agent => {
            console.log(`   • ${agent.name}`);
            console.log(`     ${agent.description}`);
            console.log(`     Tools: ${agent.tools.join(', ')}`);
            console.log(`     Invocations: ${agent.invocations}`);
            console.log('');
          });
        }
        break;

      case 'templates':
        // Show templates
        const templates = fde.platform.listTemplates();

        console.log('\n📚 Available Templates:\n');

        templates.forEach(template => {
          console.log(`   • ${template.id}: ${template.name}`);
          console.log(`     ${template.description}`);
          console.log(`     Tools: ${template.tools.join(', ')}`);
          console.log(`     Examples:`);
          template.examples.forEach(ex => console.log(`       - ${ex}`));
          console.log('');
        });
        break;

      case 'run':
        // Run an agent
        const agentName = args[1];
        const agentInput = args[2];

        if (!agentName || !agentInput) {
          console.error('\n❌ Error: Please provide agent name and input');
          console.error('   Usage: npm run platform run <agent-name> "<input>"');
          process.exit(1);
        }

        console.log(`\n⚙️  Running agent: ${agentName}\n`);

        const result = await fde.platform.runAgent(agentName, agentInput);

        console.log('\n✅ Result:');
        console.log(JSON.stringify(result, null, 2));
        break;

      case 'examples':
        // Show example commands
        showExamples();
        break;

      case 'help':
      default:
        showHelp();
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);

    if (process.env.NODE_ENV === 'development') {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

/**
 * Show help message
 */
function showHelp() {
  console.log('\n📖 AI-Native Platform CLI - Help\n');
  console.log('Commands:');
  console.log('');
  console.log('  interactive             Start interactive conversation mode (default)');
  console.log('  create "<desc>"         Quick create agent from description');
  console.log('  collaborate             Build agent with domain expert');
  console.log('  prototype "<desc>"      Rapid prototype with test cases');
  console.log('  workflow <file>         Compile/execute workflow from YAML/JSON');
  console.log('  list                    List all created agents');
  console.log('  templates               Show available agent templates');
  console.log('  run <agent> "<input>"   Run a specific agent');
  console.log('  examples                Show example commands');
  console.log('  help                    Show this help message');
  console.log('');
  console.log('Options:');
  console.log('  --deploy                Deploy agent after creation');
  console.log('  --run                   Execute workflow after compilation');
  console.log('  --input <json>          Provide input data for workflow');
  console.log('');
  console.log('Examples:');
  console.log('  npm run platform');
  console.log('  npm run platform create "Validate customer emails"');
  console.log('  npm run platform workflow workflows/example.yaml --run');
  console.log('  npm run platform list');
  console.log('');
}

/**
 * Show example commands
 */
function showExamples() {
  console.log('\n📚 Example Commands\n');
  console.log('━'.repeat(80));

  console.log('\n1️⃣  Create a data validation agent:');
  console.log('   npm run platform create "Validate customer email addresses and phone numbers"');

  console.log('\n2️⃣  Create a report generator:');
  console.log('   npm run platform create "Generate daily sales summary from transaction data"');

  console.log('\n3️⃣  Rapid prototype with tests:');
  console.log('   npm run platform prototype "Customer service agent that answers product questions"');

  console.log('\n4️⃣  Collaborate with domain expert:');
  console.log('   npm run platform collaborate "Sarah Johnson" "Sales Operations"');

  console.log('\n5️⃣  Execute workflow:');
  console.log('   npm run platform workflow workflows/order-fulfillment.yaml --run');

  console.log('\n6️⃣  Interactive mode (most powerful):');
  console.log('   npm run platform');
  console.log('   > Build an agent that processes invoices and flags discrepancies');

  console.log('\n━'.repeat(80));
  console.log('\n💡 Tip: Interactive mode is the easiest way to get started!');
  console.log('   Just describe what you need in natural language.\n');
}

// Run CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('\n💥 Fatal error:', error.message);
    process.exit(1);
  });
}

export default main;
