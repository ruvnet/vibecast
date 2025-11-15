#!/usr/bin/env tsx
/**
 * Test API Keys - Verify all configured API keys work correctly
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

dotenv.config();

console.log('🔐 Testing API Keys...\n');

// Test Anthropic API Key
async function testAnthropicKey() {
  try {
    console.log('1️⃣  Testing Anthropic API Key...');
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 50,
      messages: [
        { role: 'user', content: 'Say "API key works!" in exactly 3 words.' }
      ]
    });

    const result = response.content[0].type === 'text'
      ? response.content[0].text
      : 'No text response';

    console.log('   ✅ Anthropic API: WORKING');
    console.log('   📝 Response:', result.trim());
    console.log('   📊 Tokens used:', response.usage.input_tokens + response.usage.output_tokens);
    return true;
  } catch (error) {
    console.log('   ❌ Anthropic API: FAILED');
    console.log('   Error:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Test OpenRouter API Key
async function testOpenRouterKey() {
  try {
    console.log('\n2️⃣  Testing OpenRouter API Key...');
    const openrouter = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/vibecast/franchise-manager',
        'X-Title': 'Vibecast Franchise Manager Test',
      }
    });

    const completion = await openrouter.chat.completions.create({
      model: 'deepseek/deepseek-chat',
      messages: [
        { role: 'user', content: 'Say "API key works!" in exactly 3 words.' }
      ],
      max_tokens: 50,
    });

    const result = completion.choices[0]?.message?.content || 'No response';

    console.log('   ✅ OpenRouter API: WORKING');
    console.log('   📝 Response:', result.trim());
    console.log('   📊 Tokens used:', completion.usage?.total_tokens || 0);
    return true;
  } catch (error) {
    console.log('   ❌ OpenRouter API: FAILED');
    console.log('   Error:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Check environment variables
function checkEnvVars() {
  console.log('\n3️⃣  Checking Environment Variables...');
  const keys = {
    'OPENROUTER_API_KEY': process.env.OPENROUTER_API_KEY,
    'ANTHROPIC_API_KEY': process.env.ANTHROPIC_API_KEY,
    'PERPLEXITY_API_KEY': process.env.PERPLEXITY_API_KEY,
    'GOOGLE_GEMINI_API_KEY': process.env.GOOGLE_GEMINI_API_KEY,
    'HUGGINGFACE_API_KEY': process.env.HUGGINGFACE_API_KEY,
  };

  let allSet = true;
  for (const [name, value] of Object.entries(keys)) {
    if (value) {
      console.log(`   ✅ ${name}: Set (${value.substring(0, 15)}...)`);
    } else {
      console.log(`   ❌ ${name}: Not set`);
      allSet = false;
    }
  }

  return allSet;
}

// Main test function
async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('           API KEY VERIFICATION TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════\n');

  const envCheck = checkEnvVars();
  const anthropicWorks = await testAnthropicKey();
  const openRouterWorks = await testOpenRouterKey();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                    TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`Environment Variables: ${envCheck ? '✅ All Set' : '⚠️  Some Missing'}`);
  console.log(`Anthropic API:         ${anthropicWorks ? '✅ Working' : '❌ Failed'}`);
  console.log(`OpenRouter API:        ${openRouterWorks ? '✅ Working' : '❌ Failed'}`);

  const allPassed = envCheck && anthropicWorks && openRouterWorks;

  console.log('\n' + '═'.repeat(59));
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED - API KEYS ARE WORKING! 🎉');
  } else {
    console.log('⚠️  SOME TESTS FAILED - CHECK ERRORS ABOVE');
  }
  console.log('═'.repeat(59) + '\n');

  process.exit(allPassed ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  console.error('\n❌ Test suite crashed:', error);
  process.exit(1);
});
