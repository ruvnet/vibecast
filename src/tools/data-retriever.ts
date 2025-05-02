/**
 * Data retrieval tools for the MCP server
 */
import { McpTool } from '../types';

/**
 * Mock database for demonstration purposes
 */
const mockDatabase = {
  users: [
    { id: 1, name: 'John Doe', email: 'john@example.com', role: 'admin' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'user' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'user' },
    { id: 4, name: 'Alice Brown', email: 'alice@example.com', role: 'manager' },
    { id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', role: 'user' }
  ],
  products: [
    { id: 101, name: 'Laptop', category: 'electronics', price: 999.99, stock: 50 },
    { id: 102, name: 'Smartphone', category: 'electronics', price: 699.99, stock: 100 },
    { id: 103, name: 'Headphones', category: 'accessories', price: 149.99, stock: 200 },
    { id: 104, name: 'Monitor', category: 'electronics', price: 349.99, stock: 30 },
    { id: 105, name: 'Keyboard', category: 'accessories', price: 79.99, stock: 150 },
    { id: 106, name: 'Mouse', category: 'accessories', price: 49.99, stock: 200 },
    { id: 107, name: 'Tablet', category: 'electronics', price: 499.99, stock: 75 }
  ],
  orders: [
    { id: 1001, userId: 1, products: [101, 103], total: 1149.98, date: '2025-04-15' },
    { id: 1002, userId: 2, products: [102], total: 699.99, date: '2025-04-16' },
    { id: 1003, userId: 3, products: [105, 106], total: 129.98, date: '2025-04-18' },
    { id: 1004, userId: 4, products: [104, 107], total: 849.98, date: '2025-04-20' },
    { id: 1005, userId: 1, products: [102, 106], total: 749.98, date: '2025-04-22' }
  ]
};

/**
 * Search tool for querying data
 */
export const searchTool: McpTool = {
  name: 'search_data',
  description: 'Search for data in the database based on query parameters',
  parameters: {
    collection: {
      type: 'string',
      description: 'The collection to search in (users, products, orders)',
      required: true,
    },
    query: {
      type: 'object',
      description: 'Query parameters for filtering results',
      required: false,
      default: {},
    },
    limit: {
      type: 'number',
      description: 'Maximum number of results to return',
      required: false,
      default: 10,
    },
    offset: {
      type: 'number',
      description: 'Number of results to skip',
      required: false,
      default: 0,
    }
  },
  handler: async (params: Record<string, any>) => {
    const { collection, query = {}, limit = 10, offset = 0 } = params;
    
    if (!collection) {
      throw new Error('Collection parameter is required');
    }
    
    // Check if collection exists
    if (!mockDatabase[collection as keyof typeof mockDatabase]) {
      throw new Error(`Collection not found: ${collection}`);
    }
    
    // Get data from the mock database
    const data = mockDatabase[collection as keyof typeof mockDatabase];
    
    // Filter data based on query parameters
    const filteredData = data.filter((item: Record<string, any>) => {
      // Check if all query parameters match
      return Object.entries(query).every(([key, value]) => {
        // Handle nested properties
        if (key.includes('.')) {
          const parts = key.split('.');
          let nestedValue = item;
          for (const part of parts) {
            if (nestedValue === undefined || nestedValue === null) {
              return false;
            }
            nestedValue = nestedValue[part];
          }
          return nestedValue === value;
        }
        
        // Handle array contains
        if (Array.isArray(item[key]) && !Array.isArray(value)) {
          return item[key].includes(value);
        }
        
        // Handle exact match
        return item[key] === value;
      });
    });
    
    // Apply pagination
    const paginatedData = filteredData.slice(offset, offset + limit);
    
    return {
      collection,
      total: filteredData.length,
      offset,
      limit,
      data: paginatedData
    };
  },
};

/**
 * Data fetching tool for retrieving specific records
 */
export const fetchDataTool: McpTool = {
  name: 'fetch_data',
  description: 'Fetch specific records by ID from the database',
  parameters: {
    collection: {
      type: 'string',
      description: 'The collection to fetch from (users, products, orders)',
      required: true,
    },
    id: {
      type: 'number',
      description: 'The ID of the record to fetch',
      required: true,
    },
    include_related: {
      type: 'boolean',
      description: 'Whether to include related records',
      required: false,
      default: false,
    }
  },
  handler: async (params: Record<string, any>) => {
    const { collection, id, include_related = false } = params;
    
    if (!collection) {
      throw new Error('Collection parameter is required');
    }
    
    if (id === undefined) {
      throw new Error('ID parameter is required');
    }
    
    // Check if collection exists
    if (!mockDatabase[collection as keyof typeof mockDatabase]) {
      throw new Error(`Collection not found: ${collection}`);
    }
    
    // Get data from the mock database
    const data = mockDatabase[collection as keyof typeof mockDatabase];
    
    // Find the record by ID
    const record = data.find((item: Record<string, any>) => item.id === id);
    
    if (!record) {
      throw new Error(`Record not found: ${id}`);
    }
    
    // If include_related is true, include related records
    let related: Record<string, any> = {};
    
    if (include_related) {
      switch (collection) {
        case 'users':
          // Include user's orders
          related.orders = mockDatabase.orders.filter(
            (order: Record<string, any>) => order.userId === id
          );
          break;
        case 'orders':
          // Include order's user and products
          const orderRecord = record as { userId: number; products: number[] };
          related.user = mockDatabase.users.find(
            (user: Record<string, any>) => user.id === orderRecord.userId
          );
          related.products = mockDatabase.products.filter(
            (product: Record<string, any>) => orderRecord.products.includes(product.id)
          );
          break;
        case 'products':
          // Include orders containing this product
          related.orders = mockDatabase.orders.filter(
            (order: Record<string, any>) => order.products.includes(id)
          );
          break;
      }
    }
    
    return {
      collection,
      id,
      data: record,
      related: include_related ? related : undefined
    };
  },
};

/**
 * Aggregation tool for data analysis
 */
export const aggregateTool: McpTool = {
  name: 'aggregate_data',
  description: 'Perform aggregation operations on data',
  parameters: {
    collection: {
      type: 'string',
      description: 'The collection to aggregate (users, products, orders)',
      required: true,
    },
    group_by: {
      type: 'string',
      description: 'Field to group by',
      required: true,
    },
    aggregations: {
      type: 'array',
      description: 'List of aggregation operations to perform',
      required: true,
    }
  },
  handler: async (params: Record<string, any>) => {
    const { collection, group_by, aggregations } = params;
    
    if (!collection) {
      throw new Error('Collection parameter is required');
    }
    
    if (!group_by) {
      throw new Error('Group by parameter is required');
    }
    
    if (!aggregations || !Array.isArray(aggregations) || aggregations.length === 0) {
      throw new Error('Aggregations parameter is required and must be a non-empty array');
    }
    
    // Check if collection exists
    if (!mockDatabase[collection as keyof typeof mockDatabase]) {
      throw new Error(`Collection not found: ${collection}`);
    }
    
    // Get data from the mock database
    const data = mockDatabase[collection as keyof typeof mockDatabase];
    
    // Group data by the specified field
    const groups: Record<string, any[]> = {};
    
    data.forEach((item: Record<string, any>) => {
      const groupValue = item[group_by];
      if (groupValue === undefined) {
        return; // Skip items without the group_by field
      }
      
      const key = String(groupValue);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    });
    
    // Perform aggregations
    const result: Record<string, Record<string, any>> = {};
    
    Object.entries(groups).forEach(([key, items]) => {
      result[key] = {
        count: items.length
      };
      
      aggregations.forEach((agg: Record<string, string>) => {
        const { operation, field, alias } = agg;
        const outputName = alias || `${operation}_${field}`;
        
        switch (operation) {
          case 'sum':
            result[key][outputName] = items.reduce(
              (sum, item) => sum + (Number(item[field]) || 0), 
              0
            );
            break;
          case 'avg':
            result[key][outputName] = items.reduce(
              (sum, item) => sum + (Number(item[field]) || 0), 
              0
            ) / items.length;
            break;
          case 'min':
            result[key][outputName] = Math.min(
              ...items.map(item => Number(item[field]) || 0)
            );
            break;
          case 'max':
            result[key][outputName] = Math.max(
              ...items.map(item => Number(item[field]) || 0)
            );
            break;
          case 'count_distinct':
            const distinctValues = new Set(items.map(item => item[field]));
            result[key][outputName] = distinctValues.size;
            break;
          default:
            result[key][outputName] = null;
        }
      });
    });
    
    return {
      collection,
      group_by,
      aggregations,
      result
    };
  },
};