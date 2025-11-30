// Test script for ruvector-attention-wasm package
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import initSync for Node.js environment
import { initSync } from 'ruvector-attention-wasm';
import {
  WasmMultiHeadAttention,
  WasmHyperbolicAttention,
  WasmFlashAttention,
  WasmMoEAttention,
  WasmLinearAttention,
  WasmAdam,
  WasmInfoNCELoss,
  scaled_dot_attention,
  cosine_similarity,
  softmax,
  normalize,
  version
} from 'ruvector-attention-wasm';

console.log('=== Testing ruvector-attention-wasm ===\n');

// Initialize WASM synchronously with the wasm file
const __dirname = dirname(fileURLToPath(import.meta.url));
const wasmPath = join(__dirname, 'node_modules/ruvector-attention-wasm/ruvector_attention_wasm_bg.wasm');
const wasmBuffer = readFileSync(wasmPath);
initSync(wasmBuffer);
console.log('✓ WASM module initialized');
console.log('  Version:', version());

// Create test data
const dim = 64;
const query = new Float32Array(dim);
const keys = [new Float32Array(dim), new Float32Array(dim)];
const values = [new Float32Array(dim), new Float32Array(dim)];

// Fill with random data
for (let i = 0; i < dim; i++) {
  query[i] = Math.random() - 0.5;
  keys[0][i] = Math.random() - 0.5;
  keys[1][i] = Math.random() - 0.5;
  values[0][i] = Math.random() - 0.5;
  values[1][i] = Math.random() - 0.5;
}

// Test scaled_dot_attention function
console.log('\n1. Testing scaled_dot_attention...');
try {
  const result = scaled_dot_attention(query, keys, values, null);
  console.log('   ✓ scaled_dot_attention works! Output size:', result.length);
  console.log('   Sample:', Array.from(result.slice(0, 3)).map(n => n.toFixed(4)));
} catch (err) {
  console.log('   ✗ Error:', err.message);
}

// Test WasmMultiHeadAttention
console.log('\n2. Testing WasmMultiHeadAttention...');
try {
  const mha = new WasmMultiHeadAttention(dim, 8);
  const result = mha.compute(query, keys, values);
  console.log('   ✓ WasmMultiHeadAttention works! Output size:', result.length);
  console.log('   Sample:', Array.from(result.slice(0, 3)).map(n => n.toFixed(4)));
  console.log('   dim:', mha.dim, '| num_heads:', mha.num_heads);
} catch (err) {
  console.log('   ✗ Error:', err.message);
}

// Test WasmHyperbolicAttention
console.log('\n3. Testing WasmHyperbolicAttention...');
try {
  const hyper = new WasmHyperbolicAttention(dim, 1.0);
  const result = hyper.compute(query, keys, values);
  console.log('   ✓ WasmHyperbolicAttention works! Output size:', result.length);
  console.log('   Sample:', Array.from(result.slice(0, 3)).map(n => n.toFixed(4)));
  console.log('   curvature:', hyper.curvature);
} catch (err) {
  console.log('   ✗ Error:', err.message);
}

// Test WasmFlashAttention
console.log('\n4. Testing WasmFlashAttention...');
try {
  const flash = new WasmFlashAttention(dim, 16);
  const result = flash.compute(query, keys, values);
  console.log('   ✓ WasmFlashAttention works! Output size:', result.length);
  console.log('   Sample:', Array.from(result.slice(0, 3)).map(n => n.toFixed(4)));
} catch (err) {
  console.log('   ✗ Error:', err.message);
}

// Test WasmLinearAttention
console.log('\n5. Testing WasmLinearAttention...');
try {
  const linear = new WasmLinearAttention(dim, 32);
  const result = linear.compute(query, keys, values);
  console.log('   ✓ WasmLinearAttention works! Output size:', result.length);
  console.log('   Sample:', Array.from(result.slice(0, 3)).map(n => n.toFixed(4)));
} catch (err) {
  console.log('   ✗ Error:', err.message);
}

// Test WasmMoEAttention
console.log('\n6. Testing WasmMoEAttention...');
try {
  const moe = new WasmMoEAttention(dim, 4, 2); // 4 experts, top-2
  const result = moe.compute(query, keys, values);
  console.log('   ✓ WasmMoEAttention works! Output size:', result.length);
  console.log('   Sample:', Array.from(result.slice(0, 3)).map(n => n.toFixed(4)));
} catch (err) {
  console.log('   ✗ Error:', err.message);
}

// Test utility functions
console.log('\n7. Testing utility functions...');
try {
  const similarity = cosine_similarity(query, keys[0]);
  console.log('   ✓ cosine_similarity:', similarity.toFixed(4));

  const normalized = new Float32Array(query);
  normalize(normalized);
  console.log('   ✓ normalize works! Sample:', Array.from(normalized.slice(0, 3)).map(n => n.toFixed(4)));

  const scores = new Float32Array([1.0, 2.0, 3.0, 4.0]);
  softmax(scores);
  console.log('   ✓ softmax:', Array.from(scores).map(n => n.toFixed(4)));
} catch (err) {
  console.log('   ✗ Error:', err.message);
}

// Test training components
console.log('\n8. Testing training components...');
try {
  const optimizer = new WasmAdam(100, 0.001);
  console.log('   ✓ WasmAdam created, learning_rate:', optimizer.learning_rate);

  const loss = new WasmInfoNCELoss(0.07);
  const anchor = new Float32Array(dim).fill(0.5);
  const positive = new Float32Array(dim).fill(0.4);
  const negatives = [new Float32Array(dim).fill(-0.3)];
  const lossValue = loss.compute(anchor, positive, negatives);
  console.log('   ✓ WasmInfoNCELoss computed:', lossValue.toFixed(4));
} catch (err) {
  console.log('   ✗ Error:', err.message);
}

console.log('\n=== WASM tests complete ===');
