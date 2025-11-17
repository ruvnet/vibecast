#!/usr/bin/env node

/**
 * Explore Airtable base structure and data
 */

const token = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const baseId = 'appzNTISE6DHpfh9x';

if (!token) {
  console.error('❌ Error: AIRTABLE_PERSONAL_ACCESS_TOKEN not set');
  process.exit(1);
}

async function exploreBase() {
  try {
    console.log('🔍 Exploring Airtable Base: Conveyor-Dev');
    console.log('Base ID:', baseId);
    console.log('='.repeat(60));

    // Try to get base schema using Web API
    const schemaUrl = `https://api.airtable.com/v0/meta/bases/${baseId}/tables`;

    const schemaResponse = await fetch(schemaUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (schemaResponse.ok) {
      const schema = await schemaResponse.json();
      console.log('\n📋 TABLES AND SCHEMA:\n');

      if (schema.tables) {
        for (const table of schema.tables) {
          console.log(`\n📊 Table: ${table.name} (${table.id})`);
          console.log(`   Primary Field: ${table.primaryFieldId}`);

          if (table.fields) {
            console.log('\n   Fields:');
            table.fields.forEach(field => {
              console.log(`   - ${field.name} (${field.type})`);
              if (field.options) {
                console.log(`     Options: ${JSON.stringify(field.options, null, 2).replace(/\n/g, '\n     ')}`);
              }
            });
          }

          // Now fetch data from this table
          await fetchTableData(table.id, table.name);
        }
      }
    } else {
      const error = await schemaResponse.text();
      console.log(`\n⚠️  Schema API returned ${schemaResponse.status}: ${error}`);
      console.log('\nTrying to access base data without schema...\n');

      // Try common table names
      const commonTables = ['Table 1', 'Users', 'Data', 'Records', 'Main'];
      for (const tableName of commonTables) {
        await tryTableName(tableName);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function fetchTableData(tableId, tableName) {
  try {
    const dataUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?maxRecords=10`;

    const response = await fetch(dataUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`\n   📦 Records: ${data.records ? data.records.length : 0} (showing up to 10)`);

      if (data.records && data.records.length > 0) {
        console.log('\n   Sample Data:');
        data.records.slice(0, 3).forEach((record, idx) => {
          console.log(`\n   Record ${idx + 1} (${record.id}):`);
          console.log('   ' + JSON.stringify(record.fields, null, 2).replace(/\n/g, '\n   '));
        });
      }
    } else {
      console.log(`   ⚠️  Could not fetch data: ${response.status}`);
    }
  } catch (error) {
    console.log(`   ⚠️  Error fetching data: ${error.message}`);
  }
}

async function tryTableName(tableName) {
  try {
    const dataUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?maxRecords=5`;

    const response = await fetch(dataUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`\n✅ Found table: "${tableName}"`);
      console.log(`   Records: ${data.records ? data.records.length : 0}`);

      if (data.records && data.records.length > 0) {
        console.log('\n   Fields detected:');
        const fields = new Set();
        data.records.forEach(record => {
          Object.keys(record.fields).forEach(field => fields.add(field));
        });
        fields.forEach(field => console.log(`   - ${field}`));

        console.log('\n   Sample record:');
        console.log('   ' + JSON.stringify(data.records[0].fields, null, 2).replace(/\n/g, '\n   '));
      }
    }
  } catch (error) {
    // Silent fail for non-existent tables
  }
}

exploreBase();
