/**
 * Growth Planning Scenario Example
 * 
 * This example demonstrates:
 * - Identifying growth opportunities
 * - Analyzing ROI and investment requirements
 * - Generating comprehensive reports
 * - Strategic planning with agent insights
 */

const { FranchiseManager } = require('../dist/index');

async function main() {
  console.log('=== Growth Planning Scenario ===\n');

  const manager = new FranchiseManager({
    name: 'FitLife Gym',
    industry: 'Fitness & Wellness',
    databasePath: './examples/gym-franchise.db',
    logLevel: 'info'
  });

  // Add existing locations
  console.log('Setting up franchise locations...\n');

  const locations = [
    {
      name: 'FitLife Gym Downtown',
      address: '100 First Street',
      city: 'Seattle',
      state: 'WA',
      zipCode: '98101',
      country: 'USA',
      opened: new Date('2020-01-10'),
      status: 'active'
    },
    {
      name: 'FitLife Gym Suburbs',
      address: '200 Green Lane',
      city: 'Bellevue',
      state: 'WA',
      zipCode: '98004',
      country: 'USA',
      opened: new Date('2021-05-15'),
      status: 'active'
    },
    {
      name: 'FitLife Gym University',
      address: '300 Campus Drive',
      city: 'Seattle',
      state: 'WA',
      zipCode: '98195',
      country: 'USA',
      opened: new Date('2022-09-01'),
      status: 'active'
    }
  ];

  for (const loc of locations) {
    await manager.addLocation(loc);
  }

  console.log('Added', locations.length, 'locations\n');

  // Add financial performance data
  console.log('Adding financial data...\n');
  
  const allLocations = await manager.getAllLocations();
  
  for (const location of allLocations) {
    await manager.addFinancialMetrics(location.id, {
      revenue: 200000 + Math.random() * 100000,
      expenses: 120000 + Math.random() * 50000,
      profit: 80000 + Math.random() * 50000,
      profitMargin: 30 + Math.random() * 10,
      period: '2024-Q1'
    });

    await manager.addOperationalMetrics(location.id, {
      employeeCount: 15 + Math.floor(Math.random() * 10),
      customerCount: 800 + Math.floor(Math.random() * 400),
      averageTransactionValue: 45 + Math.random() * 20,
      customerSatisfactionScore: 4.0 + Math.random() * 1,
      operationalEfficiency: 75 + Math.random() * 20
    });
  }

  // Run growth strategy analysis
  console.log('Running growth strategy analysis...\n');
  
  const growthAnalysis = await manager.runAnalysis({
    type: 'growth'
  });

  console.log('=== Growth Opportunities Identified ===\n');
  
  const opportunities = growthAnalysis.data?.opportunities || [];
  
  // Sort by ROI
  opportunities.sort((a, b) => b.roi - a.roi);

  opportunities.forEach((opp, idx) => {
    console.log((idx + 1) + '. ' + opp.description);
    console.log('   Type:', opp.type);
    console.log('   Potential Revenue: $' + opp.potentialRevenue.toLocaleString());
    console.log('   Investment Required: $' + opp.investmentRequired.toLocaleString());
    console.log('   ROI:', opp.roi + '%');
    console.log('   Timeframe:', opp.timeframe);
    console.log('   Priority:', opp.priority.toUpperCase());
    console.log('');
  });

  // Calculate total potential
  const totalPotentialRevenue = opportunities.reduce((sum, opp) => sum + opp.potentialRevenue, 0);
  const totalInvestment = opportunities.reduce((sum, opp) => sum + opp.investmentRequired, 0);
  const averageROI = opportunities.reduce((sum, opp) => sum + opp.roi, 0) / opportunities.length;

  console.log('=== Growth Planning Summary ===\n');
  console.log('Total Potential Revenue:', '$' + totalPotentialRevenue.toLocaleString());
  console.log('Total Investment Required:', '$' + totalInvestment.toLocaleString());
  console.log('Average ROI:', averageROI.toFixed(1) + '%');
  console.log('Number of Opportunities:', opportunities.length);

  // Generate comprehensive report
  console.log('\n--- Generating Comprehensive Report ---\n');
  
  const report = await manager.getComprehensiveReport();

  console.log('Report Title:', report.title);
  console.log('Generated:', report.generatedAt.toLocaleString());
  console.log('Locations Analyzed:', report.locations.length);

  console.log('\nStrategic Recommendations:');
  report.recommendations.slice(0, 8).forEach((rec, idx) => {
    console.log('  ' + (idx + 1) + '.', rec);
  });

  // Add top opportunities to database
  console.log('\n--- Saving Top Opportunities ---\n');
  
  for (const opp of opportunities.slice(0, 3)) {
    await manager.addGrowthOpportunity(opp);
    console.log('Saved opportunity:', opp.description);
  }

  // Retrieve saved opportunities
  const savedOpportunities = await manager.getGrowthOpportunities(5);
  console.log('\nSaved opportunities in database:', savedOpportunities.length);

  console.log('\nGrowth planning scenario completed!');
  console.log('\nNext Steps:');
  console.log('1. Review high-priority opportunities with stakeholders');
  console.log('2. Conduct detailed feasibility studies for top 2-3 opportunities');
  console.log('3. Develop implementation timeline and resource allocation plan');
  console.log('4. Set up monitoring and tracking for growth initiatives');

  await manager.close();
}

main().catch(console.error);
