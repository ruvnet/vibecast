/**
 * Basic usage example for AgentDB
 */

import { AgentDB, AgentDBPool } from '../src/index';

async function basicExample() {
  console.log('🚀 AgentDB Basic Usage Example\n');

  // Initialize WASM module
  await AgentDB.init();

  // Create database instance
  const db = new AgentDB({
    cacheEnabled: true,
    cacheTTL: 5000,
  });

  console.log('📊 Database initialized');
  console.log('Version:', AgentDB.version());
  console.log('');

  // Create agents
  console.log('👤 Creating agents...');
  const agent1 = db.createAgent('Alice', 'manager');
  const agent2 = db.createAgent('Bob', 'worker');
  const agent3 = db.createAgent('Charlie', 'specialist');

  console.log(`Created agent: ${agent1.name} (${agent1.id})`);
  console.log(`Created agent: ${agent2.name} (${agent2.id})`);
  console.log(`Created agent: ${agent3.name} (${agent3.id})`);
  console.log('');

  // Create franchises
  console.log('🏢 Creating franchises...');
  const franchise1 = db.createFranchise('TechCorp NYC', agent1.id, 'New York');
  const franchise2 = db.createFranchise('TechCorp SF', agent1.id, 'San Francisco');

  console.log(`Created franchise: ${franchise1.name} (${franchise1.id})`);
  console.log(`Created franchise: ${franchise2.name} (${franchise2.id})`);
  console.log('');

  // Assign agents to franchises
  console.log('🔗 Assigning agents to franchises...');
  db.assignAgent(agent2.id, franchise1.id);
  db.assignAgent(agent3.id, franchise1.id);

  console.log(`Assigned ${agent2.name} to ${franchise1.name}`);
  console.log(`Assigned ${agent3.name} to ${franchise1.name}`);
  console.log('');

  // Query agents
  console.log('🔍 Querying agents...');
  const activeAgents = db.queryAgents({
    franchise_id: franchise1.id,
    limit: 10,
  });

  console.log(`Found ${activeAgents.length} agents in ${franchise1.name}:`);
  activeAgents.forEach((agent) => {
    console.log(`  - ${agent.name} (${agent.role})`);
  });
  console.log('');

  // Get statistics
  console.log('📈 Database statistics:');
  const stats = db.getStats();
  console.log(`  Total agents: ${stats.total_agents}`);
  console.log(`  Total franchises: ${stats.total_franchises}`);
  console.log(`  Total events: ${stats.total_events}`);
  console.log(`  Active agents: ${stats.active_agents}`);
  console.log(`  Memory usage: ${stats.memory_usage} bytes`);
  console.log('');

  // Get event history
  console.log('📜 Recent events:');
  const events = db.getEvents(undefined, 5);
  events.forEach((event, i) => {
    console.log(
      `  ${i + 1}. ${event.event_type} - ${event.entity_type} (${event.entity_id})`
    );
  });
  console.log('');

  // Export and import
  console.log('💾 Testing export/import...');
  const exported = db.export();
  console.log(`Exported database: ${exported.length} bytes`);

  const newDb = new AgentDB();
  newDb.import(exported);
  const newStats = newDb.getStats();
  console.log(`Imported successfully. Agents: ${newStats.total_agents}`);
  console.log('');

  console.log('✅ Example completed successfully!');
}

async function poolExample() {
  console.log('\n🌊 AgentDB Pool Example\n');

  await AgentDB.init();

  // Create a connection pool
  const pool = new AgentDBPool({
    maxInstances: 3,
    cacheEnabled: true,
  });

  console.log('Created connection pool with 3 instances');

  // Execute operations using the pool
  await pool.execute((db) => {
    db.createAgent('Pool Agent 1', 'worker');
    console.log('Created agent in pool instance');
  });

  await pool.execute((db) => {
    const agents = db.queryAgents({});
    console.log(`Found ${agents.length} agents in pool`);
  });

  console.log('✅ Pool example completed successfully!');
}

async function performanceExample() {
  console.log('\n⚡ Performance Benchmark\n');

  await AgentDB.init();

  const db = new AgentDB({ cacheEnabled: false });

  // Benchmark agent creation
  console.log('Benchmarking agent creation...');
  const startCreate = AgentDB.now();

  for (let i = 0; i < 1000; i++) {
    db.createAgent(`Agent ${i}`, 'worker');
  }

  const endCreate = AgentDB.now();
  console.log(
    `Created 1000 agents in ${(endCreate - startCreate).toFixed(2)}ms`
  );
  console.log(
    `Average: ${((endCreate - startCreate) / 1000).toFixed(4)}ms per agent`
  );

  // Benchmark queries
  console.log('\nBenchmarking queries...');
  const startQuery = AgentDB.now();

  for (let i = 0; i < 1000; i++) {
    db.queryAgents({ limit: 10 });
  }

  const endQuery = AgentDB.now();
  console.log(
    `Executed 1000 queries in ${(endQuery - startQuery).toFixed(2)}ms`
  );
  console.log(
    `Average: ${((endQuery - startQuery) / 1000).toFixed(4)}ms per query`
  );

  // Benchmark with caching
  console.log('\nBenchmarking with cache enabled...');
  db.setCacheEnabled(true);

  const startCachedQuery = AgentDB.now();

  for (let i = 0; i < 1000; i++) {
    db.queryAgents({ limit: 10 });
  }

  const endCachedQuery = AgentDB.now();
  console.log(
    `Executed 1000 cached queries in ${(endCachedQuery - startCachedQuery).toFixed(2)}ms`
  );
  console.log(
    `Average: ${((endCachedQuery - startCachedQuery) / 1000).toFixed(4)}ms per query`
  );
  console.log(
    `Speedup: ${((endQuery - startQuery) / (endCachedQuery - startCachedQuery)).toFixed(2)}x`
  );

  console.log('\n✅ Performance benchmark completed!');
}

// Run all examples
async function main() {
  try {
    await basicExample();
    await poolExample();
    await performanceExample();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
