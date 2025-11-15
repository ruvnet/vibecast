/**
 * Utility functions for benchmarking
 */

/**
 * Generate synthetic trading data (price movements)
 */
export function generateTradingData(n, basePrice = 100, volatility = 0.02) {
  const data = [];
  let price = basePrice;

  for (let i = 0; i < n; i++) {
    // Random walk with drift
    const change = (Math.random() - 0.48) * volatility * price;
    price = Math.max(price + change, 1); // Prevent negative prices
    data.push({
      timestamp: Date.now() + i * 1000,
      price,
      volume: Math.floor(Math.random() * 10000) + 1000
    });
  }

  return data;
}

/**
 * Generate predictions with some noise
 */
export function generatePredictions(actuals, noiseLevel = 0.01) {
  return actuals.map(actual => {
    const noise = (Math.random() - 0.5) * 2 * noiseLevel * actual;
    return actual + noise;
  });
}

/**
 * Timer utility for measuring execution time
 */
export class Timer {
  constructor() {
    this.start = null;
    this.end = null;
  }

  begin() {
    this.start = performance.now();
    return this;
  }

  stop() {
    this.end = performance.now();
    return this.elapsed();
  }

  elapsed() {
    if (!this.start) return 0;
    const end = this.end || performance.now();
    return end - this.start;
  }
}

/**
 * Calculate statistics for an array of numbers
 */
export function calculateStats(values) {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;

  const variance = values.reduce((acc, val) => {
    return acc + Math.pow(val - mean, 2);
  }, 0) / values.length;

  const stdDev = Math.sqrt(variance);

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean,
    median: sorted[Math.floor(sorted.length / 2)],
    stdDev,
    p25: sorted[Math.floor(sorted.length * 0.25)],
    p75: sorted[Math.floor(sorted.length * 0.75)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)]
  };
}

/**
 * Format time in human-readable format
 */
export function formatTime(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Format number with thousands separator
 */
export function formatNumber(num) {
  return num.toLocaleString();
}

/**
 * Print benchmark results in a formatted table
 */
export function printResults(name, results) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 ${name}`);
  console.log('='.repeat(60));

  Object.entries(results).forEach(([key, value]) => {
    if (typeof value === 'object' && value !== null) {
      console.log(`\n${key}:`);
      Object.entries(value).forEach(([k, v]) => {
        const formatted = typeof v === 'number' ?
          (k.includes('time') || k.includes('Time') ? formatTime(v) : v.toFixed(4)) :
          v;
        console.log(`  ${k}: ${formatted}`);
      });
    } else {
      const formatted = typeof value === 'number' ?
        (key.includes('time') || key.includes('Time') ? formatTime(value) : value.toFixed(4)) :
        value;
      console.log(`${key}: ${formatted}`);
    }
  });
  console.log('='.repeat(60));
}
