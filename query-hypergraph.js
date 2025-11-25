#!/usr/bin/env node

/**
 * Hypergraph Query Examples
 *
 * Run specific queries against the knowledge graph
 */

const fs = require('fs');
const path = require('path');

const hypergraph = JSON.parse(fs.readFileSync('knowledge-graph-hypergraph.json', 'utf8'));

// Get command line argument
const query = process.argv[2] || 'help';

console.log('🔎 Hypergraph Query Tool\n');

const queries = {
  help: () => {
    console.log('Available Queries:\n');
    console.log('  node query-hypergraph.js blockchain     - Show all blockchain entities');
    console.log('  node query-hypergraph.js ai-ethics      - Show AI ethics concepts');
    console.log('  node query-hypergraph.js metaverse       - Show metaverse entities');
    console.log('  node query-hypergraph.js connected       - Show most connected entities');
    console.log('  node query-hypergraph.js draft           - Show draft entries needing work');
    console.log('  node query-hypergraph.js high-auth       - Show high-authority entities');
    console.log('  node query-hypergraph.js search <term>   - Search for entities by title');
    console.log('  node query-hypergraph.js entity "<id>"   - Show specific entity details');
    console.log('  node query-hypergraph.js stats           - Show overall statistics');
  },

  blockchain: () => {
    console.log('🔗 Blockchain Entities:\n');
    const blockchain = hypergraph.nodes.filter(n =>
      n.domain === 'blockchain' || n.domain === 'bc'
    );

    console.log(`Total: ${blockchain.length} entities\n`);
    console.log('Sample (10 random):');

    for (let i = 0; i < 10 && i < blockchain.length; i++) {
      const idx = Math.floor(Math.random() * blockchain.length);
      const entity = blockchain[idx];
      console.log(`\n  ${i+1}. ${entity.title}`);
      console.log(`     Authority: ${entity.authorityScore}, Maturity: ${entity.maturity}`);
      console.log(`     Type: ${entity.physicality || 'unknown'}`);
      if (entity.relationships && entity.relationships.length > 0) {
        console.log(`     Relationships: ${entity.relationships.map(r => r.target).join(', ')}`);
      }
    }
  },

  'ai-ethics': () => {
    console.log('🤖 AI Ethics & Governance Concepts:\n');
    const aiEthics = hypergraph.nodes.filter(n =>
      n.domain === 'ai' && (
        n.title.toLowerCase().includes('ethic') ||
        n.title.toLowerCase().includes('governance') ||
        n.title.toLowerCase().includes('fairness') ||
        n.title.toLowerCase().includes('bias') ||
        n.title.toLowerCase().includes('accountability') ||
        n.title.toLowerCase().includes('transparency')
      )
    );

    console.log(`Found: ${aiEthics.length} ethics-related entities\n`);
    aiEthics.forEach((entity, i) => {
      console.log(`${(i+1).toString().padStart(2)}. ${entity.title}`);
      console.log(`    Maturity: ${entity.maturity}, Authority: ${entity.authorityScore}`);
      if (entity.relationships && entity.relationships.length > 0) {
        console.log(`    Links: ${entity.relationships.length} relationships`);
      }
    });
  },

  metaverse: () => {
    console.log('🌐 Metaverse & Virtual World Entities:\n');
    const metaverse = hypergraph.nodes.filter(n =>
      n.domain === 'metaverse' || n.domain === 'mv'
    );

    console.log(`Total: ${metaverse.length} entities\n`);

    // Group by physicality
    const byPhysicality = {};
    metaverse.forEach(e => {
      const type = e.physicality || 'unknown';
      if (!byPhysicality[type]) byPhysicality[type] = [];
      byPhysicality[type].push(e);
    });

    Object.entries(byPhysicality).forEach(([type, entities]) => {
      console.log(`\n${type} (${entities.length}):`);
      entities.slice(0, 5).forEach(e => {
        console.log(`  • ${e.title}`);
      });
      if (entities.length > 5) {
        console.log(`  ... and ${entities.length - 5} more`);
      }
    });
  },

  connected: () => {
    console.log('🔗 Most Connected Entities:\n');
    const connected = hypergraph.nodes
      .filter(n => n.relationships && n.relationships.length > 0)
      .sort((a, b) => b.relationships.length - a.relationships.length)
      .slice(0, 20);

    connected.forEach((node, i) => {
      console.log(`\n${(i+1).toString().padStart(2)}. ${node.title} (${node.relationships.length} links)`);
      console.log(`    Domain: ${node.domainName || node.domain}`);
      console.log(`    Maturity: ${node.maturity}, Authority: ${node.authorityScore}`);
      console.log(`    Connections:`);
      node.relationships.forEach(rel => {
        console.log(`      ${rel.type} → ${rel.target}`);
      });
    });
  },

  draft: () => {
    console.log('📝 Draft Entries Needing Completion:\n');
    const drafts = hypergraph.nodes.filter(n => n.maturity === 'draft');

    console.log(`Total draft entries: ${drafts.length}\n`);

    // Group by domain
    const byDomain = {};
    drafts.forEach(d => {
      if (!byDomain[d.domain]) byDomain[d.domain] = [];
      byDomain[d.domain].push(d);
    });

    console.log('By Domain:');
    Object.entries(byDomain)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([domain, entities]) => {
        console.log(`\n  ${domain} (${entities.length} drafts):`);
        entities.slice(0, 5).forEach(e => {
          console.log(`    • ${e.title} (auth: ${e.authorityScore})`);
        });
        if (entities.length > 5) {
          console.log(`    ... and ${entities.length - 5} more`);
        }
      });
  },

  'high-auth': () => {
    console.log('⭐ High-Authority Entities (≥ 0.9):\n');
    const highAuth = hypergraph.nodes
      .filter(n => n.authorityScore >= 0.9)
      .sort((a, b) => b.authorityScore - a.authorityScore);

    console.log(`Total: ${highAuth.length} high-authority entities\n`);

    highAuth.forEach((node, i) => {
      console.log(`${(i+1).toString().padStart(3)}. ${node.title.padEnd(50)} (${node.authorityScore.toFixed(2)})`);
      console.log(`     Domain: ${(node.domainName || node.domain).padEnd(20)} Maturity: ${node.maturity}`);
      if (i < highAuth.length - 1 && i % 10 === 9) {
        console.log(); // Space every 10
      }
    });
  },

  search: () => {
    const term = process.argv[3];
    if (!term) {
      console.log('Usage: node query-hypergraph.js search <term>\n');
      return;
    }

    console.log(`🔍 Searching for: "${term}"\n`);
    const results = hypergraph.nodes.filter(n =>
      n.title.toLowerCase().includes(term.toLowerCase())
    );

    console.log(`Found ${results.length} matches:\n`);
    results.forEach((node, i) => {
      console.log(`${(i+1).toString().padStart(2)}. ${node.title}`);
      console.log(`    Domain: ${node.domainName || node.domain}`);
      console.log(`    Type: ${node.physicality || 'unknown'}`);
      console.log(`    Maturity: ${node.maturity}, Authority: ${node.authorityScore}`);
      if (node.relationships && node.relationships.length > 0) {
        console.log(`    Relationships: ${node.relationships.length}`);
      }
      console.log();
    });
  },

  entity: () => {
    const id = process.argv[3];
    if (!id) {
      console.log('Usage: node query-hypergraph.js entity "<entity-id>"\n');
      console.log('Example: node query-hypergraph.js entity "Blockchain"\n');
      return;
    }

    const entity = hypergraph.nodes.find(n => n.id === id || n.title === id);
    if (!entity) {
      console.log(`Entity not found: "${id}"\n`);
      console.log('Try searching first: node query-hypergraph.js search <term>');
      return;
    }

    console.log('📄 Entity Details:\n');
    console.log('='.repeat(70));
    console.log(`ID:           ${entity.id}`);
    console.log(`Title:        ${entity.title}`);
    console.log(`Domain:       ${entity.domainName || entity.domain} (${entity.domain})`);
    console.log(`OWL Class:    ${entity.owlClass || 'N/A'}`);
    console.log(`Physicality:  ${entity.physicality || 'unknown'}`);
    console.log(`Role:         ${entity.role || 'N/A'}`);
    console.log(`Maturity:     ${entity.maturity}`);
    console.log(`Status:       ${entity.status}`);
    console.log(`Authority:    ${entity.authorityScore}`);
    console.log(`Quality:      ${entity.qualityScore}`);

    if (entity.relationships && entity.relationships.length > 0) {
      console.log(`\nRelationships (${entity.relationships.length}):`);
      entity.relationships.forEach(rel => {
        console.log(`  ${rel.type.padEnd(12)} → ${rel.target}`);
      });
    } else {
      console.log('\nNo relationships defined.');
    }

    // Find reverse relationships (entities pointing to this one)
    const inbound = hypergraph.edges.filter(e => e.target === entity.id);
    if (inbound.length > 0) {
      console.log(`\nInbound References (${inbound.length}):`);
      inbound.forEach(edge => {
        console.log(`  ${edge.source.padEnd(50)} (${edge.type})`);
      });
    }
  },

  stats: () => {
    console.log('📊 Hypergraph Statistics:\n');
    console.log('='.repeat(70));
    console.log(`Total Nodes:     ${hypergraph.metadata.totalNodes.toLocaleString()}`);
    console.log(`Total Edges:     ${hypergraph.metadata.totalEdges.toLocaleString()}`);
    console.log(`Domains:         ${hypergraph.metadata.domains.length}`);
    console.log(`Generated:       ${new Date(hypergraph.metadata.generatedAt).toLocaleString()}`);

    console.log('\nTop 5 Domains:');
    hypergraph.domains
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .forEach((d, i) => {
        const pct = ((d.count / hypergraph.metadata.totalNodes) * 100).toFixed(1);
        console.log(`  ${i+1}. ${d.name.padEnd(20)} ${d.count.toString().padStart(4)} (${pct}%)`);
      });

    const maturityCounts = {};
    hypergraph.nodes.forEach(n => {
      maturityCounts[n.maturity] = (maturityCounts[n.maturity] || 0) + 1;
    });

    console.log('\nMaturity Distribution:');
    Object.entries(maturityCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([level, count]) => {
        const pct = ((count / hypergraph.metadata.totalNodes) * 100).toFixed(1);
        console.log(`  ${level.padEnd(15)} ${count.toString().padStart(4)} (${pct}%)`);
      });

    const avgAuthority = hypergraph.nodes.reduce((sum, n) => sum + (n.authorityScore || 0), 0) / hypergraph.nodes.length;
    const highAuth = hypergraph.nodes.filter(n => n.authorityScore >= 0.9).length;
    const connected = hypergraph.nodes.filter(n => n.relationships && n.relationships.length > 0).length;

    console.log('\nQuality Metrics:');
    console.log(`  Average Authority:    ${avgAuthority.toFixed(3)}`);
    console.log(`  High Authority (≥0.9): ${highAuth} (${((highAuth/hypergraph.metadata.totalNodes)*100).toFixed(1)}%)`);
    console.log(`  Connected Entities:    ${connected} (${((connected/hypergraph.metadata.totalNodes)*100).toFixed(1)}%)`);
    console.log(`  Relationship Density:  ${(hypergraph.metadata.totalEdges / hypergraph.metadata.totalNodes).toFixed(2)} edges/node`);
  }
};

// Execute query
if (queries[query]) {
  queries[query]();
} else {
  console.log(`Unknown query: "${query}"\n`);
  queries.help();
}
