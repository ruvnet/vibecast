/**
 * Metrics and ROI Tracking
 * Provides analytics and reporting for the data entry system
 */

import { connectAgentDB } from './db/agentdb.js';
import dotenv from 'dotenv';

dotenv.config();

const db = connectAgentDB();

/**
 * Calculate exception rate over a time period
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<object>}
 */
async function calculateExceptionRate(startDate = null, endDate = null) {
  const start = startDate || new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
  const end = endDate || new Date();

  // Get total records in period
  const records = await db.query('records', {
    where: {
      created_at: { operator: 'gte', value: start.toISOString() }
    }
  });

  const totalRecords = records.length;

  // Get exceptions in period
  const exceptions = await db.query('exceptions', {
    where: {
      created_at: { operator: 'gte', value: start.toISOString() }
    }
  });

  const totalExceptions = exceptions.length;
  const reviewedExceptions = exceptions.filter(e => e.reviewed).length;

  const exceptionRate = totalRecords > 0 ? (totalExceptions / totalRecords) * 100 : 0;
  const reviewRate = totalExceptions > 0 ? (reviewedExceptions / totalExceptions) * 100 : 0;

  return {
    period: {
      start: start.toISOString(),
      end: end.toISOString()
    },
    totalRecords,
    totalExceptions,
    reviewedExceptions,
    exceptionRate: parseFloat(exceptionRate.toFixed(2)),
    reviewRate: parseFloat(reviewRate.toFixed(2)),
    automationRate: parseFloat((100 - exceptionRate).toFixed(2))
  };
}

/**
 * Calculate processing metrics
 * @returns {Promise<object>}
 */
async function calculateProcessingMetrics() {
  const summary = await db.getMetricsSummary();

  const validRecords = summary.valid_records || 0;
  const invalidRecords = summary.invalid_records || 0;
  const totalRecords = summary.total_records || 0;

  return {
    totalRecords,
    validRecords,
    invalidRecords,
    validationRate: totalRecords > 0 ? parseFloat(((validRecords / totalRecords) * 100).toFixed(2)) : 0,
    averageLatencyMs: parseFloat((summary.avg_latency_ms || 0).toFixed(2)),
    minLatencyMs: summary.min_latency_ms || 0,
    maxLatencyMs: summary.max_latency_ms || 0,
    daysActive: summary.days_active || 0
  };
}

/**
 * Calculate ROI metrics
 * @param {object} assumptions - Cost assumptions
 * @returns {Promise<object>}
 */
async function calculateROI(assumptions = {}) {
  const {
    manualProcessingTimeMinutes = 5,  // Average time to manually process one record
    hourlyWage = 25,                   // Operator hourly wage
    apiCostPerRequest = 0.01           // Average API cost per record
  } = assumptions;

  const metrics = await calculateProcessingMetrics();
  const exceptionMetrics = await calculateExceptionRate();

  // Calculate costs
  const totalRecords = metrics.totalRecords;
  const automatedRecords = totalRecords - exceptionMetrics.totalExceptions;
  const manualRecords = exceptionMetrics.totalExceptions;

  // Time saved
  const automatedTimeMinutes = automatedRecords * manualProcessingTimeMinutes;
  const automatedTimeHours = automatedTimeMinutes / 60;

  // Cost saved
  const laborCostSaved = automatedTimeHours * hourlyWage;

  // API costs
  const apiCosts = totalRecords * apiCostPerRequest;

  // Net savings
  const netSavings = laborCostSaved - apiCosts;

  // ROI
  const roi = apiCosts > 0 ? ((netSavings / apiCosts) * 100) : 0;

  return {
    totalRecords,
    automatedRecords,
    manualRecords,
    automationRate: exceptionMetrics.automationRate,
    timeSaved: {
      minutes: parseFloat(automatedTimeMinutes.toFixed(2)),
      hours: parseFloat(automatedTimeHours.toFixed(2))
    },
    costs: {
      apiCosts: parseFloat(apiCosts.toFixed(2)),
      laborCostSaved: parseFloat(laborCostSaved.toFixed(2)),
      netSavings: parseFloat(netSavings.toFixed(2))
    },
    roi: parseFloat(roi.toFixed(2)),
    assumptions
  };
}

/**
 * Get exception breakdown by type
 * @returns {Promise<Array>}
 */
async function getExceptionBreakdown() {
  return await db.getExceptionRates();
}

/**
 * Get agent performance metrics
 * @returns {Promise<object>}
 */
async function getAgentPerformance() {
  // Get tool execution metrics
  const toolMetrics = await db.query('processing_metrics', {
    where: { metric_type: 'tool_execution_time' },
    orderBy: { column: 'timestamp', ascending: false },
    limit: 1000
  });

  // Aggregate by tool
  const toolStats = {};

  toolMetrics.forEach(metric => {
    const tool = metric.dimension?.tool || 'unknown';

    if (!toolStats[tool]) {
      toolStats[tool] = {
        tool,
        count: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0
      };
    }

    toolStats[tool].count++;
    toolStats[tool].totalTime += metric.metric_value;
    toolStats[tool].minTime = Math.min(toolStats[tool].minTime, metric.metric_value);
    toolStats[tool].maxTime = Math.max(toolStats[tool].maxTime, metric.metric_value);
  });

  // Calculate averages
  const performance = Object.values(toolStats).map(stat => ({
    tool: stat.tool,
    invocations: stat.count,
    averageTimeMs: parseFloat((stat.totalTime / stat.count).toFixed(2)),
    minTimeMs: stat.minTime,
    maxTimeMs: stat.maxTime
  }));

  return {
    tools: performance,
    totalInvocations: toolMetrics.length
  };
}

/**
 * Generate comprehensive dashboard
 * @returns {Promise<object>}
 */
async function generateDashboard() {
  console.log('\n📊 Generating metrics dashboard...\n');

  const [
    processingMetrics,
    exceptionRate,
    roi,
    exceptionBreakdown,
    agentPerformance
  ] = await Promise.all([
    calculateProcessingMetrics(),
    calculateExceptionRate(),
    calculateROI(),
    getExceptionBreakdown(),
    getAgentPerformance()
  ]);

  const dashboard = {
    timestamp: new Date().toISOString(),
    processing: processingMetrics,
    exceptions: {
      rate: exceptionRate,
      breakdown: exceptionBreakdown
    },
    roi,
    agent: agentPerformance
  };

  return dashboard;
}

/**
 * Display dashboard in console
 */
async function displayDashboard() {
  const dashboard = await generateDashboard();

  console.log('='.repeat(80));
  console.log('  AGENTIC DATA ENTRY SYSTEM - METRICS DASHBOARD');
  console.log('='.repeat(80));

  // Processing metrics
  console.log('\n📈 Processing Metrics:');
  console.log(`  Total Records: ${dashboard.processing.totalRecords}`);
  console.log(`  Valid: ${dashboard.processing.validRecords} (${dashboard.processing.validationRate}%)`);
  console.log(`  Invalid: ${dashboard.processing.invalidRecords}`);
  console.log(`  Avg Latency: ${dashboard.processing.averageLatencyMs}ms`);
  console.log(`  Days Active: ${dashboard.processing.daysActive}`);

  // Exception metrics
  console.log('\n⚠️  Exception Metrics:');
  console.log(`  Exception Rate: ${dashboard.exceptions.rate.exceptionRate}%`);
  console.log(`  Automation Rate: ${dashboard.exceptions.rate.automationRate}%`);
  console.log(`  Review Rate: ${dashboard.exceptions.rate.reviewRate}%`);
  console.log(`  Pending: ${dashboard.exceptions.rate.totalExceptions - dashboard.exceptions.rate.reviewedExceptions}`);

  // Exception breakdown
  if (dashboard.exceptions.breakdown.length > 0) {
    console.log('\n📋 Exception Breakdown:');
    dashboard.exceptions.breakdown.forEach(item => {
      console.log(`  ${item.exception_type}: ${item.count} (${parseFloat(item.percentage_of_total).toFixed(1)}%)`);
    });
  }

  // ROI metrics
  console.log('\n💰 ROI Metrics:');
  console.log(`  Automation Rate: ${dashboard.roi.automationRate}%`);
  console.log(`  Time Saved: ${dashboard.roi.timeSaved.hours} hours`);
  console.log(`  Labor Cost Saved: $${dashboard.roi.costs.laborCostSaved}`);
  console.log(`  API Costs: $${dashboard.roi.costs.apiCosts}`);
  console.log(`  Net Savings: $${dashboard.roi.costs.netSavings}`);
  console.log(`  ROI: ${dashboard.roi.roi}%`);

  // Agent performance
  console.log('\n🤖 Agent Performance:');
  console.log(`  Total Tool Invocations: ${dashboard.agent.totalInvocations}`);
  if (dashboard.agent.tools.length > 0) {
    dashboard.agent.tools.forEach(tool => {
      console.log(`  ${tool.tool}: ${tool.invocations} calls, avg ${tool.averageTimeMs}ms`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log(`  Generated: ${dashboard.timestamp}`);
  console.log('='.repeat(80) + '\n');

  return dashboard;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  displayDashboard().catch(console.error);
}

export {
  calculateExceptionRate,
  calculateProcessingMetrics,
  calculateROI,
  getExceptionBreakdown,
  getAgentPerformance,
  generateDashboard,
  displayDashboard
};

export default displayDashboard;
