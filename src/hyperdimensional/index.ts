/**
 * Hyperdimensional Computing System
 *
 * A complete implementation of Vector Symbolic Architectures for
 * holographic data storage and temporal computing.
 *
 * This is 50-years-ahead technology made practical:
 * - 10,000-dimensional vectors for massive information capacity
 * - Holographic storage where every fragment contains the whole
 * - Temporal databases where time is a storage dimension
 * - Graceful degradation under data loss
 * - Fuzzy/associative retrieval
 *
 * @module hyperdimensional
 */

export { HyperVector } from './hypervector.js';
export { TemporalDatabase } from './temporal-db.js';
export { HolographicStore } from './holographic-store.js';

/**
 * Quick start guide:
 *
 * ```typescript
 * import { HyperVector, TemporalDatabase, HolographicStore } from './hyperdimensional';
 *
 * // Basic encoding
 * const vec = HyperVector.encode({ type: 'sensor', value: 42 });
 *
 * // Temporal storage (time as dimension)
 * const db = new TemporalDatabase();
 * db.store('sensor-1', { temperature: 72 });
 * db.store('sensor-1', { temperature: 73 });
 * const history = db.trajectory('sensor-1');
 *
 * // Holographic storage (fault-tolerant)
 * const store = new HolographicStore(8, 2); // 8 shards, 2x redundancy
 * store.store('data-key', { important: 'information' });
 * store.simulateFailure(0.5); // Lose 50% of shards
 * const recovered = store.retrieve('data-key'); // Still works!
 * ```
 */

/**
 * Core concepts:
 *
 * BINDING (⊗): Combines two concepts
 * - vec1.bind(vec2) creates a new vector unlike either input
 * - Self-inverse: A ⊗ B ⊗ B = A
 * - Used for: key-value pairs, temporal encoding
 *
 * BUNDLING (⊕): Superposition of concepts
 * - HyperVector.bundle([v1, v2, v3]) creates average-like vector
 * - Result is similar to all inputs
 * - Used for: sets, categories, summaries
 *
 * PERMUTATION (ρ): Rotation/sequencing
 * - vec.permute(n) shifts dimensions by n positions
 * - Used for: sequences, time encoding, order
 *
 * SIMILARITY: Cosine/Hamming distance
 * - vec1.similarity(vec2) returns 0-1 (0=orthogonal, 1=identical)
 * - Used for: fuzzy matching, retrieval, cleanup
 */

/**
 * Architecture notes:
 *
 * 1. HyperVector: Foundation class
 *    - 10,000 binary dimensions
 *    - Basic operations: bind, bundle, permute
 *    - Utility: similarity, cleanup, encoding
 *
 * 2. TemporalDatabase: Time as a dimension
 *    - Stores data bound with time vectors
 *    - Time-travel queries
 *    - Temporal interpolation
 *    - Evolution analytics
 *
 * 3. HolographicStore: Fault-tolerant storage
 *    - Fragments data across shards
 *    - Graceful degradation
 *    - Distributed redundancy
 *    - Self-healing properties
 */
