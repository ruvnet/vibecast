/**
 * AgentDB Connection Layer
 * Provides database connectivity and query methods for the agentic system
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

class AgentDB {
  constructor(url, key, options = {}) {
    this.mockMode = options.mockMode || false;

    if (!url || !key) {
      if (process.env.USE_MOCK_MODE === 'true') {
        console.warn('⚠️  AgentDB: Missing credentials, using mock mode for testing');
        this.mockMode = true;
        this.mockData = {
          rules: [],
          pending_exceptions: [],
          audit_trail: [],
          agent_memory: [],
          processing_metrics: []
        };
        return;
      }
      throw new Error('AgentDB requires AGENTDB_URL and AGENTDB_KEY environment variables');
    }

    this.client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      db: {
        schema: 'public'
      }
    });
  }

  /**
   * Query data from a table
   * @param {string} table - Table name
   * @param {object} options - Query options (where, select, orderBy, limit)
   * @returns {Promise<Array>}
   */
  async query(table, options = {}) {
    if (this.mockMode) {
      let data = this.mockData[table] || [];

      // Apply where filter
      if (options.where) {
        data = data.filter(row => {
          return Object.entries(options.where).every(([column, value]) => {
            if (typeof value === 'object' && value.operator) {
              const rowValue = row[column];
              switch (value.operator) {
                case 'gt': return rowValue > value.value;
                case 'lt': return rowValue < value.value;
                case 'gte': return rowValue >= value.value;
                case 'lte': return rowValue <= value.value;
                default: return rowValue === value.value;
              }
            }
            return row[column] === value;
          });
        });
      }

      // Apply limit
      if (options.limit) {
        data = data.slice(0, options.limit);
      }

      return data;
    }

    try {
      let query = this.client.from(table).select(options.select || '*');

      if (options.where) {
        Object.entries(options.where).forEach(([column, value]) => {
          if (typeof value === 'object' && value.operator) {
            // Support advanced operators: {operator: 'gt', value: 10}
            query = query[value.operator](column, value.value);
          } else {
            query = query.eq(column, value);
          }
        });
      }

      if (options.orderBy) {
        const { column, ascending = true } = options.orderBy;
        query = query.order(column, { ascending });
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Query error: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('AgentDB query error:', error);
      throw error;
    }
  }

  /**
   * Insert data into a table
   * @param {string} table - Table name
   * @param {object|Array} data - Data to insert
   * @returns {Promise<object>}
   */
  async insert(table, data) {
    if (this.mockMode) {
      if (!this.mockData[table]) {
        this.mockData[table] = [];
      }
      const items = Array.isArray(data) ? data : [data];
      const inserted = items.map(item => ({
        id: Math.random().toString(36).substr(2, 9),
        created_at: new Date().toISOString(),
        ...item
      }));
      this.mockData[table].push(...inserted);
      return Array.isArray(data) ? inserted : inserted[0];
    }

    try {
      const { data: result, error } = await this.client
        .from(table)
        .insert(data)
        .select();

      if (error) {
        throw new Error(`Insert error: ${error.message}`);
      }

      return Array.isArray(data) ? result : result[0];
    } catch (error) {
      console.error('AgentDB insert error:', error);
      throw error;
    }
  }

  /**
   * Update data in a table
   * @param {string} table - Table name
   * @param {object} where - Where conditions
   * @param {object} data - Data to update
   * @returns {Promise<object>}
   */
  async update(table, where, data) {
    if (this.mockMode) {
      const items = this.mockData[table] || [];
      const updated = [];
      for (const item of items) {
        const matches = Object.entries(where).every(([col, val]) => item[col] === val);
        if (matches) {
          Object.assign(item, data);
          updated.push(item);
        }
      }
      return updated;
    }

    try {
      let query = this.client.from(table).update(data);

      Object.entries(where).forEach(([column, value]) => {
        query = query.eq(column, value);
      });

      const { data: result, error } = await query.select();

      if (error) {
        throw new Error(`Update error: ${error.message}`);
      }

      return result;
    } catch (error) {
      console.error('AgentDB update error:', error);
      throw error;
    }
  }

  /**
   * Delete data from a table
   * @param {string} table - Table name
   * @param {object} where - Where conditions
   * @returns {Promise<object>}
   */
  async delete(table, where) {
    if (this.mockMode) {
      const items = this.mockData[table] || [];
      const deleted = [];
      this.mockData[table] = items.filter(item => {
        const matches = Object.entries(where).every(([col, val]) => item[col] === val);
        if (matches) {
          deleted.push(item);
          return false;
        }
        return true;
      });
      return deleted;
    }

    try {
      let query = this.client.from(table).delete();

      Object.entries(where).forEach(([column, value]) => {
        query = query.eq(column, value);
      });

      const { data, error } = await query;

      if (error) {
        throw new Error(`Delete error: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('AgentDB delete error:', error);
      throw error;
    }
  }

  /**
   * Execute a raw SQL query
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>}
   */
  async raw(sql, params = []) {
    if (this.mockMode) {
      console.warn('⚠️  Raw SQL queries not supported in mock mode');
      return [];
    }

    try {
      const { data, error } = await this.client.rpc('exec_sql', {
        query: sql,
        params
      });

      if (error) {
        throw new Error(`Raw query error: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('AgentDB raw query error:', error);
      throw error;
    }
  }

  /**
   * Get active rules from the database
   * @param {string} ruleType - Optional rule type filter
   * @returns {Promise<Array>}
   */
  async getActiveRules(ruleType = null) {
    const options = {
      where: { active: true },
      orderBy: { column: 'priority', ascending: false }
    };

    if (ruleType) {
      options.where.rule_type = ruleType;
    }

    return this.query('rules', options);
  }

  /**
   * Get pending exceptions for review
   * @param {number} limit - Maximum number of exceptions to retrieve
   * @returns {Promise<Array>}
   */
  async getPendingExceptions(limit = 50) {
    return this.query('pending_exceptions', { limit });
  }

  /**
   * Create audit trail entry
   * @param {object} auditData - Audit trail data
   * @returns {Promise<object>}
   */
  async createAuditTrail(auditData) {
    return this.insert('audit_trail', {
      event_type: auditData.eventType,
      entity_type: auditData.entityType,
      entity_id: auditData.entityId,
      actor: auditData.actor,
      action: auditData.action,
      before_state: auditData.beforeState,
      after_state: auditData.afterState,
      changes: auditData.changes,
      session_id: auditData.sessionId,
      metadata: auditData.metadata || {}
    });
  }

  /**
   * Store agent memory for reflexion
   * @param {object} memoryData - Memory data
   * @returns {Promise<object>}
   */
  async storeMemory(memoryData) {
    return this.insert('agent_memory', {
      agent_name: memoryData.agentName,
      memory_type: memoryData.memoryType,
      content: memoryData.content,
      context: memoryData.context || {},
      confidence_score: memoryData.confidenceScore,
      metadata: memoryData.metadata || {}
    });
  }

  /**
   * Retrieve agent memory
   * @param {string} agentName - Agent name
   * @param {string} memoryType - Optional memory type filter
   * @returns {Promise<Array>}
   */
  async getMemory(agentName, memoryType = null) {
    const options = {
      where: { agent_name: agentName },
      orderBy: { column: 'confidence_score', ascending: false },
      limit: 10
    };

    if (memoryType) {
      options.where.memory_type = memoryType;
    }

    return this.query('agent_memory', options);
  }

  /**
   * Calculate metrics summary
   * @returns {Promise<object>}
   */
  async getMetricsSummary() {
    const result = await this.query('metrics_summary', { limit: 1 });
    return result[0] || {};
  }

  /**
   * Get exception rates
   * @returns {Promise<Array>}
   */
  async getExceptionRates() {
    return this.query('exception_rates');
  }

  /**
   * Store processing metric
   * @param {object} metricData - Metric data
   * @returns {Promise<object>}
   */
  async storeMetric(metricData) {
    return this.insert('processing_metrics', {
      metric_type: metricData.metricType,
      metric_value: metricData.metricValue,
      metric_unit: metricData.metricUnit,
      dimension: metricData.dimension || {},
      aggregation_period: metricData.aggregationPeriod,
      metadata: metricData.metadata || {}
    });
  }
}

// Singleton connection
let dbInstance = null;

/**
 * Connect to AgentDB
 * @param {string} url - Database URL (optional, uses env var if not provided)
 * @param {string} key - Database key (optional, uses env var if not provided)
 * @returns {AgentDB}
 */
export function connectAgentDB(url = null, key = null) {
  if (!dbInstance) {
    const dbUrl = url || process.env.AGENTDB_URL;
    const dbKey = key || process.env.AGENTDB_KEY;
    dbInstance = new AgentDB(dbUrl, dbKey);
  }
  return dbInstance;
}

export default AgentDB;
