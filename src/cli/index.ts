#!/usr/bin/env node

import { Command } from 'commander';
import { FranchiseManager } from '../core/FranchiseManager';
import * as path from 'path';

const program = new Command();

program
  .name('franchise')
  .description('CLI tool for franchise management')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize a new franchise management project')
  .option('-n, --name <name>', 'Franchise name')
  .option('-i, --industry <industry>', 'Industry type')
  .option('-d, --database <path>', 'Database path', './franchise.db')
  .action(async (options) => {
    console.log('Initializing franchise management project...');
    console.log('Name:', options.name);
    console.log('Industry:', options.industry);
    console.log('Database:', options.database);
    
    const manager = new FranchiseManager({
      name: options.name,
      industry: options.industry,
      databasePath: options.database
    });

    console.log('Franchise management project initialized successfully!');
    await manager.close();
  });

program
  .command('add-location')
  .description('Add a new franchise location')
  .requiredOption('-n, --name <name>', 'Location name')
  .requiredOption('-a, --address <address>', 'Street address')
  .requiredOption('-c, --city <city>', 'City')
  .requiredOption('-s, --state <state>', 'State')
  .requiredOption('-z, --zip <zip>', 'Zip code')
  .option('--country <country>', 'Country', 'USA')
  .option('-d, --database <path>', 'Database path', './franchise.db')
  .action(async (options) => {
    const manager = new FranchiseManager({
      name: 'Franchise',
      industry: 'General',
      databasePath: options.database
    });

    const location = await manager.addLocation({
      name: options.name,
      address: options.address,
      city: options.city,
      state: options.state,
      zipCode: options.zip,
      country: options.country,
      opened: new Date(),
      status: 'active'
    });

    console.log('Location added successfully!');
    console.log('ID:', location.id);
    console.log('Name:', location.name);
    
    await manager.close();
  });

program
  .command('list-locations')
  .description('List all franchise locations')
  .option('-d, --database <path>', 'Database path', './franchise.db')
  .action(async (options) => {
    const manager = new FranchiseManager({
      name: 'Franchise',
      industry: 'General',
      databasePath: options.database
    });

    const locations = await manager.getAllLocations();
    
    console.log('Franchise Locations (' + locations.length + '):');
    console.log('');
    
    locations.forEach(loc => {
      console.log('ID:', loc.id);
      console.log('Name:', loc.name);
      console.log('Address:', loc.address + ', ' + loc.city + ', ' + loc.state);
      console.log('Status:', loc.status);
      console.log('---');
    });
    
    await manager.close();
  });

program
  .command('analyze')
  .description('Run franchise analysis')
  .option('-t, --type <type>', 'Analysis type (financial, market, growth, comprehensive)', 'comprehensive')
  .option('-d, --database <path>', 'Database path', './franchise.db')
  .action(async (options) => {
    const manager = new FranchiseManager({
      name: 'Franchise',
      industry: 'General',
      databasePath: options.database
    });

    console.log('Running ' + options.type + ' analysis...');
    console.log('');

    const result = await manager.runAnalysis({
      type: options.type
    });

    if (result.success !== false) {
      console.log('Analysis completed successfully!');
      console.log('');
      
      if (result.insights) {
        console.log('Insights:');
        result.insights.forEach((insight: string) => console.log('- ' + insight));
        console.log('');
      }
      
      if (result.recommendations) {
        console.log('Recommendations:');
        result.recommendations.forEach((rec: string) => console.log('- ' + rec));
      }
    } else {
      console.error('Analysis failed:', result.error);
    }
    
    await manager.close();
  });

program
  .command('report')
  .description('Generate comprehensive franchise report')
  .option('-d, --database <path>', 'Database path', './franchise.db')
  .action(async (options) => {
    const manager = new FranchiseManager({
      name: 'Franchise',
      industry: 'General',
      databasePath: options.database
    });

    console.log('Generating comprehensive report...');
    console.log('');

    const report = await manager.getComprehensiveReport();

    console.log('=== ' + report.title + ' ===');
    console.log('Generated:', report.generatedAt.toLocaleString());
    console.log('');
    console.log('Locations:', report.locations.length);
    console.log('');
    
    console.log('Recommendations:');
    report.recommendations.forEach((rec: string) => console.log('- ' + rec));
    
    await manager.close();
  });

program
  .command('opportunities')
  .description('List growth opportunities')
  .option('-d, --database <path>', 'Database path', './franchise.db')
  .option('-l, --limit <limit>', 'Limit results', '10')
  .action(async (options) => {
    const manager = new FranchiseManager({
      name: 'Franchise',
      industry: 'General',
      databasePath: options.database
    });

    const opportunities = await manager.getGrowthOpportunities(parseInt(options.limit));

    console.log('Growth Opportunities (' + opportunities.length + '):');
    console.log('');
    
    opportunities.forEach((opp: any) => {
      console.log('Type:', opp.type);
      console.log('Description:', opp.description);
      console.log('Potential Revenue: $' + opp.potential_revenue?.toLocaleString());
      console.log('Investment: $' + opp.investment_required?.toLocaleString());
      console.log('ROI:', opp.roi + '%');
      console.log('Priority:', opp.priority);
      console.log('---');
    });
    
    await manager.close();
  });

program.parse();
