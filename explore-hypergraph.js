#!/usr/bin/env node

/**
 * Interactive Hypergraph Explorer
 *
 * Explore the knowledge graph hypergraph with interactive queries
 */

const fs = require('fs');
const path = require('path');

// Load hypergraph
const hypergraphPath = path.join(__dirname, 'knowledge-graph-hypergraph.json');
const hypergraph = JSON.parse(fs.readFileSync(hypergraphPath, 'utf8'));

console.log('🔍 Knowledge Graph Hypergraph Explorer\n');
console.log('='.repeat(70));

// Display metadata
console.log('\n📊 Hypergraph Metadata:');
console.log('-'.repeat(70));
console.log(`Total Nodes:      ${hypergraph.metadata.totalNodes.toLocaleString()}`);
console.log(`Total Edges:      ${hypergraph.metadata.totalEdges.toLocaleString()}`);
console.log(`Domains:          ${hypergraph.metadata.domains.length}`);
console.log(`Generated:        ${new Date(hypergraph.metadata.generatedAt).toLocaleString()}`);

// Domain stats
console.log('\n🌐 Domain Distribution:');
console.log('-'.repeat(70));
hypergraph.domains
  .sort((a, b) => b.count - a.count)
  .forEach((domain, i) => {
    const bar = '█'.repeat(Math.floor(domain.count / 10));
    const pct = ((domain.count / hypergraph.metadata.totalNodes) * 100).toFixed(1);
    console.log(`${(i+1).toString().padStart(2)}. ${domain.name.padEnd(25)} ${domain.count.toString().padStart(4)} (${pct.padStart(5)}%) ${bar}`);
  });

// Find most connected nodes
console.log('\n🔗 Most Connected Entities (Top 15):');
console.log('-'.repeat(70));
const connectedNodes = hypergraph.nodes
  .filter(n => n.relationships && n.relationships.length > 0)
  .sort((a, b) => b.relationships.length - a.relationships.length)
  .slice(0, 15);

connectedNodes.forEach((node, i) => {
  const title = node.title.substring(0, 45).padEnd(45);
  const domain = (node.domainName || node.domain).substring(0, 18).padEnd(18);
  const links = node.relationships.length;
  console.log(`${(i+1).toString().padStart(2)}. ${title} ${domain} (${links} links)`);
});

// Maturity analysis
console.log('\n📈 Maturity Level Analysis:');
console.log('-'.repeat(70));
const maturityCounts = {};
hypergraph.nodes.forEach(n => {
  maturityCounts[n.maturity] = (maturityCounts[n.maturity] || 0) + 1;
});

Object.entries(maturityCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([level, count]) => {
    const bar = '█'.repeat(Math.floor(count / 10));
    const pct = ((count / hypergraph.metadata.totalNodes) * 100).toFixed(1);
    console.log(`${level.padEnd(15)} ${count.toString().padStart(4)} (${pct.padStart(5)}%) ${bar}`);
  });

// Physicality distribution
console.log('\n🎯 Physicality Types:');
console.log('-'.repeat(70));
const physicalityCounts = {};
hypergraph.nodes.forEach(n => {
  const type = n.physicality || 'unknown';
  physicalityCounts[type] = (physicalityCounts[type] || 0) + 1;
});

Object.entries(physicalityCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([type, count]) => {
    const bar = '█'.repeat(Math.floor(count / 15));
    const pct = ((count / hypergraph.metadata.totalNodes) * 100).toFixed(1);
    console.log(`${type.padEnd(25)} ${count.toString().padStart(4)} (${pct.padStart(5)}%) ${bar}`);
  });

// Authority score distribution
console.log('\n⭐ Authority Score Distribution:');
console.log('-'.repeat(70));
const authBuckets = {
  '0.0-0.2': 0,
  '0.2-0.4': 0,
  '0.4-0.6': 0,
  '0.6-0.8': 0,
  '0.8-1.0': 0
};

hypergraph.nodes.forEach(n => {
  const score = n.authorityScore || 0;
  if (score < 0.2) authBuckets['0.0-0.2']++;
  else if (score < 0.4) authBuckets['0.2-0.4']++;
  else if (score < 0.6) authBuckets['0.4-0.6']++;
  else if (score < 0.8) authBuckets['0.6-0.8']++;
  else authBuckets['0.8-1.0']++;
});

Object.entries(authBuckets).forEach(([range, count]) => {
  const bar = '█'.repeat(Math.floor(count / 20));
  const pct = ((count / hypergraph.metadata.totalNodes) * 100).toFixed(1);
  console.log(`${range.padEnd(10)} ${count.toString().padStart(4)} (${pct.padStart(5)}%) ${bar}`);
});

// Sample entities from each domain
console.log('\n📚 Sample Entities by Domain:');
console.log('='.repeat(70));

const domainsToShow = ['ai', 'blockchain', 'metaverse', 'rb'];
domainsToShow.forEach(domainCode => {
  const domainEntities = hypergraph.nodes.filter(n => n.domain === domainCode);
  if (domainEntities.length === 0) return;

  const domainInfo = hypergraph.domains.find(d => d.name === domainCode);
  const domainName = domainInfo ? domainInfo.name : domainCode;

  console.log(`\n📂 ${domainName.toUpperCase()} (${domainEntities.length} entities)`);
  console.log('-'.repeat(70));

  // Show 5 random samples
  const samples = [];
  for (let i = 0; i < 5 && i < domainEntities.length; i++) {
    const randomIdx = Math.floor(Math.random() * domainEntities.length);
    const entity = domainEntities[randomIdx];
    if (!samples.find(s => s.id === entity.id)) {
      samples.push(entity);
    }
  }

  samples.forEach((entity, i) => {
    console.log(`\n  ${i+1}. ${entity.title}`);
    console.log(`     Type: ${entity.physicality || 'unknown'}`);
    console.log(`     Maturity: ${entity.maturity}, Authority: ${entity.authorityScore}`);
    if (entity.relationships && entity.relationships.length > 0) {
      console.log(`     Relationships: ${entity.relationships.length}`);
      entity.relationships.slice(0, 2).forEach(rel => {
        console.log(`       - ${rel.type}: ${rel.target}`);
      });
    }
  });
});

// Relationship analysis
console.log('\n\n🔗 Relationship Type Analysis:');
console.log('='.repeat(70));

const relationshipTypes = {};
hypergraph.edges.forEach(edge => {
  relationshipTypes[edge.type] = (relationshipTypes[edge.type] || 0) + 1;
});

console.log('\nEdge Types:');
Object.entries(relationshipTypes)
  .sort((a, b) => b[1] - a[1])
  .forEach(([type, count]) => {
    const bar = '█'.repeat(Math.floor(count / 10));
    const pct = ((count / hypergraph.metadata.totalEdges) * 100).toFixed(1);
    console.log(`  ${type.padEnd(15)} ${count.toString().padStart(4)} (${pct.padStart(5)}%) ${bar}`);
  });

// Find interesting patterns
console.log('\n\n🎯 Interesting Patterns:');
console.log('='.repeat(70));

// Most mature domains
const domainMaturity = {};
hypergraph.nodes.forEach(n => {
  if (!domainMaturity[n.domain]) {
    domainMaturity[n.domain] = { mature: 0, draft: 0, total: 0 };
  }
  domainMaturity[n.domain].total++;
  if (n.maturity === 'mature') domainMaturity[n.domain].mature++;
  if (n.maturity === 'draft') domainMaturity[n.domain].draft++;
});

console.log('\nMost Mature Domains:');
Object.entries(domainMaturity)
  .map(([domain, stats]) => ({
    domain,
    maturePct: (stats.mature / stats.total) * 100,
    total: stats.total
  }))
  .filter(d => d.total > 10) // Only domains with 10+ entities
  .sort((a, b) => b.maturePct - a.maturePct)
  .slice(0, 5)
  .forEach((d, i) => {
    console.log(`  ${i+1}. ${d.domain.padEnd(20)} ${d.maturePct.toFixed(1)}% mature (${d.total} entities)`);
  });

console.log('\nLeast Mature Domains (need attention):');
Object.entries(domainMaturity)
  .map(([domain, stats]) => ({
    domain,
    draftPct: (stats.draft / stats.total) * 100,
    total: stats.total
  }))
  .filter(d => d.total > 10)
  .sort((a, b) => b.draftPct - a.draftPct)
  .slice(0, 5)
  .forEach((d, i) => {
    console.log(`  ${i+1}. ${d.domain.padEnd(20)} ${d.draftPct.toFixed(1)}% draft (${d.total} entities)`);
  });

// High authority entities
console.log('\n\n⭐ High Authority Entities (Authority ≥ 0.9):');
console.log('-'.repeat(70));
const highAuth = hypergraph.nodes
  .filter(n => n.authorityScore >= 0.9)
  .sort((a, b) => b.authorityScore - a.authorityScore)
  .slice(0, 10);

highAuth.forEach((node, i) => {
  console.log(`${(i+1).toString().padStart(2)}. ${node.title.substring(0, 50).padEnd(50)} (${node.authorityScore.toFixed(2)})`);
  console.log(`    Domain: ${node.domainName || node.domain}, Maturity: ${node.maturity}`);
});

// Cross-domain potential
console.log('\n\n🌉 Cross-Domain Connection Potential:');
console.log('-'.repeat(70));
console.log('Entities with relationships could link across domains:\n');

const potentialCrossDomain = hypergraph.nodes
  .filter(n => n.relationships && n.relationships.length >= 2)
  .slice(0, 5);

potentialCrossDomain.forEach((node, i) => {
  console.log(`${i+1}. ${node.title} (${node.domain})`);
  console.log(`   Has ${node.relationships.length} relationships:`);
  node.relationships.forEach(rel => {
    console.log(`   - ${rel.type}: ${rel.target}`);
  });
  console.log();
});

// Summary
console.log('\n' + '='.repeat(70));
console.log('\n✨ Exploration Summary:');
console.log(`   • ${hypergraph.metadata.totalNodes.toLocaleString()} total entities across ${hypergraph.metadata.domains.length} domains`);
console.log(`   • ${hypergraph.metadata.totalEdges.toLocaleString()} relationships mapping knowledge connections`);
console.log(`   • ${connectedNodes.length} well-connected hub entities`);
console.log(`   • ${highAuth.length} high-authority validated concepts`);
console.log(`   • ${maturityCounts.draft || 0} draft entries ready for refinement`);
console.log('\n💡 Next Steps:');
console.log('   • Use ruvector-hypergraph-fixed.js for semantic search');
console.log('   • Visualize with: dot -Tpng knowledge-graph.dot -o graph.png');
console.log('   • Import into Neo4j/ArangoDB for graph analysis');
console.log('   • Complete draft entries to improve coverage\n');
