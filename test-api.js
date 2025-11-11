// Quick test of OpenRouter API connectivity
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/ruvnet/vibecast',
    'X-Title': 'Vibecast SWE-Bench'
  }
});

async function testConnection() {
  try {
    console.log('Testing OpenRouter API connection...');

    const response = await client.chat.completions.create({
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [
        { role: 'user', content: 'Write a simple hello world function in JavaScript' }
      ],
      temperature: 0.3,
      max_tokens: 100
    });

    console.log('✅ SUCCESS! API is working!\n');
    console.log('Response:', response.choices[0].message.content);
    console.log('\nTokens used:', response.usage.total_tokens);

    return true;
  } catch (error) {
    console.error('❌ API Error:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause.message);
    }
    return false;
  }
}

testConnection().then(success => {
  process.exit(success ? 0 : 1);
});
