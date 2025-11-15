/**
 * Basic Franchise Setup Example
 * 
 * This example demonstrates:
 * - Initializing FranchiseManager
 * - Adding locations
 * - Adding financial and operational metrics
 * - Retrieving location data
 */

const { FranchiseManager } = require('../dist/index');

async function main() {
  console.log('=== Basic Franchise Setup Example ===\n');

  // Initialize the franchise manager
  const manager = new FranchiseManager({
    name: 'Coffee Haven',
    industry: 'Food & Beverage',
    databasePath: './examples/coffee-franchise.db',
    logLevel: 'info'
  });

  console.log('Franchise manager initialized!\n');

  // Add first location
  const location1 = await manager.addLocation({
    name: 'Coffee Haven Downtown',
    address: '123 Main Street',
    city: 'San Francisco',
    state: 'CA',
    zipCode: '94102',
    country: 'USA',
    opened: new Date('2022-01-15'),
    status: 'active'
  });

  console.log('Added location:', location1.name);
  console.log('Location ID:', location1.id, '\n');

  // Add second location
  const location2 = await manager.addLocation({
    name: 'Coffee Haven Marina',
    address: '456 Bay Street',
    city: 'San Francisco',
    state: 'CA',
    zipCode: '94123',
    country: 'USA',
    opened: new Date('2023-03-20'),
    status: 'active'
  });

  console.log('Added location:', location2.name);
  console.log('Location ID:', location2.id, '\n');

  // Add financial metrics for location 1
  await manager.addFinancialMetrics(location1.id, {
    revenue: 125000,
    expenses: 85000,
    profit: 40000,
    profitMargin: 32,
    period: '2024-Q1'
  });

  console.log('Added financial metrics for', location1.name, '\n');

  // Add operational metrics for location 1
  await manager.addOperationalMetrics(location1.id, {
    employeeCount: 12,
    customerCount: 3500,
    averageTransactionValue: 8.50,
    customerSatisfactionScore: 4.5,
    operationalEfficiency: 87
  });

  console.log('Added operational metrics for', location1.name, '\n');

  // Retrieve all locations
  const allLocations = await manager.getAllLocations();
  console.log('Total locations:', allLocations.length);
  allLocations.forEach(loc => {
    console.log('  -', loc.name, '(' + loc.status + ')');
  });

  console.log('\nExample completed successfully!');

  await manager.close();
}

main().catch(console.error);
