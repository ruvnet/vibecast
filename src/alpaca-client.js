const Alpaca = require('@alpacahq/alpaca-trade-api');
const chalk = require('chalk');

class AlpacaClient {
  constructor(options = {}) {
    this.mode = options.mode || 'paper';
    this.apiKey = options.apiKey || process.env.ALPACA_API_KEY;
    this.apiSecret = options.apiSecret || process.env.ALPACA_API_SECRET;
    this.alpaca = null;
  }

  async connect() {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('Alpaca API credentials not found. Set ALPACA_API_KEY and ALPACA_API_SECRET environment variables.');
    }

    const baseUrl = this.mode === 'paper'
      ? 'https://paper-api.alpaca.markets'
      : 'https://api.alpaca.markets';

    this.alpaca = new Alpaca({
      keyId: this.apiKey,
      secretKey: this.apiSecret,
      paper: this.mode === 'paper',
      usePolygon: false
    });

    // Test connection
    try {
      const account = await this.alpaca.getAccount();
      console.log(chalk.green(`✓ Connected to Alpaca (${this.mode} mode)`));
      console.log(chalk.gray(`  Account: ${account.account_number}`));
      console.log(chalk.gray(`  Equity: $${parseFloat(account.equity).toFixed(2)}`));
      return true;
    } catch (error) {
      throw new Error(`Failed to connect to Alpaca: ${error.message}`);
    }
  }

  async getAccount() {
    return await this.alpaca.getAccount();
  }

  async getPositions() {
    return await this.alpaca.getPositions();
  }

  async getPosition(symbol) {
    try {
      return await this.alpaca.getPosition(symbol);
    } catch (error) {
      return null;
    }
  }

  async placeOrder(orderParams) {
    return await this.alpaca.createOrder(orderParams);
  }

  async closePosition(symbol) {
    return await this.alpaca.closePosition(symbol);
  }

  async closeAllPositions() {
    return await this.alpaca.closeAllPositions();
  }

  async getMarketData(symbols) {
    const data = [];

    for (const symbol of symbols) {
      try {
        // Get latest quote
        const quote = await this.alpaca.getLatestQuote(symbol);

        // Get bars for additional data
        const bars = await this.alpaca.getBarsV2(symbol, {
          limit: 100,
          timeframe: '1Min'
        });

        const barsArray = [];
        for await (let bar of bars) {
          barsArray.push(bar);
        }

        data.push({
          symbol,
          price: quote.BidPrice || quote.AskPrice || 0,
          bid: quote.BidPrice,
          ask: quote.AskPrice,
          timestamp: quote.Timestamp,
          bars: barsArray
        });
      } catch (error) {
        console.error(chalk.yellow(`⚠ Could not fetch data for ${symbol}: ${error.message}`));
      }
    }

    return data;
  }

  async getHistoricalData(symbol, days = 30) {
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

    try {
      const bars = await this.alpaca.getBarsV2(symbol, {
        start: start.toISOString(),
        end: end.toISOString(),
        timeframe: '1Day',
        limit: 10000
      });

      const data = [];
      for await (let bar of bars) {
        data.push({
          timestamp: bar.Timestamp,
          open: bar.OpenPrice,
          high: bar.HighPrice,
          low: bar.LowPrice,
          close: bar.ClosePrice,
          volume: bar.Volume
        });
      }

      return data;
    } catch (error) {
      throw new Error(`Failed to fetch historical data: ${error.message}`);
    }
  }

  async getClock() {
    return await this.alpaca.getClock();
  }

  async getCalendar(start, end) {
    return await this.alpaca.getCalendar({ start, end });
  }

  isMarketOpen() {
    return this.alpaca.getClock().then(clock => clock.is_open);
  }
}

module.exports = AlpacaClient;
