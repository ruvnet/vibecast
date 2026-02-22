#!/usr/bin/env node

/**
 * AgentDB Example 15 - Full AI Agent Lifecycle Simulator
 *
 * Simulates an AI coding assistant growing from Junior to Expert over 5 "days".
 * Uses the complete AgentDB memory stack:
 *   - ReflexionMemory   : episodic replay with self-critique
 *   - SkillLibrary      : lifelong learning skill management
 *   - CausalMemoryGraph : causal inference and intervention reasoning
 *   - ReasoningBank     : reasoning pattern storage
 *   - NightlyLearner    : automated causal discovery
 *   - LearningSystem    : RL session management
 *   - ContextSynthesizer: narrative synthesis from memories
 *   - MetadataFilter    : MongoDB-style metadata filtering
 *
 * All data lives in a single in-memory sql.js WASM database.
 */

import AgentDB from 'agentdb';
import {
  ReflexionMemory,
  SkillLibrary,
  CausalMemoryGraph,
  ReasoningBank,
  NightlyLearner,
  LearningSystem,
  ContextSynthesizer,
  MetadataFilter,
} from 'agentdb';

// ---------------------------------------------------------------------------
// Mock embedder
// ---------------------------------------------------------------------------
class MockEmbedder {
  constructor(dim = 384) { this.dim = dim; }
  async initialize() {}
  async embed(text) {
    const arr = new Float32Array(this.dim);
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    for (let i = 0; i < this.dim; i++) { hash = ((hash << 5) - hash + i) | 0; arr[i] = (hash & 0xFFFF) / 65536 - 0.5; }
    const norm = Math.sqrt(arr.reduce((s, v) => s + v * v, 0));
    for (let i = 0; i < this.dim; i++) arr[i] /= norm;
    return arr;
  }
  async embedBatch(texts) { return Promise.all(texts.map(t => this.embed(t))); }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function banner(title) {
  const line = '='.repeat(70);
  console.log(`\n${line}`);
  console.log(`  ${title}`);
  console.log(`${line}\n`);
}

function subBanner(title) {
  console.log(`\n  --- ${title} ${'─'.repeat(Math.max(0, 55 - title.length))}\n`);
}

function table(rows, headers) {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => String(r[i]).length))
  );
  const sep = widths.map(w => '-'.repeat(w + 2)).join('+');
  const fmt = (vals) => vals.map((v, i) => ` ${String(v).padEnd(widths[i])} `).join('|');
  console.log(`  ${fmt(headers)}`);
  console.log(`  ${sep}`);
  rows.forEach(r => console.log(`  ${fmt(r)}`));
}

function progressBar(value, max, width = 30) {
  const filled = Math.round((value / max) * width);
  return '[' + '#'.repeat(filled) + '.'.repeat(width - filled) + ']';
}

// Deterministic "random" for reproducibility
let rngSeed = 42;
function rand() {
  rngSeed = (rngSeed * 1103515245 + 12345) & 0x7FFFFFFF;
  return rngSeed / 0x7FFFFFFF;
}
function randRange(lo, hi) { return lo + rand() * (hi - lo); }

// ---------------------------------------------------------------------------
// Task definitions
// ---------------------------------------------------------------------------
const TASKS = [
  { name: 'fix_bug',          description: 'Fix a null pointer exception in user auth module' },
  { name: 'write_test',       description: 'Write unit tests for the payment processing service' },
  { name: 'refactor_fn',      description: 'Refactor the data transformation pipeline for clarity' },
  { name: 'review_pr',        description: 'Review pull request for the new caching layer' },
  { name: 'deploy_service',   description: 'Deploy the notification microservice to staging' },
  { name: 'optimize_query',   description: 'Optimize slow database queries in reporting module' },
  { name: 'design_api',       description: 'Design REST API endpoints for the new feature' },
  { name: 'debug_memory',     description: 'Debug memory leak in the websocket connection handler' },
  { name: 'write_docs',       description: 'Write API documentation for the integration module' },
  { name: 'setup_ci',         description: 'Set up continuous integration pipeline with tests' },
];

const CRITIQUES = {
  low:  ['Missed edge cases', 'Incomplete implementation', 'No error handling', 'Forgot to add tests', 'Hardcoded values'],
  mid:  ['Good approach but needs polish', 'Works but could be more efficient', 'Missing documentation', 'Partial test coverage'],
  high: ['Solid implementation with tests', 'Clean code with good error handling', 'Well-documented solution', 'Efficient and maintainable'],
};

// ---------------------------------------------------------------------------
// Main simulation
// ---------------------------------------------------------------------------
async function main() {
  console.log(`
    _    ___      _                _
   / \\  |_ _|   / \\   __ _  ___ | |
  / _ \\  | |   / _ \\ / _\` |/ _ \\| '_ \\| __|
 / ___ \\ | |  / ___ \\ (_| |  __/| | | | |_
/_/   \\_\\___||_/   \\_\\__, |\\___|_| |_|\\__|
                     |___/
   Coding Assistant Lifecycle Simulator
   5 Days: Junior -> Learning -> Competent -> Expert -> Teaching
  `);

  // =========================================================================
  // Initialize AgentDB
  // =========================================================================
  banner('Initializing AgentDB');

  const db = new AgentDB({ dbPath: ':memory:', vectorDimension: 384 });
  await db.initialize();

  const database = db.database;
  const embedder = new MockEmbedder(384);

  // Create all controllers sharing the same database
  const reflexion    = new ReflexionMemory(database, embedder);
  const skills       = new SkillLibrary(database, embedder);
  const causalGraph  = new CausalMemoryGraph(database);
  const reasoning    = new ReasoningBank(database, embedder);
  const learner      = new NightlyLearner(database, embedder);
  const learning     = new LearningSystem(database, embedder);

  console.log('  All controllers initialized.');
  console.log('  Database backend: sql.js WASM (in-memory)');
  console.log('  Embedding dim: 384 (mock embedder)');

  // Track rewards for learning curve
  const rewardHistory = [];
  const dayLabels = ['Day 1: Junior', 'Day 2: Learning', 'Day 3: Competent', 'Day 4: Expert', 'Day 5: Teaching'];
  const skillTimeline = [];

  // =========================================================================
  // DAY 1: Junior Developer
  // =========================================================================
  banner('DAY 1: "Junior Developer" -- Learning the Ropes');
  console.log('  The agent encounters tasks for the first time. Low rewards,');
  console.log('  fumbling through problems, building initial experiences.\n');

  const day1Session = await learning.startSession('agent-alpha', 'q-learning', {
    learningRate: 0.1,
    discountFactor: 0.95,
    explorationRate: 0.8,
  });

  const day1Episodes = [];
  for (let i = 0; i < 5; i++) {
    const task = TASKS[i];
    const reward = randRange(0.3, 0.6);
    const success = reward > 0.5;
    const critique = CRITIQUES.low[i % CRITIQUES.low.length];

    const epId = await reflexion.storeEpisode({
      sessionId: 'day1',
      task: task.description,
      input: `Attempting: ${task.name}`,
      output: success ? 'Partial solution' : 'Failed attempt',
      critique: critique,
      reward: reward,
      success: success,
      latencyMs: Math.floor(randRange(5000, 15000)),
      tokensUsed: Math.floor(randRange(500, 2000)),
      tags: [task.name, 'day1', 'junior'],
      metadata: { day: 1, taskType: task.name, difficulty: 'standard' },
    });

    day1Episodes.push({ id: epId, task: task.name, reward, success, critique });
    rewardHistory.push({ day: 1, task: task.name, reward });

    console.log(`  Task ${i + 1}: ${task.name.padEnd(16)} reward=${reward.toFixed(2)} ${success ? 'OK' : 'FAIL'}  "${critique}"`);
  }

  // Store initial reasoning patterns
  subBanner('Storing Initial Reasoning Patterns');
  const pattern1Id = await reasoning.storePattern({
    taskType: 'debugging',
    approach: 'Read error logs, identify stack trace, add print statements',
    successRate: 0.4,
    tags: ['debugging', 'basic'],
  });
  const pattern2Id = await reasoning.storePattern({
    taskType: 'testing',
    approach: 'Write basic assertions for happy path only',
    successRate: 0.5,
    tags: ['testing', 'basic'],
  });
  console.log(`  Stored 2 basic reasoning patterns (IDs: ${pattern1Id}, ${pattern2Id})`);

  const day1Stats = reflexion.getTaskStats(TASKS[0].description);
  console.log(`\n  Day 1 Stats for "${TASKS[0].name}":`);
  console.log(`    Total attempts    : ${day1Stats.totalAttempts}`);
  console.log(`    Success rate      : ${(day1Stats.successRate * 100).toFixed(0)}%`);
  console.log(`    Avg reward        : ${day1Stats.avgReward.toFixed(3)}`);

  skillTimeline.push({ day: 1, skills: 0, patterns: 2 });

  // =========================================================================
  // DAY 2: Learning
  // =========================================================================
  banner('DAY 2: "Learning" -- Retrieving Past Experiences');
  console.log('  The agent retrieves memories from Day 1 to guide decisions.');
  console.log('  Rewards improve. First skills emerge.\n');

  const day2Session = await learning.startSession('agent-alpha', 'sarsa', {
    learningRate: 0.15,
    discountFactor: 0.95,
    explorationRate: 0.5,
  });

  // Retrieve past experiences to guide new attempts
  subBanner('Retrieving Past Episodes for Guidance');
  for (let i = 0; i < 3; i++) {
    const task = TASKS[i];
    const relevant = await reflexion.retrieveRelevant({
      task: task.description,
      k: 2,
    });
    console.log(`  "${task.name}" -> found ${relevant.length} relevant episodes`);
    relevant.forEach(ep => {
      console.log(`    - reward=${ep.reward.toFixed(2)} success=${ep.success} "${(ep.critique || '').substring(0, 40)}"`);
    });
  }

  // Day 2 episodes with improved rewards
  subBanner('Day 2 Task Execution');
  const day2Episodes = [];
  for (let i = 0; i < 5; i++) {
    const task = TASKS[i];
    const reward = randRange(0.5, 0.8);
    const success = reward > 0.55;
    const critique = CRITIQUES.mid[i % CRITIQUES.mid.length];

    const epId = await reflexion.storeEpisode({
      sessionId: 'day2',
      task: task.description,
      input: `Reattempting: ${task.name} (with prior knowledge)`,
      output: success ? 'Improved solution' : 'Better attempt, still needs work',
      critique: critique,
      reward: reward,
      success: success,
      latencyMs: Math.floor(randRange(3000, 10000)),
      tokensUsed: Math.floor(randRange(400, 1500)),
      tags: [task.name, 'day2', 'learning'],
      metadata: { day: 2, taskType: task.name, usedPriorKnowledge: true },
    });

    day2Episodes.push({ id: epId, task: task.name, reward, success, critique });
    rewardHistory.push({ day: 2, task: task.name, reward });

    console.log(`  Task ${i + 1}: ${task.name.padEnd(16)} reward=${reward.toFixed(2)} ${success ? 'OK' : 'FAIL'}  "${critique}"`);
  }

  // Create skills from successful episodes
  subBanner('Creating Skills from Successes');
  const skillsCreated = [];
  const successfulTasks = day2Episodes.filter(e => e.success);
  for (let i = 0; i < Math.min(3, successfulTasks.length); i++) {
    const ep = successfulTasks[i];
    const skillId = await skills.createSkill({
      name: `${ep.task}_basic`,
      description: `Basic approach for ${ep.task} learned from experience`,
      code: `// Skill for ${ep.task}\nfunction handle() { /* learned pattern */ }`,
      successRate: ep.reward,
      uses: 1,
      avgReward: ep.reward,
      createdFromEpisode: ep.id,
      metadata: { day: 2, sourceEpisode: ep.id },
    });
    skillsCreated.push({ id: skillId, name: `${ep.task}_basic` });
    console.log(`  Created skill: "${ep.task}_basic" (id=${skillId}, reward=${ep.reward.toFixed(2)})`);
  }

  // Add causal edges
  subBanner('Discovering Causal Relationships');
  if (day1Episodes.length >= 2 && day2Episodes.length >= 2) {
    const edge1Id = await causalGraph.addCausalEdge({
      fromMemoryId: day1Episodes[1].id,
      fromMemoryType: 'episode',
      toMemoryId: day2Episodes[4].id,
      toMemoryType: 'episode',
      similarity: 0.72,
      uplift: 0.35,
      confidence: 0.65,
      sampleSize: 5,
      mechanism: 'testing CAUSES deployment_success',
      metadata: { discoveredOn: 'day2' },
    });
    console.log(`  Causal edge: "testing -> deployment_success" (id=${edge1Id}, uplift=0.35)`);

    const edge2Id = await causalGraph.addCausalEdge({
      fromMemoryId: day1Episodes[0].id,
      fromMemoryType: 'episode',
      toMemoryId: day2Episodes[0].id,
      toMemoryType: 'episode',
      similarity: 0.68,
      uplift: 0.28,
      confidence: 0.60,
      sampleSize: 4,
      mechanism: 'debugging_practice CAUSES fix_bug_improvement',
      metadata: { discoveredOn: 'day2' },
    });
    console.log(`  Causal edge: "debugging_practice -> fix_bug_improvement" (id=${edge2Id}, uplift=0.28)`);
  }

  // Store improved reasoning
  await reasoning.storePattern({
    taskType: 'debugging',
    approach: 'Check error logs, reproduce locally, use debugger, add tests for fix',
    successRate: 0.7,
    tags: ['debugging', 'improved'],
  });

  skillTimeline.push({ day: 2, skills: skillsCreated.length, patterns: 3 });

  // =========================================================================
  // DAY 3: Competent
  // =========================================================================
  banner('DAY 3: "Competent" -- Efficient Task Handling');
  console.log('  The agent uses skills and patterns to handle tasks efficiently.');
  console.log('  High rewards. Nightly learner consolidates knowledge.\n');

  // Search for relevant skills
  subBanner('Skill Retrieval for Task Planning');
  for (const task of TASKS.slice(0, 3)) {
    const foundSkills = await skills.searchSkills({ task: task.description, k: 2 });
    console.log(`  "${task.name}" -> ${foundSkills.length} relevant skills`);
    foundSkills.forEach(s => {
      console.log(`    - "${s.name}" successRate=${s.successRate.toFixed(2)} uses=${s.uses || 0}`);
    });
  }

  // Day 3 episodes with high rewards
  subBanner('Day 3 Task Execution');
  const day3Episodes = [];
  for (let i = 0; i < 7; i++) {
    const task = TASKS[i % TASKS.length];
    const reward = randRange(0.7, 0.95);
    const success = reward > 0.65;
    const critique = CRITIQUES.high[i % CRITIQUES.high.length];

    const epId = await reflexion.storeEpisode({
      sessionId: 'day3',
      task: task.description,
      input: `Executing: ${task.name} (using skills + patterns)`,
      output: 'Efficient solution with tests and documentation',
      critique: critique,
      reward: reward,
      success: success,
      latencyMs: Math.floor(randRange(1500, 5000)),
      tokensUsed: Math.floor(randRange(200, 800)),
      tags: [task.name, 'day3', 'competent'],
      metadata: { day: 3, taskType: task.name, usedSkills: true, usedPatterns: true },
    });

    day3Episodes.push({ id: epId, task: task.name, reward, success, critique });
    rewardHistory.push({ day: 3, task: task.name, reward });

    // Update skill stats if skill exists
    if (skillsCreated.length > 0) {
      const si = i % skillsCreated.length;
      skills.updateSkillStats(skillsCreated[si].id, success, reward, Math.floor(randRange(1500, 5000)));
    }

    console.log(`  Task ${i + 1}: ${task.name.padEnd(16)} reward=${reward.toFixed(2)} ${success ? 'OK' : 'FAIL'}  "${critique}"`);
  }

  // Discover more causal patterns
  subBanner('New Causal Discoveries');
  await causalGraph.addCausalEdge({
    fromMemoryId: day2Episodes[0].id,
    fromMemoryType: 'episode',
    toMemoryId: day3Episodes[0].id,
    toMemoryType: 'episode',
    similarity: 0.82,
    uplift: 0.45,
    confidence: 0.78,
    sampleSize: 8,
    mechanism: 'skill_reuse CAUSES efficiency_improvement',
  });
  console.log('  "skill_reuse -> efficiency_improvement" (uplift=0.45, confidence=0.78)');

  await causalGraph.addCausalEdge({
    fromMemoryId: day3Episodes[1].id,
    fromMemoryType: 'episode',
    toMemoryId: day3Episodes[4].id,
    toMemoryType: 'episode',
    similarity: 0.75,
    uplift: 0.38,
    confidence: 0.72,
    sampleSize: 6,
    mechanism: 'test_coverage CAUSES deploy_confidence',
  });
  console.log('  "test_coverage -> deploy_confidence" (uplift=0.38, confidence=0.72)');

  // Build skill relationships
  subBanner('Skill Relationships');
  if (skillsCreated.length >= 2) {
    skills.linkSkills({
      parentSkillId: skillsCreated[0].id,
      childSkillId: skillsCreated[1].id,
      relationship: 'prerequisite',
      weight: 0.8,
      metadata: { reason: 'Bug fixing often needed before testing' },
    });
    console.log(`  Linked: "${skillsCreated[0].name}" --prerequisite--> "${skillsCreated[1].name}"`);
  }

  // Create advanced skill
  const advSkillId = await skills.createSkill({
    name: 'full_development_cycle',
    description: 'Complete development cycle: fix, test, refactor, review, deploy',
    code: '// Composite skill\nfunction fullCycle(task) { fix(); test(); refactor(); review(); deploy(); }',
    successRate: 0.85,
    uses: 3,
    avgReward: 0.85,
    metadata: { day: 3, type: 'composite' },
  });
  skillsCreated.push({ id: advSkillId, name: 'full_development_cycle' });
  console.log(`  Created composite skill: "full_development_cycle" (id=${advSkillId})`);

  // Run nightly learner
  subBanner('Nightly Learner -- Knowledge Consolidation');
  try {
    const nightReport = await learner.run();
    console.log(`  Execution time     : ${nightReport.executionTimeMs.toFixed(0)} ms`);
    console.log(`  Edges discovered   : ${nightReport.edgesDiscovered}`);
    console.log(`  Edges pruned       : ${nightReport.edgesPruned}`);
    console.log(`  Experiments done   : ${nightReport.experimentsCompleted}`);
    console.log(`  Avg uplift         : ${nightReport.avgUplift.toFixed(3)}`);
    console.log(`  Avg confidence     : ${nightReport.avgConfidence.toFixed(3)}`);
    if (nightReport.recommendations.length > 0) {
      console.log('  Recommendations:');
      nightReport.recommendations.forEach(r => console.log(`    - ${r}`));
    }
  } catch (err) {
    console.log(`  NightlyLearner run completed (${err.message || 'no new discoveries'})`);
  }

  skillTimeline.push({ day: 3, skills: skillsCreated.length, patterns: 4 });

  // =========================================================================
  // DAY 4: Expert
  // =========================================================================
  banner('DAY 4: "Expert" -- Complex Multi-Step Tasks');
  console.log('  The agent handles complex tasks with causal reasoning.');
  console.log('  Very high rewards. Advanced skill compositions.\n');

  // Use causal reasoning for planning
  subBanner('Causal Reasoning for Task Planning');
  const causalEffects = causalGraph.queryCausalEffects({
    interventionMemoryId: day1Episodes[0].id,
    interventionMemoryType: 'episode',
    minConfidence: 0.3,
  });
  console.log(`  Queried causal effects from episode ${day1Episodes[0].id}:`);
  causalEffects.forEach(e => {
    console.log(`    -> to=${e.toMemoryId} uplift=${(e.uplift || 0).toFixed(3)} conf=${e.confidence.toFixed(3)} "${(e.mechanism || 'unknown').substring(0, 40)}"`);
  });

  // Search reasoning patterns
  const patterns = await reasoning.searchPatterns({
    task: 'debugging complex memory issues',
    k: 3,
  });
  console.log(`\n  Found ${patterns.length} relevant reasoning patterns`);
  patterns.forEach(p => {
    console.log(`    - [${p.taskType}] "${p.approach.substring(0, 50)}" rate=${p.successRate.toFixed(2)}`);
  });

  // Day 4 episodes
  subBanner('Day 4 Expert Execution');
  const day4Episodes = [];
  for (let i = 0; i < 8; i++) {
    const task = TASKS[i % TASKS.length];
    const reward = randRange(0.85, 0.98);
    const success = true;
    const critique = CRITIQUES.high[i % CRITIQUES.high.length];

    const epId = await reflexion.storeEpisode({
      sessionId: 'day4',
      task: task.description,
      input: `Expert handling: ${task.name} (causal + skills)`,
      output: 'Optimal solution with comprehensive tests, docs, and monitoring',
      critique: critique,
      reward: reward,
      success: success,
      latencyMs: Math.floor(randRange(800, 3000)),
      tokensUsed: Math.floor(randRange(150, 600)),
      tags: [task.name, 'day4', 'expert'],
      metadata: { day: 4, taskType: task.name, usedCausalReasoning: true, expert: true },
    });

    day4Episodes.push({ id: epId, task: task.name, reward, success, critique });
    rewardHistory.push({ day: 4, task: task.name, reward });

    console.log(`  Task ${i + 1}: ${task.name.padEnd(16)} reward=${reward.toFixed(2)} OK  "${critique}"`);
  }

  // Create advanced composite skill
  const expertSkillId = await skills.createSkill({
    name: 'causal_debugging_expert',
    description: 'Use causal graphs to identify root cause, plan intervention, verify with counterfactual',
    code: '// Expert causal debugging\nasync function causalDebug(issue) {\n  const causes = await causalGraph.queryCausalEffects(issue);\n  const intervention = planIntervention(causes);\n  return await verify(intervention);\n}',
    successRate: 0.95,
    uses: 5,
    avgReward: 0.93,
    metadata: { day: 4, type: 'expert', usesCausal: true },
  });
  skillsCreated.push({ id: expertSkillId, name: 'causal_debugging_expert' });
  console.log(`\n  Created expert skill: "causal_debugging_expert" (id=${expertSkillId})`);

  // Store expert reasoning pattern
  await reasoning.storePattern({
    taskType: 'complex_debugging',
    approach: 'Causal graph traversal -> root cause isolation -> counterfactual verification -> targeted fix',
    successRate: 0.92,
    tags: ['debugging', 'expert', 'causal'],
  });

  // Context synthesis
  subBanner('Context Synthesis -- Decision Support');
  const recentEpisodes = await reflexion.getRecentEpisodes('day4', 5);
  const memoryPatterns = recentEpisodes.map(ep => ({
    task: ep.task,
    reward: ep.reward,
    success: ep.success,
    critique: ep.critique,
    input: ep.input,
    output: ep.output,
  }));

  const context = ContextSynthesizer.synthesize(memoryPatterns, {
    includeRecommendations: true,
    maxSummaryLength: 500,
  });

  console.log(`  Summary: ${context.summary.substring(0, 120)}...`);
  console.log(`  Total memories : ${context.totalMemories}`);
  console.log(`  Success rate   : ${(context.successRate * 100).toFixed(0)}%`);
  console.log(`  Avg reward     : ${context.averageReward.toFixed(3)}`);
  console.log('  Patterns:');
  context.patterns.slice(0, 3).forEach(p => console.log(`    - ${p}`));
  console.log('  Key Insights:');
  context.keyInsights.slice(0, 3).forEach(i => console.log(`    - ${i}`));
  if (context.recommendations.length > 0) {
    console.log('  Recommendations:');
    context.recommendations.slice(0, 3).forEach(r => console.log(`    - ${r}`));
  }

  skillTimeline.push({ day: 4, skills: skillsCreated.length, patterns: 5 });

  // =========================================================================
  // DAY 5: Teaching
  // =========================================================================
  banner('DAY 5: "Teaching" -- Knowledge Export & Transfer');
  console.log('  The agent generates strategies for new agents, exports skills,');
  console.log('  provides causal explanations, and shows growth trajectory.\n');

  // Generate success strategies
  subBanner('Success Strategies for New Agents');
  for (const task of TASKS.slice(0, 5)) {
    try {
      const strategies = await reflexion.getSuccessStrategies({
        task: task.description,
        k: 3,
        onlySuccesses: true,
      });
      console.log(`  "${task.name}": ${strategies.substring(0, 80)}...`);
    } catch {
      console.log(`  "${task.name}": Building strategies from accumulated experience...`);
    }
  }

  // Critique summaries
  subBanner('Critique Summaries (Lessons Learned)');
  for (const task of TASKS.slice(0, 3)) {
    try {
      const critiqueSummary = await reflexion.getCritiqueSummary({
        task: task.description,
        k: 5,
      });
      console.log(`  "${task.name}": ${critiqueSummary.substring(0, 80)}...`);
    } catch {
      console.log(`  "${task.name}": Aggregating critique insights...`);
    }
  }

  // Export skill library
  subBanner('Skill Library Export');
  const allSkillsResult = await skills.searchSkills({ task: 'development', k: 10 });
  console.log(`  Total skills available: ${allSkillsResult.length}`);
  allSkillsResult.forEach(s => {
    console.log(`    - "${s.name}" rate=${s.successRate.toFixed(2)} uses=${s.uses || 0} reward=${(s.avgReward || 0).toFixed(2)}`);
  });

  // Causal explanations
  subBanner('Causal Explanations');
  const allCausalEffects = causalGraph.queryCausalEffects({
    interventionMemoryId: day1Episodes[0].id,
    interventionMemoryType: 'episode',
    minConfidence: 0.0,
  });
  console.log(`  Total causal edges from agent's experience: ${allCausalEffects.length}`);
  allCausalEffects.forEach(e => {
    console.log(`    ${e.fromMemoryId} -> ${e.toMemoryId} | mechanism="${(e.mechanism || '?').substring(0, 45)}" | uplift=${(e.uplift || 0).toFixed(3)} | conf=${e.confidence.toFixed(3)}`);
  });

  // Metadata filtering
  subBanner('Expert Episode Filtering');
  const allDay4 = await reflexion.getRecentEpisodes('day4', 20);
  const filtered = MetadataFilter.apply(
    allDay4.map(ep => ({
      ...ep,
      metadata: ep.metadata || {},
    })),
    { reward: { $gte: 0.9 }, success: true }
  );
  console.log(`  Episodes with reward >= 0.9 and success=true: ${filtered.length}`);

  // Actionable steps
  const actionSteps = ContextSynthesizer.extractActionableSteps(memoryPatterns);
  if (actionSteps.length > 0) {
    console.log('\n  Actionable Steps for New Agents:');
    actionSteps.slice(0, 5).forEach((s, i) => console.log(`    ${i + 1}. ${s}`));
  }

  // Reasoning pattern stats
  const patternStats = reasoning.getPatternStats();
  console.log(`\n  Reasoning Patterns:`);
  console.log(`    Total patterns          : ${patternStats.totalPatterns}`);
  console.log(`    Avg success rate        : ${patternStats.avgSuccessRate.toFixed(3)}`);
  console.log(`    High-performing patterns: ${patternStats.highPerformingPatterns}`);

  skillTimeline.push({ day: 5, skills: skillsCreated.length, patterns: patternStats.totalPatterns });

  // =========================================================================
  // Final Report
  // =========================================================================
  banner('FINAL REPORT -- Agent Growth Trajectory');

  // Learning curve
  subBanner('Learning Curve (Average Reward per Day)');
  const dayAvgs = {};
  rewardHistory.forEach(r => {
    if (!dayAvgs[r.day]) dayAvgs[r.day] = [];
    dayAvgs[r.day].push(r.reward);
  });

  console.log('');
  for (let d = 1; d <= 5; d++) {
    const rewards = dayAvgs[d] || [];
    const avg = rewards.length ? rewards.reduce((a, b) => a + b, 0) / rewards.length : 0;
    const bar = progressBar(avg, 1.0, 40);
    console.log(`  Day ${d} ${bar} ${avg.toFixed(3)} (n=${rewards.length})`);
  }

  // Skill evolution
  subBanner('Skill Evolution');
  table(
    skillTimeline.map((st, i) => [
      dayLabels[i],
      st.skills,
      st.patterns,
      `${st.skills + st.patterns} total knowledge`,
    ]),
    ['Day', 'Skills', 'Patterns', 'Knowledge Base']
  );

  // Reward distribution
  subBanner('Reward Distribution by Task');
  const taskRewards = {};
  rewardHistory.forEach(r => {
    if (!taskRewards[r.task]) taskRewards[r.task] = [];
    taskRewards[r.task].push(r.reward);
  });

  const distRows = Object.entries(taskRewards).map(([task, rewards]) => {
    const avg = rewards.reduce((a, b) => a + b, 0) / rewards.length;
    const min = Math.min(...rewards);
    const max = Math.max(...rewards);
    return [task, rewards.length, avg.toFixed(3), min.toFixed(3), max.toFixed(3), progressBar(avg, 1.0, 20)];
  }).sort((a, b) => parseFloat(b[2]) - parseFloat(a[2]));

  table(distRows, ['Task', 'N', 'Avg', 'Min', 'Max', 'Bar']);

  // Causal graph summary
  subBanner('Causal Graph Summary');
  const allEdges = causalGraph.queryCausalEffects({
    interventionMemoryId: day1Episodes[0].id,
    interventionMemoryType: 'episode',
    minConfidence: 0.0,
  });
  console.log(`  Edges discovered    : ${allEdges.length}`);
  if (allEdges.length > 0) {
    const avgUplift = allEdges.reduce((s, e) => s + (e.uplift || 0), 0) / allEdges.length;
    const avgConf = allEdges.reduce((s, e) => s + e.confidence, 0) / allEdges.length;
    console.log(`  Avg uplift          : ${avgUplift.toFixed(3)}`);
    console.log(`  Avg confidence      : ${avgConf.toFixed(3)}`);
    console.log('  Key mechanisms:');
    const mechanisms = [...new Set(allEdges.map(e => e.mechanism).filter(Boolean))];
    mechanisms.forEach(m => console.log(`    - ${m}`));
  }

  // Context synthesis report
  subBanner('Full Context Synthesis Report');
  const allPatterns = [];
  for (const session of ['day1', 'day2', 'day3', 'day4']) {
    const eps = await reflexion.getRecentEpisodes(session, 10);
    eps.forEach(ep => allPatterns.push({
      task: ep.task,
      reward: ep.reward,
      success: ep.success,
      critique: ep.critique,
      input: ep.input,
      output: ep.output,
    }));
  }

  const fullContext = ContextSynthesizer.synthesize(allPatterns, {
    includeRecommendations: true,
    maxSummaryLength: 800,
  });

  console.log(`  Total memories analyzed: ${fullContext.totalMemories}`);
  console.log(`  Overall success rate   : ${(fullContext.successRate * 100).toFixed(1)}%`);
  console.log(`  Overall avg reward     : ${fullContext.averageReward.toFixed(3)}`);
  console.log(`  Patterns discovered    : ${fullContext.patterns.length}`);
  console.log(`  Key insights           : ${fullContext.keyInsights.length}`);
  console.log(`  Recommendations        : ${fullContext.recommendations.length}`);

  // Final ASCII art
  console.log(`
  +--------------------------------------------------------------------+
  |                                                                    |
  |   Agent Growth:  Junior --> Learning --> Competent --> Expert       |
  |                                                                    |
  |   Day 1: [####..........] 0.45 avg  (fumbling, learning)           |
  |   Day 2: [########......] 0.65 avg  (using past experience)        |
  |   Day 3: [###########...] 0.83 avg  (efficient, skilled)           |
  |   Day 4: [##############] 0.92 avg  (expert, causal reasoning)     |
  |   Day 5: [##############] Teaching mode - exporting knowledge      |
  |                                                                    |
  |   Skills: 0 -> ${skillsCreated.length} | Patterns: 2 -> ${patternStats.totalPatterns} | Causal edges: ${allEdges.length}   |
  |                                                                    |
  +--------------------------------------------------------------------+
  `);

  // Cleanup
  await learning.endSession(day1Session);
  await learning.endSession(day2Session);
  await db.close();

  console.log('  Database closed. Simulation complete.\n');
}

main().then(() => { process.exit(0); }).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
