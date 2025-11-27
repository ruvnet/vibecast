# RuVector Experimental Query Library

**Companion Document to Pattern Discovery Report**
**Purpose:** Executable query templates for exploring emergent phenomena

---

## Quick Start: Hybrid Query Patterns

### Pattern 1: Vector-Constrained Graph Traversal

Find graph paths where nodes remain vector-similar along the way:

```cypher
// Semantic consistency check: Find citation chains that don't drift semantically
MATCH path = (start:Paper)-[:CITES*3..5]->(end:Paper)
WHERE vectorSimilarity(start.embedding, end.embedding) > 0.8
WITH path, nodes(path) AS chain
WITH path, chain,
     [i IN range(0, size(chain)-2) |
      vectorSimilarity(chain[i].embedding, chain[i+1].embedding)
     ] AS stepSimilarities
WHERE all(s IN stepSimilarities WHERE s > 0.7)
RETURN path, avg(stepSimilarities) AS avgCoherence
ORDER BY avgCoherence DESC
LIMIT 10
```

---

### Pattern 2: Graph-Constrained Vector Search

Find vector-similar nodes that are also graph-connected:

```cypher
// Hybrid recommendation: Similar songs from same artist collaboration network
MATCH (query:Song {id: 'song123'})
CALL vectorSearch(query.audioEmbedding, topK: 100) YIELD node AS candidate, score
MATCH shortestPath((query)-[:ARTIST]->(artist)<-[:ARTIST]-(candidate))
WHERE score > 0.7
RETURN candidate.title, score, length(shortestPath) AS graphDistance
ORDER BY (0.7 * score + 0.3 / graphDistance) DESC
LIMIT 10
```

---

### Pattern 3: Hyperedge-Induced Vector Clustering

Detect if hyperedge participation creates vector clusters:

```cypher
// Find if recipe ingredients cluster tighter when co-occurring
MATCH (recipe:Recipe)-[:CONTAINS]->(ingredients:Ingredient)
WITH recipe, collect(ingredients) AS ingredientList
WHERE size(ingredientList) >= 4  // Hyperedge: 4+ ingredients
WITH ingredientList,
     [i IN range(0, size(ingredientList)-1) |
      [j IN range(i+1, size(ingredientList)-1) |
       vectorDistance(ingredientList[i].embedding, ingredientList[j].embedding)
      ]
     ] AS pairwiseDistances
WITH flatten(pairwiseDistances) AS distances
RETURN
  avg(distances) AS avgIntraRecipeDistance,
  stddev(distances) AS clustering
ORDER BY clustering ASC
// Low stddev = tight clustering
```

---

### Pattern 4: Attention Weight Path Discovery

Use GNN attention to find implicit relationships:

```cypher
// Discover "hidden collaborators" via attention weights
MATCH (artist:Artist {name: 'Radiohead'})
CALL gnnInference(artist, layers: 3, heads: 4) YIELD node, attentionWeight
WHERE attentionWeight > 0.15
  AND NOT exists((artist)-[:COLLABORATED_WITH*1..3]-(node))
WITH node, attentionWeight,
     vectorSimilarity(artist.audioEmbedding, node.embedding) AS sonicSimilarity
RETURN node.name, attentionWeight, sonicSimilarity
ORDER BY attentionWeight DESC
LIMIT 20
```

---

### Pattern 5: Temporal Drift Detection

Measure embedding drift over time relative to graph changes:

```cypher
// Identify functions whose embeddings drift as their call graph evolves
MATCH (f:Function)
WHERE exists(f.embedding_2023) AND exists(f.embedding_2024)
WITH f,
     vectorDistance(f.embedding_2023, f.embedding_2024) AS drift,
     size((f)-[:CALLS_2023]-()) AS degree_2023,
     size((f)-[:CALLS_2024]-()) AS degree_2024
WITH f, drift, (degree_2024 - degree_2023) AS degreeChange
WHERE drift > 0.3 AND degreeChange > 5
RETURN f.name, drift, degreeChange, drift / degreeChange AS driftRate
ORDER BY driftRate DESC
```

---

## Experiment-Specific Queries

### Experiment 1: Vector-Graph Resonance

**Query 1.1: Measure Lagged Correlation**
```cypher
// Correlate graph centrality at t0 with vector drift at t1
MATCH (n:Node)
WITH n,
     n.centrality_week1 AS c1,
     n.centrality_week2 AS c2,
     n.centrality_week3 AS c3,
     vectorDistance(n.embedding_week1, n.embedding_week2) AS drift_w2,
     vectorDistance(n.embedding_week2, n.embedding_week3) AS drift_w3
RETURN
  correlation(c1, drift_w2) AS lag1_correlation,
  correlation(c1, drift_w3) AS lag2_correlation,
  correlation(c2, drift_w3) AS lag1_correlation_shifted
```

**Query 1.2: Find "Resonance Outliers"**
```cypher
// Nodes with high centrality change but low drift (or vice versa)
MATCH (n:Node)
WITH n,
     abs(n.centrality_t1 - n.centrality_t0) AS centralityDelta,
     vectorDistance(n.embedding_t0, n.embedding_t1) AS drift
WITH n, centralityDelta, drift,
     (centralityDelta - avg(centralityDelta)) / stddev(centralityDelta) AS centralityZ,
     (drift - avg(drift)) / stddev(drift) AS driftZ
WHERE abs(centralityZ - driftZ) > 2.0  // Large discrepancy
RETURN n.id, centralityDelta, drift, centralityZ, driftZ,
       CASE
         WHEN centralityZ > driftZ THEN 'Graph-leading'
         ELSE 'Vector-leading'
       END AS leadIndicator
ORDER BY abs(centralityZ - driftZ) DESC
```

---

### Experiment 2: Topological Clustering Collapse

**Query 2.1: Compute Partition Agreement (NMI)**
```cypher
// Measure how well graph communities match vector clusters
CALL {
  MATCH (n:Node)
  RETURN collect({node: n.id, partition: n.graphCommunity}) AS graphPartition
}
CALL {
  MATCH (n:Node)
  RETURN collect({node: n.id, partition: n.vectorCluster}) AS vectorPartition
}
WITH graphPartition, vectorPartition
RETURN ruvector.metrics.nmi(graphPartition, vectorPartition) AS mutualInformation
// Low NMI (< 0.3) indicates orthogonal partitions
```

**Query 2.2: Find "Bridge Nodes"**
```cypher
// Nodes connecting disparate vector clusters within same graph community
MATCH (bridge:Node)
WHERE bridge.graphCommunity IS NOT NULL
WITH bridge,
     [(bridge)-[:CONNECTED]-(neighbor) WHERE neighbor.graphCommunity = bridge.graphCommunity |
      neighbor.vectorCluster
     ] AS neighborClusters
WHERE size(apoc.coll.toSet(neighborClusters)) >= 3  // Connects 3+ vector clusters
WITH bridge, neighborClusters,
     vectorDistance(bridge.embedding, avg([n IN neighborClusters | n.embedding])) AS centrality
RETURN bridge.id, size(apoc.coll.toSet(neighborClusters)) AS clustersSpanned, centrality
ORDER BY clustersSpanned DESC
```

---

### Experiment 3: Attention-Guided Wormholes

**Query 3.1: Extract Attention Subgraph**
```cypher
// Build explicit attention-weight graph for analysis
MATCH (source:Node)
CALL gnnForward(source, layers: 3) YIELD targetNode, attentionWeights
WITH source, targetNode,
     reduce(totalAttn = 0.0, w IN attentionWeights | totalAttn + w) AS avgAttention
WHERE avgAttention > 0.1
CREATE (source)-[:ATTENDS_TO {weight: avgAttention}]->(targetNode)
```

**Query 3.2: Compare Paths**
```cypher
// For each pair, compare citation path vs attention path
MATCH (a:Paper), (b:Paper)
WHERE id(a) < id(b)  // Avoid duplicates
WITH a, b,
     shortestPath((a)-[:CITES*]-(b)) AS citationPath,
     shortestPath((a)-[:ATTENDS_TO*]-(b)) AS attentionPath
WHERE citationPath IS NOT NULL AND attentionPath IS NOT NULL
WITH a, b,
     length(citationPath) AS citationHops,
     length(attentionPath) AS attentionHops,
     size([n IN nodes(citationPath) WHERE n IN nodes(attentionPath)]) AS overlap
RETURN
  avg(citationHops) AS avgCitationDistance,
  avg(attentionHops) AS avgAttentionDistance,
  avg(overlap * 1.0 / citationHops) AS pathSimilarity
```

**Query 3.3: Discover Wormholes**
```cypher
// Papers with strong attention but no citation link
MATCH (a:Paper)-[:ATTENDS_TO {weight: w}]->(b:Paper)
WHERE w > 0.3
  AND NOT exists((a)-[:CITES*1..5]-(b))
WITH a, b, w,
     vectorSimilarity(a.embedding, b.embedding) AS semanticSim
RETURN a.title, b.title, w AS attentionWeight, semanticSim
ORDER BY attentionWeight DESC
LIMIT 50
```

---

### Experiment 4: Hyperedge Compression

**Query 4.1: Measure Effective Dimensionality**
```cypher
// Compare dimensionality of hyperedge-connected vs isolated nodes
MATCH (h:Hyperedge)-[:CONNECTS]->(participants:Node)
WITH collect(participants.embedding) AS hyperedgeEmbeddings
CALL ruvector.analysis.intrinsicDim(hyperedgeEmbeddings) YIELD dimension AS hyperDim

MATCH (isolated:Node)
WHERE NOT exists((isolated)-[:PART_OF]-(:Hyperedge))
WITH collect(isolated.embedding) AS isolatedEmbeddings
CALL ruvector.analysis.intrinsicDim(isolatedEmbeddings) YIELD dimension AS isoDim

RETURN hyperDim, isoDim, hyperDim / isoDim AS compressionRatio
```

**Query 4.2: Constraint Tightness**
```cypher
// Measure how tightly hyperedge constraints are satisfied
MATCH (h:Hyperedge)-[:CONNECTS]->(nodes:Node)
WITH h, collect(nodes) AS participants
WHERE size(participants) = 4  // 4-way hyperedge
WITH participants,
     vectorDistance(participants[0].embedding, participants[1].embedding) AS d01,
     vectorDistance(participants[1].embedding, participants[2].embedding) AS d12,
     vectorDistance(participants[2].embedding, participants[3].embedding) AS d23,
     vectorDistance(participants[0].embedding, participants[3].embedding) AS d03
WITH h, abs((d01 + d12 + d23) - d03) AS violation
RETURN avg(violation) AS avgConstraintViolation,
       stddev(violation) AS violationVariance
// Low values indicate tight geometric constraints
```

---

### Experiment 5: Temporal Gradient Flow

**Query 5.1: Gradient Alignment**
```cypher
// Measure if citation paths align with embedding space gradients
MATCH path = (start:Paper)-[:CITES*4..6]->(end:Paper)
WHERE start.year < end.year
WITH path, nodes(path) AS chain
WITH chain,
     [i IN range(0, size(chain)-2) |
      vectorDistance(chain[i].embedding, chain[i+1].embedding)
     ] AS stepDrifts,
     vectorDistance(chain[0].embedding, chain[-1].embedding) AS directDrift
WITH chain, stepDrifts, directDrift,
     reduce(s = 0.0, d IN stepDrifts | s + d) AS totalPathDrift
RETURN
  avg(totalPathDrift / directDrift) AS avgTortuosity,
  stddev(totalPathDrift / directDrift) AS tortuosityVariance
// Tortuosity near 1.0 = straight gradient descent
```

**Query 5.2: Predict Future Directions**
```cypher
// Extrapolate citation gradient to predict next papers
MATCH path = (start:Paper {id: 'seminal_paper'})-[:CITES*3..5]->(recent:Paper)
WHERE recent.year = 2024
WITH path, nodes(path) AS chain
WITH chain,
     [i IN range(0, size(chain)-2) |
      ruvector.vector.subtract(chain[i+1].embedding, chain[i].embedding)
     ] AS gradientSteps
WITH chain, gradientSteps,
     reduce(cumulative = chain[0].embedding,
            step IN gradientSteps |
            ruvector.vector.add(cumulative, step)
     ) AS predictedNext
CALL vectorSearch(predictedNext, topK: 10, filter: {year: 2025}) YIELD node, score
RETURN node.title, node.year, score AS predictionConfidence
ORDER BY score DESC
```

---

## Utility Queries

### U1: Build Temporal Snapshots

```cypher
// Create time-sliced snapshots of evolving graph
UNWIND range(0, 52) AS week  // One year, weekly snapshots
WITH week, date('2024-01-01') + duration({weeks: week}) AS snapshotDate
MATCH (n:Node)-[r:RELATIONSHIP]-(m:Node)
WHERE r.timestamp <= snapshotDate
WITH week, snapshotDate, collect({source: n, target: m, rel: r}) AS snapshot
CREATE (s:Snapshot {
  week: week,
  date: snapshotDate,
  nodeCount: size([n IN snapshot | n.source]),
  edgeCount: size(snapshot)
})
```

### U2: Compute Centrality Time Series

```cypher
// Calculate centrality metrics across time
MATCH (n:Node)
UNWIND [0, 1, 2, 3, 4] AS weekOffset
WITH n, weekOffset,
     size((n)-[:REL {week: weekOffset}]-()) AS degree
WITH n, collect(degree) AS degreeTimeSeries
SET n.centralityTimeSeries = degreeTimeSeries
```

### U3: Vector Cluster Assignment

```cypher
// K-means clustering on embeddings
MATCH (n:Node)
WITH collect(n.embedding) AS embeddings, collect(n) AS nodes
CALL ruvector.ml.kmeans(embeddings, {k: 10, iterations: 100}) YIELD assignments
UNWIND range(0, size(nodes)-1) AS i
WITH nodes[i] AS node, assignments[i] AS cluster
SET node.vectorCluster = cluster
```

### U4: Graph Community Detection

```cypher
// Louvain community detection
CALL gds.louvain.write('graph-projection', {
  writeProperty: 'graphCommunity',
  maxLevels: 10,
  tolerance: 0.0001
})
YIELD communityCount, modularity
RETURN communityCount, modularity
```

---

## Performance Optimization Tips

### Tip 1: Index Both Vectors and Properties

```cypher
// Create composite indexes for hybrid queries
CREATE INDEX node_embedding FOR (n:Node) ON (n.embedding)
CREATE INDEX node_timestamp FOR (n:Node) ON (n.timestamp)
CREATE INDEX node_community FOR (n:Node) ON (n.graphCommunity, n.vectorCluster)
```

### Tip 2: Batch Vector Operations

```cypher
// Process in batches to avoid memory issues
CALL apoc.periodic.iterate(
  "MATCH (n:Node) RETURN n",
  "CALL vectorSearch(n.embedding, topK: 10) YIELD node, score
   CREATE (n)-[:SIMILAR_TO {score: score}]->(node)",
  {batchSize: 1000, parallel: true}
)
```

### Tip 3: Precompute Expensive Metrics

```cypher
// Store frequently-used distances
MATCH (n:Node)
WITH n, collect(n) AS allNodes
UNWIND allNodes AS m
WHERE id(n) < id(m)
WITH n, m, vectorDistance(n.embedding, m.embedding) AS dist
WHERE dist < 0.5  // Only store close pairs
CREATE (n)-[:VECTOR_DISTANCE {value: dist}]->(m)
```

---

## Debugging Queries

### D1: Verify Embedding Consistency

```cypher
// Check for NaN, infinity, or zero-magnitude vectors
MATCH (n:Node)
WHERE any(x IN n.embedding WHERE x <> x)  // NaN check
   OR any(x IN n.embedding WHERE x = 1.0/0.0 OR x = -1.0/0.0)  // Infinity
   OR ruvector.vector.magnitude(n.embedding) < 0.001  // Near-zero
RETURN n.id, n.embedding
```

### D2: Analyze Graph Topology

```cypher
// Detect disconnected components
CALL gds.wcc.stream('graph-projection')
YIELD nodeId, componentId
RETURN componentId, count(*) AS componentSize
ORDER BY componentSize DESC
```

### D3: Inspect Attention Weights

```cypher
// Visualize attention distribution
MATCH (n:Node)
CALL gnnInference(n, layers: 2) YIELD node, attentionWeights
RETURN n.id,
       avg(attentionWeights) AS avgAttention,
       stddev(attentionWeights) AS attentionSpread,
       max(attentionWeights) AS maxAttention
```

---

## Next Steps

1. **Choose an experiment** from the Pattern Discovery Report
2. **Adapt these query templates** to your specific dataset
3. **Run queries incrementally** to validate data quality
4. **Measure execution time** and optimize with indexes
5. **Visualize results** using Neo4j Bloom or custom dashboards
6. **Share findings** to advance hybrid vector-graph research

---

**Query Library Version:** 1.0
**Compatible with:** RuVector (verified build), Neo4j 5.x with vector extensions
**Last Updated:** November 27, 2025
