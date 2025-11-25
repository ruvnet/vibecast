#!/usr/bin/env node

/**
 * Generate Realistic Microbiome Test Data
 *
 * Creates synthetic 16S rRNA sequences based on known bacterial taxa
 * with realistic variation patterns for benchmarking
 */

const fs = require('fs');
const path = require('path');

// Known 16S rRNA conserved regions (from literature)
const CONSERVED_REGIONS = {
  V1: 'AGAGTTTGATCCTGGCTCAG',
  V2: 'TGCCAGCAGCCGCGGTAA',
  V3: 'CCTACGGGAGGCAGCAG',
  V4: 'GTGCCAGCMGCCGCGGTAA',
  V5: 'CCGTCAATTCMTTTRAGTTT',
  V6: 'GAATTGACGGGGGCCCGCACAAG',
  V7: 'CGTCAGCTCGTGYYGTGAGA',
  V8: 'GGTTACCTTGTTACGACTT',
  V9: 'GCCCCGTCAATTCCTTTG'
};

// Bacterial taxa with characteristic sequences
const BACTERIAL_TAXA = {
  'Escherichia coli': {
    genus: 'Escherichia',
    family: 'Enterobacteriaceae',
    phylum: 'Proteobacteria',
    v4_signature: 'TACGTAGGTCCCAAGCGTTGTCCGGATTTATTGGGCGTAAAGAGCGCGTAGGTGGTTTGATAAGTCAGAGGTGAAAGCGGAATTGCTA'
  },
  'Bacteroides fragilis': {
    genus: 'Bacteroides',
    family: 'Bacteroidaceae',
    phylum: 'Bacteroidetes',
    v4_signature: 'TACGGAGGGTGCAAGCGTTAATCGGAATTACTGGGCGTAAAGCGCGCGTAGGTGGTTTGTTAAGTCAGATGTGAAATCCCCGAGCTC'
  },
  'Lactobacillus acidophilus': {
    genus: 'Lactobacillus',
    family: 'Lactobacillaceae',
    phylum: 'Firmicutes',
    v4_signature: 'TACGTAGGGGGCAAGCGTTATCCGGAATTATTGGGCGTAAAGCGAGCGCAGGCGGTTTCTTAAGTCTGATGTGAAAGCCCCCGGCTC'
  },
  'Bifidobacterium longum': {
    genus: 'Bifidobacterium',
    family: 'Bifidobacteriaceae',
    phylum: 'Actinobacteria',
    v4_signature: 'TACGGAAGGTCCGGGCGTTATCCGGATTTATTGGGTTTAAAGGGTGCGTAGGCGGCCTGCCAAGTCAGCGGTGAAATGCGGTGGCTC'
  },
  'Clostridium difficile': {
    genus: 'Clostridium',
    family: 'Clostridiaceae',
    phylum: 'Firmicutes',
    v4_signature: 'TACGCAGGGGGCGAGCGTTGTCCGGAATTATTGGGCGTAAAGGGCTTGCAGACGGGTTCAAGTGAGATATGAAAGTTCGGGGCTCAA'
  },
  'Akkermansia muciniphila': {
    genus: 'Akkermansia',
    family: 'Akkermansiaceae',
    phylum: 'Verrucomicrobia',
    v4_signature: 'TACGTAGGGCGCGAGCGTTGTCCGGAATTATTGGGCGTAAAGGGCGCGCAGGCGGTTGGTTAAGTCTGATGTGAAAGCCCTGGGCTT'
  },
  'Prevotella copri': {
    genus: 'Prevotella',
    family: 'Prevotellaceae',
    phylum: 'Bacteroidetes',
    v4_signature: 'TACGGAGGGTGCGAGCGTTAATCGGAATTACTGGGCGTAAAGCGTGCGTAGGCGGTTTATTAAGTCGGATGTGAAAGCCCCGGGCTC'
  },
  'Streptococcus thermophilus': {
    genus: 'Streptococcus',
    family: 'Streptococcaceae',
    phylum: 'Firmicutes',
    v4_signature: 'TACGTAGGGTGCAAGCGTTGTCCGGAATTACTGGGTGTAAAGGGAGCGTAGACGGCAAGACAAGTCTGAAGTGAAAACCCAGGGCTC'
  },
  'Faecalibacterium prausnitzii': {
    genus: 'Faecalibacterium',
    family: 'Ruminococcaceae',
    phylum: 'Firmicutes',
    v4_signature: 'TACGCAGGGTGCAAGCGTTAATCGGAATTACTGGGCGTAAAGCGTGCGTAGGCGGTTTATAAAGTCTGGAGTGAAAGCCCCGGGCTC'
  },
  'Methanobrevibacter smithii': {
    genus: 'Methanobrevibacter',
    family: 'Methanobacteriaceae',
    phylum: 'Euryarchaeota',
    v4_signature: 'TACGCAGGATCCGAGCGTTATCCGGATTTATTGGGTTTAAAGGGAGCGTAGGTGGATTGTAAGTTAGTGGTGAAATCCCGGGGCTCA'
  }
};

// Generate random nucleotide with given GC content
function randomNucleotide(gcBias = 0.5) {
  const r = Math.random();
  if (r < gcBias / 2) return 'G';
  if (r < gcBias) return 'C';
  if (r < (1 + gcBias) / 2) return 'A';
  return 'T';
}

// Generate variable region with mutations
function mutateSequence(sequence, mutationRate = 0.02) {
  let mutated = '';
  for (let i = 0; i < sequence.length; i++) {
    if (Math.random() < mutationRate) {
      // Introduce mutation
      const bases = ['A', 'C', 'G', 'T'];
      mutated += bases[Math.floor(Math.random() * bases.length)];
    } else {
      mutated += sequence[i];
    }
  }
  return mutated;
}

// Generate full 16S sequence
function generate16SSequence(taxon, abundance = 1) {
  const data = BACTERIAL_TAXA[taxon];
  const sequences = [];

  for (let i = 0; i < abundance; i++) {
    // Construct full sequence with conserved regions + variable signatures
    let sequence = '';

    // Add conserved region 1
    sequence += CONSERVED_REGIONS.V1;

    // Add variable region with mutations
    sequence += mutateSequence(data.v4_signature, 0.02);

    // Add more conserved regions
    sequence += CONSERVED_REGIONS.V6;

    // Add filler to reach ~1500bp
    const targetLength = 1500;
    while (sequence.length < targetLength - 100) {
      sequence += randomNucleotide(0.55); // Slight GC bias like real bacteria
    }

    // Add final conserved region
    sequence += CONSERVED_REGIONS.V9;

    sequences.push({
      id: `${data.genus}_${data.family}_${i + 1}`,
      taxon: taxon,
      genus: data.genus,
      family: data.family,
      phylum: data.phylum,
      sequence: sequence,
      length: sequence.length
    });
  }

  return sequences;
}

// Generate complete dataset
function generateDataset(size) {
  console.log(`🧬 Generating ${size.toLocaleString()} synthetic 16S rRNA sequences...`);

  const taxa = Object.keys(BACTERIAL_TAXA);
  const sequences = [];

  // Generate abundance distribution (log-normal, realistic for microbiome)
  const abundances = taxa.map(() => Math.floor(Math.random() * size / taxa.length * 2));
  const totalAbundance = abundances.reduce((a, b) => a + b, 0);

  // Normalize to exact size
  const normalized = abundances.map(a => Math.floor(a * size / totalAbundance));
  const remaining = size - normalized.reduce((a, b) => a + b, 0);
  normalized[0] += remaining; // Add remainder to first taxon

  console.log('\n📊 Abundance Distribution:');
  taxa.forEach((taxon, i) => {
    const count = normalized[i];
    const pct = (count / size * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(count / size * 50));
    console.log(`  ${taxon.padEnd(35)} ${count.toString().padStart(6)} (${pct.padStart(5)}%) ${bar}`);
  });

  // Generate sequences for each taxon
  taxa.forEach((taxon, i) => {
    const count = normalized[i];
    const taxonSequences = generate16SSequence(taxon, count);
    sequences.push(...taxonSequences);
  });

  console.log(`\n✅ Generated ${sequences.length.toLocaleString()} sequences`);
  console.log(`   Average length: ${Math.floor(sequences.reduce((sum, s) => sum + s.length, 0) / sequences.length)} bp`);

  return sequences;
}

// Generate k-mer embeddings for benchmarking
function generateKmerEmbedding(sequence, k = 4) {
  const kmers = {};
  const allKmers = [];

  // Generate all possible k-mers
  const bases = ['A', 'C', 'G', 'T'];
  function generateAllKmers(length, prefix = '') {
    if (length === 0) {
      allKmers.push(prefix);
      return;
    }
    bases.forEach(base => generateAllKmers(length - 1, prefix + base));
  }
  generateAllKmers(k);

  // Count k-mers in sequence
  for (let i = 0; i <= sequence.length - k; i++) {
    const kmer = sequence.substring(i, i + k);
    if (!kmer.includes('N')) { // Skip ambiguous bases
      kmers[kmer] = (kmers[kmer] || 0) + 1;
    }
  }

  // Convert to frequency vector
  const total = Object.values(kmers).reduce((a, b) => a + b, 0);
  const vector = allKmers.map(kmer => (kmers[kmer] || 0) / total);

  // Normalize to unit length
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return vector.map(v => v / magnitude);
}

// Main execution
const datasetSizes = [1000, 5000, 10000, 50000];

console.log('🔬 Microbiome Benchmark Data Generator\n');
console.log('='.repeat(70));

datasetSizes.forEach(size => {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📦 Dataset Size: ${size.toLocaleString()} sequences`);
  console.log('='.repeat(70));

  const sequences = generateDataset(size);

  // Save sequences
  const outputPath = path.join(__dirname, 'data', `sequences_${size}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(sequences, null, 2));
  console.log(`\n💾 Saved to: ${outputPath}`);

  // Generate and save k-mer embeddings
  console.log(`\n🧮 Generating 4-mer embeddings (256 dimensions)...`);
  const startTime = Date.now();
  const embeddings = sequences.map((seq, i) => {
    if (i % 1000 === 0 && i > 0) {
      process.stdout.write(`\r   Progress: ${i}/${sequences.length} (${(i/sequences.length*100).toFixed(1)}%)`);
    }
    return {
      id: seq.id,
      taxon: seq.taxon,
      genus: seq.genus,
      family: seq.family,
      phylum: seq.phylum,
      vector: generateKmerEmbedding(seq.sequence, 4)
    };
  });
  const elapsed = Date.now() - startTime;
  console.log(`\r   Progress: ${sequences.length}/${sequences.length} (100.0%) ✓`);
  console.log(`   Time: ${(elapsed/1000).toFixed(2)}s`);

  const embeddingsPath = path.join(__dirname, 'data', `embeddings_${size}.json`);
  fs.writeFileSync(embeddingsPath, JSON.stringify(embeddings, null, 2));
  console.log(`   Saved to: ${embeddingsPath}`);

  // Stats
  const fileSize = fs.statSync(embeddingsPath).size;
  console.log(`   File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
});

console.log('\n' + '='.repeat(70));
console.log('✅ Dataset generation complete!');
console.log('\nGenerated datasets:');
datasetSizes.forEach(size => {
  console.log(`  • ${size.toLocaleString().padStart(6)} sequences: data/sequences_${size}.json + data/embeddings_${size}.json`);
});
console.log('\n📊 Ready for benchmarking!');
