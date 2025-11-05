/**
 * Database Initialization Script
 * Sets up AgentDB schema and seed data
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function initDatabase() {
  console.log('🔧 Initializing AgentDB...\n');

  const url = process.env.AGENTDB_URL;
  const serviceKey = process.env.AGENTDB_SERVICE_KEY || process.env.AGENTDB_KEY;

  if (!url || !serviceKey) {
    console.error('❌ Error: AGENTDB_URL and AGENTDB_SERVICE_KEY environment variables are required');
    console.error('   Please copy .env.example to .env and configure your database credentials');
    process.exit(1);
  }

  try {
    // Create Supabase client with service role key
    const supabase = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('📡 Connected to AgentDB');

    // Read schema file
    const schemaPath = join(__dirname, '../../config/database.schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    console.log('📄 Loaded database schema');

    // Split schema into individual statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`\n📊 Executing ${statements.length} SQL statements...\n`);

    // Execute each statement
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';

      try {
        // For CREATE statements, try to execute directly
        if (statement.includes('CREATE') || statement.includes('INSERT')) {
          const { error } = await supabase.rpc('exec_sql', { sql: statement });

          if (error) {
            // Ignore "already exists" errors
            if (error.message.includes('already exists')) {
              console.log(`⚠️  Statement ${i + 1}: Already exists (skipping)`);
            } else {
              throw error;
            }
          } else {
            console.log(`✅ Statement ${i + 1}: Success`);
            successCount++;
          }
        } else {
          console.log(`⏭️  Statement ${i + 1}: Skipped (non-DDL)`);
        }
      } catch (error) {
        console.error(`❌ Statement ${i + 1}: Error - ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n✨ Database initialization complete!`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Total: ${statements.length}\n`);

    // Verify tables were created
    console.log('🔍 Verifying table creation...\n');

    const tables = [
      'rules',
      'records',
      'exceptions',
      'agent_memory',
      'audit_trail',
      'cryptographic_proofs',
      'processing_metrics'
    ];

    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ Table '${table}': Not found or error`);
      } else {
        console.log(`✅ Table '${table}': Created (${count || 0} rows)`);
      }
    }

    console.log('\n✅ Database setup complete!\n');

  } catch (error) {
    console.error('\n❌ Database initialization failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initDatabase();
}

export default initDatabase;
