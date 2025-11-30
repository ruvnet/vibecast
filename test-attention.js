// Test script for ruvector-attention packages
const { DotProductAttention, MultiHeadAttention, FlashAttention, version } = require('@ruvector/attention');

console.log('=== Testing @ruvector/attention (NAPI) ===\n');

// Check version
console.log('Package version:', version());

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

// Test DotProductAttention
console.log('\n1. Testing DotProductAttention...');
try {
  const dotProd = new DotProductAttention(dim, 1.0);
  const result = dotProd.compute(query, keys, values);
  console.log('   ✓ DotProductAttention works! Output size:', result.length);
  console.log('   Sample output:', result.slice(0, 5));
} catch (err) {
  console.log('   ✗ Error:', err.message);
}

// Test MultiHeadAttention
console.log('\n2. Testing MultiHeadAttention...');
try {
  const mha = new MultiHeadAttention(dim, 8); // 8 heads
  const result = mha.compute(query, keys, values);
  console.log('   ✓ MultiHeadAttention works! Output size:', result.length);
  console.log('   Sample output:', result.slice(0, 5));
} catch (err) {
  console.log('   ✗ Error:', err.message);
}

// Test FlashAttention
console.log('\n3. Testing FlashAttention...');
try {
  const flash = new FlashAttention(dim, 16); // block size 16
  const result = flash.compute(query, keys, values);
  console.log('   ✓ FlashAttention works! Output size:', result.length);
  console.log('   Sample output:', result.slice(0, 5));
} catch (err) {
  console.log('   ✗ Error:', err.message);
}

console.log('\n=== NAPI tests complete ===\n');
