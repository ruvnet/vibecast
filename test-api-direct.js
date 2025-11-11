// Test with explicit fetch and better error handling
import https from 'https';

async function testOpenRouterDirect() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY not set');
    return false;
  }

  console.log('Testing OpenRouter API with direct HTTPS request...');
  console.log('API Key present:', apiKey.substring(0, 10) + '...');

  const data = JSON.stringify({
    model: 'google/gemini-2.0-flash-exp:free',
    messages: [{ role: 'user', content: 'Say hello in 5 words' }],
    max_tokens: 20
  });

  const options = {
    hostname: 'openrouter.ai',
    port: 443,
    path: '/api/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/ruvnet/vibecast',
      'X-Title': 'Vibecast Benchmark',
      'Content-Length': data.length
    }
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      console.log('Status Code:', res.statusCode);

      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const result = JSON.parse(body);
            console.log('✅ SUCCESS!');
            console.log('Response:', result.choices[0].message.content);
            console.log('Model:', result.model);
            console.log('Tokens:', result.usage.total_tokens);
            resolve(true);
          } else {
            console.error('❌ Error:', res.statusCode);
            console.error('Body:', body);
            resolve(false);
          }
        } catch (error) {
          console.error('❌ Parse error:', error.message);
          console.error('Body:', body);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      console.error('Code:', error.code);
      resolve(false);
    });

    req.write(data);
    req.end();
  });
}

testOpenRouterDirect().then(success => {
  process.exit(success ? 0 : 1);
});
