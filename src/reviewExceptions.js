/**
 * Human-in-Loop Exception Review Interface
 * Allows operators to review and resolve failed validations
 */

import { connectAgentDB } from './db/agentdb.js';
import { generateAuditReport } from './utils/proofs.js';
import readline from 'readline';
import dotenv from 'dotenv';

dotenv.config();

const db = connectAgentDB();

/**
 * Display exception details
 * @param {object} exception - Exception to display
 */
function displayException(exception) {
  console.log('\n' + '='.repeat(80));
  console.log(`Exception ID: ${exception.id}`);
  console.log(`Record ID: ${exception.record_id}`);
  console.log(`Type: ${exception.exception_type}`);
  console.log(`Severity: ${exception.severity.toUpperCase()}`);
  console.log(`Created: ${exception.created_at}`);
  console.log('-'.repeat(80));
  console.log(`Error Message: ${exception.error_message}`);

  if (exception.record_data) {
    console.log('\nRecord Data:');
    console.log(JSON.stringify(exception.record_data, null, 2));
  }

  if (exception.validation_errors && exception.validation_errors.length > 0) {
    console.log('\nValidation Errors:');
    exception.validation_errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.message} (rule: ${err.rule}, field: ${err.field})`);
    });
  }

  console.log('='.repeat(80));
}

/**
 * Prompt user for resolution
 * @param {object} rl - Readline interface
 * @returns {Promise<object>}
 */
function promptResolution(rl) {
  return new Promise((resolve) => {
    console.log('\nResolution Options:');
    console.log('  1. Approve - Accept the record as-is');
    console.log('  2. Reject - Permanently reject the record');
    console.log('  3. Modify - Edit the record data');
    console.log('  4. Reprocess - Retry validation with current rules');
    console.log('  5. Skip - Review later');
    console.log('  6. Audit - Generate full audit report');
    console.log('  0. Exit');

    rl.question('\nSelect option (1-6, 0 to exit): ', (answer) => {
      const option = parseInt(answer.trim());

      switch (option) {
        case 1:
          resolve({ action: 'approved', notes: '' });
          break;
        case 2:
          rl.question('Rejection reason: ', (reason) => {
            resolve({ action: 'rejected', notes: reason });
          });
          break;
        case 3:
          rl.question('Enter modified data (JSON): ', (json) => {
            try {
              const data = JSON.parse(json);
              resolve({ action: 'modified', notes: '', modifiedData: data });
            } catch (error) {
              console.error('Invalid JSON, skipping modification');
              resolve({ action: 'skip', notes: '' });
            }
          });
          break;
        case 4:
          resolve({ action: 'reprocessed', notes: '' });
          break;
        case 5:
          resolve({ action: 'skip', notes: '' });
          break;
        case 6:
          resolve({ action: 'audit', notes: '' });
          break;
        case 0:
          resolve({ action: 'exit', notes: '' });
          break;
        default:
          console.log('Invalid option');
          resolve({ action: 'skip', notes: '' });
      }
    });
  });
}

/**
 * Process exception resolution
 * @param {object} exception - Exception to resolve
 * @param {object} resolution - Resolution action
 * @param {string} reviewer - Reviewer identifier
 * @returns {Promise<void>}
 */
async function processResolution(exception, resolution, reviewer) {
  console.log(`\n⚙️  Processing resolution: ${resolution.action}...`);

  try {
    switch (resolution.action) {
      case 'approved':
        // Mark record as valid
        await db.update('records',
          { id: exception.record_id },
          { status: 'valid', valid: true }
        );

        // Mark exception as reviewed
        await db.update('exceptions',
          { id: exception.id },
          {
            reviewed: true,
            reviewed_by: reviewer,
            reviewed_at: new Date().toISOString(),
            resolution: 'Manually approved by reviewer',
            resolution_action: 'approved'
          }
        );

        // Create audit trail
        await db.createAuditTrail({
          eventType: 'exception_resolved',
          entityType: 'exception',
          entityId: exception.id,
          actor: reviewer,
          action: 'approve',
          beforeState: { reviewed: false },
          afterState: { reviewed: true, resolution: 'approved' },
          changes: { resolution: 'approved' },
          sessionId: 'manual_review'
        });

        console.log('✅ Exception approved');
        break;

      case 'rejected':
        // Mark record as invalid
        await db.update('records',
          { id: exception.record_id },
          { status: 'rejected', valid: false }
        );

        // Mark exception as reviewed
        await db.update('exceptions',
          { id: exception.id },
          {
            reviewed: true,
            reviewed_by: reviewer,
            reviewed_at: new Date().toISOString(),
            resolution: resolution.notes,
            resolution_action: 'rejected'
          }
        );

        // Create audit trail
        await db.createAuditTrail({
          eventType: 'exception_resolved',
          entityType: 'exception',
          entityId: exception.id,
          actor: reviewer,
          action: 'reject',
          beforeState: { reviewed: false },
          afterState: { reviewed: true, resolution: 'rejected' },
          changes: { resolution: 'rejected', reason: resolution.notes },
          sessionId: 'manual_review'
        });

        console.log('✅ Exception rejected');
        break;

      case 'modified':
        // Update record data
        await db.update('records',
          { id: exception.record_id },
          { data: resolution.modifiedData, status: 'valid', valid: true }
        );

        // Mark exception as reviewed
        await db.update('exceptions',
          { id: exception.id },
          {
            reviewed: true,
            reviewed_by: reviewer,
            reviewed_at: new Date().toISOString(),
            resolution: 'Data modified and approved',
            resolution_action: 'modified'
          }
        );

        // Create audit trail
        await db.createAuditTrail({
          eventType: 'exception_resolved',
          entityType: 'exception',
          entityId: exception.id,
          actor: reviewer,
          action: 'modify',
          beforeState: { data: exception.record_data },
          afterState: { data: resolution.modifiedData },
          changes: { modified_fields: Object.keys(resolution.modifiedData) },
          sessionId: 'manual_review'
        });

        console.log('✅ Exception modified and approved');
        break;

      case 'reprocessed':
        // Reprocess the record (would call dataProcessor here)
        console.log('🔄 Reprocessing would happen here...');

        // Mark exception as reviewed
        await db.update('exceptions',
          { id: exception.id },
          {
            reviewed: true,
            reviewed_by: reviewer,
            reviewed_at: new Date().toISOString(),
            resolution: 'Sent for reprocessing',
            resolution_action: 'reprocessed'
          }
        );

        console.log('✅ Exception sent for reprocessing');
        break;

      case 'audit':
        // Generate full audit report
        console.log('\n📊 Generating audit report...\n');
        const report = await generateAuditReport(exception.record_id, 'record');
        console.log(JSON.stringify(report, null, 2));
        console.log('\n✅ Audit report generated');
        break;

      case 'skip':
        console.log('⏭️  Skipped');
        break;

      case 'exit':
        console.log('👋 Exiting review process');
        break;

      default:
        console.log('Unknown action');
    }
  } catch (error) {
    console.error('❌ Error processing resolution:', error.message);
  }
}

/**
 * Main review loop
 */
async function reviewExceptions() {
  console.log('\n🔍 Exception Review Interface\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    // Get reviewer identity
    const reviewer = await new Promise((resolve) => {
      rl.question('Enter your name/ID: ', (name) => {
        resolve(name.trim() || 'anonymous');
      });
    });

    console.log(`\n👤 Reviewer: ${reviewer}\n`);

    let continueReview = true;

    while (continueReview) {
      // Fetch pending exceptions
      const exceptions = await db.getPendingExceptions(1);

      if (exceptions.length === 0) {
        console.log('\n✨ No pending exceptions! All caught up.\n');
        break;
      }

      const exception = exceptions[0];

      // Display exception
      displayException(exception);

      // Get resolution
      const resolution = await promptResolution(rl);

      if (resolution.action === 'exit') {
        continueReview = false;
        break;
      }

      // Process resolution
      await processResolution(exception, resolution, reviewer);

      // Ask if continue
      if (resolution.action !== 'skip' && resolution.action !== 'audit') {
        const shouldContinue = await new Promise((resolve) => {
          rl.question('\nReview next exception? (y/n): ', (answer) => {
            resolve(answer.toLowerCase().trim() === 'y');
          });
        });

        continueReview = shouldContinue;
      }
    }

    console.log('\n✅ Review session complete\n');
  } catch (error) {
    console.error('\n❌ Error during review:', error.message);
  } finally {
    rl.close();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  reviewExceptions();
}

export default reviewExceptions;
