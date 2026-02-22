/**
 * Example 07 - MongoDB-Style Metadata Filtering
 *
 * Demonstrates agentdb's MetadataFilter with all 10 operators:
 *   $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $contains, $exists
 *
 * Also shows:
 *   - Compound filters combining multiple operators
 *   - Filter validation
 *   - SQL generation with parameterized queries
 *
 * @module examples/intermediate/07-metadata-filter
 */

import { MetadataFilter } from 'agentdb';

// ---------------------------------------------------------------------------
// Dataset: 20 items with diverse metadata
// ---------------------------------------------------------------------------
const dataset = [
  { id: 1,  type: 'episode',  reward: 0.95, tags: ['auth', 'security'],          createdAt: '2025-12-01T10:00:00Z', language: 'javascript', complexity: 3,  reviewed: true,  description: 'Implement JWT auth with refresh tokens' },
  { id: 2,  type: 'skill',    reward: 0.80, tags: ['testing', 'unit'],            createdAt: '2025-12-02T11:30:00Z', language: 'javascript', complexity: 2,  reviewed: true,  description: 'Create unit test suite for API layer' },
  { id: 3,  type: 'pattern',  reward: 0.65, tags: ['design', 'architecture'],     createdAt: '2025-12-03T09:00:00Z', language: 'python',     complexity: 7,  reviewed: false, description: 'Use event sourcing for order management' },
  { id: 4,  type: 'episode',  reward: 0.45, tags: ['database', 'migration'],      createdAt: '2025-12-04T14:15:00Z', language: 'python',     complexity: 5,  reviewed: true,  description: 'Fix database migration rollback failure' },
  { id: 5,  type: 'skill',    reward: 0.90, tags: ['deployment', 'ci-cd'],        createdAt: '2025-12-05T08:45:00Z', language: 'go',         complexity: 4,  reviewed: true,  description: 'Implement blue-green deployment pipeline' },
  { id: 6,  type: 'pattern',  reward: 0.30, tags: ['caching', 'performance'],     createdAt: '2025-12-06T16:00:00Z', language: 'rust',       complexity: 8,  reviewed: false, description: 'Design multi-layer caching strategy' },
  { id: 7,  type: 'episode',  reward: 0.75, tags: ['auth', 'oauth'],              createdAt: '2025-12-07T12:30:00Z', language: 'javascript', complexity: 4,  reviewed: true,  description: 'Integrate OAuth2 PKCE flow' },
  { id: 8,  type: 'skill',    reward: 0.55, tags: ['logging', 'observability'],   createdAt: '2025-12-08T10:00:00Z', language: 'go',         complexity: 3,  reviewed: false, description: 'Set up structured logging with tracing' },
  { id: 9,  type: 'pattern',  reward: 0.85, tags: ['security', 'encryption'],     createdAt: '2025-12-09T15:20:00Z', language: 'rust',       complexity: 9,  reviewed: true,  description: 'Implement end-to-end encryption' },
  { id: 10, type: 'episode',  reward: 0.40, tags: ['api', 'graphql'],             createdAt: '2025-12-10T09:45:00Z', language: 'javascript', complexity: 5,  reviewed: false, description: 'Fix N+1 query issue in GraphQL resolver' },
  { id: 11, type: 'skill',    reward: 0.70, tags: ['testing', 'integration'],     createdAt: '2025-12-11T11:00:00Z', language: 'python',     complexity: 6,  reviewed: true,  description: 'Build integration test framework' },
  { id: 12, type: 'pattern',  reward: 0.60, tags: ['microservices', 'messaging'], createdAt: '2025-12-12T13:30:00Z', language: 'go',         complexity: 7,  reviewed: false, description: 'Use saga pattern for distributed transactions' },
  { id: 13, type: 'episode',  reward: 1.00, tags: ['performance', 'optimization'],createdAt: '2025-12-13T08:00:00Z', language: 'rust',       complexity: 10, reviewed: true,  description: 'Achieve sub-millisecond response times' },
  { id: 14, type: 'skill',    reward: 0.50, tags: ['database', 'indexing'],       createdAt: '2025-12-14T14:00:00Z', language: 'python',     complexity: 4,  reviewed: true,  description: 'Create composite database indexes' },
  { id: 15, type: 'pattern',  reward: 0.35, tags: ['monitoring', 'alerting'],     createdAt: '2025-12-15T10:30:00Z', language: 'javascript', complexity: 3,  reviewed: false, description: 'Design alerting escalation policy' },
  { id: 16, type: 'episode',  reward: 0.88, tags: ['auth', 'security', 'rbac'],   createdAt: '2025-12-16T09:15:00Z', language: 'go',         complexity: 6,  reviewed: true,  description: 'Implement role-based access control' },
  { id: 17, type: 'skill',    reward: 0.72, tags: ['deployment', 'kubernetes'],   createdAt: '2025-12-17T15:45:00Z', language: 'go',         complexity: 8,  reviewed: true,  description: 'Create Kubernetes operator for auto-scaling' },
  { id: 18, type: 'pattern',  reward: 0.10, tags: ['legacy', 'refactoring'],      createdAt: '2025-12-18T12:00:00Z', language: 'javascript', complexity: 2,  reviewed: false },
  { id: 19, type: 'episode',  reward: 0.78, tags: ['api', 'rest', 'versioning'],  createdAt: '2025-12-19T10:00:00Z', language: 'python',     complexity: 5,  reviewed: true,  description: 'Implement API versioning strategy' },
  { id: 20, type: 'skill',    reward: 0.92, tags: ['testing', 'e2e'],             createdAt: '2025-12-20T08:30:00Z', language: 'rust',       complexity: 6,  reviewed: true,  description: 'Use property-based testing for core algorithms' },
];

// ---------------------------------------------------------------------------
// Helper: print filtered results
// ---------------------------------------------------------------------------
function printResults(label, items) {
  console.log(`\n  ${label}`);
  if (items.length === 0) {
    console.log('    (no results)');
    return;
  }
  for (const item of items) {
    const desc = item.description ? item.description.substring(0, 50) : '(no description)';
    console.log(
      `    #${String(item.id).padStart(2)} ` +
      `type=${item.type.padEnd(8)} ` +
      `lang=${item.language.padEnd(11)} ` +
      `reward=${item.reward.toFixed(2)} ` +
      `cx=${String(item.complexity).padStart(2)} ` +
      `"${desc}"`
    );
  }
  console.log(`    => ${items.length} match(es)`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  console.log('='.repeat(72));
  console.log('  Example 07 - MongoDB-Style Metadata Filtering (agentdb)');
  console.log('='.repeat(72));

  console.log(`\n  Dataset: ${dataset.length} items\n`);

  // -----------------------------------------------------------------------
  // Part 1: Individual operator demonstrations
  // -----------------------------------------------------------------------
  console.log('--- Part 1: All 10 Filter Operators ---');

  // 1. $eq - Equal to
  const eqFilter = { type: { $eq: 'episode' } };
  printResults('$eq  -> type equals "episode"', MetadataFilter.apply(dataset, eqFilter));

  // 2. $ne - Not equal to
  const neFilter = { language: { $ne: 'javascript' } };
  printResults('$ne  -> language not "javascript"', MetadataFilter.apply(dataset, neFilter));

  // 3. $gt - Greater than
  const gtFilter = { reward: { $gt: 0.85 } };
  printResults('$gt  -> reward > 0.85', MetadataFilter.apply(dataset, gtFilter));

  // 4. $gte - Greater than or equal
  const gteFilter = { complexity: { $gte: 8 } };
  printResults('$gte -> complexity >= 8', MetadataFilter.apply(dataset, gteFilter));

  // 5. $lt - Less than
  const ltFilter = { reward: { $lt: 0.4 } };
  printResults('$lt  -> reward < 0.4', MetadataFilter.apply(dataset, ltFilter));

  // 6. $lte - Less than or equal
  const lteFilter = { complexity: { $lte: 3 } };
  printResults('$lte -> complexity <= 3', MetadataFilter.apply(dataset, lteFilter));

  // 7. $in - Value in array
  const inFilter = { language: { $in: ['rust', 'go'] } };
  printResults('$in  -> language in ["rust", "go"]', MetadataFilter.apply(dataset, inFilter));

  // 8. $nin - Value not in array
  const ninFilter = { type: { $nin: ['pattern', 'skill'] } };
  printResults('$nin -> type not in ["pattern", "skill"]', MetadataFilter.apply(dataset, ninFilter));

  // 9. $contains - String/array contains value
  const containsFilter = { tags: { $contains: 'auth' } };
  printResults('$contains -> tags contains "auth"', MetadataFilter.apply(dataset, containsFilter));

  // 10. $exists - Field exists
  const existsFilter = { description: { $exists: true } };
  printResults('$exists -> description exists', MetadataFilter.apply(dataset, existsFilter));

  const notExistsFilter = { description: { $exists: false } };
  printResults('$exists -> description does NOT exist', MetadataFilter.apply(dataset, notExistsFilter));

  // -----------------------------------------------------------------------
  // Part 2: Compound filters
  // -----------------------------------------------------------------------
  console.log('\n--- Part 2: Compound Filters ---');

  // High-reward JavaScript episodes
  const compound1 = {
    type: { $eq: 'episode' },
    language: { $eq: 'javascript' },
    reward: { $gte: 0.7 },
  };
  printResults(
    'Compound: type=episode AND language=javascript AND reward>=0.7',
    MetadataFilter.apply(dataset, compound1),
  );

  // Non-JavaScript, reviewed, complexity between 4 and 7
  const compound2 = {
    language: { $nin: ['javascript'] },
    reviewed: true,
    complexity: { $gte: 4, $lte: 7 },
  };
  printResults(
    'Compound: lang not JS AND reviewed=true AND 4<=complexity<=7',
    MetadataFilter.apply(dataset, compound2),
  );

  // Skills or patterns in go/rust with high reward
  const compound3 = {
    type: { $in: ['skill', 'pattern'] },
    language: { $in: ['go', 'rust'] },
    reward: { $gt: 0.6 },
  };
  printResults(
    'Compound: type in [skill,pattern] AND lang in [go,rust] AND reward>0.6',
    MetadataFilter.apply(dataset, compound3),
  );

  // Recently created (after Dec 15) with auth tag
  const compound4 = {
    createdAt: { $gt: '2025-12-15T00:00:00Z' },
    tags: { $contains: 'auth' },
  };
  printResults(
    'Compound: createdAt > Dec 15 AND tags contains "auth"',
    MetadataFilter.apply(dataset, compound4),
  );

  // Everything NOT reviewed with low complexity
  const compound5 = {
    reviewed: false,
    complexity: { $lt: 5 },
  };
  printResults(
    'Compound: reviewed=false AND complexity<5',
    MetadataFilter.apply(dataset, compound5),
  );

  // -----------------------------------------------------------------------
  // Part 3: Filter validation
  // -----------------------------------------------------------------------
  console.log('\n--- Part 3: Filter Validation ---\n');

  const validFilter = {
    type: { $eq: 'episode' },
    reward: { $gte: 0.5 },
  };
  const validResult = MetadataFilter.validate(validFilter);
  console.log(`  Valid filter   : ${JSON.stringify(validFilter)}`);
  console.log(`    valid=${validResult.valid}  errors=${JSON.stringify(validResult.errors)}`);

  const invalidFilter = {
    type: { badOp: 'test' },
    '': { $eq: 'empty field name' },
  };
  const invalidResult = MetadataFilter.validate(invalidFilter);
  console.log(`\n  Invalid filter : ${JSON.stringify(invalidFilter)}`);
  console.log(`    valid=${invalidResult.valid}  errors=${JSON.stringify(invalidResult.errors)}`);

  const anotherInvalid = {
    status: { noDollar: 'missing $ prefix' },
  };
  const anotherResult = MetadataFilter.validate(anotherInvalid);
  console.log(`\n  Invalid filter : ${JSON.stringify(anotherInvalid)}`);
  console.log(`    valid=${anotherResult.valid}  errors=${JSON.stringify(anotherResult.errors)}`);

  // -----------------------------------------------------------------------
  // Part 4: SQL generation
  // -----------------------------------------------------------------------
  console.log('\n--- Part 4: SQL Generation (Parameterized Queries) ---\n');

  const sqlFilters = [
    {
      label: '$eq + $gte',
      filter: { type: { $eq: 'episode' }, reward: { $gte: 0.7 } },
    },
    {
      label: '$in + $lt',
      filter: { language: { $in: ['javascript', 'python'] }, complexity: { $lt: 5 } },
    },
    {
      label: '$ne + $contains',
      filter: { type: { $ne: 'pattern' }, description: { $contains: 'test' } },
    },
    {
      label: '$nin + $exists',
      filter: { language: { $nin: ['rust'] }, description: { $exists: true } },
    },
    {
      label: 'Simple equality',
      filter: { reviewed: true },
    },
    {
      label: '$gt + $lte on metadata paths',
      filter: { 'metadata.score': { $gt: 0.5 }, 'metadata.level': { $lte: 3 } },
    },
    {
      label: 'Range query ($gte + $lt)',
      filter: { reward: { $gte: 0.4, $lt: 0.8 } },
    },
  ];

  for (const { label, filter } of sqlFilters) {
    const { where, params } = MetadataFilter.toSQL(filter, 'episodes');
    console.log(`  Filter: ${label}`);
    console.log(`    Input : ${JSON.stringify(filter)}`);
    console.log(`    WHERE : ${where}`);
    console.log(`    Params: ${JSON.stringify(params)}`);
    console.log();
  }

  // -----------------------------------------------------------------------
  // Part 5: Practical pipeline - chain filter then sort
  // -----------------------------------------------------------------------
  console.log('--- Part 5: Practical Filter Pipeline ---\n');

  // Find reviewed skills in go/rust with reward >= 0.7, sort by reward descending
  const pipelineFilter = {
    type: { $eq: 'skill' },
    language: { $in: ['go', 'rust'] },
    reward: { $gte: 0.7 },
    reviewed: true,
  };

  const pipelineResult = MetadataFilter.apply(dataset, pipelineFilter)
    .sort((a, b) => b.reward - a.reward);

  console.log('  Query: reviewed skills in [go, rust] with reward >= 0.7, sorted by reward:');
  for (const item of pipelineResult) {
    console.log(
      `    #${String(item.id).padStart(2)} ` +
      `${item.language.padEnd(6)} ` +
      `reward=${item.reward.toFixed(2)} ` +
      `tags=${JSON.stringify(item.tags)} ` +
      `"${item.description || ''}"`
    );
  }
  console.log(`    => ${pipelineResult.length} result(s)`);

  // Summary statistics of filtered set
  if (pipelineResult.length > 0) {
    const avgReward = pipelineResult.reduce((s, i) => s + i.reward, 0) / pipelineResult.length;
    const avgComplexity = pipelineResult.reduce((s, i) => s + i.complexity, 0) / pipelineResult.length;
    console.log(`\n  Filtered set stats:`);
    console.log(`    Avg reward    : ${avgReward.toFixed(3)}`);
    console.log(`    Avg complexity: ${avgComplexity.toFixed(1)}`);
  }

  console.log('\n' + '='.repeat(72));
  console.log('  Example 07 complete.');
  console.log('='.repeat(72) + '\n');
}

main();
process.exit(0);
