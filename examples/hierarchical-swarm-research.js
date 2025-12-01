/**
 * Hierarchical Swarm Research Agent Example
 *
 * Demonstrates 1000+ agents collaborating on research with hierarchical coordination
 */

const { HierarchicalSwarmAttention } = require('@ruvector/attention');
const { createUnifiedDatabase, EmbeddingService, ReflexionMemory, SkillLibrary } = require('agentdb');

class HierarchicalResearchSwarm {
  constructor(config) {
    this.numAgents = config.numAgents;
    this.embeddingDim = config.embeddingDim;
    this.hierarchicalSwarm = null;
    this.db = null;
    this.embedder = null;
  }

  async initialize() {
    console.log('Initializing hierarchical research swarm...\n');

    // Initialize embedder
    this.embedder = new EmbeddingService({
      model: 'Xenova/all-MiniLM-L6-v2',
      dimension: this.embeddingDim,
      provider: 'transformers',
    });
    await this.embedder.initialize();
    console.log('Embedder initialized');

    // Initialize agentdb
    this.db = await createUnifiedDatabase(
      './data/research-swarm.graph',
      this.embedder,
      { forceMode: 'graph' }
    );
    console.log('AgentDB initialized');

    // Initialize hierarchical swarm attention
    // Hierarchy: 1000 agents -> 100 coordinators -> 10 hubs -> 1 global
    this.hierarchicalSwarm = new HierarchicalSwarmAttention({
      dim: this.embeddingDim,
      levels: [
        { numAgents: this.numAgents, type: 'leaf' },      // Level 0: Individual agents
        { numSwarms: 100, type: 'coordinator' },          // Level 1: Local coordinators
        { numHubs: 10, type: 'regional' },                // Level 2: Regional hubs
        { type: 'global' },                               // Level 3: Global coordination
      ],

      // Increasing curvature for deeper hierarchies
      curvatures: [-1.0, -2.0, -4.0, -8.0],

      // Aggregation strategy
      aggregationType: 'weighted-consensus',

      // Enable top-down modulation
      enableTopDown: true,
    });
    console.log('Hierarchical swarm initialized\n');
  }

  async conductHierarchicalResearch(topic, subtopics) {
    console.log(`=== Conducting Hierarchical Research: ${topic} ===\n`);

    // 1. Global level: Decompose research topic
    console.log('[Level 3 - Global] Decomposing research topic...');
    const topicEmbedding = await this.embedder.embed(topic);

    const subtopicEmbeddings = await Promise.all(
      subtopics.map(st => this.embedder.embed(st))
    );
    console.log(`  Decomposed into ${subtopics.length} subtopics\n`);

    // 2. Regional hubs: Assign subtopics to regions
    console.log('[Level 2 - Regional Hubs] Assigning subtopics to regions...');
    const regionAssignments = await this.assignToRegions(subtopics, subtopicEmbeddings);

    for (const [region, topics] of Object.entries(regionAssignments)) {
      console.log(`  Region ${region}: ${topics.length} subtopics`);
    }
    console.log();

    // 3. Local coordinators: Distribute work among agent swarms
    console.log('[Level 1 - Local Coordinators] Distributing work to agent swarms...');
    const swarmAssignments = await this.distributeToSwarms(regionAssignments);
    console.log(`  Distributed to ${Object.keys(swarmAssignments).length} swarms\n`);

    // 4. Individual agents: Execute research tasks
    console.log('[Level 0 - Agents] Executing research tasks...');
    const agentResults = await this.executeAgentResearch(swarmAssignments);
    console.log(`  ${agentResults.length} agents completed research\n`);

    // 5. Bottom-up aggregation
    console.log('=== Bottom-Up Aggregation ===\n');

    // Level 0 -> 1: Agents to coordinators
    console.log('[Level 0 -> 1] Aggregating agent results to coordinators...');
    const coordinatorResults = await this.aggregateToCoordinators(agentResults);
    console.log(`  ${coordinatorResults.length} coordinator summaries\n`);

    // Level 1 -> 2: Coordinators to regional hubs
    console.log('[Level 1 -> 2] Aggregating coordinator results to regional hubs...');
    const hubResults = await this.aggregateToHubs(coordinatorResults);
    console.log(`  ${hubResults.length} regional summaries\n`);

    // Level 2 -> 3: Regional hubs to global
    console.log('[Level 2 -> 3] Aggregating hub results to global synthesis...');
    const globalSynthesis = await this.aggregateToGlobal(hubResults);
    console.log('  Global synthesis complete\n');

    // 6. Top-down modulation
    console.log('=== Top-Down Modulation ===\n');
    console.log('[Level 3 -> 2] Global insights modulating regional focus...');
    await this.modulateRegionalFocus(globalSynthesis);

    console.log('[Level 2 -> 1] Regional insights modulating coordinator strategies...');
    await this.modulateCoordinatorStrategies(hubResults);

    console.log('[Level 1 -> 0] Coordinator insights guiding agent exploration...\n');
    await this.guideAgentExploration(coordinatorResults);

    return {
      topic,
      synthesis: globalSynthesis,
      agentContributions: agentResults.length,
      hierarchyDepth: 4,
    };
  }

  async assignToRegions(subtopics, embeddings) {
    // Use hierarchical swarm to cluster subtopics by region
    const assignments = {};

    for (let i = 0; i < subtopics.length; i++) {
      // Determine region using swarm attention
      const regionId = Math.floor(Math.random() * 10); // Simplified

      if (!assignments[regionId]) {
        assignments[regionId] = [];
      }

      assignments[regionId].push({
        topic: subtopics[i],
        embedding: embeddings[i],
      });
    }

    return assignments;
  }

  async distributeToSwarms(regionAssignments) {
    const swarmAssignments = {};
    let swarmId = 0;

    for (const [region, topics] of Object.entries(regionAssignments)) {
      // Each region has multiple swarms
      const swarmsPerRegion = 10;

      for (let i = 0; i < swarmsPerRegion; i++) {
        swarmAssignments[swarmId] = {
          region,
          topics: topics.filter((_, idx) => idx % swarmsPerRegion === i),
        };
        swarmId++;
      }
    }

    return swarmAssignments;
  }

  async executeAgentResearch(swarmAssignments) {
    const results = [];

    for (const [swarmId, assignment] of Object.entries(swarmAssignments)) {
      if (assignment.topics.length === 0) continue;

      // 10 agents per swarm
      const agentsPerSwarm = 10;

      for (let agentIdx = 0; agentIdx < agentsPerSwarm; agentIdx++) {
        const agentId = parseInt(swarmId) * agentsPerSwarm + agentIdx;

        // Each agent researches one topic
        const topicIdx = agentIdx % assignment.topics.length;
        const topic = assignment.topics[topicIdx];

        // Simulate research using reflexion memory
        const reflexion = new ReflexionMemory(
          this.db.getGraphDatabase(),
          this.embedder,
          undefined,
          undefined,
          this.db.getGraphDatabase()
        );

        // Retrieve relevant knowledge
        const relevantMemories = await reflexion.retrieveRelevant({
          task: topic.topic,
          k: 5,
        });

        // Simulate research findings
        const findings = {
          agentId,
          swarmId: parseInt(swarmId),
          topic: topic.topic,
          keyFindings: [
            `Finding 1 for ${topic.topic}`,
            `Finding 2 for ${topic.topic}`,
          ],
          confidence: 0.7 + Math.random() * 0.3,
          relevantMemories: relevantMemories.length,
        };

        // Store episode
        await reflexion.storeEpisode({
          sessionId: `agent-${agentId}`,
          task: topic.topic,
          reward: findings.confidence,
          success: findings.confidence > 0.8,
          input: topic.topic,
          output: JSON.stringify(findings.keyFindings),
        });

        results.push(findings);
      }
    }

    return results;
  }

  async aggregateToCoordinators(agentResults) {
    // Group by swarm
    const swarmGroups = {};

    for (const result of agentResults) {
      if (!swarmGroups[result.swarmId]) {
        swarmGroups[result.swarmId] = [];
      }
      swarmGroups[result.swarmId].push(result);
    }

    // Each coordinator aggregates results from its swarm
    const coordinatorResults = [];

    for (const [swarmId, results] of Object.entries(swarmGroups)) {
      const summary = {
        coordinatorId: parseInt(swarmId),
        numAgents: results.length,
        avgConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length,
        topics: [...new Set(results.map(r => r.topic))],
        consolidatedFindings: this.consolidateFindings(results),
      };

      coordinatorResults.push(summary);
    }

    return coordinatorResults;
  }

  async aggregateToHubs(coordinatorResults) {
    // Group coordinators by region (10 coordinators per hub)
    const hubGroups = {};

    for (const result of coordinatorResults) {
      const hubId = Math.floor(result.coordinatorId / 10);

      if (!hubGroups[hubId]) {
        hubGroups[hubId] = [];
      }
      hubGroups[hubId].push(result);
    }

    // Each hub aggregates from coordinators
    const hubResults = [];

    for (const [hubId, coordinators] of Object.entries(hubGroups)) {
      const summary = {
        hubId: parseInt(hubId),
        numCoordinators: coordinators.length,
        numAgents: coordinators.reduce((sum, c) => sum + c.numAgents, 0),
        avgConfidence: coordinators.reduce((sum, c) => sum + c.avgConfidence, 0) / coordinators.length,
        regionalThemes: this.extractThemes(coordinators),
      };

      hubResults.push(summary);
    }

    return hubResults;
  }

  async aggregateToGlobal(hubResults) {
    return {
      totalHubs: hubResults.length,
      totalAgents: hubResults.reduce((sum, h) => sum + h.numAgents, 0),
      overallConfidence: hubResults.reduce((sum, h) => sum + h.avgConfidence, 0) / hubResults.length,
      globalThemes: this.synthesizeGlobalThemes(hubResults),
      insights: [
        'Global insight 1 from hierarchical analysis',
        'Global insight 2 from emergent patterns',
        'Global insight 3 from cross-regional synthesis',
      ],
    };
  }

  consolidateFindings(results) {
    // Simplified consolidation
    return results.flatMap(r => r.keyFindings).slice(0, 5);
  }

  extractThemes(coordinators) {
    // Simplified theme extraction
    return ['Theme 1', 'Theme 2', 'Theme 3'];
  }

  synthesizeGlobalThemes(hubResults) {
    // Simplified synthesis
    return hubResults.flatMap(h => h.regionalThemes).slice(0, 5);
  }

  async modulateRegionalFocus(globalSynthesis) {
    console.log(`  Modulating ${globalSynthesis.totalHubs} regional hubs based on global insights`);
  }

  async modulateCoordinatorStrategies(hubResults) {
    console.log(`  Modulating ${hubResults.length * 10} coordinator strategies`);
  }

  async guideAgentExploration(coordinatorResults) {
    console.log(`  Guiding ${coordinatorResults.reduce((sum, c) => sum + c.numAgents, 0)} agents`);
  }

  async shutdown() {
    if (this.db) {
      this.db.close();
    }
  }
}

// Run example
async function main() {
  const swarm = new HierarchicalResearchSwarm({
    numAgents: 1000,
    embeddingDim: 384,
  });

  await swarm.initialize();

  const result = await swarm.conductHierarchicalResearch(
    'Artificial General Intelligence',
    [
      'Neural architecture search',
      'Meta-learning algorithms',
      'Multimodal learning',
      'Causal reasoning',
      'Lifelong learning',
      'Transfer learning',
      'Few-shot learning',
      'Self-supervised learning',
    ]
  );

  console.log('=== Final Results ===\n');
  console.log(JSON.stringify(result, null, 2));

  await swarm.shutdown();
  console.log('\n=== Example Complete ===');
}

main().catch(err => console.error('Error:', err));
