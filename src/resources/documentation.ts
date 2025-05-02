/**
 * Documentation resources for the MCP server
 */
import { McpResource } from '../types';

/**
 * API documentation resource
 */
export const apiDocumentationResource: McpResource = {
  uri: 'documentation/api',
  description: 'API documentation for the MCP server',
  handler: async () => {
    return {
      title: 'MCP Server API Documentation',
      version: '0.1.0',
      description: 'Comprehensive API documentation for the Model Context Protocol server',
      base_url: '/mcp',
      endpoints: [
        {
          path: '/mcp',
          method: 'GET',
          description: 'Get server information',
          response: {
            type: 'object',
            properties: {
              name: 'Server name',
              version: 'Server version',
              protocol: 'Protocol name (mcp)',
              protocol_version: 'Protocol version',
              jsonrpc: 'JSON-RPC version',
              description: 'Server description',
              tools: 'Array of available tools',
              resources: 'Array of available resources',
              methods: 'Array of available methods'
            }
          }
        },
        {
          path: '/mcp',
          method: 'POST',
          description: 'JSON-RPC 2.0 endpoint for MCP requests',
          request: {
            type: 'object',
            properties: {
              jsonrpc: 'JSON-RPC version (must be "2.0")',
              id: 'Request ID (string, number, or null)',
              method: 'Method name',
              params: 'Method parameters'
            }
          },
          response: {
            type: 'object',
            properties: {
              jsonrpc: 'JSON-RPC version (always "2.0")',
              id: 'Request ID (echoed from request)',
              result: 'Result object (for success)',
              error: 'Error object (for failure)'
            }
          }
        },
        {
          path: '/health',
          method: 'GET',
          description: 'Health check endpoint',
          response: {
            type: 'string',
            example: 'OK'
          }
        }
      ],
      methods: [
        {
          name: 'mcp.use_tool',
          description: 'Execute a tool',
          params: {
            tool: 'The name of the tool to execute',
            parameters: 'Parameters for the tool'
          },
          example: {
            request: {
              jsonrpc: '2.0',
              id: 1,
              method: 'mcp.use_tool',
              params: {
                tool: 'example_tool',
                parameters: {
                  message: 'Hello, world!',
                  uppercase: true
                }
              }
            },
            response: {
              jsonrpc: '2.0',
              id: 1,
              result: {
                message: 'HELLO, WORLD!',
                timestamp: '2025-05-01T12:00:00.000Z'
              }
            }
          }
        },
        {
          name: 'mcp.access_resource',
          description: 'Access a resource',
          params: {
            uri: 'The URI of the resource to access'
          },
          example: {
            request: {
              jsonrpc: '2.0',
              id: 2,
              method: 'mcp.access_resource',
              params: {
                uri: 'server_info'
              }
            },
            response: {
              jsonrpc: '2.0',
              id: 2,
              result: {
                content: {
                  name: 'Cloudflare MCP Server',
                  version: '0.1.0',
                  description: 'Model Context Protocol server implemented with Cloudflare Workers',
                  environment: 'development',
                  runtime: 'Cloudflare Workers',
                  timestamp: '2025-05-01T12:00:00.000Z'
                }
              }
            }
          }
        },
        {
          name: 'mcp.list_tools',
          description: 'List available tools',
          params: {},
          example: {
            request: {
              jsonrpc: '2.0',
              id: 3,
              method: 'mcp.list_tools',
              params: {}
            },
            response: {
              jsonrpc: '2.0',
              id: 3,
              result: {
                tools: [
                  {
                    id: 'example_tool',
                    name: 'example_tool',
                    description: 'An example tool for demonstration purposes'
                  },
                  {
                    id: 'get_weather',
                    name: 'get_weather',
                    description: 'Get current weather information for a location'
                  }
                ]
              }
            }
          }
        },
        {
          name: 'mcp.list_resources',
          description: 'List available resources',
          params: {},
          example: {
            request: {
              jsonrpc: '2.0',
              id: 4,
              method: 'mcp.list_resources',
              params: {}
            },
            response: {
              jsonrpc: '2.0',
              id: 4,
              result: {
                resources: [
                  {
                    id: 'example_resource',
                    uri: 'example_resource',
                    description: 'An example resource for demonstration purposes'
                  },
                  {
                    id: 'server_info',
                    uri: 'server_info',
                    description: 'Information about the MCP server'
                  }
                ]
              }
            }
          }
        },
        {
          name: 'mcp.get_tool_schema',
          description: 'Get schema for a specific tool',
          params: {
            tool: 'The name of the tool'
          },
          example: {
            request: {
              jsonrpc: '2.0',
              id: 5,
              method: 'mcp.get_tool_schema',
              params: {
                tool: 'example_tool'
              }
            },
            response: {
              jsonrpc: '2.0',
              id: 5,
              result: {
                name: 'example_tool',
                description: 'An example tool for demonstration purposes',
                parameters: {
                  message: {
                    type: 'string',
                    description: 'A message to echo back',
                    required: true
                  },
                  uppercase: {
                    type: 'boolean',
                    description: 'Whether to convert the message to uppercase',
                    required: false,
                    default: false
                  }
                }
              }
            }
          }
        },
        {
          name: 'mcp.get_server_info',
          description: 'Get server information',
          params: {},
          example: {
            request: {
              jsonrpc: '2.0',
              id: 6,
              method: 'mcp.get_server_info',
              params: {}
            },
            response: {
              jsonrpc: '2.0',
              id: 6,
              result: {
                name: 'Cloudflare MCP Server',
                version: '0.1.0',
                protocol: 'mcp',
                protocol_version: '0.1.0',
                jsonrpc: '2.0',
                description: 'Model Context Protocol server implemented with Cloudflare Workers',
                methods: [
                  'mcp.use_tool',
                  'mcp.access_resource',
                  'mcp.list_tools',
                  'mcp.list_resources',
                  'mcp.get_tool_schema',
                  'mcp.get_server_info'
                ]
              }
            }
          }
        }
      ]
    };
  },
};

/**
 * Tool documentation resource
 */
export const toolDocumentationResource: McpResource = {
  uri: 'documentation/tools',
  description: 'Documentation for available MCP tools',
  handler: async () => {
    return {
      title: 'MCP Server Tools Documentation',
      version: '0.1.0',
      description: 'Documentation for all available tools in the MCP server',
      categories: [
        {
          name: 'Text Processing',
          description: 'Tools for processing and analyzing text',
          tools: [
            {
              name: 'summarize_text',
              description: 'Summarizes text by extracting key sentences based on importance',
              parameters: {
                text: {
                  type: 'string',
                  description: 'The text to summarize',
                  required: true
                },
                max_sentences: {
                  type: 'number',
                  description: 'Maximum number of sentences to include in the summary',
                  required: false,
                  default: 3
                },
                min_length: {
                  type: 'number',
                  description: 'Minimum length of sentences to consider',
                  required: false,
                  default: 10
                }
              },
              example: {
                request: {
                  text: 'The Model Context Protocol (MCP) is a standardized interface for AI models to access external tools and resources. It enables models to perform actions beyond their training data, such as accessing real-time information, executing code, or interacting with external systems. MCP servers provide a JSON-RPC 2.0 compatible API that models can use to discover and utilize available tools and resources. This protocol enhances the capabilities of AI models while maintaining a clear separation between the model and external systems.',
                  max_sentences: 2
                },
                response: {
                  original_length: 429,
                  summary_length: 286,
                  sentence_count: 2,
                  summary: 'The Model Context Protocol (MCP) is a standardized interface for AI models to access external tools and resources. It enables models to perform actions beyond their training data, such as accessing real-time information, executing code, or interacting with external systems.',
                  reduction_percentage: 33
                }
              }
            },
            {
              name: 'translate_text',
              description: 'Translates text between languages using a simple dictionary-based approach',
              parameters: {
                text: {
                  type: 'string',
                  description: 'The text to translate',
                  required: true
                },
                source_language: {
                  type: 'string',
                  description: 'Source language code (e.g., en, es, fr)',
                  required: true
                },
                target_language: {
                  type: 'string',
                  description: 'Target language code (e.g., en, es, fr)',
                  required: true
                }
              },
              example: {
                request: {
                  text: 'Hello world, how are you today?',
                  source_language: 'en',
                  target_language: 'es'
                },
                response: {
                  original_text: 'Hello world, how are you today?',
                  translated_text: 'Hola mundo, cómo estás tú hoy?',
                  source_language: 'en',
                  target_language: 'es',
                  supported: true,
                  word_count: 6,
                  translated_word_count: 6
                }
              }
            }
          ]
        },
        {
          name: 'Data Retrieval',
          description: 'Tools for searching and retrieving data',
          tools: [
            {
              name: 'search_data',
              description: 'Search for data in the database based on query parameters',
              parameters: {
                collection: {
                  type: 'string',
                  description: 'The collection to search in (users, products, orders)',
                  required: true
                },
                query: {
                  type: 'object',
                  description: 'Query parameters for filtering results',
                  required: false,
                  default: {}
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return',
                  required: false,
                  default: 10
                },
                offset: {
                  type: 'number',
                  description: 'Number of results to skip',
                  required: false,
                  default: 0
                }
              },
              example: {
                request: {
                  collection: 'products',
                  query: {
                    category: 'electronics'
                  },
                  limit: 2
                },
                response: {
                  collection: 'products',
                  total: 4,
                  offset: 0,
                  limit: 2,
                  data: [
                    {
                      id: 101,
                      name: 'Laptop',
                      category: 'electronics',
                      price: 999.99,
                      stock: 50
                    },
                    {
                      id: 102,
                      name: 'Smartphone',
                      category: 'electronics',
                      price: 699.99,
                      stock: 100
                    }
                  ]
                }
              }
            },
            {
              name: 'fetch_data',
              description: 'Fetch specific records by ID from the database',
              parameters: {
                collection: {
                  type: 'string',
                  description: 'The collection to fetch from (users, products, orders)',
                  required: true
                },
                id: {
                  type: 'number',
                  description: 'The ID of the record to fetch',
                  required: true
                },
                include_related: {
                  type: 'boolean',
                  description: 'Whether to include related records',
                  required: false,
                  default: false
                }
              },
              example: {
                request: {
                  collection: 'orders',
                  id: 1001,
                  include_related: true
                },
                response: {
                  collection: 'orders',
                  id: 1001,
                  data: {
                    id: 1001,
                    userId: 1,
                    products: [101, 103],
                    total: 1149.98,
                    date: '2025-04-15'
                  },
                  related: {
                    user: {
                      id: 1,
                      name: 'John Doe',
                      email: 'john@example.com',
                      role: 'admin'
                    },
                    products: [
                      {
                        id: 101,
                        name: 'Laptop',
                        category: 'electronics',
                        price: 999.99,
                        stock: 50
                      },
                      {
                        id: 103,
                        name: 'Headphones',
                        category: 'accessories',
                        price: 149.99,
                        stock: 200
                      }
                    ]
                  }
                }
              }
            }
          ]
        },
        {
          name: 'Data Analysis',
          description: 'Tools for analyzing and processing data',
          tools: [
            {
              name: 'analyze_statistics',
              description: 'Performs statistical analysis on numerical data',
              parameters: {
                data: {
                  type: 'array',
                  description: 'Array of numerical values to analyze',
                  required: true
                },
                percentiles: {
                  type: 'array',
                  description: 'Array of percentiles to calculate (values between 0 and 100)',
                  required: false,
                  default: [25, 50, 75]
                },
                include_outliers: {
                  type: 'boolean',
                  description: 'Whether to identify outliers in the data',
                  required: false,
                  default: false
                }
              },
              example: {
                request: {
                  data: [12, 15, 18, 22, 25, 27, 30, 32, 35, 40, 42, 45, 50, 55, 60],
                  percentiles: [25, 50, 75, 90],
                  include_outliers: true
                },
                response: {
                  count: 15,
                  min: 12,
                  max: 60,
                  range: 48,
                  sum: 508,
                  mean: 33.87,
                  median: 32,
                  variance: 205.27,
                  std_dev: 14.33,
                  percentiles: {
                    p25: 25,
                    p50: 32,
                    p75: 45,
                    p90: 55
                  },
                  outliers: [60],
                  invalid_values_count: 0
                }
              }
            },
            {
              name: 'linear_regression',
              description: 'Performs linear regression analysis on data points',
              parameters: {
                x_values: {
                  type: 'array',
                  description: 'Array of independent variable values',
                  required: true
                },
                y_values: {
                  type: 'array',
                  description: 'Array of dependent variable values',
                  required: true
                },
                predict_for: {
                  type: 'array',
                  description: 'Array of x values to predict y values for',
                  required: false,
                  default: []
                }
              },
              example: {
                request: {
                  x_values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                  y_values: [2, 4, 5, 7, 9, 11, 14, 15, 17, 20],
                  predict_for: [11, 12, 13]
                },
                response: {
                  data_points: 10,
                  invalid_points: 0,
                  coefficients: {
                    slope: 1.97,
                    intercept: -0.3
                  },
                  equation: 'y = 1.9700x + -0.3000',
                  r_squared: 0.9923,
                  correlation: 0.9961,
                  predictions: [
                    { x: 11, y: 21.37 },
                    { x: 12, y: 23.34 },
                    { x: 13, y: 25.31 }
                  ]
                }
              }
            }
          ]
        }
      ]
    };
  },
};

/**
 * MCP protocol documentation resource
 */
export const protocolDocumentationResource: McpResource = {
  uri: 'documentation/protocol',
  description: 'Documentation for the Model Context Protocol',
  handler: async () => {
    return {
      title: 'Model Context Protocol (MCP) Documentation',
      version: '0.1.0',
      description: 'Documentation for the Model Context Protocol specification',
      sections: [
        {
          title: 'Introduction',
          content: `
            The Model Context Protocol (MCP) is a standardized interface for AI models to access external tools and resources.
            It enables models to perform actions beyond their training data, such as accessing real-time information,
            executing code, or interacting with external systems. MCP servers provide a JSON-RPC 2.0 compatible API
            that models can use to discover and utilize available tools and resources.
          `
        },
        {
          title: 'Core Concepts',
          content: `
            The MCP defines two primary concepts:
            
            1. Tools: Executable functions that perform specific actions or computations
            2. Resources: Data sources that provide information or context
            
            Models interact with MCP servers using JSON-RPC 2.0 over HTTP, allowing for a standardized
            request-response pattern with proper error handling.
          `
        },
        {
          title: 'Protocol Methods',
          content: `
            The MCP defines several standard methods:
            
            - mcp.use_tool: Execute a tool with specified parameters
            - mcp.access_resource: Access a resource by URI
            - mcp.list_tools: List all available tools
            - mcp.list_resources: List all available resources
            - mcp.get_tool_schema: Get detailed schema for a specific tool
            - mcp.get_server_info: Get information about the MCP server
          `
        },
        {
          title: 'Request Format',
          content: `
            All requests follow the JSON-RPC 2.0 format:
            
            {
              "jsonrpc": "2.0",
              "id": "request-id",
              "method": "method-name",
              "params": {
                // Method-specific parameters
              }
            }
          `
        },
        {
          title: 'Response Format',
          content: `
            Successful responses:
            
            {
              "jsonrpc": "2.0",
              "id": "request-id",
              "result": {
                // Method-specific result
              }
            }
            
            Error responses:
            
            {
              "jsonrpc": "2.0",
              "id": "request-id",
              "error": {
                "code": -32000,
                "message": "Error message",
                "data": {
                  // Additional error information
                }
              }
            }
          `
        },
        {
          title: 'Error Codes',
          content: `
            The MCP uses standard JSON-RPC 2.0 error codes:
            
            - -32700: Parse error
            - -32600: Invalid request
            - -32601: Method not found
            - -32602: Invalid params
            - -32603: Internal error
            - -32000 to -32099: Server error
          `
        },
        {
          title: 'Implementation Guidelines',
          content: `
            When implementing an MCP server:
            
            1. Use JSON-RPC 2.0 for all communication
            2. Implement all standard methods
            3. Provide clear documentation for all tools and resources
            4. Include proper error handling and validation
            5. Support CORS for cross-origin requests
            6. Implement proper security measures
          `
        }
      ],
      references: [
        {
          title: 'JSON-RPC 2.0 Specification',
          url: 'https://www.jsonrpc.org/specification'
        },
        {
          title: 'MCP GitHub Repository',
          url: 'https://github.com/example/mcp-spec'
        }
      ]
    };
  },
};