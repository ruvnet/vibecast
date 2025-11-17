#!/usr/bin/env node

/**
 * Test script to verify Airtable Personal Access Token
 */

const token = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;

if (!token) {
  console.error('❌ Error: AIRTABLE_PERSONAL_ACCESS_TOKEN environment variable is not set');
  process.exit(1);
}

console.log('🔍 Testing Airtable Personal Access Token...');
console.log(`Token: ${token.substring(0, 20)}...`);

// Test the token by making a request to Airtable's meta API
// This endpoint lists all bases accessible with the token
const testUrl = 'https://api.airtable.com/v0/meta/bases';

fetch(testUrl, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
  .then(response => {
    console.log(`\n📡 Response Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      return response.text().then(text => {
        throw new Error(`HTTP ${response.status}: ${text}`);
      });
    }

    return response.json();
  })
  .then(data => {
    console.log('\n✅ Token is VALID!');
    console.log(`\n📊 Accessible bases: ${data.bases ? data.bases.length : 0}`);

    if (data.bases && data.bases.length > 0) {
      console.log('\n📋 Bases:');
      data.bases.forEach((base, index) => {
        console.log(`  ${index + 1}. ${base.name} (${base.id})`);
        if (base.permissionLevel) {
          console.log(`     Permission: ${base.permissionLevel}`);
        }
      });
    } else {
      console.log('\n⚠️  Note: No bases found. You may need to grant this token access to specific bases.');
    }
  })
  .catch(error => {
    console.error('\n❌ Token test FAILED!');
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
