/**
 * Hyperdimensional Computing (HDC) / Vector Symbolic Architecture
 *
 * Implements 10,000-dimensional binary vectors for holographic data storage.
 * Based on Pentti Kanerva's work on sparse distributed memory.
 *
 * Key properties:
 * - High dimensionality enables quasi-orthogonality
 * - Holographic: every part contains info about the whole
 * - Graceful degradation under noise
 * - Associative memory and fuzzy matching
 */

export class HyperVector {
  private static readonly DIMENSIONS = 10000;
  private vector: Uint8Array; // Packed binary representation

  constructor(vector?: Uint8Array) {
    this.vector = vector || new Uint8Array(Math.ceil(HyperVector.DIMENSIONS / 8));
  }

  /**
   * Generate a random hypervector (used for atomic symbols)
   */
  static random(): HyperVector {
    const hv = new HyperVector();
    for (let i = 0; i < hv.vector.length; i++) {
      hv.vector[i] = Math.floor(Math.random() * 256);
    }
    return hv;
  }

  /**
   * Create from semantic data (converts any data to hypervector)
   */
  static encode(data: any): HyperVector {
    const str = JSON.stringify(data);
    const hv = new HyperVector();

    // Use hash-based encoding for deterministic vectors
    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i);
      const index = (charCode * 2654435761) % hv.vector.length; // Fibonacci hash
      hv.vector[index] ^= charCode;
    }

    return hv;
  }

  /**
   * BINDING operation: combines two concepts (XOR)
   * Creates a new vector that contains both inputs
   * A * B ≈ neither A nor B, but recoverable
   */
  bind(other: HyperVector): HyperVector {
    const result = new HyperVector();
    for (let i = 0; i < this.vector.length; i++) {
      result.vector[i] = this.vector[i] ^ other.vector[i];
    }
    return result;
  }

  /**
   * BUNDLING operation: superposition of concepts (majority rule)
   * Creates a vector similar to all inputs
   * A + B ≈ both A and B
   */
  static bundle(vectors: HyperVector[]): HyperVector {
    if (vectors.length === 0) return HyperVector.random();

    const result = new HyperVector();
    const bitCounts = new Array(HyperVector.DIMENSIONS).fill(0);

    // Count bits across all vectors
    for (const vec of vectors) {
      for (let byteIdx = 0; byteIdx < vec.vector.length; byteIdx++) {
        for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
          const dimension = byteIdx * 8 + bitIdx;
          if (dimension >= HyperVector.DIMENSIONS) break;

          const bit = (vec.vector[byteIdx] >> bitIdx) & 1;
          if (bit) bitCounts[dimension]++;
        }
      }
    }

    // Majority vote
    const threshold = vectors.length / 2;
    for (let dim = 0; dim < HyperVector.DIMENSIONS; dim++) {
      if (bitCounts[dim] > threshold) {
        const byteIdx = Math.floor(dim / 8);
        const bitIdx = dim % 8;
        result.vector[byteIdx] |= (1 << bitIdx);
      }
    }

    return result;
  }

  /**
   * PERMUTATION: rotate vector (used for sequences and time)
   * Preserves distance but makes it different
   */
  permute(shifts: number = 1): HyperVector {
    const result = new HyperVector();
    const dimensions = HyperVector.DIMENSIONS;

    for (let dim = 0; dim < dimensions; dim++) {
      const sourceDim = (dim - shifts + dimensions) % dimensions;
      const sourceByte = Math.floor(sourceDim / 8);
      const sourceBit = sourceDim % 8;
      const destByte = Math.floor(dim / 8);
      const destBit = dim % 8;

      const bit = (this.vector[sourceByte] >> sourceBit) & 1;
      if (bit) {
        result.vector[destByte] |= (1 << destBit);
      }
    }

    return result;
  }

  /**
   * SIMILARITY: Hamming distance / cosine similarity
   * Returns value between 0 (orthogonal) and 1 (identical)
   */
  similarity(other: HyperVector): number {
    let matches = 0;
    let total = 0;

    for (let byteIdx = 0; byteIdx < this.vector.length; byteIdx++) {
      const xor = this.vector[byteIdx] ^ other.vector[byteIdx];
      for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
        if (total >= HyperVector.DIMENSIONS) break;
        const bit = (xor >> bitIdx) & 1;
        if (!bit) matches++;
        total++;
      }
    }

    return matches / total;
  }

  /**
   * CLEANUP: Find nearest atomic concept from a codebook
   * Enables holographic retrieval - noisy query returns clean match
   */
  cleanup(codebook: Map<string, HyperVector>): string | null {
    let bestMatch: string | null = null;
    let bestSimilarity = 0;

    for (const [name, vector] of codebook.entries()) {
      const sim = this.similarity(vector);
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestMatch = name;
      }
    }

    return bestSimilarity > 0.4 ? bestMatch : null; // Threshold for recognition
  }

  /**
   * Export as raw buffer (for storage)
   */
  toBuffer(): Uint8Array {
    return this.vector;
  }

  /**
   * Visualize as density (for debugging)
   */
  density(): number {
    let ones = 0;
    for (let i = 0; i < this.vector.length; i++) {
      ones += this.countBits(this.vector[i]);
    }
    return ones / HyperVector.DIMENSIONS;
  }

  /**
   * WEIGHTED BUNDLING: Superposition with importance weighting
   * More important vectors contribute more to the result
   */
  static weightedBundle(vectors: Array<{ vector: HyperVector; weight: number }>): HyperVector {
    if (vectors.length === 0) return HyperVector.random();

    const result = new HyperVector();
    const bitCounts = new Array(HyperVector.DIMENSIONS).fill(0);
    let totalWeight = 0;

    // Weighted bit counting
    for (const { vector, weight } of vectors) {
      totalWeight += weight;
      for (let byteIdx = 0; byteIdx < vector.vector.length; byteIdx++) {
        for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
          const dimension = byteIdx * 8 + bitIdx;
          if (dimension >= HyperVector.DIMENSIONS) break;

          const bit = (vector.vector[byteIdx] >> bitIdx) & 1;
          if (bit) bitCounts[dimension] += weight;
        }
      }
    }

    // Weighted threshold
    const threshold = totalWeight / 2;
    for (let dim = 0; dim < HyperVector.DIMENSIONS; dim++) {
      if (bitCounts[dim] > threshold) {
        const byteIdx = Math.floor(dim / 8);
        const bitIdx = dim % 8;
        result.vector[byteIdx] |= (1 << bitIdx);
      }
    }

    return result;
  }

  /**
   * INVERT: Self-inverse operation (unbinding)
   * In binary HDC, XOR is its own inverse: A * B * B = A
   */
  invert(): HyperVector {
    // In binary, inversion is identity (XOR is self-inverse)
    return this;
  }

  /**
   * FRAGMENT: Get a portion of the vector
   * Used for holographic storage - each fragment still useful
   */
  fragment(startPercent: number, endPercent: number): HyperVector {
    const startDim = Math.floor(HyperVector.DIMENSIONS * startPercent);
    const endDim = Math.floor(HyperVector.DIMENSIONS * endPercent);
    const result = new HyperVector();

    for (let dim = startDim; dim < endDim && dim < HyperVector.DIMENSIONS; dim++) {
      const sourceByte = Math.floor(dim / 8);
      const sourceBit = dim % 8;
      const bit = (this.vector[sourceByte] >> sourceBit) & 1;

      if (bit) {
        const destByte = Math.floor(dim / 8);
        const destBit = dim % 8;
        result.vector[destByte] |= (1 << destBit);
      }
    }

    return result;
  }

  /**
   * HAMMING DISTANCE: Raw distance metric
   */
  hammingDistance(other: HyperVector): number {
    let distance = 0;
    for (let byteIdx = 0; byteIdx < this.vector.length; byteIdx++) {
      const xor = this.vector[byteIdx] ^ other.vector[byteIdx];
      distance += this.countBits(xor);
    }
    return distance;
  }

  /**
   * SERIALIZE: Convert to JSON-compatible format
   */
  toJSON(): any {
    return {
      dimensions: HyperVector.DIMENSIONS,
      vector: Array.from(this.vector),
      density: this.density()
    };
  }

  /**
   * DESERIALIZE: Restore from JSON
   */
  static fromJSON(json: any): HyperVector {
    return new HyperVector(new Uint8Array(json.vector));
  }

  /**
   * CLONE: Create a copy
   */
  clone(): HyperVector {
    return new HyperVector(new Uint8Array(this.vector));
  }

  /**
   * Get dimensionality (static accessor)
   */
  static getDimensions(): number {
    return HyperVector.DIMENSIONS;
  }

  private countBits(n: number): number {
    let count = 0;
    while (n) {
      count += n & 1;
      n >>= 1;
    }
    return count;
  }
}
