/**
 * MCP resources implementation
 */
import { McpResource } from '../types';

// Import resources from separate files
import {
  apiDocumentationResource,
  toolDocumentationResource,
  protocolDocumentationResource
} from './documentation';

import {
  countriesResource,
  currenciesResource,
  timeZonesResource,
  sampleDatasetResource
} from './data';

import {
  systemInfoResource,
  configInfoResource,
  statusInfoResource,
  usageStatsResource
} from './server-info';

/**
 * Example resource implementation
 */
export const exampleResource: McpResource = {
  uri: 'example_resource',
  description: 'An example resource for demonstration purposes',
  handler: async () => {
    return {
      data: {
        message: 'This is an example resource',
        timestamp: new Date().toISOString(),
      },
      metadata: {
        type: 'example',
        version: '1.0.0',
      },
    };
  },
};

/**
 * Server information resource
 */
export const serverInfoResource: McpResource = {
  uri: 'server_info',
  description: 'Information about the MCP server',
  handler: async () => {
    return {
      name: 'Cloudflare MCP Server',
      version: '0.1.0',
      description: 'Model Context Protocol server implemented with Cloudflare Workers',
      environment: 'development', // In Cloudflare Workers, we use env bindings instead of process.env
      runtime: 'Cloudflare Workers',
      timestamp: new Date().toISOString(),
    };
  },
};

/**
 * Documentation resource
 */
export const documentationResource: McpResource = {
  uri: 'documentation',
  description: 'Documentation for the MCP server',
  handler: async () => {
    return {
      title: 'MCP Server Documentation',
      version: '0.1.0',
      description: 'Documentation for the Model Context Protocol server',
      endpoints: [
        {
          path: '/mcp',
          method: 'GET',
          description: 'Get server information',
        },
        {
          path: '/mcp',
          method: 'POST',
          description: 'JSON-RPC 2.0 endpoint for MCP requests',
        },
      ],
      methods: [
        {
          name: 'mcp.use_tool',
          description: 'Execute a tool',
          params: {
            tool: 'The name of the tool to execute',
            parameters: 'Parameters for the tool',
          },
        },
        {
          name: 'mcp.access_resource',
          description: 'Access a resource',
          params: {
            uri: 'The URI of the resource to access',
          },
        },
        {
          name: 'mcp.list_tools',
          description: 'List available tools',
          params: {},
        },
        {
          name: 'mcp.list_resources',
          description: 'List available resources',
          params: {},
        },
        {
          name: 'mcp.get_tool_schema',
          description: 'Get schema for a specific tool',
          params: {
            tool: 'The name of the tool',
          },
        },
        {
          name: 'mcp.get_server_info',
          description: 'Get server information',
          params: {},
        },
      ],
    };
  },
};

/**
 * Map of all available resources
 */
export const resources: Record<string, McpResource> = {
  // Basic resources
  example_resource: exampleResource,
  server_info: serverInfoResource,
  documentation: documentationResource,
  
  // Documentation resources
  'documentation/api': apiDocumentationResource,
  'documentation/tools': toolDocumentationResource,
  'documentation/protocol': protocolDocumentationResource,
  
  // Data resources
  'data/countries': countriesResource,
  'data/currencies': currenciesResource,
  'data/timezones': timeZonesResource,
  'data/sample_dataset': sampleDatasetResource,
  
  // Server information resources
  'server/system': systemInfoResource,
  'server/config': configInfoResource,
  'server/status': statusInfoResource,
  'server/usage': usageStatsResource
};