/**
 * Multi-Agent Analysis Example
 * 
 * This example demonstrates:
 * - Running individual agent analyses
 * - Coordinating multiple agents
 * - Processing agent insights and recommendations
 * - Listening to real-time events
 */

const { FranchiseManager, AgentType } = require('../dist/index');

async function main() {
  console.log('=== Multi-Agent Analysis Example ===\n');

  const manager = new FranchiseManager({
    name: 'Pizza Paradise',
    industry: 'Restaurant',
    databasePath: './examples/pizza-franchise.db',
    logLevel: 'info'
  });

  // Setup event listeners
  manager.events.on('agent:started', (event) => {
    console.log('[EVENT] Agent started:', event.data.agentType);
  });

  manager.events.on('agent:completed', (event) => {
    console.log('[EVENT] Agent completed:', event.data.agentType);
  });

  manager.events.on('analysis:completed', (event) => {
    console.log('[EVENT] Analysis completed at', event.timestamp.toISOString());
  });

  // Add sample locations
  const location1 = await manager.addLocation({
    name: 'Pizza Paradise North',
    address: '789 Oak Avenue',
    city: 'Austin',
    state: 'TX',
    zipCode: '78701',
    country: 'USA',
    opened: new Date('2021-06-01'),
    status: 'active'
  });

  const location2 = await manager.addLocation({
    name: 'Pizza Paradise South',
    address: '321 Pine Street',
    city: 'Austin',
    state: 'TX',
    zipCode: '78704',
    country: 'USA',
    opened: new Date('2022-08-15'),
    status: 'active'
  });

  console.log('Added 2 locations\n');

  // Add sample metrics
  await manager.addFinancialMetrics(location1.id, {
    revenue: 180000,
    expenses: 120000,
    profit: 60000,
    profitMargin: 33.3,
    period: '2024-Q1'
  });

  await manager.addFinancialMetrics(location2.id, {
    revenue: 145000,
    expenses: 100000,
    profit: 45000,
    profitMargin: 31,
    period: '2024-Q1'
  });

  console.log('Added financial metrics\n');

  // Run financial analysis
  console.log('--- Running Financial Analysis ---');
  const financialResult = await manager.runAnalysis({
    type: 'financial'
  });

  console.log('\nFinancial Insights:');
  financialResult.insights?.forEach(insight => {
    console.log('  -', insight);
  });

  console.log('\nFinancial Recommendations:');
  financialResult.recommendations?.forEach(rec => {
    console.log('  -', rec);
  });

  // Run market analysis
  console.log('\n--- Running Market Analysis ---');
  const marketResult = await manager.runAnalysis({
    type: 'market'
  });

  console.log('\nMarket Insights:');
  marketResult.insights?.forEach(insight => {
    console.log('  -', insight);
  });

  // Run growth analysis
  console.log('\n--- Running Growth Strategy Analysis ---');
  const growthResult = await manager.runAnalysis({
    type: 'growth'
  });

  console.log('\nGrowth Opportunities Found:', growthResult.data?.opportunities?.length);
  growthResult.data?.opportunities?.forEach(opp => {
    console.log('\n  Type:', opp.type);
    console.log('  Description:', opp.description);
    console.log('  ROI:', opp.roi + '%');
    console.log('  Priority:', opp.priority);
  });

  // Run comprehensive analysis (all agents coordinated)
  console.log('\n--- Running Comprehensive Analysis (All Agents) ---');
  const comprehensiveResult = await manager.runAnalysis({
    type: 'comprehensive'
  });

  console.log('\nAgents Involved:', comprehensiveResult.agents?.join(', '));
  console.log('Total Insights:', comprehensiveResult.aggregatedInsights?.length);
  console.log('Top Recommendations:', comprehensiveResult.recommendations?.length);

  console.log('\nTop 5 Recommendations:');
  comprehensiveResult.recommendations?.slice(0, 5).forEach((rec, idx) => {
    console.log('  ' + (idx + 1) + '.', rec);
  });

  console.log('\nMulti-agent analysis completed!');

  await manager.close();
}

main().catch(console.error);
