/**
 * OpenTelemetry Integration
 *
 * Production-grade observability with:
 * - Distributed tracing with cost tags
 * - Metrics with proof artifact IDs
 * - Structured logging with context
 * - Custom spans for router, policies, proofs
 *
 * Exports to OTLP-compatible backends (Datadog, New Relic, Grafana, etc.)
 */

import { connectAgentDB } from '../db/agentdb.js';

/**
 * Simplified OpenTelemetry implementation
 * In production, use @opentelemetry/sdk-node
 */
export class TelemetryCollector {
  constructor(config = {}) {
    this.db = connectAgentDB();
    this.config = {
      serviceName: config.serviceName || 'vibecast-agentic-platform',
      environment: config.environment || process.env.NODE_ENV || 'development',
      ...config
    };

    this.traces = [];
    this.metrics = [];
  }

  /**
   * Start a trace span
   */
  startSpan(name, attributes = {}) {
    const span = {
      id: this._generateId(),
      traceId: attributes.traceId || this._generateId(),
      name,
      startTime: Date.now(),
      attributes: {
        'service.name': this.config.serviceName,
        'service.environment': this.config.environment,
        ...attributes
      },
      events: [],
      status: 'started'
    };

    return span;
  }

  /**
   * End a trace span
   */
  endSpan(span, status = 'ok', error = null) {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;

    if (error) {
      span.attributes['error'] = true;
      span.attributes['error.message'] = error.message;
      span.attributes['error.stack'] = error.stack;
    }

    this.traces.push(span);

    // Store in database for querying
    this._storeTrace(span);

    return span;
  }

  /**
   * Add event to span
   */
  addSpanEvent(span, name, attributes = {}) {
    span.events.push({
      name,
      timestamp: Date.now(),
      attributes
    });
  }

  /**
   * Record metric
   */
  recordMetric(name, value, unit, attributes = {}) {
    const metric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      attributes: {
        'service.name': this.config.serviceName,
        'service.environment': this.config.environment,
        ...attributes
      }
    };

    this.metrics.push(metric);

    // Store in database
    this._storeMetric(metric);

    return metric;
  }

  /**
   * Trace router decision
   */
  async traceRouterDecision(routerFn, context) {
    const span = this.startSpan('router.route', {
      'router.has_pii': context.hasPII,
      'router.task_type': context.taskType,
      'router.complexity': context.complexity
    });

    try {
      const decision = await routerFn(context);

      // Add decision attributes
      span.attributes['router.lane'] = decision.lane;
      span.attributes['router.cost'] = decision.costPerRequest;
      span.attributes['router.quality_score'] = decision.qualityScore;
      span.attributes['router.privacy_score'] = decision.privacyScore;

      // Record cost metric
      this.recordMetric('router.cost', decision.costPerRequest, 'USD', {
        'router.lane': decision.lane,
        'router.task_type': context.taskType
      });

      this.endSpan(span, 'ok');

      return decision;
    } catch (error) {
      this.endSpan(span, 'error', error);
      throw error;
    }
  }

  /**
   * Trace policy evaluation
   */
  async tracePolicyEvaluation(policyFn, policyType, context) {
    const span = this.startSpan('policy.evaluate', {
      'policy.type': policyType,
      'policy.has_pii': context.hasPII
    });

    try {
      const decision = await policyFn(context);

      span.attributes['policy.allowed'] = decision.allowed;
      span.attributes['policy.denied_by'] = decision.deniedBy || 'none';

      if (!decision.allowed) {
        // Record policy violation metric
        this.recordMetric('policy.violations', 1, 'count', {
          'policy.type': policyType,
          'policy.denied_by': decision.deniedBy
        });
      }

      this.endSpan(span, 'ok');

      return decision;
    } catch (error) {
      this.endSpan(span, 'error', error);
      throw error;
    }
  }

  /**
   * Trace proof generation
   */
  async traceProofGeneration(proofFn, entryId) {
    const span = this.startSpan('audit.generate_proof', {
      'audit.entry_id': entryId
    });

    try {
      const proof = await proofFn(entryId);

      span.attributes['audit.proof_hash'] = proof.hash;
      span.attributes['audit.proof_verified'] = proof.verified;
      span.attributes['audit.tree_sequence'] = proof.treeSequence;

      // Record proof generation metric
      this.recordMetric('audit.proofs_generated', 1, 'count', {
        'audit.verified': proof.verified
      });

      this.endSpan(span, 'ok');

      return proof;
    } catch (error) {
      this.endSpan(span, 'error', error);
      throw error;
    }
  }

  /**
   * Trace exception handling
   */
  async traceException(exceptionFn, recordId) {
    const span = this.startSpan('exception.handle', {
      'exception.record_id': recordId
    });

    try {
      const result = await exceptionFn(recordId);

      span.attributes['exception.created'] = result.created;
      span.attributes['exception.type'] = result.type;
      span.attributes['exception.severity'] = result.severity;

      // Record exception metric
      this.recordMetric('exceptions.created', 1, 'count', {
        'exception.type': result.type,
        'exception.severity': result.severity
      });

      this.endSpan(span, 'ok');

      return result;
    } catch (error) {
      this.endSpan(span, 'error', error);
      throw error;
    }
  }

  /**
   * Generate cost heatmap data
   */
  async getCostHeatmap(hours = 24) {
    const startTime = Date.now() - (hours * 60 * 60 * 1000);

    const metrics = await this.db.query('telemetry_metrics', {
      where: {
        name: 'router.cost',
        timestamp: { operator: 'gte', value: startTime }
      },
      orderBy: { column: 'timestamp', ascending: true }
    });

    // Group by hour and lane
    const heatmap = {};

    for (const metric of metrics) {
      const hour = Math.floor(metric.timestamp / (60 * 60 * 1000));
      const lane = metric.attributes['router.lane'];

      if (!heatmap[hour]) heatmap[hour] = {};
      if (!heatmap[hour][lane]) heatmap[hour][lane] = { cost: 0, count: 0 };

      heatmap[hour][lane].cost += metric.value;
      heatmap[hour][lane].count++;
    }

    return heatmap;
  }

  /**
   * Generate exception waterfall data
   */
  async getExceptionWaterfall(days = 7) {
    const startTime = Date.now() - (days * 24 * 60 * 60 * 1000);

    const metrics = await this.db.query('telemetry_metrics', {
      where: {
        name: 'exceptions.created',
        timestamp: { operator: 'gte', value: startTime }
      },
      orderBy: { column: 'timestamp', ascending: true }
    });

    // Group by day and type
    const waterfall = {};

    for (const metric of metrics) {
      const day = Math.floor(metric.timestamp / (24 * 60 * 60 * 1000));
      const type = metric.attributes['exception.type'];

      if (!waterfall[day]) waterfall[day] = {};
      if (!waterfall[day][type]) waterfall[day][type] = 0;

      waterfall[day][type]++;
    }

    return waterfall;
  }

  /**
   * Get proof verification failures
   */
  async getProofFailures(days = 7) {
    const startTime = Date.now() - (days * 24 * 60 * 60 * 1000);

    const metrics = await this.db.query('telemetry_metrics', {
      where: {
        name: 'audit.proofs_generated',
        timestamp: { operator: 'gte', value: startTime }
      }
    });

    const failures = metrics.filter(m => m.attributes['audit.verified'] === false);

    return {
      total: metrics.length,
      failures: failures.length,
      failureRate: metrics.length > 0 ? (failures.length / metrics.length) * 100 : 0
    };
  }

  /**
   * Store trace in database
   */
  async _storeTrace(span) {
    await this.db.insert('telemetry_traces', {
      span_id: span.id,
      trace_id: span.traceId,
      name: span.name,
      start_time: span.startTime,
      end_time: span.endTime,
      duration: span.duration,
      status: span.status,
      attributes: span.attributes,
      events: span.events
    });
  }

  /**
   * Store metric in database
   */
  async _storeMetric(metric) {
    await this.db.insert('telemetry_metrics', {
      name: metric.name,
      value: metric.value,
      unit: metric.unit,
      timestamp: metric.timestamp,
      attributes: metric.attributes
    });
  }

  /**
   * Generate unique ID
   */
  _generateId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}

export default TelemetryCollector;
