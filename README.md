# vibecast
Weekly Vibecast Live coding sessions with rUv. Check branches for each week.

---

# 🔒 RuVector CVE Security Introspection System

**World's Fastest CVE Security Analysis** using RuVector's advanced capabilities:

- ⚡ **Vector Database** - Similarity-based threat pattern detection
- 🧠 **Graph Neural Networks (GNN)** - Deep pattern recognition with multi-head attention
- 📊 **Attack Graph Analysis** - Centrality-based risk scoring & attack chain discovery
- 🔬 **Self-Learning** - Novel vulnerability discovery via embedding anomaly detection

## 🚀 Quick Start

```bash
# Install dependencies
npx ruvector install --all

# Run comprehensive scan
node ruvector-cve-scanner.js

# Run quick scan
node security-scan.js

# Run GNN threat intelligence
node gnn-threat-intel.js
```

## 📋 Available Scripts

```bash
npm run scan          # Full CVE analysis with all capabilities
npm run scan:quick    # Fast pattern-based scanning
npm run scan:gnn      # GNN-enhanced threat intelligence
npm run scan:all      # Run all scanners sequentially
npm run doctor        # Check ruvector health
```

## 🔍 Detection Capabilities

### Vulnerability Categories
| Category | CWEs | CVSS Range |
|----------|------|------------|
| Command Injection | CWE-78, CWE-94 | 9.1 - 10.0 |
| SQL/NoSQL Injection | CWE-89, CWE-943 | 8.6 - 9.1 |
| XSS (DOM/Reflected) | CWE-79 | 6.1 |
| Path Traversal/LFI | CWE-22, CWE-98 | 7.5 - 9.1 |
| SSRF | CWE-918 | 8.6 |
| Prototype Pollution | CWE-1321 | 9.8 |
| Hardcoded Secrets | CWE-798 | 9.8 |
| Weak Cryptography | CWE-327, CWE-330 | 5.9 |
| Unsafe Deserialization | CWE-502 | 9.8 |
| XXE | CWE-611 | 9.1 |
| ReDoS | CWE-1333 | 7.5 |

### GNN Features
- Multi-head attention (8 heads, 256 dimensions)
- Message passing layers for pattern propagation
- Cosine similarity clustering
- Self-learning anomaly detection

### Attack Graph Analysis
- PageRank-based risk scoring
- BFS/DFS attack chain discovery
- Vulnerability centrality computation
- Mermaid diagram generation

## 📊 Output Files

| File | Description |
|------|-------------|
| `security-report.json` | Quick scan results |
| `gnn-threat-report.json` | GNN analysis with attack graphs |
| `ruvector-cve-report.json` | Comprehensive CVE report |

## 🛡️ CVE Database

Includes patterns for recent critical CVEs:
- CVE-2024-3094 (xz-utils backdoor)
- CVE-2024-4577 (PHP CGI injection)
- CVE-2023-44487 (HTTP/2 Rapid Reset)
- CVE-2023-38545 (curl heap overflow)
- And many more Node.js ecosystem CVEs

## 📈 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  RuVector CVE Scanner                    │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Vector DB    │  │ GNN Layer    │  │ Attack Graph │  │
│  │ (Similarity) │  │ (Attention)  │  │ (PageRank)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │          │
│         └────────────┬────┴─────────────────┘          │
│                      ▼                                  │
│           ┌──────────────────────┐                     │
│           │  Threat Intelligence │                     │
│           │  & Novel Discovery   │                     │
│           └──────────────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

## 📝 License

MIT 
