/**
 * Real Market Data Fetcher
 * Fetches actual market data from Yahoo Finance API
 */

/**
 * Fetch real market data from Yahoo Finance
 * @param {string} symbol - Ticker symbol (e.g., 'SPY', 'BTC-USD')
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {string} interval - Data interval ('1d', '1h', '5m')
 */
export async function fetchYahooFinanceData(symbol, startDate, endDate, interval = '1d') {
  console.log(`📈 Fetching ${symbol} data from ${startDate} to ${endDate}...`);

  // Convert dates to Unix timestamps
  const start = Math.floor(new Date(startDate).getTime() / 1000);
  const end = Math.floor(new Date(endDate).getTime() / 1000);

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${start}&period2=${end}&interval=${interval}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.chart.error) {
      throw new Error(data.chart.error.description);
    }

    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];

    // Format data
    const formattedData = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (quotes.close[i] !== null) {
        formattedData.push({
          timestamp: timestamps[i] * 1000, // Convert to milliseconds
          price: quotes.close[i],
          open: quotes.open[i],
          high: quotes.high[i],
          low: quotes.low[i],
          volume: quotes.volume[i],
          returns: i > 0 ? (quotes.close[i] - quotes.close[i-1]) / quotes.close[i-1] : 0
        });
      }
    }

    // Add regime detection based on volatility
    const windowSize = 20;
    for (let i = 0; i < formattedData.length; i++) {
      if (i >= windowSize) {
        const recentReturns = formattedData.slice(i - windowSize, i).map(d => d.returns);
        const volatility = Math.sqrt(
          recentReturns.reduce((sum, r) => sum + r * r, 0) / recentReturns.length
        );

        // Simple regime classification based on volatility quartiles
        if (volatility < 0.01) formattedData[i].regime = 0; // Low volatility
        else if (volatility < 0.015) formattedData[i].regime = 1; // Medium volatility
        else if (volatility < 0.025) formattedData[i].regime = 2; // High volatility
        else formattedData[i].regime = 3; // Extreme volatility
      } else {
        formattedData[i].regime = 1; // Default to medium
      }
    }

    console.log(`  ✓ Fetched ${formattedData.length} data points`);
    console.log(`  ✓ Price range: $${Math.min(...formattedData.map(d => d.price)).toFixed(2)} - $${Math.max(...formattedData.map(d => d.price)).toFixed(2)}`);

    return formattedData;
  } catch (error) {
    console.error(`❌ Error fetching data for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Fetch multiple assets for comparison
 */
export async function fetchMultipleAssets(assets, startDate, endDate, interval = '1d') {
  const results = {};

  for (const asset of assets) {
    try {
      results[asset] = await fetchYahooFinanceData(asset, startDate, endDate, interval);
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Failed to fetch ${asset}:`, error.message);
      results[asset] = null;
    }
  }

  return results;
}

/**
 * Get specific crisis/interesting periods for testing
 */
export const TEST_PERIODS = {
  'COVID_CRASH': {
    name: 'COVID-19 Market Crash',
    start: '2020-02-01',
    end: '2020-06-01',
    description: 'Extreme volatility, 34% drop in 23 days, rapid recovery'
  },
  'SVB_CRISIS': {
    name: 'SVB Bank Crisis',
    start: '2023-03-01',
    end: '2023-04-30',
    description: 'Banking sector crisis, regional bank failures'
  },
  'BEAR_MARKET_2022': {
    name: '2022 Bear Market',
    start: '2022-01-01',
    end: '2022-12-31',
    description: 'Rising interest rates, tech sector correction'
  },
  'BULL_RUN_2023': {
    name: '2023 Bull Run',
    start: '2023-01-01',
    end: '2023-12-31',
    description: 'AI boom, strong recovery, low volatility'
  },
  'CRYPTO_WINTER': {
    name: 'Crypto Winter 2022',
    start: '2022-05-01',
    end: '2022-12-31',
    description: 'Crypto crash, Terra/Luna collapse, FTX bankruptcy',
    assets: ['BTC-USD', 'ETH-USD']
  },
  'FULL_CYCLE': {
    name: 'Full Market Cycle',
    start: '2020-01-01',
    end: '2024-01-01',
    description: '4 years: COVID crash, recovery, inflation, bear market, recovery'
  }
};

/**
 * Calculate basic statistics for a dataset
 */
export function calculateDatasetStats(data) {
  const prices = data.map(d => d.price);
  const returns = data.map(d => d.returns);

  const priceChange = (prices[prices.length - 1] - prices[0]) / prices[0];
  const volatility = Math.sqrt(
    returns.reduce((sum, r) => sum + r * r, 0) / returns.length
  ) * Math.sqrt(252); // Annualized

  const regimeCounts = {};
  data.forEach(d => {
    regimeCounts[d.regime] = (regimeCounts[d.regime] || 0) + 1;
  });

  return {
    dataPoints: data.length,
    startPrice: prices[0],
    endPrice: prices[prices.length - 1],
    priceChange: priceChange * 100,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    avgVolume: data.reduce((sum, d) => sum + d.volume, 0) / data.length,
    volatility: volatility * 100,
    regimes: regimeCounts
  };
}

/**
 * Format data for backtesting (ensure compatibility)
 */
export function formatForBacktesting(data) {
  return data.map(d => ({
    timestamp: d.timestamp,
    price: d.price,
    volume: d.volume,
    returns: d.returns,
    regime: d.regime
  }));
}
