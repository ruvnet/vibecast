/**
 * Main Entry Point - Agentic Data Entry Automation System
 * Orchestrates the complete data entry pipeline
 */

import { processRecord } from './dataProcessor.js';
import { getFlowNexusClient, getSwarmOrchestrator } from './orchestration/flowNexus.js';
import { connectAgentDB } from './db/agentdb.js';
import { displayDashboard } from './metrics.js';
import dotenv from 'dotenv';

dotenv.config();

const db = connectAgentDB();

/**
 * Process a batch of records
 * @param {Array} records - Array of records to process
 * @returns {Promise<object>}
 */
async function processBatch(records) {
  console.log(`\n🚀 Processing batch of ${records.length} records...\n`);

  const startTime = Date.now();
  const results = {
    total: records.length,
    successful: 0,
    failed: 0,
    errors: []
  };

  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    console.log(`\n📝 Processing record ${i + 1}/${records.length}...`);

    try {
      await processRecord(record.data, record.externalId);
      results.successful++;
      console.log(`✅ Record ${i + 1} processed successfully`);
    } catch (error) {
      results.failed++;
      results.errors.push({
        record: i + 1,
        error: error.message
      });
      console.error(`❌ Record ${i + 1} failed:`, error.message);
    }
  }

  const endTime = Date.now();
  const totalTime = endTime - startTime;

  console.log('\n' + '='.repeat(80));
  console.log('📊 Batch Processing Summary');
  console.log('='.repeat(80));
  console.log(`Total Records: ${results.total}`);
  console.log(`Successful: ${results.successful}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Total Time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
  console.log(`Avg Time per Record: ${(totalTime / results.total).toFixed(2)}ms`);
  console.log('='.repeat(80) + '\n');

  return results;
}

/**
 * Example: Process sample data
 */
async function runExample() {
  console.log('\n🎯 Agentic Data Entry Automation System');
  console.log('   Example: Processing Sample Data\n');

  // Sample records
  const sampleRecords = [
    {
      externalId: 'REC-001',
      data: {
        email: 'user@example.com',
        amount: 150.00,
        description: 'Valid record with positive amount'
      }
    },
    {
      externalId: 'REC-002',
      data: {
        email: 'invalid-email',  // Invalid email format
        amount: 250.00,
        description: 'Invalid email format'
      }
    },
    {
      externalId: 'REC-003',
      data: {
        email: 'another@example.com',
        amount: -50.00,  // Negative amount (invalid)
        description: 'Negative amount should fail validation'
      }
    },
    {
      externalId: 'REC-004',
      data: {
        email: 'valid@test.com',
        amount: 1500.00,
        description: 'High-value transaction'
      }
    },
    {
      externalId: 'REC-005',
      data: {
        // Missing email field
        amount: 75.00,
        description: 'Missing required field'
      }
    }
  ];

  try {
    // Process batch
    const results = await processBatch(sampleRecords);

    // Display metrics dashboard
    console.log('\n📊 System Metrics Dashboard:\n');
    await displayDashboard();

    // Summary
    console.log('\n✅ Example completed successfully!');
    console.log('\nNext steps:');
    console.log('  • Run `npm run review` to review exceptions');
    console.log('  • Run `npm run metrics` to view detailed metrics');
    console.log('  • Check AgentDB for stored records and audit trails\n');

  } catch (error) {
    console.error('\n❌ Example failed:', error);
    throw error;
  }
}

/**
 * Main CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'example':
        await runExample();
        break;

      case 'batch':
        // Process custom batch from file
        const filePath = args[1];
        if (!filePath) {
          console.error('Usage: npm start batch <file.json>');
          process.exit(1);
        }
        console.log(`Processing batch from ${filePath}...`);
        // Implementation would load and process file
        break;

      case 'metrics':
        await displayDashboard();
        break;

      case 'help':
      default:
        console.log('\n🤖 Agentic Data Entry Automation System\n');
        console.log('Usage: npm start [command] [options]\n');
        console.log('Commands:');
        console.log('  example     Run example with sample data');
        console.log('  batch <file> Process batch from JSON file');
        console.log('  metrics     Display metrics dashboard');
        console.log('  help        Show this help message\n');
        console.log('Other commands:');
        console.log('  npm run review   Review pending exceptions');
        console.log('  npm run setup    Initialize database\n');
        break;
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { processBatch, runExample, main };
export default main;
