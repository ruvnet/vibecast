/**
 * Data analysis tools for the MCP server
 */
import { McpTool } from '../types';

/**
 * Statistical analysis tool
 * Provides basic statistical analysis for numerical data
 */
export const statisticsTool: McpTool = {
  name: 'analyze_statistics',
  description: 'Performs statistical analysis on numerical data',
  parameters: {
    data: {
      type: 'array',
      description: 'Array of numerical values to analyze',
      required: true,
    },
    percentiles: {
      type: 'array',
      description: 'Array of percentiles to calculate (values between 0 and 100)',
      required: false,
      default: [25, 50, 75],
    },
    include_outliers: {
      type: 'boolean',
      description: 'Whether to identify outliers in the data',
      required: false,
      default: false,
    }
  },
  handler: async (params: Record<string, any>) => {
    const { data, percentiles = [25, 50, 75], include_outliers = false } = params;
    
    if (!data || !Array.isArray(data)) {
      throw new Error('Data parameter is required and must be an array');
    }
    
    // Filter out non-numeric values
    const numericData = data.filter((value: any) => 
      typeof value === 'number' && !isNaN(value) && isFinite(value)
    );
    
    if (numericData.length === 0) {
      throw new Error('No valid numeric data provided');
    }
    
    // Sort data for calculations
    const sortedData = [...numericData].sort((a: number, b: number) => a - b);
    
    // Calculate basic statistics
    const sum = sortedData.reduce((acc: number, val: number) => acc + val, 0);
    const count = sortedData.length;
    const mean = sum / count;
    const min = sortedData[0];
    const max = sortedData[count - 1];
    const range = max - min;
    
    // Calculate median (50th percentile)
    const median = calculatePercentile(sortedData, 50);
    
    // Calculate variance and standard deviation
    const squaredDiffs = sortedData.map((value: number) => Math.pow(value - mean, 2));
    const variance = squaredDiffs.reduce((acc: number, val: number) => acc + val, 0) / count;
    const stdDev = Math.sqrt(variance);
    
    // Calculate requested percentiles
    const percentileResults: Record<string, number> = {};
    percentiles.forEach((p: number) => {
      if (p < 0 || p > 100) {
        throw new Error(`Percentile must be between 0 and 100: ${p}`);
      }
      percentileResults[`p${p}`] = calculatePercentile(sortedData, p);
    });
    
    // Calculate outliers if requested
    let outliers: number[] = [];
    if (include_outliers) {
      // Using IQR method to identify outliers
      const q1 = calculatePercentile(sortedData, 25);
      const q3 = calculatePercentile(sortedData, 75);
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;
      
      outliers = sortedData.filter((value: number) => 
        value < lowerBound || value > upperBound
      );
    }
    
    return {
      count,
      min,
      max,
      range,
      sum,
      mean,
      median,
      variance,
      std_dev: stdDev,
      percentiles: percentileResults,
      outliers: include_outliers ? outliers : undefined,
      invalid_values_count: data.length - numericData.length
    };
  },
};

/**
 * Helper function to calculate percentiles
 */
function calculatePercentile(sortedData: number[], percentile: number): number {
  if (sortedData.length === 0) return 0;
  if (sortedData.length === 1) return sortedData[0];
  
  const index = (percentile / 100) * (sortedData.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  
  if (lower === upper) return sortedData[lower];
  
  return sortedData[lower] * (1 - weight) + sortedData[upper] * weight;
}

/**
 * Time series analysis tool
 * Provides analysis for time series data
 */
export const timeSeriesAnalysisTool: McpTool = {
  name: 'analyze_time_series',
  description: 'Analyzes time series data to identify trends and patterns',
  parameters: {
    data: {
      type: 'array',
      description: 'Array of time series data points with timestamp and value',
      required: true,
    },
    interval: {
      type: 'string',
      description: 'Time interval for aggregation (day, week, month, year)',
      required: false,
      default: 'day',
    },
    moving_average_window: {
      type: 'number',
      description: 'Window size for calculating moving average',
      required: false,
      default: 3,
    }
  },
  handler: async (params: Record<string, any>) => {
    const { data, interval = 'day', moving_average_window = 3 } = params;
    
    if (!data || !Array.isArray(data)) {
      throw new Error('Data parameter is required and must be an array');
    }
    
    // Validate data format
    const validData = data.filter((point: any) => 
      point && 
      typeof point === 'object' && 
      'timestamp' in point && 
      'value' in point &&
      typeof point.value === 'number' &&
      !isNaN(point.value) &&
      isFinite(point.value)
    );
    
    if (validData.length === 0) {
      throw new Error('No valid time series data provided');
    }
    
    // Sort data by timestamp
    const sortedData = [...validData].sort((a: any, b: any) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return dateA - dateB;
    });
    
    // Aggregate data by interval
    const aggregatedData = aggregateByTimeInterval(sortedData, interval);
    
    // Calculate moving average
    const movingAverage = calculateMovingAverage(
      aggregatedData.map((point: any) => point.value),
      moving_average_window
    );
    
    // Add moving average to aggregated data
    const result = aggregatedData.map((point: any, index: number) => ({
      ...point,
      moving_average: index < movingAverage.length ? movingAverage[index] : null
    }));
    
    // Calculate basic trend analysis
    const firstValue = sortedData[0].value;
    const lastValue = sortedData[sortedData.length - 1].value;
    const totalChange = lastValue - firstValue;
    const percentChange = (totalChange / Math.abs(firstValue)) * 100;
    
    // Calculate volatility (standard deviation of percent changes)
    const percentChanges = [];
    for (let i = 1; i < sortedData.length; i++) {
      const prevValue = sortedData[i - 1].value;
      const currValue = sortedData[i].value;
      if (prevValue !== 0) {
        percentChanges.push((currValue - prevValue) / Math.abs(prevValue) * 100);
      }
    }
    
    const volatility = calculateStandardDeviation(percentChanges);
    
    return {
      data_points: sortedData.length,
      start_date: new Date(sortedData[0].timestamp).toISOString(),
      end_date: new Date(sortedData[sortedData.length - 1].timestamp).toISOString(),
      duration_days: Math.round(
        (new Date(sortedData[sortedData.length - 1].timestamp).getTime() - 
         new Date(sortedData[0].timestamp).getTime()) / (1000 * 60 * 60 * 24)
      ),
      aggregation_interval: interval,
      moving_average_window,
      first_value: firstValue,
      last_value: lastValue,
      total_change: totalChange,
      percent_change: percentChange,
      volatility,
      trend: percentChange > 5 ? 'increasing' : percentChange < -5 ? 'decreasing' : 'stable',
      aggregated_data: result,
      invalid_data_points: data.length - validData.length
    };
  },
};

/**
 * Helper function to aggregate time series data by interval
 */
function aggregateByTimeInterval(data: any[], interval: string): any[] {
  const result: Record<string, any> = {};
  
  data.forEach((point: any) => {
    const date = new Date(point.timestamp);
    let key: string;
    
    switch (interval.toLowerCase()) {
      case 'day':
        key = date.toISOString().split('T')[0]; // YYYY-MM-DD
        break;
      case 'week':
        // Get the first day of the week (Sunday)
        const day = date.getUTCDay();
        const diff = date.getUTCDate() - day;
        const weekStart = new Date(date);
        weekStart.setUTCDate(diff);
        key = weekStart.toISOString().split('T')[0];
        break;
      case 'month':
        key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
        break;
      case 'year':
        key = `${date.getUTCFullYear()}`;
        break;
      default:
        key = date.toISOString().split('T')[0]; // Default to day
    }
    
    if (!result[key]) {
      result[key] = {
        interval: key,
        count: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
        values: []
      };
    }
    
    result[key].count++;
    result[key].sum += point.value;
    result[key].min = Math.min(result[key].min, point.value);
    result[key].max = Math.max(result[key].max, point.value);
    result[key].values.push(point.value);
  });
  
  // Calculate averages and convert to array
  return Object.values(result).map((item: any) => ({
    interval: item.interval,
    count: item.count,
    sum: item.sum,
    min: item.min,
    max: item.max,
    value: item.sum / item.count, // Average value for the interval
    timestamp: new Date(item.interval).toISOString()
  })).sort((a: any, b: any) => {
    return new Date(a.interval).getTime() - new Date(b.interval).getTime();
  });
}

/**
 * Helper function to calculate moving average
 */
function calculateMovingAverage(values: number[], window: number): number[] {
  if (window <= 0 || values.length === 0) return [];
  
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < window - 1) {
      // Not enough data points yet
      continue;
    }
    
    let sum = 0;
    for (let j = 0; j < window; j++) {
      sum += values[i - j];
    }
    result.push(sum / window);
  }
  
  return result;
}

/**
 * Helper function to calculate standard deviation
 */
function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  
  return Math.sqrt(variance);
}

/**
 * Machine learning tool for prediction
 * Provides simple linear regression for prediction
 */
export const linearRegressionTool: McpTool = {
  name: 'linear_regression',
  description: 'Performs linear regression analysis on data points',
  parameters: {
    x_values: {
      type: 'array',
      description: 'Array of independent variable values',
      required: true,
    },
    y_values: {
      type: 'array',
      description: 'Array of dependent variable values',
      required: true,
    },
    predict_for: {
      type: 'array',
      description: 'Array of x values to predict y values for',
      required: false,
      default: [],
    }
  },
  handler: async (params: Record<string, any>) => {
    const { x_values, y_values, predict_for = [] } = params;
    
    if (!x_values || !Array.isArray(x_values)) {
      throw new Error('x_values parameter is required and must be an array');
    }
    
    if (!y_values || !Array.isArray(y_values)) {
      throw new Error('y_values parameter is required and must be an array');
    }
    
    if (x_values.length !== y_values.length) {
      throw new Error('x_values and y_values must have the same length');
    }
    
    if (x_values.length < 2) {
      throw new Error('At least two data points are required for regression');
    }
    
    // Filter out non-numeric values
    const validIndices: number[] = [];
    for (let i = 0; i < x_values.length; i++) {
      const x = x_values[i];
      const y = y_values[i];
      
      if (
        typeof x === 'number' && !isNaN(x) && isFinite(x) &&
        typeof y === 'number' && !isNaN(y) && isFinite(y)
      ) {
        validIndices.push(i);
      }
    }
    
    if (validIndices.length < 2) {
      throw new Error('At least two valid numeric data points are required for regression');
    }
    
    const validX = validIndices.map(i => x_values[i]);
    const validY = validIndices.map(i => y_values[i]);
    
    // Calculate linear regression coefficients
    const { slope, intercept, r_squared } = calculateLinearRegression(validX, validY);
    
    // Make predictions if requested
    const predictions: Array<{ x: number; y: number }> = [];
    if (Array.isArray(predict_for)) {
      predict_for.forEach((x: any) => {
        if (typeof x === 'number' && !isNaN(x) && isFinite(x)) {
          const predictedY = slope * x + intercept;
          predictions.push({ x, y: predictedY });
        }
      });
    }
    
    return {
      data_points: validIndices.length,
      invalid_points: x_values.length - validIndices.length,
      coefficients: {
        slope,
        intercept
      },
      equation: `y = ${slope.toFixed(4)}x + ${intercept.toFixed(4)}`,
      r_squared,
      correlation: Math.sqrt(r_squared) * (slope >= 0 ? 1 : -1),
      predictions: predictions.length > 0 ? predictions : undefined
    };
  },
};

/**
 * Helper function to calculate linear regression coefficients
 */
function calculateLinearRegression(x: number[], y: number[]): { slope: number; intercept: number; r_squared: number } {
  const n = x.length;
  
  // Calculate means
  const meanX = x.reduce((sum, val) => sum + val, 0) / n;
  const meanY = y.reduce((sum, val) => sum + val, 0) / n;
  
  // Calculate slope and intercept
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < n; i++) {
    numerator += (x[i] - meanX) * (y[i] - meanY);
    denominator += Math.pow(x[i] - meanX, 2);
  }
  
  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = meanY - slope * meanX;
  
  // Calculate R-squared
  let totalSumOfSquares = 0;
  let residualSumOfSquares = 0;
  
  for (let i = 0; i < n; i++) {
    const predictedY = slope * x[i] + intercept;
    totalSumOfSquares += Math.pow(y[i] - meanY, 2);
    residualSumOfSquares += Math.pow(y[i] - predictedY, 2);
  }
  
  const r_squared = totalSumOfSquares !== 0 ? 1 - (residualSumOfSquares / totalSumOfSquares) : 0;
  
  return { slope, intercept, r_squared };
}