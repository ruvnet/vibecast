#!/usr/bin/env node

/**
 * Create Hypergraph from Knowledge Graph API Data
 *
 * This script processes the knowledge graph data from the api/ directory
 * and creates a hypergraph representation showing entities and their relationships.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Knowledge Graph Hypergraph Generator\n');
console.log('='.repeat(70));

// Load the search index
const searchIndexPath = path.join(__dirname, 'kg-temp/api/search-index.json');
console.log(`\nLoading search index from: ${searchIndexPath}`);

let searchIndex;
try {
  const data = fs.readFileSync(searchIndexPath, 'utf8');
  const indexData = JSON.parse(data);
  searchIndex = indexData.documents || [];
  console.log(`✓ Loaded ${searchIndex.length} entries from ${indexData.total_documents} total documents`);
} catch (error) {
  console.error(`✗ Failed to load search index: ${error.message}`);
  process.exit(1);
}

// Analyze the knowledge graph structure
console.log('\n📊 Analyzing Knowledge Graph Structure...\n');

// Extract domains
const domains = new Map();
const entities = new Map();
const relationships = new Set();
const crossDomainLinks = [];

searchIndex.forEach(entry => {
  // Track domains
  if (entry.domain) {
    if (!domains.has(entry.domain)) {
      domains.set(entry.domain, {
        name: entry.domain,
        count: 0,
        entities: []
      });
    }
    domains.get(entry.domain).count++;
    domains.get(entry.domain).entities.push(entry.id);
  }

  // Track entities
  entities.set(entry.id, {
    id: entry.id,
    title: entry.title,
    domain: entry.domain,
    domainName: entry.domain_name,
    owlClass: entry.owl_class,
    physicality: entry.owl_physicality,
    role: entry.owl_role,
    maturity: entry.maturity,
    status: entry.status,
    authorityScore: entry.authority_score,
    qualityScore: entry.quality_score,
    relationships: []
  });

  // Track relationships - subclassOf
  if (entry.is_subclass_of && Array.isArray(entry.is_subclass_of) && entry.is_subclass_of.length > 0) {
    entry.is_subclass_of.forEach(parent => {
      relationships.add(`${entry.id} -> ${parent} [subclassOf]`);
      if (!entities.get(entry.id).relationships) {
        entities.get(entry.id).relationships = [];
      }
      entities.get(entry.id).relationships.push({
        type: 'subclassOf',
        target: parent
      });
    });
  }

  // Track relationships - relatesTo
  if (entry.relates_to && Array.isArray(entry.relates_to) && entry.relates_to.length > 0) {
    entry.relates_to.forEach(related => {
      relationships.add(`${entry.id} -> ${related} [relatesTo]`);
      if (!entities.get(entry.id).relationships) {
        entities.get(entry.id).relationships = [];
      }
      entities.get(entry.id).relationships.push({
        type: 'relatesTo',
        target: related
      });
    });
  }

  // Track cross-domain links
  if (entry.cross_domain_links && entry.cross_domain_links > 0) {
    // Note: The actual links aren't in the array, just the count
    // We can still track that this entity has cross-domain connections
    if (entry.relates_to && Array.isArray(entry.relates_to)) {
      entry.relates_to.forEach(link => {
        // Check if link is from a different domain
        const targetEntity = entities.get(link);
        if (targetEntity && targetEntity.domain !== entry.domain) {
          crossDomainLinks.push({
            source: entry.id,
            sourceDomain: entry.domain,
            target: link,
            targetDomain: targetEntity ? targetEntity.domain : 'unknown',
            type: 'crossDomain'
          });
        }
      });
    }
  }
});

// Display domain statistics
console.log('📈 Domain Distribution:');
console.log('-'.repeat(70));
Array.from(domains.values())
  .sort((a, b) => b.count - a.count)
  .forEach(domain => {
    const bar = '█'.repeat(Math.floor(domain.count / 10));
    console.log(`  ${domain.name.padEnd(20)} ${domain.count.toString().padStart(4)} ${bar}`);
  });

// Analyze OWL Classes
const owlClasses = new Map();
searchIndex.forEach(entry => {
  if (entry.owl_class) {
    owlClasses.set(entry.owl_class, (owlClasses.get(entry.owl_class) || 0) + 1);
  }
});

console.log('\n🏛️  OWL Class Distribution (Top 10):');
console.log('-'.repeat(70));
const owlClassEntries = Array.from(owlClasses.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);
if (owlClassEntries.length > 0) {
  owlClassEntries.forEach(([className, count]) => {
    const bar = '█'.repeat(Math.floor(count / 5));
    console.log(`  ${className.substring(0, 30).padEnd(30)} ${count.toString().padStart(4)} ${bar}`);
  });
} else {
  console.log('  (No OWL class data available)');
}

// Analyze physicality types
const physicalityTypes = new Map();
searchIndex.forEach(entry => {
  if (entry.owl_physicality) {
    physicalityTypes.set(entry.owl_physicality, (physicalityTypes.get(entry.owl_physicality) || 0) + 1);
  }
});

console.log('\n🌐 Physicality Distribution:');
console.log('-'.repeat(70));
Array.from(physicalityTypes.entries())
  .sort((a, b) => b[1] - a[1])
  .forEach(([type, count]) => {
    const bar = '█'.repeat(Math.floor(count / 5));
    console.log(`  ${type.padEnd(30)} ${count.toString().padStart(4)} ${bar}`);
  });

// Build hypergraph structure
console.log('\n🕸️  Building Hypergraph Structure...\n');

const hypergraph = {
  metadata: {
    totalNodes: entities.size,
    totalEdges: relationships.size,
    domains: Array.from(domains.keys()),
    crossDomainLinks: crossDomainLinks.length,
    generatedAt: new Date().toISOString()
  },
  nodes: Array.from(entities.values()),
  edges: Array.from(relationships).map(rel => {
    const match = rel.match(/(.+) -> (.+) \[(.+)\]/);
    return match ? {
      source: match[1],
      target: match[2],
      type: match[3]
    } : null;
  }).filter(Boolean),
  crossDomainLinks: crossDomainLinks,
  domains: Array.from(domains.values())
};

// Save hypergraph to file
const outputPath = path.join(__dirname, 'knowledge-graph-hypergraph.json');
fs.writeFileSync(outputPath, JSON.stringify(hypergraph, null, 2));

console.log('✓ Hypergraph structure created');
console.log(`✓ Output saved to: ${outputPath}`);

// Display statistics
console.log('\n📊 Hypergraph Statistics:');
console.log('-'.repeat(70));
console.log(`  Total Nodes:          ${hypergraph.metadata.totalNodes.toLocaleString()}`);
console.log(`  Total Edges:          ${hypergraph.metadata.totalEdges.toLocaleString()}`);
console.log(`  Cross-Domain Links:   ${hypergraph.metadata.crossDomainLinks.toLocaleString()}`);
console.log(`  Domains:              ${hypergraph.metadata.domains.length}`);

// Analyze maturity levels
const maturityLevels = new Map();
searchIndex.forEach(entry => {
  if (entry.maturity !== undefined) {
    maturityLevels.set(entry.maturity, (maturityLevels.get(entry.maturity) || 0) + 1);
  }
});

console.log('\n📈 Maturity Level Distribution:');
console.log('-'.repeat(70));
Array.from(maturityLevels.entries())
  .sort((a, b) => a[0] - b[0])
  .forEach(([level, count]) => {
    const bar = '█'.repeat(Math.floor(count / 10));
    const stars = '⭐'.repeat(level);
    console.log(`  Level ${level} ${stars.padEnd(15)} ${count.toString().padStart(4)} ${bar}`);
  });

// Show some example entities with high connectivity
console.log('\n🔗 Top Connected Entities:');
console.log('-'.repeat(70));
const connectedEntities = Array.from(entities.values())
  .filter(e => e.relationships && e.relationships.length > 0)
  .sort((a, b) => b.relationships.length - a.relationships.length)
  .slice(0, 10);

connectedEntities.forEach((entity, i) => {
  console.log(`  ${(i + 1).toString().padStart(2)}. ${entity.title.substring(0, 50).padEnd(50)} (${entity.relationships.length} links)`);
});

// Create a simple graph visualization in DOT format
console.log('\n📝 Generating DOT graph visualization...\n');

// Select a subset for visualization (top domains and their connections)
const topDomains = Array.from(domains.values())
  .sort((a, b) => b.count - a.count)
  .slice(0, 5);

let dotGraph = 'digraph KnowledgeGraph {\n';
dotGraph += '  rankdir=LR;\n';
dotGraph += '  node [shape=box, style=rounded];\n\n';

// Add domain clusters
topDomains.forEach(domain => {
  dotGraph += `  subgraph cluster_${domain.name.replace(/[^a-zA-Z0-9]/g, '_')} {\n`;
  dotGraph += `    label="${domain.name}";\n`;
  dotGraph += `    style=filled;\n`;
  dotGraph += `    color=lightgrey;\n`;

  // Add a few sample entities from each domain
  const sampleEntities = domain.entities.slice(0, 5);
  sampleEntities.forEach(entityId => {
    const entity = entities.get(entityId);
    if (entity) {
      const nodeId = entityId.replace(/[^a-zA-Z0-9]/g, '_');
      const label = entity.title.substring(0, 30);
      dotGraph += `    ${nodeId} [label="${label}"];\n`;
    }
  });

  dotGraph += '  }\n\n';
});

// Add cross-domain links
crossDomainLinks.slice(0, 20).forEach(link => {
  const sourceId = link.source.replace(/[^a-zA-Z0-9]/g, '_');
  const targetId = link.target.replace(/[^a-zA-Z0-9]/g, '_');
  dotGraph += `  ${sourceId} -> ${targetId} [style=dashed, color=blue];\n`;
});

dotGraph += '}\n';

const dotPath = path.join(__dirname, 'knowledge-graph.dot');
fs.writeFileSync(dotPath, dotGraph);
console.log(`✓ DOT graph saved to: ${dotPath}`);
console.log('  (Use Graphviz to visualize: dot -Tpng knowledge-graph.dot -o graph.png)');

console.log('\n' + '='.repeat(70));
console.log('\n✅ Hypergraph generation complete!\n');
console.log('📁 Output Files:');
console.log(`   • ${path.basename(outputPath)} - Full hypergraph data (JSON)`);
console.log(`   • ${path.basename(dotPath)} - Graph visualization (DOT format)`);
console.log('\n💡 Next Steps:');
console.log('   • Visualize with Graphviz: dot -Tpng knowledge-graph.dot -o graph.png');
console.log('   • Import hypergraph JSON into graph analysis tools');
console.log('   • Use for semantic search, recommendation systems, or knowledge discovery\n');
