/**
 * Reprocess Failed Records
 * Utility for reprocessing records that failed validation
 */

import { processRecord } from './dataProcessor.js';
import { connectAgentDB } from './db/agentdb.js';
import dotenv from 'dotenv';

dotenv.config();

const db = connectAgentDB();

/**
 * Reprocess a specific record by ID
 * @param {string} recordId - Record ID to reprocess
 * @returns {Promise<object>}
 */
async function reprocessRecord(recordId) {
  console.log(`\n🔄 Reprocessing record: ${recordId}\n`);

  try {
    // Fetch record
    const records = await db.query('records', {
      where: { id: recordId },
      limit: 1
    });

    if (records.length === 0) {
      throw new Error(`Record ${recordId} not found`);
    }

    const record = records[0];

    console.log('📋 Current record data:');
    console.log(JSON.stringify(record.data, null, 2));
    console.log('');

    // Reprocess
    const result = await processRecord(record.data, record.external_id);

    // Fetch updated record
    const updatedRecords = await db.query('records', {
      where: { id: recordId },
      limit: 1
    });

    const updatedRecord = updatedRecords[0];

    console.log('\n✅ Reprocessing complete!');
    console.log('\n📊 Updated record status:');
    console.log(`  Status: ${updatedRecord.status}`);
    console.log(`  Valid: ${updatedRecord.valid}`);
    console.log(`  Enriched: ${updatedRecord.enriched}`);

    if (updatedRecord.validation_errors && updatedRecord.validation_errors.length > 0) {
      console.log('\n⚠️  Validation errors:');
      updatedRecord.validation_errors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.message}`);
      });
    }

    return {
      success: updatedRecord.valid,
      record: updatedRecord
    };

  } catch (error) {
    console.error('\n❌ Reprocessing failed:', error.message);
    throw error;
  }
}

/**
 * Reprocess all invalid records
 * @param {number} limit - Maximum number of records to reprocess
 * @returns {Promise<object>}
 */
async function reprocessAllInvalid(limit = 10) {
  console.log(`\n🔄 Reprocessing up to ${limit} invalid records...\n`);

  try {
    // Fetch invalid records
    const records = await db.query('records', {
      where: { valid: false },
      orderBy: { column: 'created_at', ascending: false },
      limit
    });

    if (records.length === 0) {
      console.log('✨ No invalid records found!\n');
      return { total: 0, successful: 0, failed: 0 };
    }

    console.log(`Found ${records.length} invalid records\n`);

    const results = {
      total: records.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      console.log(`\n📝 Reprocessing ${i + 1}/${records.length}: ${record.id}`);

      try {
        const result = await reprocessRecord(record.id);

        if (result.success) {
          results.successful++;
          console.log(`✅ Success`);
        } else {
          results.failed++;
          console.log(`❌ Still invalid after reprocessing`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          recordId: record.id,
          error: error.message
        });
        console.error(`❌ Error: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 Reprocessing Summary');
    console.log('='.repeat(80));
    console.log(`Total Records: ${results.total}`);
    console.log(`Successful: ${results.successful}`);
    console.log(`Failed: ${results.failed}`);
    console.log('='.repeat(80) + '\n');

    return results;

  } catch (error) {
    console.error('\n❌ Batch reprocessing failed:', error.message);
    throw error;
  }
}

/**
 * Main CLI
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('\n🔄 Record Reprocessing Utility\n');
    console.log('Usage:');
    console.log('  npm run reprocess -- --record_id=<id>  Reprocess specific record');
    console.log('  npm run reprocess -- --all [limit]     Reprocess all invalid records');
    console.log('');
    process.exit(1);
  }

  try {
    const recordIdArg = args.find(arg => arg.startsWith('--record_id='));
    const allFlag = args.includes('--all');

    if (recordIdArg) {
      const recordId = recordIdArg.split('=')[1];
      await reprocessRecord(recordId);
    } else if (allFlag) {
      const limit = parseInt(args[args.indexOf('--all') + 1]) || 10;
      await reprocessAllInvalid(limit);
    } else {
      console.error('Invalid arguments. Use --record_id=<id> or --all');
      process.exit(1);
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

export { reprocessRecord, reprocessAllInvalid };
export default reprocessRecord;
