/**
 * Server information resources for the MCP server
 */
import { McpResource } from '../types';

/**
 * System information resource
 */
export const systemInfoResource: McpResource = {
  uri: 'server/system',
  description: 'System information for the MCP server',
  handler: async () => {
    return {
      platform: 'Cloudflare Workers',
      runtime: 'JavaScript',
      version: '1.0.0',
      environment: 'production',
      region: 'auto', // Cloudflare automatically selects the closest region
      timestamp: new Date().toISOString(),
      uptime: Math.floor(Math.random() * 1000000), // Mock uptime in seconds
      memory: {
        total: '128MB', // Cloudflare Workers have a memory limit
        used: `${Math.floor(Math.random() * 100)}MB`,
        free: `${Math.floor(Math.random() * 50)}MB`
      },
      cpu: {
        cores: 'N/A', // Cloudflare Workers abstract away CPU details
        usage: `${Math.floor(Math.random() * 100)}%`
      },
      limits: {
        requests_per_day: 100000,
        cpu_time_per_request: '50ms',
        memory: '128MB',
        environment_variables: 64,
        kv_namespaces: 100
      }
    };
  },
};

/**
 * Configuration information resource
 */
export const configInfoResource: McpResource = {
  uri: 'server/config',
  description: 'Configuration information for the MCP server',
  handler: async () => {
    return {
      server_name: 'Cloudflare MCP Server',
      version: '0.1.0',
      description: 'Model Context Protocol server implemented with Cloudflare Workers',
      cors: {
        enabled: true,
        allowed_origins: ['*'],
        allowed_methods: ['GET', 'POST', 'OPTIONS'],
        allowed_headers: ['Content-Type', 'Authorization'],
        max_age: 86400
      },
      rate_limiting: {
        enabled: true,
        requests_per_minute: 60,
        burst: 10
      },
      logging: {
        level: 'info',
        format: 'json',
        include_request_body: false,
        include_response_body: false
      },
      security: {
        tls_version: '1.3',
        content_security_policy: "default-src 'self'",
        x_content_type_options: 'nosniff',
        x_frame_options: 'DENY',
        x_xss_protection: '1; mode=block'
      }
    };
  },
};

/**
 * Status information resource
 */
export const statusInfoResource: McpResource = {
  uri: 'server/status',
  description: 'Status information for the MCP server',
  handler: async () => {
    // Generate mock status data
    const generateRandomStatus = () => {
      const statuses = ['healthy', 'degraded', 'unhealthy'];
      const weights = [0.95, 0.04, 0.01]; // 95% chance of healthy, 4% degraded, 1% unhealthy
      
      const random = Math.random();
      let cumulativeWeight = 0;
      
      for (let i = 0; i < statuses.length; i++) {
        cumulativeWeight += weights[i];
        if (random < cumulativeWeight) {
          return statuses[i];
        }
      }
      
      return statuses[0]; // Default to healthy
    };
    
    const overallStatus = generateRandomStatus();
    
    return {
      timestamp: new Date().toISOString(),
      overall_status: overallStatus,
      components: {
        api: {
          status: generateRandomStatus(),
          latency: `${Math.floor(Math.random() * 100)}ms`,
          success_rate: `${99 + Math.floor(Math.random() * 2)}%`
        },
        database: {
          status: generateRandomStatus(),
          latency: `${Math.floor(Math.random() * 50)}ms`,
          connections: Math.floor(Math.random() * 100)
        },
        cache: {
          status: generateRandomStatus(),
          hit_rate: `${80 + Math.floor(Math.random() * 20)}%`,
          size: `${Math.floor(Math.random() * 100)}MB`
        },
        workers: {
          status: generateRandomStatus(),
          active: Math.floor(Math.random() * 10),
          idle: Math.floor(Math.random() * 5)
        }
      },
      metrics: {
        requests: {
          total: Math.floor(Math.random() * 1000000),
          success: Math.floor(Math.random() * 990000),
          error: Math.floor(Math.random() * 10000),
          timeout: Math.floor(Math.random() * 1000)
        },
        response_time: {
          average: `${Math.floor(Math.random() * 100)}ms`,
          p95: `${Math.floor(Math.random() * 200)}ms`,
          p99: `${Math.floor(Math.random() * 500)}ms`
        },
        throughput: {
          requests_per_second: Math.floor(Math.random() * 100),
          bytes_per_second: `${Math.floor(Math.random() * 10)}MB`
        }
      },
      incidents: overallStatus !== 'healthy' ? [
        {
          id: `INC-${Math.floor(Math.random() * 10000)}`,
          title: 'Increased API latency',
          status: 'investigating',
          started_at: new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString(),
          updated_at: new Date().toISOString(),
          components_affected: ['api'],
          description: 'We are investigating increased latency in API responses.'
        }
      ] : []
    };
  },
};

/**
 * Usage statistics resource
 */
export const usageStatsResource: McpResource = {
  uri: 'server/usage',
  description: 'Usage statistics for the MCP server',
  handler: async () => {
    // Generate mock usage data
    const generateDailyUsage = () => {
      const data = [];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // Last 30 days
      
      for (let i = 0; i < 30; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        
        data.push({
          date: date.toISOString().split('T')[0],
          requests: Math.floor(Math.random() * 10000),
          unique_users: Math.floor(Math.random() * 1000),
          bandwidth: Math.floor(Math.random() * 1000),
          compute_time: Math.floor(Math.random() * 5000),
          errors: Math.floor(Math.random() * 100)
        });
      }
      
      return data;
    };
    
    // Generate mock tool usage data
    const generateToolUsage = () => {
      const tools = [
        'example_tool',
        'get_weather',
        'calculator',
        'summarize_text',
        'translate_text',
        'search_data',
        'fetch_data',
        'analyze_statistics',
        'linear_regression'
      ];
      
      return tools.map(tool => ({
        name: tool,
        calls: Math.floor(Math.random() * 10000),
        errors: Math.floor(Math.random() * 100),
        average_latency: `${Math.floor(Math.random() * 100)}ms`
      }));
    };
    
    // Generate mock resource usage data
    const generateResourceUsage = () => {
      const resources = [
        'example_resource',
        'server_info',
        'documentation',
        'data/countries',
        'data/currencies',
        'data/timezones',
        'data/sample_dataset',
        'server/system',
        'server/config',
        'server/status'
      ];
      
      return resources.map(resource => ({
        uri: resource,
        accesses: Math.floor(Math.random() * 5000),
        errors: Math.floor(Math.random() * 50),
        average_latency: `${Math.floor(Math.random() * 50)}ms`
      }));
    };
    
    return {
      period: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
        days: 30
      },
      summary: {
        total_requests: Math.floor(Math.random() * 300000),
        unique_users: Math.floor(Math.random() * 10000),
        total_bandwidth: `${Math.floor(Math.random() * 100)}GB`,
        total_compute_time: `${Math.floor(Math.random() * 100000)}s`,
        total_errors: Math.floor(Math.random() * 3000),
        success_rate: `${99 + Math.random()}%`
      },
      daily_usage: generateDailyUsage(),
      tool_usage: generateToolUsage(),
      resource_usage: generateResourceUsage(),
      top_users: [
        { id: 'user1', requests: Math.floor(Math.random() * 10000) },
        { id: 'user2', requests: Math.floor(Math.random() * 8000) },
        { id: 'user3', requests: Math.floor(Math.random() * 6000) },
        { id: 'user4', requests: Math.floor(Math.random() * 4000) },
        { id: 'user5', requests: Math.floor(Math.random() * 2000) }
      ]
    };
  },
};