/**
 * Emotional Topology Mapper
 *
 * Maps collective emotional landscape from aggregated biometric data.
 * Creates n-dimensional emotional space and clusters similar physiological states.
 * Visualizes audience as single organism with distributed physiology.
 */

import { BiometricData } from './sensors';

export interface EmotionalState {
  viewerId: string;
  position: number[]; // N-dimensional coordinates in emotional space
  valence: number; // -1 to 1
  arousal: number; // 0 to 1
  attention: number; // 0 to 1
  stress: number; // 0 to 1
  engagement: number; // 0 to 1
  timestamp: number;
}

export interface EmotionalCluster {
  id: string;
  centroid: number[]; // Center of cluster in emotional space
  members: string[]; // Viewer IDs
  dominantEmotion: string; // e.g., "excited", "calm", "stressed", "focused"
  coherence: number; // 0-1, how similar members are
  size: number; // Number of viewers
  velocity: number[]; // Movement vector in emotional space
}

export interface TopologyMap {
  timestamp: number;
  dimensions: number;
  states: EmotionalState[];
  clusters: EmotionalCluster[];
  globalCenter: number[]; // Collective emotional center
  dispersion: number; // How spread out the audience is
  polarization: number; // 0-1, how divided into distinct groups
  connectivity: number; // 0-1, how connected the topology is
}

export interface TopologyConfig {
  dimensions: number; // Number of dimensions in emotional space
  clusterThreshold: number; // Distance threshold for clustering
  minClusterSize: number; // Minimum viewers for a cluster
  historyWindow: number; // ms to keep for velocity calculations
}

/**
 * EmotionalTopology - Map and analyze collective emotional landscape
 */
export class EmotionalTopology {
  private config: TopologyConfig;
  private history: Map<string, EmotionalState[]> = new Map();
  private currentMap: TopologyMap | null = null;

  constructor(config: Partial<TopologyConfig> = {}) {
    this.config = {
      dimensions: 5, // [valence, arousal, attention, stress, engagement]
      clusterThreshold: 0.3,
      minClusterSize: 2,
      historyWindow: 10000, // 10 seconds
      ...config
    };
  }

  /**
   * Update topology with new biometric data
   */
  updateTopology(biometricData: BiometricData[]): TopologyMap {
    // Convert biometric data to emotional states
    const states = biometricData.map(data => this.biometricToEmotionalState(data));

    // Update history for velocity calculations
    this.updateHistory(states);

    // Cluster similar emotional states
    const clusters = this.clusterStates(states);

    // Calculate global metrics
    const globalCenter = this.calculateGlobalCenter(states);
    const dispersion = this.calculateDispersion(states, globalCenter);
    const polarization = this.calculatePolarization(clusters);
    const connectivity = this.calculateConnectivity(states);

    this.currentMap = {
      timestamp: Date.now(),
      dimensions: this.config.dimensions,
      states,
      clusters,
      globalCenter,
      dispersion,
      polarization,
      connectivity
    };

    return this.currentMap;
  }

  /**
   * Get current topology map
   */
  getCurrentMap(): TopologyMap | null {
    return this.currentMap;
  }

  /**
   * Get emotional region description
   */
  describeRegion(clusterId: string): string {
    if (!this.currentMap) return 'No topology data';

    const cluster = this.currentMap.clusters.find(c => c.id === clusterId);
    if (!cluster) return 'Unknown region';

    return `${cluster.dominantEmotion} region with ${cluster.size} viewers (coherence: ${(cluster.coherence * 100).toFixed(1)}%)`;
  }

  /**
   * Detect emotional "hotspots" - areas of high density
   */
  detectHotspots(): EmotionalCluster[] {
    if (!this.currentMap) return [];

    // Return clusters sorted by size and coherence
    return this.currentMap.clusters
      .filter(c => c.size >= this.config.minClusterSize)
      .sort((a, b) => (b.size * b.coherence) - (a.size * a.coherence));
  }

  /**
   * Track movement through emotional space
   */
  trackMovement(viewerId: string): { velocity: number[], trajectory: EmotionalState[] } {
    const trajectory = this.history.get(viewerId) || [];

    if (trajectory.length < 2) {
      return { velocity: new Array(this.config.dimensions).fill(0), trajectory };
    }

    // Calculate velocity from recent positions
    const recent = trajectory.slice(-5); // Last 5 states
    const velocity = this.calculateVelocity(recent);

    return { velocity, trajectory };
  }

  /**
   * Get audience as single organism metrics
   */
  getCollectiveOrganism(): {
    center: number[];
    spread: number;
    cohesion: number;
    mood: string;
    energy: number;
  } {
    if (!this.currentMap) {
      return {
        center: new Array(this.config.dimensions).fill(0),
        spread: 0,
        cohesion: 0,
        mood: 'unknown',
        energy: 0
      };
    }

    const avgValence = this.currentMap.globalCenter[0];
    const avgArousal = this.currentMap.globalCenter[1];
    const cohesion = 1 - this.currentMap.dispersion;

    // Classify mood based on valence and arousal
    let mood = 'neutral';
    if (avgValence > 0.3 && avgArousal > 0.5) mood = 'excited';
    else if (avgValence > 0.3 && avgArousal < 0.5) mood = 'content';
    else if (avgValence < -0.3 && avgArousal > 0.5) mood = 'stressed';
    else if (avgValence < -0.3 && avgArousal < 0.5) mood = 'calm';
    else if (avgArousal > 0.6) mood = 'energized';
    else if (avgArousal < 0.4) mood = 'relaxed';

    return {
      center: this.currentMap.globalCenter,
      spread: this.currentMap.dispersion,
      cohesion,
      mood,
      energy: avgArousal
    };
  }

  // Private methods

  /**
   * Convert biometric data to emotional state in n-dimensional space
   */
  private biometricToEmotionalState(data: BiometricData): EmotionalState {
    // Map to 5D emotional space: [valence, arousal, attention, stress, engagement]
    const position = [
      data.emotion.valence,
      data.emotion.arousal,
      data.emotion.attention,
      data.hrv.stressIndex,
      data.eeg.engagement
    ];

    return {
      viewerId: data.viewerId,
      position,
      valence: data.emotion.valence,
      arousal: data.emotion.arousal,
      attention: data.emotion.attention,
      stress: data.hrv.stressIndex,
      engagement: data.eeg.engagement,
      timestamp: data.timestamp
    };
  }

  /**
   * Update history for velocity calculations
   */
  private updateHistory(states: EmotionalState[]): void {
    const now = Date.now();
    const cutoff = now - this.config.historyWindow;

    for (const state of states) {
      let history = this.history.get(state.viewerId) || [];

      // Add new state
      history.push(state);

      // Remove old states
      history = history.filter(s => s.timestamp > cutoff);

      this.history.set(state.viewerId, history);
    }
  }

  /**
   * Cluster similar emotional states using k-means-like algorithm
   */
  private clusterStates(states: EmotionalState[]): EmotionalCluster[] {
    if (states.length === 0) return [];

    // Start with all states as potential cluster centers
    const clusters: EmotionalCluster[] = [];
    const assigned = new Set<string>();

    for (const state of states) {
      if (assigned.has(state.viewerId)) continue;

      // Find nearby states
      const members: string[] = [state.viewerId];
      assigned.add(state.viewerId);

      for (const other of states) {
        if (assigned.has(other.viewerId)) continue;

        const distance = this.euclideanDistance(state.position, other.position);

        if (distance < this.config.clusterThreshold) {
          members.push(other.viewerId);
          assigned.add(other.viewerId);
        }
      }

      if (members.length >= this.config.minClusterSize) {
        // Calculate cluster properties
        const memberStates = states.filter(s => members.includes(s.viewerId));
        const centroid = this.calculateCentroid(memberStates.map(s => s.position));
        const coherence = this.calculateCoherence(memberStates);
        const dominantEmotion = this.classifyEmotion(centroid);
        const velocity = this.calculateClusterVelocity(members);

        clusters.push({
          id: `cluster_${clusters.length}`,
          centroid,
          members,
          dominantEmotion,
          coherence,
          size: members.length,
          velocity
        });
      }
    }

    return clusters;
  }

  /**
   * Calculate centroid of positions
   */
  private calculateCentroid(positions: number[][]): number[] {
    if (positions.length === 0) return new Array(this.config.dimensions).fill(0);

    const centroid = new Array(this.config.dimensions).fill(0);

    for (const pos of positions) {
      for (let i = 0; i < this.config.dimensions; i++) {
        centroid[i] += pos[i];
      }
    }

    return centroid.map(val => val / positions.length);
  }

  /**
   * Calculate global center of all states
   */
  private calculateGlobalCenter(states: EmotionalState[]): number[] {
    return this.calculateCentroid(states.map(s => s.position));
  }

  /**
   * Calculate dispersion (spread) of states
   */
  private calculateDispersion(states: EmotionalState[], center: number[]): number {
    if (states.length === 0) return 0;

    const distances = states.map(s => this.euclideanDistance(s.position, center));
    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;

    // Normalize to 0-1 (assuming max reasonable distance is sqrt(dimensions))
    return Math.min(avgDistance / Math.sqrt(this.config.dimensions), 1);
  }

  /**
   * Calculate polarization (how divided into distinct groups)
   */
  private calculatePolarization(clusters: EmotionalCluster[]): number {
    if (clusters.length <= 1) return 0;

    // Calculate distances between cluster centroids
    let maxDistance = 0;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const distance = this.euclideanDistance(clusters[i].centroid, clusters[j].centroid);
        maxDistance = Math.max(maxDistance, distance);
      }
    }

    // Normalize
    return Math.min(maxDistance / Math.sqrt(this.config.dimensions), 1);
  }

  /**
   * Calculate connectivity (how connected the topology is)
   */
  private calculateConnectivity(states: EmotionalState[]): number {
    if (states.length <= 1) return 1;

    // Calculate average distance to nearest neighbor
    let totalMinDistance = 0;

    for (const state of states) {
      let minDistance = Infinity;
      for (const other of states) {
        if (state.viewerId === other.viewerId) continue;
        const distance = this.euclideanDistance(state.position, other.position);
        minDistance = Math.min(minDistance, distance);
      }
      totalMinDistance += minDistance;
    }

    const avgMinDistance = totalMinDistance / states.length;

    // Convert to connectivity (inverse of distance)
    return Math.max(0, 1 - avgMinDistance);
  }

  /**
   * Calculate coherence within a cluster
   */
  private calculateCoherence(states: EmotionalState[]): number {
    if (states.length <= 1) return 1;

    const centroid = this.calculateCentroid(states.map(s => s.position));
    const distances = states.map(s => this.euclideanDistance(s.position, centroid));
    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;

    // Convert to coherence (inverse of dispersion)
    return Math.max(0, 1 - avgDistance);
  }

  /**
   * Calculate velocity from trajectory
   */
  private calculateVelocity(trajectory: EmotionalState[]): number[] {
    if (trajectory.length < 2) {
      return new Array(this.config.dimensions).fill(0);
    }

    const start = trajectory[0];
    const end = trajectory[trajectory.length - 1];
    const timeDelta = (end.timestamp - start.timestamp) / 1000; // seconds

    if (timeDelta === 0) return new Array(this.config.dimensions).fill(0);

    const velocity = [];
    for (let i = 0; i < this.config.dimensions; i++) {
      velocity.push((end.position[i] - start.position[i]) / timeDelta);
    }

    return velocity;
  }

  /**
   * Calculate cluster velocity
   */
  private calculateClusterVelocity(members: string[]): number[] {
    const velocities = members.map(id => {
      const trajectory = this.history.get(id) || [];
      return this.calculateVelocity(trajectory);
    });

    // Average velocity of all members
    return this.calculateCentroid(velocities);
  }

  /**
   * Classify emotion from position in emotional space
   */
  private classifyEmotion(position: number[]): string {
    const [valence, arousal, attention, stress, engagement] = position;

    // Complex emotion classification
    if (stress > 0.7) return 'stressed';
    if (arousal > 0.7 && valence > 0.3) return 'excited';
    if (arousal > 0.7 && valence < -0.3) return 'anxious';
    if (engagement > 0.7 && attention > 0.7) return 'focused';
    if (arousal < 0.3 && valence > 0.3) return 'content';
    if (arousal < 0.3 && valence < -0.3) return 'sad';
    if (arousal < 0.3 && stress < 0.3) return 'calm';
    if (valence > 0.5) return 'happy';
    if (valence < -0.5) return 'negative';
    return 'neutral';
  }

  /**
   * Euclidean distance between two points
   */
  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
  }
}
