#!/usr/bin/env node

import { GoogleGenerativeAI } from '@google/generative-ai';

async function testGeminiDirect() {
  console.log('\n🔍 Testing Gemini API directly with @google/generative-ai...');
  console.log('API Key:', process.env.GEMINI_API_KEY ? `${process.env.GEMINI_API_KEY.substring(0, 10)}...` : 'NOT SET');

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent('Generate a single stock ticker symbol and price in JSON format');
    const response = await result.response;
    const text = response.text();

    console.log('✅ Gemini direct test successful!');
    console.log('Response:', text);
  } catch (error) {
    console.error('❌ Gemini direct test failed:', error.message);
    console.error('Error details:', error);
  }
}

await testGeminiDirect();
