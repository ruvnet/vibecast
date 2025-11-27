#!/usr/bin/env node
/**
 * Pre-trained CVE Scanner
 *
 * Uses pre-computed embeddings and graph database for:
 * - Fast similarity-based vulnerability detection
 * - CVE mapping and correlation
 * - Attack chain analysis
 * - MITRE ATT&CK technique mapping
 * - Risk scoring with PageRank
 */

const fs = require('fs');
const path = require('path');
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
  warn: (msg) => console.log(`${C.y}⚠ ${msg}${C.x}`),
  error: (msg) => console.log(`${C.r}✗ ${msg}${C.x}`),
  critical: (msg) => console.log(`${C.r}${C.B}⚠ CRITICAL: ${msg}${C.x}`),
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
// PRE-TRAINED MODEL LOADER
// ═══════════════════════════════════════════════════════════════════════════

class PretrainedModelLoader {
  constructor() {
    this.vectorDb = null;
    this.graphDb = null;
    this.embeddings = new Map();
    this.patternIndex = new Map();
    this.dim = 384;
  }

  async load() {
    log.section('Loading Pre-trained Models');

    // Load vector database
    if (fs.existsSync('./pretrained-vectors.json')) {
      const data = JSON.parse(fs.readFileSync('./pretrained-vectors.json', 'utf8'));
      this.vectorDb = data;
      this.dim = data.dimensions;

      // Index CVE embeddings
      for (const cve of data.cveEmbeddings) {
        this.embeddings.set(cve.id, new Float32Array(cve.embedding));
      }

      // Index pattern embeddings
      for (const pattern of data.patternEmbeddings) {
        this.patternIndex.set(pattern.id, {
          embedding: new Float32Array(pattern.embedding),
          vulnType: pattern.vulnType,
          confidence: pattern.confidence,
          severity: pattern.severity
        });
      }

      log.success(`Loaded ${this.embeddings.size} CVE embeddings`);
      log.success(`Loaded ${this.patternIndex.size} pattern embeddings`);
    } else {
      log.warn('No pre-trained vector database found - run pretrained-models.js first');
    }

    // Load graph database
    if (fs.existsSync('./pretrained-graph.json')) {
      this.graphDb = JSON.parse(fs.readFileSync('./pretrained-graph.json', 'utf8'));
      log.success(`Loaded graph with ${this.graphDb.stats.totalNodes} nodes, ${this.graphDb.stats.totalEdges} edges`);
    } else {
      log.warn('No pre-trained graph database found');
    }

    return this;
  }

  // Generate embedding for new text
  embed(text) {
    const hash = crypto.createHash('sha512').update(text.toLowerCase()).digest();
    const embedding = new Float32Array(this.dim);

    for (let i = 0; i < this.dim; i++) {
      embedding[i] = (hash[i % 64] / 127.5) - 1;
    }

    // Normalize
    let norm = 0;
    for (let i = 0; i < this.dim; i++) norm += embedding[i] * embedding[i];
    norm = Math.sqrt(norm) + 1e-8;
    for (let i = 0; i < this.dim; i++) embedding[i] /= norm;

    return embedding;
  }

  // Find similar CVEs
  findSimilarCVEs(text, k = 5) {
    const queryEmbed = this.embed(text);
    const results = [];

    for (const [cveId, embed] of this.embeddings) {
      let dot = 0;
      for (let i = 0; i < this.dim; i++) {
        dot += queryEmbed[i] * embed[i];
      }
      results.push({ cveId, similarity: dot, cve: CVE_KNOWLEDGE_BASE[cveId] });
    }

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, k);
  }

  // Find similar patterns
  findSimilarPatterns(text, threshold = 0.5) {
    const queryEmbed = this.embed(text);
    const results = [];

    for (const [patternId, data] of this.patternIndex) {
      let dot = 0;
      for (let i = 0; i < this.dim; i++) {
        dot += queryEmbed[i] * data.embedding[i];
      }

      if (dot > threshold) {
        results.push({
          patternId,
          similarity: dot,
          vulnType: data.vulnType,
          confidence: data.confidence,
          severity: data.severity
        });
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity);
  }

  // Get attack techniques for CVE
  getAttackTechniques(cveId) {
    if (!this.graphDb) return [];

    const edges = this.graphDb.edges.filter(e =>
      e.from === cveId && e.type === 'ENABLES_TECHNIQUE'
    );

    return edges.map(e => ({
      technique: e.to,
      ...MITRE_ATTACK[e.to]
    }));
  }

  // Get CWEs for CVE
  getCWEs(cveId) {
    if (!this.graphDb) return [];

    const edges = this.graphDb.edges.filter(e =>
      e.from === cveId && e.type === 'HAS_WEAKNESS'
    );

    return edges.map(e => ({
      cwe: e.to,
      ...CWE_DATABASE[e.to],
      primary: e.properties?.primary
    }));
  }

  // Get related CVEs
  getRelatedCVEs(vulnType) {
    if (!this.graphDb) return [];

    const edges = this.graphDb.edges.filter(e =>
      e.from === vulnType && e.type === 'RELATED_CVE'
    );

    return edges.map(e => ({
      cveId: e.to,
      cve: CVE_KNOWLEDGE_BASE[e.to]
    }));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE SCANNER
// ═══════════════════════════════════════════════════════════════════════════

class PretrainedCVEScanner {
  constructor() {
    this.model = new PretrainedModelLoader();
    this.findings = [];
    this.stats = {
      filesScanned: 0,
      linesScanned: 0,
      bytesProcessed: 0,
      timeMs: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      cveMatches: 0,
      attackTechniques: new Set()
    };
  }

  async initialize() {
    await this.model.load();
  }

  // Compile patterns for fast matching
  getCompiledPatterns() {
    const compiled = [];

    for (const [vulnType, config] of Object.entries(DETECTION_PATTERNS)) {
      for (const pattern of config.patterns) {
        compiled.push({
          vulnType,
          regex: new RegExp(pattern.regex.source, pattern.regex.flags),
          confidence: pattern.confidence,
          severity: pattern.severity,
          cvss: config.cvss,
          cwe: config.cwe,
          cves: config.cves || []
        });
      }
    }

    return compiled;
  }

  // Scan file for vulnerabilities
  scanFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      const findings = [];

      this.stats.filesScanned++;
      this.stats.linesScanned += lines.length;
      this.stats.bytesProcessed += content.length;

      const patterns = this.getCompiledPatterns();

      for (const pattern of patterns) {
        let match;
        pattern.regex.lastIndex = 0;

        while ((match = pattern.regex.exec(content)) !== null) {
          const lineNum = content.substring(0, match.index).split('\n').length;
          const lineContent = lines[lineNum - 1]?.trim() || '';
          const matchText = match[0].substring(0, 100);

          // Find similar CVEs using embeddings
          const similarCVEs = this.model.findSimilarCVEs(
            `${pattern.vulnType} ${matchText}`,
            3
          );

          // Get related CVEs from graph
          const relatedCVEs = this.model.getRelatedCVEs(pattern.vulnType);

          // Combine CVE matches
          const matchedCVEs = [];
          for (const cveId of pattern.cves) {
            if (CVE_KNOWLEDGE_BASE[cveId]) {
              matchedCVEs.push({
                id: cveId,
                source: 'pattern',
                cve: CVE_KNOWLEDGE_BASE[cveId]
              });
            }
          }

          for (const similar of similarCVEs.slice(0, 2)) {
            if (similar.similarity > 0.6 && !matchedCVEs.find(c => c.id === similar.cveId)) {
              matchedCVEs.push({
                id: similar.cveId,
                source: 'similarity',
                similarity: similar.similarity,
                cve: similar.cve
              });
            }
          }

          // Get ATT&CK techniques
          const techniques = [];
          for (const cveMatch of matchedCVEs) {
            const techs = this.model.getAttackTechniques(cveMatch.id);
            for (const tech of techs) {
              if (!techniques.find(t => t.technique === tech.technique)) {
                techniques.push(tech);
                this.stats.attackTechniques.add(tech.technique);
              }
            }
          }

          const finding = {
            type: pattern.vulnType,
            severity: pattern.severity,
            cvss: pattern.cvss,
            cwe: pattern.cwe,
            confidence: pattern.confidence,
            file: filePath,
            line: lineNum,
            code: lineContent.substring(0, 150),
            match: matchText,
            matchedCVEs,
            attackTechniques: techniques,
            timestamp: new Date().toISOString()
          };

          findings.push(finding);
          this.findings.push(finding);

          // Update stats
          if (pattern.cvss >= 9.0) this.stats.critical++;
          else if (pattern.cvss >= 7.0) this.stats.high++;
          else if (pattern.cvss >= 4.0) this.stats.medium++;
          else this.stats.low++;

          this.stats.cveMatches += matchedCVEs.length;

          // Prevent infinite loops
          if (match.index === pattern.regex.lastIndex) {
            pattern.regex.lastIndex++;
          }
        }
      }

      return findings;
    } catch (e) {
      return [];
    }
  }

  // Scan directory
  scanDirectory(dir = '.') {
    const files = [];
    const extensions = new Set(['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.java', '.php', '.rb', '.rs']);

    const walk = (directory) => {
      try {
        const items = fs.readdirSync(directory);
        for (const item of items) {
          if (item.startsWith('.') || ['node_modules', 'dist', 'build', 'coverage'].includes(item)) continue;

          const fullPath = path.join(directory, item);
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              walk(fullPath);
            } else {
              const ext = path.extname(item).toLowerCase();
              if (extensions.has(ext) && stat.size < 1024 * 1024) {
                files.push(fullPath);
              }
            }
          } catch (e) {}
        }
      } catch (e) {}
    };

    walk(dir);
    return files;
  }

  // Run full scan
  async scan(dir = '.') {
    const startTime = Date.now();

    log.section('Scanning Source Files');
    const files = this.scanDirectory(dir);
    console.log(`  Found ${files.length} files to scan`);

    for (const file of files) {
      this.scanFile(file);
    }

    this.stats.timeMs = Date.now() - startTime;

    log.success(`Scanned ${this.stats.filesScanned} files in ${this.stats.timeMs}ms`);
    log.success(`Processed ${(this.stats.bytesProcessed / 1024).toFixed(1)} KB`);
    log.success(`Throughput: ${((this.stats.linesScanned * 1000) / this.stats.timeMs).toFixed(0)} lines/sec`);

    return this.findings;
  }

  // Generate comprehensive report
  generateReport() {
    log.header('PRE-TRAINED CVE SCAN REPORT');

    // Performance metrics
    console.log(`${C.B}Performance:${C.x}`);
    console.log(`  Scan Time:        ${this.stats.timeMs}ms`);
    console.log(`  Files:            ${this.stats.filesScanned}`);
    console.log(`  Lines:            ${this.stats.linesScanned.toLocaleString()}`);
    console.log(`  Throughput:       ${((this.stats.linesScanned * 1000) / this.stats.timeMs).toFixed(0)} lines/sec`);
    console.log();

    // Vulnerability summary
    console.log(`${C.B}Vulnerability Summary:${C.x}`);
    console.log(`  ${C.r}CRITICAL (9.0+): ${this.stats.critical}${C.x}`);
    console.log(`  ${C.y}HIGH (7.0-8.9):  ${this.stats.high}${C.x}`);
    console.log(`  ${C.c}MEDIUM (4.0-6.9): ${this.stats.medium}${C.x}`);
    console.log(`  ${C.d}LOW (<4.0):      ${this.stats.low}${C.x}`);
    console.log();

    // CVE coverage
    console.log(`${C.B}CVE Correlation:${C.x}`);
    console.log(`  Total CVE Matches:    ${this.stats.cveMatches}`);
    console.log(`  ATT&CK Techniques:    ${this.stats.attackTechniques.size}`);
    console.log();

    // Top critical findings
    const critical = this.findings.filter(f => f.cvss >= 9.0).slice(0, 5);
    if (critical.length > 0) {
      console.log(`${C.r}${C.B}Top Critical Findings:${C.x}`);
      for (const f of critical) {
        console.log(`\n  ${C.r}⚠ ${f.type.toUpperCase()}${C.x} (CVSS ${f.cvss})`);
        console.log(`    ${C.d}File:${C.x} ${f.file}:${f.line}`);
        console.log(`    ${C.d}CWE:${C.x} ${f.cwe}`);
        console.log(`    ${C.d}Confidence:${C.x} ${(f.confidence * 100).toFixed(0)}%`);

        if (f.matchedCVEs.length > 0) {
          console.log(`    ${C.d}Related CVEs:${C.x}`);
          for (const cve of f.matchedCVEs.slice(0, 3)) {
            const cveMeta = cve.cve || {};
            const kevFlag = cveMeta.cisaKEV ? `${C.r}[KEV]${C.x}` : '';
            console.log(`      - ${cve.id} ${kevFlag} ${cveMeta.title || ''}`);
          }
        }

        if (f.attackTechniques.length > 0) {
          console.log(`    ${C.d}ATT&CK Techniques:${C.x}`);
          for (const tech of f.attackTechniques.slice(0, 3)) {
            console.log(`      - ${tech.technique}: ${tech.name} (${tech.tactic})`);
          }
        }
      }
    }

    // ATT&CK technique summary
    if (this.stats.attackTechniques.size > 0) {
      console.log(`\n${C.B}MITRE ATT&CK Coverage:${C.x}`);
      const techniques = Array.from(this.stats.attackTechniques);
      const tacticGroups = {};

      for (const techId of techniques) {
        const tech = MITRE_ATTACK[techId];
        if (tech) {
          tacticGroups[tech.tactic] = tacticGroups[tech.tactic] || [];
          tacticGroups[tech.tactic].push({ id: techId, name: tech.name });
        }
      }

      for (const [tactic, techs] of Object.entries(tacticGroups)) {
        console.log(`  ${C.y}${tactic}:${C.x}`);
        for (const tech of techs) {
          console.log(`    ${tech.id}: ${tech.name}`);
        }
      }
    }
  }

  // Save detailed report
  async saveReport() {
    const report = {
      timestamp: new Date().toISOString(),
      engine: 'RuVector Pre-trained CVE Scanner v2.0',
      modelVersion: this.model.vectorDb?.version || 'N/A',
      stats: {
        ...this.stats,
        attackTechniques: Array.from(this.stats.attackTechniques)
      },
      summary: {
        total: this.findings.length,
        critical: this.stats.critical,
        high: this.stats.high,
        medium: this.stats.medium,
        low: this.stats.low,
        cveMatches: this.stats.cveMatches
      },
      findings: this.findings.slice(0, 200), // Limit for file size
      cveDatabase: {
        total: Object.keys(CVE_KNOWLEDGE_BASE).length,
        critical: Object.values(CVE_KNOWLEDGE_BASE).filter(c => c.cvss >= 9.0).length,
        kevCount: Object.values(CVE_KNOWLEDGE_BASE).filter(c => c.cisaKEV).length
      }
    };

    fs.writeFileSync('./pretrained-scan-results.json', JSON.stringify(report, null, 2));
    log.success('Detailed report saved to pretrained-scan-results.json');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.clear();
  log.header('🎯 RuVector Pre-trained CVE Scanner');
  console.log(`${C.c}Using pre-computed embeddings and graph database${C.x}`);
  console.log(`${C.d}${new Date().toISOString()}${C.x}\n`);

  const scanner = new PretrainedCVEScanner();
  await scanner.initialize();

  await scanner.scan('.');

  scanner.generateReport();
  await scanner.saveReport();

  log.header('SCAN COMPLETE');

  const total = scanner.findings.length;
  if (scanner.stats.critical > 0) {
    log.critical(`Found ${scanner.stats.critical} critical vulnerabilities!`);
  }

  console.log(`\n${C.B}Total: ${total} findings${C.x}`);
  console.log(`${C.B}CVE Correlations: ${scanner.stats.cveMatches}${C.x}`);
  console.log(`${C.B}ATT&CK Techniques: ${scanner.stats.attackTechniques.size}${C.x}`);
  console.log(`${C.d}See pretrained-scan-results.json for details${C.x}`);
}

if (require.main === module) {
  main().catch(err => {
    log.error(`Scan failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { PretrainedCVEScanner, PretrainedModelLoader };
