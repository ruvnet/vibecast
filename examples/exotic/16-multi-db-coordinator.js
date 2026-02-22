#!/usr/bin/env node

/**
 * AgentDB Example 16 - Multi-Database Coordinator (Distributed Simulation)
 *
 * Demonstrates the MultiDatabaseCoordinator for distributed vector database
 * operations. Simulates a 3-instance topology:
 *   - "primary"   : main production database
 *   - "replica-1" : read replica for query offloading
 *   - "replica-2" : analytics replica for batch processing
 *
 * Features demonstrated:
 *   - Instance registration & lifecycle
 *   - Cross-instance synchronization with progress callbacks
 *   - Conflict resolution strategies (last-write-wins, merge)
 *   - Broadcast insert/delete operations
 *   - Health monitoring with status change callbacks
 *   - Distributed operation execution
 *   - Failover simulation
 *   - Statistics and reporting
 *
 * Uses in-memory vector backends (no disk I/O or network required).
 */

import { MultiDatabaseCoordinator } from 'agentdb';

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
// In-Memory VectorBackend that satisfies the VectorBackend interface
// ---------------------------------------------------------------------------
class InMemoryVectorBackend {
  constructor(instanceName, dimension = 384) {
    this._name = 'rvf';  // satisfies the VectorBackend.name type
    this.instanceName = instanceName;
    this.dimension = dimension;
    this.vectors = new Map(); // id -> { embedding, metadata }
  }

  get name() { return this._name; }

  insert(id, embedding, metadata) {
    this.vectors.set(id, { embedding: new Float32Array(embedding), metadata: metadata || {} });
  }

  insertBatch(items) {
    for (const item of items) {
      this.insert(item.id, item.embedding, item.metadata);
    }
  }

  search(query, k, options = {}) {
    const results = [];
    for (const [id, data] of this.vectors) {
      let dot = 0, na = 0, nb = 0;
      for (let i = 0; i < query.length; i++) {
        dot += query[i] * data.embedding[i];
        na += query[i] * query[i];
        nb += data.embedding[i] * data.embedding[i];
      }
      const similarity = dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
      if (options.threshold && similarity < options.threshold) continue;
      results.push({ id, distance: 1 - similarity, similarity, metadata: data.metadata });
    }
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, k);
  }

  remove(id) {
    return this.vectors.delete(id);
  }

  getStats() {
    return {
      count: this.vectors.size,
      dimension: this.dimension,
      metric: 'cosine',
      backend: this._name,
      memoryUsage: this.vectors.size * this.dimension * 4,
    };
  }

  async save(path) {
    // no-op for in-memory
  }

  async load(path) {
    // no-op for in-memory
  }

  close() {
    this.vectors.clear();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const DIM = 384;
const embedder = new MockEmbedder(DIM);

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

function statusIcon(status) {
  switch (status) {
    case 'online':  return '[ONLINE ]';
    case 'offline': return '[OFFLINE]';
    case 'syncing': return '[SYNC.. ]';
    default:        return '[??????]';
  }
}

// ---------------------------------------------------------------------------
// Document corpus
// ---------------------------------------------------------------------------
const DOCUMENTS = [
  'Machine learning fundamentals and gradient descent optimization',
  'Natural language processing with transformer architectures',
  'Computer vision for autonomous vehicle perception systems',
  'Reinforcement learning for robotics manipulation tasks',
  'Federated learning preserving data privacy across institutions',
  'Graph neural networks for molecular property prediction',
  'Generative adversarial networks for image synthesis',
  'Self-supervised learning on unlabeled visual data',
  'Knowledge distillation for model compression on edge devices',
  'Neural architecture search automated model design',
  'Multi-modal learning combining text image and audio',
  'Attention mechanisms and their role in sequence modeling',
  'Bayesian deep learning for uncertainty quantification',
  'Continual learning without catastrophic forgetting',
  'Meta-learning algorithms for few-shot classification',
  'Diffusion models for high-quality image generation',
  'Large language model alignment and safety research',
  'Efficient inference optimization for production ML systems',
  'Causal inference methods for observational studies',
  'Active learning strategies for data-efficient training',
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`
  __  __       _ _   _ ____  ____
 |  \\/  |_   _| | |_(_)  _ \\| __ )
 | |\\/| | | | | | __| | | | |  _ \\
 | |  | | |_| | | |_| | |_| | |_) |
 |_|  |_|\\__,_|_|\\__|_|____/|____/

     Distributed Database Coordinator
     3-Instance Topology Simulation
  `);

  // =========================================================================
  // 1. Create primary vector backend and coordinator
  // =========================================================================
  banner('1. Topology Setup -- Primary + 2 Replicas');

  console.log(`
     +-------------------+
     |     PRIMARY       |  (read/write, source of truth)
     |  primary-db       |
     +--------+----------+
              |
       +------+------+
       |             |
  +----+----+  +-----+---+
  | REPLICA |  | REPLICA  |
  |   #1    |  |   #2     |
  | (read)  |  |(analytics)|
  +---------+  +----------+
  `);

  const primaryBackend = new InMemoryVectorBackend('primary', DIM);

  const coordinator = new MultiDatabaseCoordinator(primaryBackend, {
    replicationFactor: 2,
    syncIntervalMs: 0,  // disable auto-sync (we drive it manually)
    conflictResolution: 'last-write-wins',
    healthCheckIntervalMs: 5000,
    healthCheckTimeoutMs: 2000,
    autoFailover: true,
    maxRetries: 3,
    retryDelayMs: 500,
  });

  const config = coordinator.getConfig();
  console.log('  Coordinator configuration:');
  console.log(`    Replication factor  : ${config.replicationFactor}`);
  console.log(`    Conflict resolution : ${config.conflictResolution}`);
  console.log(`    Auto failover       : ${config.autoFailover}`);
  console.log(`    Max retries         : ${config.maxRetries}`);
  console.log(`    Retry delay         : ${config.retryDelayMs} ms`);

  // =========================================================================
  // 2. Register replica instances
  // =========================================================================
  banner('2. Instance Registration');

  coordinator.registerInstance({
    id: 'replica-1',
    url: 'agentdb://replica-1.internal:8080',
    status: 'online',
    lastSyncAt: 0,
    vectorCount: 0,
    version: '3.0.0-alpha.3',
    metadata: { role: 'read-replica', region: 'us-east-1', priority: 1 },
  });

  coordinator.registerInstance({
    id: 'replica-2',
    url: 'agentdb://replica-2.internal:8080',
    status: 'online',
    lastSyncAt: 0,
    vectorCount: 0,
    version: '3.0.0-alpha.3',
    metadata: { role: 'analytics-replica', region: 'eu-west-1', priority: 2 },
  });

  const instances = coordinator.getInstances();
  console.log(`  Registered ${instances.length} instances:`);
  instances.forEach(inst => {
    console.log(`    ${statusIcon(inst.status)} ${inst.id.padEnd(12)} @ ${inst.url}`);
    console.log(`             version=${inst.version} vectors=${inst.vectorCount}`);
  });

  // =========================================================================
  // 3. Register status change callbacks
  // =========================================================================
  banner('3. Health Monitoring & Status Callbacks');

  const statusLog = [];
  const unsubscribe = coordinator.onInstanceStatusChange((id, oldStatus, newStatus) => {
    const entry = { ts: Date.now(), id, from: oldStatus, to: newStatus };
    statusLog.push(entry);
    console.log(`    [STATUS] ${id}: ${oldStatus} -> ${newStatus}`);
  });

  console.log('  Status change callback registered.');
  console.log('  Online instances: ' + coordinator.getOnlineInstances().map(i => i.id).join(', '));

  // =========================================================================
  // 4. Insert vectors on primary
  // =========================================================================
  banner('4. Primary Database -- Insert Vectors');

  console.log(`  Inserting ${DOCUMENTS.length} document vectors into primary...\n`);

  for (let i = 0; i < DOCUMENTS.length; i++) {
    const embedding = await embedder.embed(DOCUMENTS[i]);
    primaryBackend.insert(`doc-${i}`, embedding, {
      title: DOCUMENTS[i].substring(0, 50),
      category: ['ml', 'nlp', 'cv', 'rl', 'misc'][i % 5],
      priority: Math.floor(i / 4) + 1,
      insertedAt: Date.now(),
    });
  }

  const primaryStats = primaryBackend.getStats();
  console.log(`  Primary stats:`);
  console.log(`    Count     : ${primaryStats.count}`);
  console.log(`    Dimension : ${primaryStats.dimension}`);
  console.log(`    Memory    : ${(primaryStats.memoryUsage / 1024).toFixed(1)} KB`);

  // Verify search on primary
  subBanner('Verify Primary Search');
  const query = await embedder.embed('transformer models for NLP tasks');
  const results = primaryBackend.search(query, 5);
  results.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.id.padEnd(8)} sim=${r.similarity.toFixed(4)} "${(r.metadata?.title || '').toString().substring(0, 45)}"`);
  });

  // =========================================================================
  // 5. Sync to replicas
  // =========================================================================
  banner('5. Synchronization -- Primary to Replicas');

  subBanner('Sync to replica-1 (with progress)');
  const syncResult1 = await coordinator.syncToInstance('replica-1', {
    conflictResolution: 'last-write-wins',
    batchSize: 10,
    onProgress: (progress) => {
      if (progress.phase === 'preparing' || progress.phase === 'completed' || progress.phase === 'error') {
        console.log(`    [${progress.phase.toUpperCase()}] ${progress.message || ''}`);
      }
    },
  });

  console.log(`\n  Sync result (replica-1):`);
  console.log(`    Success          : ${syncResult1.success}`);
  console.log(`    Items synced     : ${syncResult1.itemsSynced}`);
  console.log(`    Conflicts found  : ${syncResult1.conflictsDetected}`);
  console.log(`    Conflicts fixed  : ${syncResult1.conflictsResolved}`);
  console.log(`    Duration         : ${syncResult1.durationMs} ms`);
  console.log(`    Bytes transferred: ${(syncResult1.bytesTransferred / 1024).toFixed(1)} KB`);

  subBanner('Sync to replica-2');
  const syncResult2 = await coordinator.syncToInstance('replica-2', {
    conflictResolution: 'merge',
    batchSize: 20,
  });

  console.log(`  Sync result (replica-2):`);
  console.log(`    Success          : ${syncResult2.success}`);
  console.log(`    Items synced     : ${syncResult2.itemsSynced}`);
  console.log(`    Duration         : ${syncResult2.durationMs} ms`);

  // =========================================================================
  // 6. Sync all instances at once
  // =========================================================================
  banner('6. Sync All -- Batch Synchronization');

  const syncAllResults = await coordinator.syncAll({
    conflictResolution: 'last-write-wins',
    batchSize: 50,
  });

  console.log(`  Synced ${syncAllResults.size} instances:`);
  for (const [id, result] of syncAllResults) {
    console.log(`    ${id.padEnd(12)}: success=${result.success} items=${result.itemsSynced} conflicts=${result.conflictsDetected} time=${result.durationMs}ms`);
  }

  // =========================================================================
  // 7. Broadcast operations
  // =========================================================================
  banner('7. Broadcast Operations -- Write to All Instances');

  subBanner('Broadcast Insert');
  const newDocEmbedding = await embedder.embed('Quantum computing applications in machine learning');
  await coordinator.broadcastInsert('doc-100', newDocEmbedding, {
    title: 'Quantum ML Applications',
    category: 'quantum',
    priority: 1,
    insertedAt: Date.now(),
  });
  console.log('  Broadcast insert: doc-100 "Quantum ML Applications" -> all instances');

  const newDocEmbedding2 = await embedder.embed('Edge computing for real-time AI inference');
  await coordinator.broadcastInsert('doc-101', newDocEmbedding2, {
    title: 'Edge AI Inference',
    category: 'edge',
    priority: 2,
    insertedAt: Date.now(),
  });
  console.log('  Broadcast insert: doc-101 "Edge AI Inference" -> all instances');

  subBanner('Broadcast Delete');
  await coordinator.broadcastDelete('doc-100');
  console.log('  Broadcast delete: doc-100 -> all instances');

  // Verify on primary
  const postDeleteStats = primaryBackend.getStats();
  console.log(`\n  Primary count after broadcast ops: ${postDeleteStats.count}`);

  // =========================================================================
  // 8. Execute distributed operation
  // =========================================================================
  banner('8. Distributed Operation -- Execute on All');

  const opResult = await coordinator.executeOnAll(async (db, instanceId) => {
    const stats = db.getStats();
    return {
      instanceId,
      vectorCount: stats.count,
      memoryMB: (stats.memoryUsage / (1024 * 1024)).toFixed(3),
      healthy: stats.count > 0,
    };
  });

  console.log(`  Distributed operation results:`);
  console.log(`    Successes : ${opResult.successCount}`);
  console.log(`    Failures  : ${opResult.failureCount}`);
  for (const [id, result] of opResult.results) {
    console.log(`    ${id.padEnd(12)}: vectors=${result.vectorCount} memory=${result.memoryMB} MB healthy=${result.healthy}`);
  }
  if (opResult.errors.size > 0) {
    console.log('  Errors:');
    for (const [id, err] of opResult.errors) {
      console.log(`    ${id}: ${err.message}`);
    }
  }

  // =========================================================================
  // 9. Simulate conflict scenario
  // =========================================================================
  banner('9. Conflict Simulation -- Concurrent Writes');

  console.log('  Scenario: Two "writers" update the same vector concurrently.\n');

  // Insert a conflicting vector on primary
  const conflictEmb1 = await embedder.embed('Version A: Updated ML fundamentals');
  primaryBackend.insert('doc-0', conflictEmb1, {
    title: 'ML Fundamentals (Version A)',
    updatedBy: 'writer-1',
    updatedAt: Date.now(),
  });
  console.log('  Writer 1: Updated doc-0 on primary with Version A');

  // Sync with different resolution strategies
  subBanner('Last-Write-Wins Resolution');
  const lwwResult = await coordinator.syncToInstance('replica-1', {
    conflictResolution: 'last-write-wins',
    forceFullSync: true,
  });
  console.log(`  LWW sync: ${lwwResult.success ? 'OK' : 'FAIL'} | items=${lwwResult.itemsSynced} conflicts=${lwwResult.conflictsDetected} resolved=${lwwResult.conflictsResolved}`);

  subBanner('Merge Resolution');
  const mergeResult = await coordinator.syncToInstance('replica-2', {
    conflictResolution: 'merge',
    forceFullSync: true,
  });
  console.log(`  Merge sync: ${mergeResult.success ? 'OK' : 'FAIL'} | items=${mergeResult.itemsSynced} conflicts=${mergeResult.conflictsDetected} resolved=${mergeResult.conflictsResolved}`);

  subBanner('Manual Resolution (generates unresolved list)');
  coordinator.updateConfig({ conflictResolution: 'manual' });
  const manualResult = await coordinator.syncToInstance('replica-1', {
    conflictResolution: 'manual',
    forceFullSync: true,
  });
  console.log(`  Manual sync: ${manualResult.success ? 'OK' : 'FAIL'} | items=${manualResult.itemsSynced} conflicts=${manualResult.conflictsDetected}`);
  if (manualResult.unresolvedConflicts && manualResult.unresolvedConflicts.length > 0) {
    console.log(`  Unresolved conflicts: ${manualResult.unresolvedConflicts.length}`);
    manualResult.unresolvedConflicts.forEach(c => {
      console.log(`    - ${c.vectorId}: suggestion=${c.suggestion} local_ts=${c.local.timestamp} remote_ts=${c.remote.timestamp}`);
    });
  } else {
    console.log('  No unresolved conflicts in this batch (conflict probability is low).');
  }

  // Reset config
  coordinator.updateConfig({ conflictResolution: 'last-write-wins' });

  // =========================================================================
  // 10. Failover simulation
  // =========================================================================
  banner('10. Failover Simulation');

  console.log('  Scenario: replica-1 goes offline, coordinator detects and handles it.\n');

  // Get current instance and manually set offline to simulate failure
  const replica1 = coordinator.getInstanceStatus('replica-1');
  if (replica1) {
    // Simulate going offline by unregistering and re-registering as offline
    coordinator.unregisterInstance('replica-1');
    coordinator.registerInstance({
      ...replica1,
      status: 'offline',
      metadata: { ...replica1.metadata, failedAt: Date.now(), reason: 'network_timeout' },
    });
  }

  console.log('  replica-1 marked offline.');
  console.log('  Current instance status:');
  coordinator.getInstances().forEach(inst => {
    console.log(`    ${statusIcon(inst.status)} ${inst.id.padEnd(12)} vectors=${inst.vectorCount}`);
  });

  // Try to sync to offline replica
  subBanner('Attempt Sync to Offline Replica');
  const failedSync = await coordinator.syncToInstance('replica-1');
  console.log(`  Sync to offline replica-1: success=${failedSync.success} error="${failedSync.error}"`);

  // Sync only to online replicas
  subBanner('Sync to Online Replicas Only');
  const onlineInstances = coordinator.getOnlineInstances();
  console.log(`  Online instances: ${onlineInstances.map(i => i.id).join(', ') || 'none'}`);
  for (const inst of onlineInstances) {
    const result = await coordinator.syncToInstance(inst.id);
    console.log(`  Sync to ${inst.id}: success=${result.success} items=${result.itemsSynced}`);
  }

  // Bring replica-1 back online
  subBanner('Recovery: Bring replica-1 Back Online');
  coordinator.unregisterInstance('replica-1');
  coordinator.registerInstance({
    id: 'replica-1',
    url: 'agentdb://replica-1.internal:8080',
    status: 'online',
    lastSyncAt: 0,
    vectorCount: 0,
    version: '3.0.0-alpha.3',
    metadata: { role: 'read-replica', region: 'us-east-1', priority: 1, recoveredAt: Date.now() },
  });

  console.log('  replica-1 recovered and registered as online.');

  // Full resync after recovery
  const recoverSync = await coordinator.syncToInstance('replica-1', { forceFullSync: true });
  console.log(`  Recovery sync: success=${recoverSync.success} items=${recoverSync.itemsSynced} time=${recoverSync.durationMs}ms`);

  // =========================================================================
  // 11. Statistics and reporting
  // =========================================================================
  banner('11. Coordinator Statistics');

  const stats = coordinator.getStats();
  console.log(`  Primary stats:`);
  console.log(`    Vector count   : ${stats.primaryStats.count}`);
  console.log(`    Dimension      : ${stats.primaryStats.dimension}`);
  console.log(`    Backend        : ${stats.primaryStats.backend}`);
  console.log(`    Memory usage   : ${(stats.primaryStats.memoryUsage / 1024).toFixed(1)} KB`);
  console.log('');
  console.log(`  Cluster stats:`);
  console.log(`    Total instances: ${stats.instanceCount}`);
  console.log(`    Online         : ${stats.onlineCount}`);
  console.log(`    Offline        : ${stats.offlineCount}`);
  console.log(`    Syncing        : ${stats.syncingCount}`);
  console.log(`    Total vectors  : ${stats.totalVectors}`);

  // Instance detail table
  subBanner('Instance Detail');
  const instRows = coordinator.getInstances().map(inst => [
    inst.id,
    inst.status,
    inst.url.substring(0, 35),
    inst.vectorCount,
    inst.version,
    inst.lastSyncAt ? new Date(inst.lastSyncAt).toISOString().substring(11, 19) : 'never',
    inst.metadata?.role || 'n/a',
  ]);
  table(instRows, ['ID', 'Status', 'URL', 'Vectors', 'Version', 'Last Sync', 'Role']);

  // Status change history
  subBanner('Status Change History');
  if (statusLog.length > 0) {
    const logRows = statusLog.map(entry => [
      new Date(entry.ts).toISOString().substring(11, 23),
      entry.id,
      entry.from,
      '->',
      entry.to,
    ]);
    table(logRows, ['Time', 'Instance', 'From', '', 'To']);
  } else {
    console.log('  No status changes recorded (all transitions handled internally).');
  }

  // =========================================================================
  // 12. Configuration management
  // =========================================================================
  banner('12. Configuration Management');

  const currentConfig = coordinator.getConfig();
  console.log('  Current configuration:');
  Object.entries(currentConfig).forEach(([key, value]) => {
    console.log(`    ${key.padEnd(25)} : ${value}`);
  });

  subBanner('Dynamic Config Update');
  coordinator.updateConfig({
    replicationFactor: 3,
    conflictResolution: 'merge',
    maxRetries: 5,
  });
  const updatedConfig = coordinator.getConfig();
  console.log('  Updated configuration:');
  console.log(`    replicationFactor : ${currentConfig.replicationFactor} -> ${updatedConfig.replicationFactor}`);
  console.log(`    conflictResolution: ${currentConfig.conflictResolution} -> ${updatedConfig.conflictResolution}`);
  console.log(`    maxRetries        : ${currentConfig.maxRetries} -> ${updatedConfig.maxRetries}`);

  // =========================================================================
  // 13. Cleanup
  // =========================================================================
  banner('13. Cleanup & Summary');

  // Unsubscribe from status changes
  unsubscribe();
  console.log('  Unsubscribed from status change callbacks.');

  // Stop health checks and auto-sync
  coordinator.stopHealthCheck();
  console.log('  Stopped health check timer.');

  // Close coordinator
  coordinator.close();
  console.log('  Coordinator closed.');

  // Final summary
  console.log(`
  +--------------------------------------------------------------------+
  |                 DISTRIBUTED SIMULATION SUMMARY                     |
  +--------------------------------------------------------------------+
  |                                                                    |
  |  Topology: 1 Primary + 2 Replicas                                 |
  |  Vectors inserted on primary: ${String(primaryStats.count).padEnd(5)}                            |
  |  Broadcast inserts: 2                                              |
  |  Broadcast deletes: 1                                              |
  |  Sync operations: ${String(3 + syncAllResults.size + 3).padEnd(5)}                                        |
  |  Conflict resolutions: LWW, Merge, Manual                         |
  |  Failover tested: replica-1 offline/recovery                       |
  |  Status changes tracked: ${String(statusLog.length).padEnd(5)}                                |
  |                                                                    |
  |  All operations completed successfully.                            |
  +--------------------------------------------------------------------+
  `);

  console.log('  Done. Multi-database coordination demo complete.\n');
}

main().then(() => { process.exit(0); }).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
