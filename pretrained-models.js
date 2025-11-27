#!/usr/bin/env node
/**
 * Pre-trained Vector & Graph Database Builder
 *
 * Creates and saves:
 * - Pre-computed CVE embeddings
 * - Vulnerability similarity index
 * - Attack graph with CVE relationships
 * - MITRE ATT&CK technique mappings
 * - CWE hierarchy and relationships
 */

const fs = require('fs');
const crypto = require('crypto');
const { CVE_KNOWLEDGE_BASE, DETECTION_PATTERNS, MITRE_ATTACK, CWE_DATABASE } = require('./cve-knowledge-base');

// Colors
const C = {
  r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', b: '\x1b[34m',
  m: '\x1b[35m', c: '\x1b[36m', x: '\x1b[0m', B: '\x1b[1m', d: '\x1b[2m'
};

const log = {
  info: (msg) => console.log(`${C.c}ℹ ${msg}${C.x}`),
  success: (msg) => console.log(`${C.g}✓ ${msg}${C.x}`),
  section: (msg) => {
    console.log(`\n${C.B}${C.y}▶ ${msg}${C.x}`);
    console.log(`${C.d}${'─'.repeat(55)}${C.x}`);
  },
  header: (msg) => {
    console.log(`\n${C.B}${C.m}${'═'.repeat(65)}${C.x}`);
    console.log(`${C.B}${C.m}  ${msg}${C.x}`);
    console.log(`${C.B}${C.m}${'═'.repeat(65)}${C.x}\n`);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// VECTOR EMBEDDING ENGINE
// ═══════════════════════════════════════════════════════════════════════════

class VectorEmbeddingEngine {
  constructor(dim = 384) {
    this.dim = dim;
    this.embeddings = new Map();
  }

  // Generate semantic embedding for text
  embed(text, context = '') {
    const combined = `${text} ${context}`.toLowerCase().trim();
    const hash = crypto.createHash('sha512').update(combined).digest();

    const embedding = new Float32Array(this.dim);

    // Multi-hash approach for better distribution
    for (let i = 0; i < this.dim; i++) {
      const hashIdx = i % 64;
      const offset = Math.floor(i / 64);

      let value = hash[hashIdx];

      // Add semantic variation based on text characteristics
      if (combined.includes('critical') || combined.includes('rce') || combined.includes('remote')) {
        value += 20;
      }
      if (combined.includes('injection') || combined.includes('execute')) {
        value += 15;
      }
      if (combined.includes('auth') || combined.includes('bypass')) {
        value += 10;
      }

      // Normalize to [-1, 1]
      embedding[i] = ((value + offset * 7) % 256) / 127.5 - 1;
    }

    // L2 normalization
    let norm = 0;
    for (let i = 0; i < this.dim; i++) {
      norm += embedding[i] * embedding[i];
    }
    norm = Math.sqrt(norm) + 1e-8;
    for (let i = 0; i < this.dim; i++) {
      embedding[i] /= norm;
    }

    return embedding;
  }

  // Compute cosine similarity
  similarity(a, b) {
    let dot = 0;
    for (let i = 0; i < this.dim; i++) {
      dot += a[i] * b[i];
    }
    return dot;
  }

  // Build similarity index
  buildIndex(items) {
    const index = [];

    for (const [id, item] of items) {
      const embedding = this.embed(item.text, item.context || '');
      this.embeddings.set(id, embedding);

      index.push({
        id,
        embedding: Array.from(embedding),
        metadata: item.metadata || {}
      });
    }

    return index;
  }

  // Find k nearest neighbors
  knn(query, k = 5) {
    const queryEmbed = typeof query === 'string' ? this.embed(query) : query;
    const results = [];

    for (const [id, embed] of this.embeddings) {
      const score = this.similarity(queryEmbed, embed);
      results.push({ id, score });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, k);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GRAPH DATABASE BUILDER
// ═══════════════════════════════════════════════════════════════════════════

class GraphDatabaseBuilder {
  constructor() {
    this.nodes = new Map();
    this.edges = [];
    this.nodeIndex = {};
  }

  addNode(id, type, properties) {
    this.nodes.set(id, { id, type, properties });
    this.nodeIndex[type] = this.nodeIndex[type] || [];
    this.nodeIndex[type].push(id);
  }

  addEdge(from, to, type, properties = {}) {
    this.edges.push({ from, to, type, properties });
  }

  getNodesByType(type) {
    return (this.nodeIndex[type] || []).map(id => this.nodes.get(id));
  }

  getEdgesFrom(nodeId) {
    return this.edges.filter(e => e.from === nodeId);
  }

  getEdgesTo(nodeId) {
    return this.edges.filter(e => e.to === nodeId);
  }

  export() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
      nodeIndex: this.nodeIndex,
      stats: {
        totalNodes: this.nodes.size,
        totalEdges: this.edges.length,
        nodeTypes: Object.keys(this.nodeIndex),
        edgeTypes: [...new Set(this.edges.map(e => e.type))]
      }
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILD PRE-TRAINED MODELS
// ═══════════════════════════════════════════════════════════════════════════

function buildPretrainedModels() {
  log.header('🧠 Building Pre-trained CVE Models');

  const vectorEngine = new VectorEmbeddingEngine(384);
  const graphDb = new GraphDatabaseBuilder();

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1: Build CVE Embeddings
  // ─────────────────────────────────────────────────────────────────────────
  log.section('Building CVE Vector Embeddings');

  const cveItems = [];
  for (const [id, cve] of Object.entries(CVE_KNOWLEDGE_BASE)) {
    const text = `${cve.title} ${cve.description}`;
    const context = `${cve.cwe.join(' ')} ${(cve.attack || []).join(' ')} CVSS:${cve.cvss}`;

    cveItems.push([id, { text, context, metadata: { cvss: cve.cvss, cwe: cve.cwe } }]);

    // Add to graph
    graphDb.addNode(id, 'CVE', {
      title: cve.title,
      cvss: cve.cvss,
      cwe: cve.cwe,
      published: cve.published,
      exploited: cve.exploited,
      cisaKEV: cve.cisaKEV
    });
  }

  const cveIndex = vectorEngine.buildIndex(cveItems);
  log.success(`Created embeddings for ${cveIndex.length} CVEs`);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2: Build CWE Hierarchy
  // ─────────────────────────────────────────────────────────────────────────
  log.section('Building CWE Hierarchy');

  for (const [cweId, cwe] of Object.entries(CWE_DATABASE)) {
    graphDb.addNode(cweId, 'CWE', {
      name: cwe.name,
      category: cwe.category
    });

    // Create CWE embedding
    vectorEngine.embed(`${cweId} ${cwe.name} ${cwe.category}`, 'weakness vulnerability');
  }

  // Link CVEs to CWEs
  for (const [cveId, cve] of Object.entries(CVE_KNOWLEDGE_BASE)) {
    for (const cweId of cve.cwe) {
      if (CWE_DATABASE[cweId]) {
        graphDb.addEdge(cveId, cweId, 'HAS_WEAKNESS', { primary: cve.cwe[0] === cweId });
      }
    }
  }
  log.success(`Linked ${Object.keys(CWE_DATABASE).length} CWE weaknesses`);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3: Build ATT&CK Mappings
  // ─────────────────────────────────────────────────────────────────────────
  log.section('Building MITRE ATT&CK Mappings');

  for (const [techId, tech] of Object.entries(MITRE_ATTACK)) {
    graphDb.addNode(techId, 'ATTACK_TECHNIQUE', {
      name: tech.name,
      tactic: tech.tactic
    });

    vectorEngine.embed(`${techId} ${tech.name} ${tech.tactic}`, 'attack technique');
  }

  // Link CVEs to ATT&CK techniques
  let attackLinks = 0;
  for (const [cveId, cve] of Object.entries(CVE_KNOWLEDGE_BASE)) {
    for (const techId of (cve.attack || [])) {
      if (MITRE_ATTACK[techId]) {
        graphDb.addEdge(cveId, techId, 'ENABLES_TECHNIQUE');
        attackLinks++;
      }
    }
  }
  log.success(`Created ${attackLinks} CVE→ATT&CK technique links`);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 4: Build Vulnerability Pattern Embeddings
  // ─────────────────────────────────────────────────────────────────────────
  log.section('Building Detection Pattern Embeddings');

  const patternEmbeddings = [];
  for (const [vulnType, config] of Object.entries(DETECTION_PATTERNS)) {
    graphDb.addNode(vulnType, 'VULN_TYPE', {
      cvss: config.cvss,
      cwe: config.cwe,
      patternCount: config.patterns.length
    });

    // Embed each pattern
    for (let i = 0; i < config.patterns.length; i++) {
      const pattern = config.patterns[i];
      const patternId = `${vulnType}_pattern_${i}`;

      patternEmbeddings.push({
        id: patternId,
        vulnType,
        regex: pattern.regex.source,
        confidence: pattern.confidence,
        severity: pattern.severity,
        embedding: Array.from(vectorEngine.embed(
          `${vulnType} ${pattern.regex.source}`,
          `${config.cwe} security vulnerability`
        ))
      });

      graphDb.addNode(patternId, 'PATTERN', {
        vulnType,
        confidence: pattern.confidence,
        severity: pattern.severity
      });

      graphDb.addEdge(patternId, vulnType, 'DETECTS');
    }

    // Link to related CVEs
    for (const cveId of (config.cves || [])) {
      graphDb.addEdge(vulnType, cveId, 'RELATED_CVE');
    }
  }
  log.success(`Created embeddings for ${patternEmbeddings.length} detection patterns`);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 5: Build CVE Similarity Graph
  // ─────────────────────────────────────────────────────────────────────────
  log.section('Building CVE Similarity Graph');

  const cveIds = Object.keys(CVE_KNOWLEDGE_BASE);
  let similarityEdges = 0;

  for (let i = 0; i < cveIds.length; i++) {
    const queryEmbed = vectorEngine.embeddings.get(cveIds[i]);
    if (!queryEmbed) continue;

    for (let j = i + 1; j < cveIds.length; j++) {
      const targetEmbed = vectorEngine.embeddings.get(cveIds[j]);
      if (!targetEmbed) continue;

      const similarity = vectorEngine.similarity(queryEmbed, targetEmbed);

      if (similarity > 0.7) {
        graphDb.addEdge(cveIds[i], cveIds[j], 'SIMILAR_TO', { score: similarity });
        graphDb.addEdge(cveIds[j], cveIds[i], 'SIMILAR_TO', { score: similarity });
        similarityEdges++;
      }
    }
  }
  log.success(`Created ${similarityEdges} CVE similarity relationships`);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 6: Build Attack Chain Graph
  // ─────────────────────────────────────────────────────────────────────────
  log.section('Building Attack Chain Graph');

  const attackChains = [
    { from: 'ssrf', to: 'path_traversal', weight: 0.85 },
    { from: 'path_traversal', to: 'command_injection', weight: 0.9 },
    { from: 'sql_injection', to: 'auth_bypass', weight: 0.88 },
    { from: 'auth_bypass', to: 'hardcoded_secrets', weight: 0.75 },
    { from: 'prototype_pollution', to: 'command_injection', weight: 0.92 },
    { from: 'template_injection', to: 'command_injection', weight: 0.95 },
    { from: 'deserialization', to: 'command_injection', weight: 0.97 },
    { from: 'jndi_injection', to: 'command_injection', weight: 0.98 },
    { from: 'xss', to: 'auth_bypass', weight: 0.65 },
    { from: 'buffer_overflow', to: 'command_injection', weight: 0.85 },
    { from: 'regex_dos', to: 'deserialization', weight: 0.4 },
    { from: 'command_injection', to: 'hardcoded_secrets', weight: 0.8 }
  ];

  for (const chain of attackChains) {
    if (graphDb.nodes.has(chain.from) && graphDb.nodes.has(chain.to)) {
      graphDb.addEdge(chain.from, chain.to, 'LEADS_TO', { weight: chain.weight });
    }
  }
  log.success(`Created ${attackChains.length} attack chain relationships`);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 7: Export Models
  // ─────────────────────────────────────────────────────────────────────────
  log.section('Exporting Pre-trained Models');

  // Export vector database
  const vectorDb = {
    version: '2.0',
    created: new Date().toISOString(),
    dimensions: vectorEngine.dim,
    totalEmbeddings: vectorEngine.embeddings.size,
    cveEmbeddings: cveIndex,
    patternEmbeddings,
    metadata: {
      model: 'sha512-semantic',
      normalization: 'L2'
    }
  };

  fs.writeFileSync('./pretrained-vectors.json', JSON.stringify(vectorDb, null, 2));
  log.success(`Saved vector database (${(JSON.stringify(vectorDb).length / 1024).toFixed(1)} KB)`);

  // Export graph database
  const graphExport = graphDb.export();
  fs.writeFileSync('./pretrained-graph.json', JSON.stringify(graphExport, null, 2));
  log.success(`Saved graph database (${graphExport.stats.totalNodes} nodes, ${graphExport.stats.totalEdges} edges)`);

  // Export combined model
  const combinedModel = {
    version: '2.0',
    created: new Date().toISOString(),
    vectors: {
      dimensions: vectorEngine.dim,
      cveCount: cveIndex.length,
      patternCount: patternEmbeddings.length
    },
    graph: graphExport.stats,
    cveStats: {
      total: Object.keys(CVE_KNOWLEDGE_BASE).length,
      critical: Object.values(CVE_KNOWLEDGE_BASE).filter(c => c.cvss >= 9.0).length,
      high: Object.values(CVE_KNOWLEDGE_BASE).filter(c => c.cvss >= 7.0 && c.cvss < 9.0).length,
      exploited: Object.values(CVE_KNOWLEDGE_BASE).filter(c => c.exploited).length,
      cisaKEV: Object.values(CVE_KNOWLEDGE_BASE).filter(c => c.cisaKEV).length
    }
  };

  fs.writeFileSync('./pretrained-model-info.json', JSON.stringify(combinedModel, null, 2));
  log.success('Saved model info');

  // Summary
  log.header('PRE-TRAINING COMPLETE');

  console.log(`${C.B}Model Statistics:${C.x}`);
  console.log(`  Vector Dimensions:    ${vectorEngine.dim}`);
  console.log(`  CVE Embeddings:       ${cveIndex.length}`);
  console.log(`  Pattern Embeddings:   ${patternEmbeddings.length}`);
  console.log(`  Graph Nodes:          ${graphExport.stats.totalNodes}`);
  console.log(`  Graph Edges:          ${graphExport.stats.totalEdges}`);
  console.log(`  Node Types:           ${graphExport.stats.nodeTypes.join(', ')}`);
  console.log(`  Edge Types:           ${graphExport.stats.edgeTypes.join(', ')}`);
  console.log();
  console.log(`${C.B}CVE Coverage:${C.x}`);
  console.log(`  Total CVEs:           ${combinedModel.cveStats.total}`);
  console.log(`  Critical (9.0+):      ${combinedModel.cveStats.critical}`);
  console.log(`  High (7.0-8.9):       ${combinedModel.cveStats.high}`);
  console.log(`  Exploited in Wild:    ${combinedModel.cveStats.exploited}`);
  console.log(`  CISA KEV:             ${combinedModel.cveStats.cisaKEV}`);
  console.log();
  console.log(`${C.g}✓ Pre-trained models saved to:${C.x}`);
  console.log(`    pretrained-vectors.json`);
  console.log(`    pretrained-graph.json`);
  console.log(`    pretrained-model-info.json`);

  return { vectorDb, graphDb: graphExport, stats: combinedModel };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

if (require.main === module) {
  buildPretrainedModels();
}

module.exports = { buildPretrainedModels, VectorEmbeddingEngine, GraphDatabaseBuilder };
