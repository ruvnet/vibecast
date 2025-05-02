/**
 * MCP tools implementation
 */
import { McpTool } from '../types';

// Import tools from separate files
import { summarizeTool, translateTool } from './text-processor';
import { searchTool, fetchDataTool, aggregateTool } from './data-retriever';
import { statisticsTool, timeSeriesAnalysisTool, linearRegressionTool } from './data-analyzer';

/**
 * Example tool implementation
 */
export const exampleTool: McpTool = {
  name: 'example_tool',
  description: 'An example tool for demonstration purposes',
  parameters: {
    message: {
      type: 'string',
      description: 'A message to echo back',
      required: true,
    },
    uppercase: {
      type: 'boolean',
      description: 'Whether to convert the message to uppercase',
      required: false,
      default: false,
    },
  },
  handler: async (params: Record<string, any>) => {
    const { message, uppercase = false } = params;
    
    if (!message) {
      throw new Error('Message parameter is required');
    }
    
    const response = uppercase ? message.toUpperCase() : message;
    
    return {
      message: response,
      timestamp: new Date().toISOString(),
    };
  },
};

/**
 * Weather tool implementation
 */
export const weatherTool: McpTool = {
  name: 'get_weather',
  description: 'Get current weather information for a location',
  parameters: {
    location: {
      type: 'string',
      description: 'The location to get weather for (city name)',
      required: true,
    },
    units: {
      type: 'string',
      description: 'Temperature units (celsius or fahrenheit)',
      required: false,
      default: 'celsius',
    },
  },
  handler: async (params: Record<string, any>) => {
    const { location, units = 'celsius' } = params;
    
    if (!location) {
      throw new Error('Location parameter is required');
    }
    
    // This is a mock implementation
    // In a real implementation, you would call a weather API
    const mockWeatherData = {
      location,
      temperature: units === 'celsius' ? 22 : 72,
      units: units === 'celsius' ? 'C' : 'F',
      condition: 'Sunny',
      humidity: 65,
      wind: {
        speed: 10,
        direction: 'NE',
      },
      timestamp: new Date().toISOString(),
    };
    
    return mockWeatherData;
  },
};

/**
 * Calculator tool implementation
 */
export const calculatorTool: McpTool = {
  name: 'calculator',
  description: 'Perform basic arithmetic calculations',
  parameters: {
    operation: {
      type: 'string',
      description: 'The operation to perform (add, subtract, multiply, divide)',
      required: true,
    },
    a: {
      type: 'number',
      description: 'First operand',
      required: true,
    },
    b: {
      type: 'number',
      description: 'Second operand',
      required: true,
    },
  },
  handler: async (params: Record<string, any>) => {
    const { operation, a, b } = params;
    
    if (!operation) {
      throw new Error('Operation parameter is required');
    }
    
    if (a === undefined || b === undefined) {
      throw new Error('Both operands are required');
    }
    
    let result: number;
    
    switch (operation.toLowerCase()) {
      case 'add':
        result = a + b;
        break;
      case 'subtract':
        result = a - b;
        break;
      case 'multiply':
        result = a * b;
        break;
      case 'divide':
        if (b === 0) {
          throw new Error('Division by zero is not allowed');
        }
        result = a / b;
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
    
    return {
      operation,
      a,
      b,
      result,
    };
  },
};

/**
 * Map of all available tools
 */
export const tools: Record<string, McpTool> = {
  // Example tools
  example_tool: exampleTool,
  get_weather: weatherTool,
  calculator: calculatorTool,
  
  // Text processing tools
  summarize_text: summarizeTool,
  translate_text: translateTool,
  
  // Data retrieval tools
  search_data: searchTool,
  fetch_data: fetchDataTool,
  aggregate_data: aggregateTool,
  
  // Data analysis tools
  analyze_statistics: statisticsTool,
  analyze_time_series: timeSeriesAnalysisTool,
  linear_regression: linearRegressionTool
};