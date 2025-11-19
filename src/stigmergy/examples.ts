/**
 * Stigmergy System - Runnable Examples
 *
 * Demonstrates swarm intelligence through stigmergic coordination.
 * Run these examples to see emergent behavior in action!
 */

import {
  createStigmergicSystem,
  PheromoneType,
  AgentState,
  EmergentPatternType
} from './index';

/**
 * Example 1: Simple Exploration
 *
 * Multiple agents explore space, leaving interest trails.
 * Watch them naturally discover and converge on interesting areas.
 */
export function exampleSimpleExploration() {
  console.log('\n=== Example 1: Simple Exploration ===\n');

  const system = createStigmergicSystem({
    name: 'Exploration Demo',
    bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 }
  });

  // Spawn 5 explorer agents
  const agents = [
    { userId: 'user1', name: 'Explorer Alpha' },
    { userId: 'user2', name: 'Explorer Beta' },
    { userId: 'user3', name: 'Explorer Gamma' },
    { userId: 'user4', name: 'Explorer Delta' },
    { userId: 'user5', name: 'Explorer Epsilon' }
  ];

  agents.forEach(agent => {
    system.api.joinSession({
      sessionId: system.session.id,
      userId: agent.userId,
      name: agent.name
    });
  });

  // Run simulation for 50 ticks
  console.log('Starting exploration...\n');
  for (let tick = 0; tick < 50; tick++) {
    system.coordinator.tick();
    system.detector.analyze();

    if (tick % 10 === 0) {
      const metrics = system.coordinator.getMetrics();
      const patterns = system.detector.getPatterns();

      console.log(`Tick ${tick}:`);
      console.log(`  Active agents: ${metrics.activeAgents}`);
      console.log(`  Exploration coverage: ${metrics.explorationCoverage} cells`);
      console.log(`  Emergent patterns: ${patterns.length}`);
      console.log(`  Convergence events: ${metrics.convergenceEvents}`);
      console.log();
    }
  }

  const finalState = system.api.visualize(system.session.id);
  console.log('Final state:');
  console.log(`  Total deposits: ${finalState.deposits.length}`);
  console.log(`  Hubs formed: ${finalState.emergence.hubs.length}`);
  console.log(`  Clusters: ${finalState.emergence.clusters.length}`);

  return system;
}

/**
 * Example 2: Stigmergic Path Finding
 *
 * Agents find shortest path between two points through pheromone reinforcement.
 * Like ant colonies finding food!
 */
export function examplePathFinding() {
  console.log('\n=== Example 2: Stigmergic Path Finding ===\n');

  const system = createStigmergicSystem({
    name: 'Path Finding Demo',
    bounds: { minX: 0, maxX: 50, minY: 0, maxY: 50 }
  });

  const start = { x: 5, y: 5 };
  const goal = { x: 45, y: 45 };

  // Spawn agents at start position
  const agents = ['ant1', 'ant2', 'ant3', 'ant4', 'ant5'];
  agents.forEach(userId => {
    const { agentId } = system.api.joinSession({
      sessionId: system.session.id,
      userId,
      name: `Ant ${userId}`,
      position: start
    });

    // Set goal in agent metadata
    const agent = system.coordinator.getAgent(agentId);
    if (agent) {
      agent.metadata.goal = goal;
    }
  });

  console.log(`Start: (${start.x}, ${start.y})`);
  console.log(`Goal: (${goal.x}, ${goal.y})\n`);

  // Simulate path finding
  for (let tick = 0; tick < 100; tick++) {
    system.coordinator.tick();

    // Check if any agent reached goal
    const allAgents = system.coordinator.getAllAgents();
    allAgents.forEach(agent => {
      const distance = Math.sqrt(
        (agent.position.x - goal.x) ** 2 + (agent.position.y - goal.y) ** 2
      );

      if (distance < 2.0 && agent.state !== AgentState.WORKING) {
        console.log(`${agent.name} reached goal at tick ${tick}!`);
        agent.state = AgentState.WORKING;

        // Deposit strong success pheromone
        system.pheromones.deposit({
          type: PheromoneType.SUCCESS,
          position: agent.position,
          strength: 2.0,
          depositor: agent.id,
          context: 'Reached goal!'
        });
      }
    });

    if (tick % 20 === 0) {
      const atGoal = allAgents.filter(a => a.state === AgentState.WORKING).length;
      console.log(`Tick ${tick}: ${atGoal}/5 agents at goal`);
    }
  }

  const highways = system.detector.getPatternsByType(EmergentPatternType.HIGHWAY);
  console.log(`\nEmergent highways formed: ${highways.length}`);
  highways.forEach((highway, i) => {
    console.log(`  Highway ${i + 1}: traffic=${highway.metrics.traffic.toFixed(2)}, length=${highway.metrics.length.toFixed(2)}`);
  });

  return system;
}

/**
 * Example 3: Collaborative Problem Solving
 *
 * Agents encounter problems and request help.
 * Others follow question pheromones to provide assistance.
 * Watch emergence of helping behavior!
 */
export function exampleCollaborativeSolving() {
  console.log('\n=== Example 3: Collaborative Problem Solving ===\n');

  const system = createStigmergicSystem({
    name: 'Collaboration Demo',
    bounds: { minX: 0, maxX: 60, minY: 0, maxY: 60 }
  });

  // Spawn diverse agents
  const creators = [
    { userId: 'creator1', name: 'Alice', helpfulness: 0.9 },
    { userId: 'creator2', name: 'Bob', helpfulness: 0.7 },
    { userId: 'creator3', name: 'Carol', helpfulness: 0.8 },
    { userId: 'creator4', name: 'Dave', helpfulness: 0.6 },
    { userId: 'creator5', name: 'Eve', helpfulness: 0.9 }
  ];

  creators.forEach(creator => {
    const { agentId } = system.api.joinSession({
      sessionId: system.session.id,
      userId: creator.userId,
      name: creator.name
    });

    const agent = system.coordinator.getAgent(agentId);
    if (agent) {
      agent.behavior.helpfulness = creator.helpfulness;
    }
  });

  let helpRequests = 0;
  let helpResponses = 0;

  // Simulate collaboration
  for (let tick = 0; tick < 80; tick++) {
    // Randomly cause agents to need help
    if (tick % 15 === 0 && tick > 0) {
      const allAgents = system.coordinator.getAllAgents();
      const needsHelp = allAgents[Math.floor(Math.random() * allAgents.length)];

      if (needsHelp.state === AgentState.EXPLORING) {
        needsHelp.state = AgentState.QUESTIONING;
        system.pheromones.deposit({
          type: PheromoneType.QUESTION,
          position: needsHelp.position,
          strength: 1.5,
          depositor: needsHelp.id,
          context: 'Need help here!'
        });
        helpRequests++;
        console.log(`Tick ${tick}: ${needsHelp.name} requests help at (${needsHelp.position.x.toFixed(1)}, ${needsHelp.position.y.toFixed(1)})`);
      }
    }

    system.coordinator.tick();

    // Detect helping behavior
    const helping = system.coordinator.getAgentsByState(AgentState.HELPING);
    const converging = system.coordinator.getAgentsByState(AgentState.CONVERGING);

    if (converging.length > 0) {
      helpResponses++;
    }

    if (tick % 20 === 0) {
      console.log(`Tick ${tick}:`);
      console.log(`  Agents helping: ${helping.length}`);
      console.log(`  Convergence points: ${converging.length}`);
      console.log(`  Help requests: ${helpRequests}, Responses: ${helpResponses}`);
    }
  }

  console.log('\nFinal statistics:');
  console.log(`  Total help requests: ${helpRequests}`);
  console.log(`  Successful responses: ${helpResponses}`);
  console.log(`  Response rate: ${((helpResponses / helpRequests) * 100).toFixed(1)}%`);

  const convergencePatterns = system.detector.getPatternsByType(EmergentPatternType.HUB);
  console.log(`  Convergence (hub) events detected: ${convergencePatterns.length}`);

  return system;
}

/**
 * Example 4: Division of Labor
 *
 * Watch as agents naturally specialize into different roles.
 * Some explore, some work, some help - emergent organization!
 */
export function exampleDivisionOfLabor() {
  console.log('\n=== Example 4: Division of Labor ===\n');

  const system = createStigmergicSystem({
    name: 'Division of Labor Demo',
    bounds: { minX: 0, maxX: 80, minY: 0, maxY: 80 }
  });

  // Spawn agents with varying behaviors
  const agents = Array.from({ length: 10 }, (_, i) => ({
    userId: `agent${i}`,
    name: `Agent ${i}`,
    explorationBias: Math.random(),
    helpfulness: Math.random()
  }));

  agents.forEach(config => {
    const { agentId } = system.api.joinSession({
      sessionId: system.session.id,
      userId: config.userId,
      name: config.name
    });

    const agent = system.coordinator.getAgent(agentId);
    if (agent) {
      agent.behavior.explorationBias = config.explorationBias;
      agent.behavior.helpfulness = config.helpfulness;
    }
  });

  console.log('Running simulation to observe role specialization...\n');

  const roleHistory: Array<Record<AgentState, number>> = [];

  for (let tick = 0; tick < 100; tick++) {
    system.coordinator.tick();
    system.detector.analyze();

    // Track role distribution
    const roles: Record<string, number> = {};
    system.coordinator.getAllAgents().forEach(agent => {
      roles[agent.state] = (roles[agent.state] || 0) + 1;
    });

    roleHistory.push(roles as any);

    if (tick % 25 === 0) {
      console.log(`Tick ${tick} - Role distribution:`);
      Object.entries(roles).forEach(([state, count]) => {
        console.log(`  ${state}: ${count} agents`);
      });
      console.log();
    }
  }

  // Detect division of labor pattern
  const divisionPatterns = system.detector.getPatternsByType(EmergentPatternType.DIVISION_OF_LABOR);

  console.log('Final analysis:');
  if (divisionPatterns.length > 0) {
    const pattern = divisionPatterns[0];
    console.log(`  Division of labor emerged!`);
    console.log(`  Specialization score: ${pattern.metrics.specialization.toFixed(3)}`);
    console.log(`  Number of roles: ${pattern.metrics.roleCount}`);
  } else {
    console.log(`  No clear division of labor yet - agents still exploring roles`);
  }

  return system;
}

/**
 * Example 5: Complete Workflow with API
 *
 * Demonstrates full API usage including sensing, depositing, and following trails.
 */
export async function exampleCompleteWorkflow() {
  console.log('\n=== Example 5: Complete API Workflow ===\n');

  const system = createStigmergicSystem({
    name: 'Complete Workflow Demo',
    bounds: { minX: 0, maxX: 40, minY: 0, maxY: 40 }
  });

  // User 1 joins and explores
  const user1 = system.api.joinSession({
    sessionId: system.session.id,
    userId: 'user1',
    name: 'Pioneer',
    position: { x: 10, y: 10 }
  });

  console.log('User 1 (Pioneer) exploring and marking interesting spots...\n');

  // Mark interesting locations
  const interestingSpots = [
    { x: 15, y: 15 },
    { x: 20, y: 20 },
    { x: 25, y: 25 }
  ];

  for (const spot of interestingSpots) {
    system.api.move({
      sessionId: system.session.id,
      userId: 'user1',
      target: spot
    });

    system.api.deposit({
      sessionId: system.session.id,
      userId: 'user1',
      type: PheromoneType.INTEREST,
      strength: 1.5,
      context: 'Interesting area!',
      tags: ['discovery']
    });

    console.log(`Pioneer marked (${spot.x}, ${spot.y}) as interesting`);
  }

  // User 2 joins and senses
  const user2 = system.api.joinSession({
    sessionId: system.session.id,
    userId: 'user2',
    name: 'Follower',
    position: { x: 5, y: 5 }
  });

  console.log('\nUser 2 (Follower) joined and sensing environment...\n');

  const sensing = system.api.sense({
    sessionId: system.session.id,
    userId: 'user2'
  });

  console.log('Follower senses:');
  console.log(`  Nearby agents: ${sensing.nearbyAgents.length}`);
  console.log(`  Nearby trails: ${sensing.nearbyTrails.length}`);
  sensing.nearbyTrails.forEach((trail, i) => {
    console.log(`    Trail ${i + 1}: ${trail.type}, strength=${trail.strength.toFixed(2)}`);
  });
  console.log(`  Suggestions:`);
  sensing.suggestions.forEach(s => console.log(`    - ${s}`));

  // Follow the interest trail
  console.log('\nFollower following interest trail...\n');

  const followResult = system.api.followTrail({
    sessionId: system.session.id,
    userId: 'user2',
    type: PheromoneType.INTEREST,
    steps: 5
  });

  console.log(followResult.message);

  // User 3 joins and requests help
  const user3 = system.api.joinSession({
    sessionId: system.session.id,
    userId: 'user3',
    name: 'Questioner',
    position: { x: 35, y: 35 }
  });

  console.log('\nUser 3 (Questioner) needs help...\n');

  system.api.requestHelp({
    sessionId: system.session.id,
    userId: 'user3',
    context: 'Stuck on a problem, need assistance!'
  });

  // Run a few ticks to let helpers respond
  console.log('Waiting for helpers to respond...\n');
  for (let i = 0; i < 10; i++) {
    system.api.tick(system.session.id);
  }

  // Get activity feed
  const feed = system.api.getActivityFeed({
    sessionId: system.session.id,
    limit: 10
  });

  console.log('Recent activity:');
  feed.events.slice(-5).forEach(event => {
    console.log(`  ${event.type}: ${event.agentId.substring(0, 10)}...`);
  });

  console.log(`\nEmergent patterns detected: ${feed.patterns.length}`);
  feed.patterns.forEach(pattern => {
    console.log(`  ${pattern.type}: ${pattern.description}`);
  });

  console.log('\nEmergence metrics:');
  console.log(`  Complexity: ${feed.metrics.complexity.toFixed(3)}`);
  console.log(`  Self-organization: ${feed.metrics.selfOrganization.toFixed(3)}`);
  console.log(`  Robustness: ${feed.metrics.robustness.toFixed(3)}`);

  return system;
}

/**
 * Run all examples
 */
export function runAllExamples() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║  VibeCast Stigmergy System - Example Suite        ║');
  console.log('║  Pure Swarm Intelligence Through Environment       ║');
  console.log('╚════════════════════════════════════════════════════╝');

  exampleSimpleExploration();
  console.log('\n' + '='.repeat(60) + '\n');

  examplePathFinding();
  console.log('\n' + '='.repeat(60) + '\n');

  exampleCollaborativeSolving();
  console.log('\n' + '='.repeat(60) + '\n');

  exampleDivisionOfLabor();
  console.log('\n' + '='.repeat(60) + '\n');

  exampleCompleteWorkflow();

  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║  All examples completed!                           ║');
  console.log('║  Stigmergic coordination achieved through pure     ║');
  console.log('║  local interactions and environmental signals.     ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
}

// Allow running as script
if (require.main === module) {
  runAllExamples();
}
