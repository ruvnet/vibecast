/**
 * VibeCast Biodata Examples
 *
 * Demonstrations of collective physiology and adaptive streaming.
 * Shows how distributed humans can synchronize into a unified biological system.
 */

import {
  BiometricSensors,
  EmotionalTopology,
  CoherenceEngine,
  AdaptiveStream,
  BiometricData,
  createBiodataSystem
} from './index';

/**
 * Example 1: Basic Biometric Streaming
 *
 * Simulate biometric data from multiple viewers and observe their physiological states.
 */
export async function exampleBasicStreaming() {
  console.log('=== Example 1: Basic Biometric Streaming ===\n');

  const sensors = new BiometricSensors({ sampleRate: 5 });
  const viewerIds = ['viewer_1', 'viewer_2', 'viewer_3'];
  const collectedData: BiometricData[][] = [[], [], []];

  // Start streams for each viewer
  viewerIds.forEach((viewerId, index) => {
    sensors.startStream(viewerId, (data) => {
      collectedData[index].push(data);

      console.log(`[${viewerId}] HR: ${data.hrv.heartRate.toFixed(1)} BPM | ` +
        `Stress: ${(data.hrv.stressIndex * 100).toFixed(1)}% | ` +
        `Engagement: ${(data.eeg.engagement * 100).toFixed(1)}% | ` +
        `Attention: ${(data.emotion.attention * 100).toFixed(1)}%`);
    });
  });

  // Run for 3 seconds
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Stop all streams
  sensors.stopAllStreams();

  console.log(`\nCollected ${collectedData[0].length} samples per viewer\n`);
}

/**
 * Example 2: Emotional Topology Mapping
 *
 * Map the collective emotional landscape of an audience.
 */
export async function exampleEmotionalTopology() {
  console.log('=== Example 2: Emotional Topology Mapping ===\n');

  const sensors = new BiometricSensors({ sampleRate: 2 });
  const topology = new EmotionalTopology({ dimensions: 5, minClusterSize: 2 });

  // Simulate 8 viewers
  const viewerIds = Array.from({ length: 8 }, (_, i) => `viewer_${i + 1}`);
  let latestBatch: BiometricData[] = [];

  viewerIds.forEach(viewerId => {
    sensors.startStream(viewerId, (data) => {
      latestBatch.push(data);
    });
  });

  // Sample topology every 2 seconds
  for (let i = 0; i < 3; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (latestBatch.length > 0) {
      const map = topology.updateTopology(latestBatch);

      console.log(`\n--- Topology Snapshot ${i + 1} ---`);
      console.log(`Clusters detected: ${map.clusters.length}`);
      console.log(`Global dispersion: ${(map.dispersion * 100).toFixed(1)}%`);
      console.log(`Polarization: ${(map.polarization * 100).toFixed(1)}%`);
      console.log(`Connectivity: ${(map.connectivity * 100).toFixed(1)}%`);

      map.clusters.forEach((cluster: any) => {
        console.log(`  - ${cluster.dominantEmotion} cluster: ${cluster.size} viewers ` +
          `(coherence: ${(cluster.coherence * 100).toFixed(1)}%)`);
      });

      const organism = topology.getCollectiveOrganism();
      console.log(`\nCollective mood: ${organism.mood} (energy: ${(organism.energy * 100).toFixed(1)}%)`);

      latestBatch = [];
    }
  }

  sensors.stopAllStreams();
  console.log();
}

/**
 * Example 3: Coherence Detection
 *
 * Detect when audience physiology synchronizes into collective flow state.
 */
export async function exampleCoherenceDetection() {
  console.log('=== Example 3: Coherence Detection ===\n');

  const sensors = new BiometricSensors({ sampleRate: 10 });
  const coherenceEngine = new CoherenceEngine({
    windowSize: 30,
    flowThreshold: 0.65,
    minSyncDuration: 2000
  });

  // Simulate 6 viewers
  const viewerIds = Array.from({ length: 6 }, (_, i) => `viewer_${i + 1}`);
  let dataBatch: BiometricData[] = [];

  viewerIds.forEach(viewerId => {
    sensors.startStream(viewerId, (data) => {
      dataBatch.push(data);
    });
  });

  // Monitor coherence for 5 seconds
  console.log('Monitoring collective coherence...\n');

  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 500));

    if (dataBatch.length >= viewerIds.length) {
      const metrics = coherenceEngine.analyzeCoherence(dataBatch);

      console.log(`[${(i * 0.5).toFixed(1)}s] ` +
        `Coherence: ${(metrics.overallCoherence * 100).toFixed(1)}% | ` +
        `HR Sync: ${(metrics.heartRateSynchrony * 100).toFixed(1)}% | ` +
        `Breath Sync: ${(metrics.breathingSynchrony * 100).toFixed(1)}% | ` +
        `Flow: ${metrics.flowState.isInFlow ? '✓' : '✗'}`);

      if (metrics.flowState.isInFlow) {
        console.log(`  → FLOW STATE detected! Intensity: ${(metrics.flowState.flowIntensity * 100).toFixed(1)}% ` +
          `Duration: ${metrics.flowState.duration}ms`);
      }

      dataBatch = [];
    }
  }

  sensors.stopAllStreams();

  const trend = coherenceEngine.getCoherenceTrend(5000);
  console.log(`\nCoherence trend: ${trend.trend} ` +
    `(avg: ${(trend.avgCoherence * 100).toFixed(1)}%, peak: ${(trend.peakCoherence * 100).toFixed(1)}%)\n`);
}

/**
 * Example 4: Adaptive Content Modulation
 *
 * Modulate content parameters based on collective physiology.
 */
export async function exampleAdaptiveStream() {
  console.log('=== Example 4: Adaptive Content Modulation ===\n');

  const system = createBiodataSystem({
    sensorSampleRate: 5,
    adaptationSpeed: 0.4
  });

  // Simulate 10 viewers
  const viewerIds = Array.from({ length: 10 }, (_, i) => `viewer_${i + 1}`);
  let dataBatch: BiometricData[] = [];

  viewerIds.forEach(viewerId => {
    system.sensors.startStream(viewerId, (data: any) => {
      dataBatch.push(data);
    });
  });

  console.log('Content adapting to audience physiology...\n');

  // Monitor and adapt for 6 seconds
  for (let i = 0; i < 6; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (dataBatch.length >= viewerIds.length) {
      // Analyze topology and coherence
      const topologyMap = system.topology.updateTopology(dataBatch);
      const coherenceMetrics = system.coherence.analyzeCoherence(dataBatch);

      // Generate content modulation
      const modulation = system.adaptiveStream.modulateContent(
        dataBatch,
        coherenceMetrics,
        topologyMap
      );

      console.log(`\n--- Second ${i + 1} ---`);
      console.log(`Intensity: ${(modulation.intensity * 100).toFixed(1)}% | ` +
        `Pacing: ${(modulation.pacing * 100).toFixed(1)}% | ` +
        `Complexity: ${(modulation.complexity * 100).toFixed(1)}% | ` +
        `Stimulation: ${(modulation.stimulation * 100).toFixed(1)}%`);

      console.log(`\n${system.adaptiveStream.describeModulation(modulation)}`);

      const actions = system.adaptiveStream.getRecommendedActions(modulation);
      if (actions.length > 0) {
        console.log('\nRecommended actions:');
        actions.forEach((action: any) => console.log(`  • ${action}`));
      }

      if (modulation.branchDecision?.shouldBranch) {
        console.log(`\n⚠ BRANCH SUGGESTION: ${modulation.branchDecision.reason}`);
      }

      dataBatch = [];
    }
  }

  system.sensors.stopAllStreams();
  console.log();
}

/**
 * Example 5: Complete Integration
 *
 * Full biodata streaming system with all components working together.
 */
export async function exampleCompleteIntegration() {
  console.log('=== Example 5: Complete Biodata Streaming System ===\n');
  console.log('Simulating live stream with real-time physiological adaptation...\n');

  const system = createBiodataSystem();

  // Large audience
  const viewerIds = Array.from({ length: 15 }, (_, i) => `viewer_${i + 1}`);
  let dataBatch: BiometricData[] = [];

  viewerIds.forEach(viewerId => {
    system.sensors.startStream(viewerId, (data) => {
      dataBatch.push(data);
    });
  });

  // Streaming session
  for (let minute = 0; minute < 3; minute++) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`MINUTE ${minute + 1}`);
    console.log('='.repeat(60));

    await new Promise(resolve => setTimeout(resolve, 1000));

    if (dataBatch.length >= viewerIds.length) {
      // Full analysis
      const topologyMap = system.topology.updateTopology(dataBatch);
      const coherenceMetrics = system.coherence.analyzeCoherence(dataBatch);
      const modulation = system.adaptiveStream.modulateContent(
        dataBatch,
        coherenceMetrics,
        topologyMap
      );

      // Audience overview
      console.log('\n📊 AUDIENCE OVERVIEW');
      const organism = system.topology.getCollectiveOrganism();
      console.log(`  Collective Mood: ${organism.mood.toUpperCase()}`);
      console.log(`  Energy Level: ${(organism.energy * 100).toFixed(1)}%`);
      console.log(`  Cohesion: ${(organism.cohesion * 100).toFixed(1)}%`);
      console.log(`  Active Viewers: ${viewerIds.length}`);

      // Topology
      console.log('\n🗺️  EMOTIONAL TOPOLOGY');
      console.log(`  Clusters: ${topologyMap.clusters.length}`);
      topologyMap.clusters.slice(0, 3).forEach((cluster: any) => {
        console.log(`    • ${cluster.dominantEmotion}: ${cluster.size} viewers`);
      });
      console.log(`  Dispersion: ${(topologyMap.dispersion * 100).toFixed(1)}%`);
      console.log(`  Polarization: ${(topologyMap.polarization * 100).toFixed(1)}%`);

      // Coherence
      console.log('\n🔗 SYNCHRONIZATION');
      console.log(`  Overall Coherence: ${(coherenceMetrics.overallCoherence * 100).toFixed(1)}%`);
      console.log(`  Heart Rate Sync: ${(coherenceMetrics.heartRateSynchrony * 100).toFixed(1)}%`);
      console.log(`  Breathing Sync: ${(coherenceMetrics.breathingSynchrony * 100).toFixed(1)}%`);
      console.log(`  EEG Coherence: ${(coherenceMetrics.eegCoherence * 100).toFixed(1)}%`);

      if (coherenceMetrics.flowState.isInFlow) {
        console.log(`\n  ✨ COLLECTIVE FLOW STATE ACTIVE ✨`);
        console.log(`     Intensity: ${(coherenceMetrics.flowState.flowIntensity * 100).toFixed(1)}%`);
        console.log(`     Duration: ${(coherenceMetrics.flowState.duration / 1000).toFixed(1)}s`);
      }

      // Content adaptation
      console.log('\n🎬 CONTENT MODULATION');
      console.log(`  Intensity: ${(modulation.intensity * 100).toFixed(1)}%`);
      console.log(`  Pacing: ${(modulation.pacing * 100).toFixed(1)}%`);
      console.log(`  Complexity: ${(modulation.complexity * 100).toFixed(1)}%`);
      console.log(`  Stimulation: ${(modulation.stimulation * 100).toFixed(1)}%`);

      const actions = system.adaptiveStream.getRecommendedActions(modulation);
      if (actions.length > 0) {
        console.log('\n  📝 Recommendations:');
        actions.slice(0, 2).forEach((action: any) => console.log(`     • ${action}`));
      }

      dataBatch = [];
    }
  }

  system.sensors.stopAllStreams();

  console.log('\n' + '='.repeat(60));
  console.log('Stream complete. Audience synchronization achieved.');
  console.log('='.repeat(60) + '\n');
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('\n🧬 VibeCast Biodata Streaming Protocols - Examples\n');
  console.log('Demonstrating collective physiology and adaptive content\n');
  console.log('='.repeat(60) + '\n');

  await exampleBasicStreaming();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await exampleEmotionalTopology();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await exampleCoherenceDetection();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await exampleAdaptiveStream();
  await new Promise(resolve => setTimeout(resolve, 1000));

  await exampleCompleteIntegration();

  console.log('\n✅ All examples completed!\n');
  console.log('Key Insights:');
  console.log('  • Biometric data reveals collective emotional states');
  console.log('  • Physiological synchrony creates group coherence');
  console.log('  • Flow states emerge when audience aligns');
  console.log('  • Content can adapt to collective biology in real-time');
  console.log('  • Distributed humans can synchronize into unified organism\n');
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}
