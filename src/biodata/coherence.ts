/**
 * Coherence Detection Engine
 *
 * Detects when audience physiology synchronizes - the magical moments when
 * a distributed group of humans becomes a unified biological system.
 *
 * Measures heart rate synchrony, breathing coordination, and EEG phase locking.
 */

import { BiometricData } from './sensors';

export interface CoherenceMetrics {
  timestamp: number;

  // Overall coherence score
  overallCoherence: number; // 0-1

  // Individual synchrony measures
  heartRateSynchrony: number; // 0-1
  breathingSynchrony: number; // 0-1
  eegCoherence: number; // 0-1
  emotionalAlignment: number; // 0-1

  // Collective flow state
  flowState: {
    isInFlow: boolean;
    flowIntensity: number; // 0-1
    duration: number; // ms
    quality: number; // 0-1
  };

  // Synchronization patterns
  patterns: {
    phaseLocking: number; // 0-1
    rhythmicEntrainment: number; // 0-1
    resonance: number; // 0-1
  };

  // Group dynamics
  groupSize: number;
  participationRate: number; // Percentage actively synchronized
}

export interface SynchronyWindow {
  viewerId: string;
  heartRates: number[];
  breathRates: number[];
  eegAlpha: number[];
  timestamps: number[];
}

export interface FlowStateDetection {
  startTime: number;
  currentDuration: number;
  peakCoherence: number;
  sustainedThreshold: boolean; // Above threshold for minimum duration
  characteristics: {
    highEngagement: boolean;
    lowStress: boolean;
    rhythmicSync: boolean;
    emotionalAlignment: boolean;
  };
}

/**
 * CoherenceEngine - Detect physiological synchronization across distributed viewers
 */
export class CoherenceEngine {
  private windowSize: number; // Number of samples to analyze
  private minSyncDuration: number; // Minimum ms for sustained synchrony
  private flowThreshold: number; // Coherence threshold for flow state

  private windows: Map<string, SynchronyWindow> = new Map();
  private currentFlow: FlowStateDetection | null = null;
  private coherenceHistory: CoherenceMetrics[] = [];

  constructor(config: {
    windowSize?: number;
    minSyncDuration?: number;
    flowThreshold?: number;
  } = {}) {
    this.windowSize = config.windowSize || 50; // 5 seconds at 10Hz
    this.minSyncDuration = config.minSyncDuration || 3000; // 3 seconds
    this.flowThreshold = config.flowThreshold || 0.7;
  }

  /**
   * Update coherence analysis with new biometric data
   */
  analyzeCoherence(biometricData: BiometricData[]): CoherenceMetrics {
    // Update sliding windows
    this.updateWindows(biometricData);

    // Calculate individual synchrony metrics
    const heartRateSynchrony = this.calculateHeartRateSynchrony();
    const breathingSynchrony = this.calculateBreathingSynchrony();
    const eegCoherence = this.calculateEEGCoherence();
    const emotionalAlignment = this.calculateEmotionalAlignment(biometricData);

    // Calculate overall coherence (weighted average)
    const overallCoherence = (
      heartRateSynchrony * 0.3 +
      breathingSynchrony * 0.25 +
      eegCoherence * 0.25 +
      emotionalAlignment * 0.2
    );

    // Detect synchronization patterns
    const patterns = this.detectSyncPatterns();

    // Detect flow state
    const flowState = this.detectFlowState(overallCoherence, biometricData);

    // Calculate group dynamics
    const groupSize = biometricData.length;
    const participationRate = this.calculateParticipationRate(overallCoherence);

    const metrics: CoherenceMetrics = {
      timestamp: Date.now(),
      overallCoherence,
      heartRateSynchrony,
      breathingSynchrony,
      eegCoherence,
      emotionalAlignment,
      flowState,
      patterns,
      groupSize,
      participationRate
    };

    // Store in history
    this.coherenceHistory.push(metrics);
    if (this.coherenceHistory.length > 1000) {
      this.coherenceHistory.shift();
    }

    return metrics;
  }

  /**
   * Get current flow state status
   */
  getFlowState(): FlowStateDetection | null {
    return this.currentFlow;
  }

  /**
   * Get coherence trend over time
   */
  getCoherenceTrend(durationMs: number = 30000): {
    trend: 'increasing' | 'decreasing' | 'stable';
    avgCoherence: number;
    peakCoherence: number;
    coherenceChange: number;
  } {
    const cutoff = Date.now() - durationMs;
    const recent = this.coherenceHistory.filter(m => m.timestamp > cutoff);

    if (recent.length < 2) {
      return { trend: 'stable', avgCoherence: 0, peakCoherence: 0, coherenceChange: 0 };
    }

    const coherenceValues = recent.map(m => m.overallCoherence);
    const avgCoherence = coherenceValues.reduce((a, b) => a + b, 0) / coherenceValues.length;
    const peakCoherence = Math.max(...coherenceValues);

    // Calculate trend (compare first half vs second half)
    const midpoint = Math.floor(recent.length / 2);
    const firstHalf = coherenceValues.slice(0, midpoint);
    const secondHalf = coherenceValues.slice(midpoint);

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const coherenceChange = secondAvg - firstAvg;

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (coherenceChange > 0.1) trend = 'increasing';
    else if (coherenceChange < -0.1) trend = 'decreasing';

    return { trend, avgCoherence, peakCoherence, coherenceChange };
  }

  /**
   * Identify moments of peak synchronization
   */
  getPeakMoments(minCoherence: number = 0.7): CoherenceMetrics[] {
    return this.coherenceHistory.filter(m => m.overallCoherence >= minCoherence);
  }

  // Private methods

  /**
   * Update sliding windows for each viewer
   */
  private updateWindows(biometricData: BiometricData[]): void {
    for (const data of biometricData) {
      let window = this.windows.get(data.viewerId);

      if (!window) {
        window = {
          viewerId: data.viewerId,
          heartRates: [],
          breathRates: [],
          eegAlpha: [],
          timestamps: []
        };
        this.windows.set(data.viewerId, window);
      }

      // Add new data
      window.heartRates.push(data.hrv.heartRate);
      window.breathRates.push(data.respiration.rate);
      window.eegAlpha.push(data.eeg.alpha);
      window.timestamps.push(data.timestamp);

      // Trim to window size
      if (window.heartRates.length > this.windowSize) {
        window.heartRates.shift();
        window.breathRates.shift();
        window.eegAlpha.shift();
        window.timestamps.shift();
      }
    }
  }

  /**
   * Calculate heart rate synchrony using cross-correlation
   */
  private calculateHeartRateSynchrony(): number {
    const windows = Array.from(this.windows.values());
    if (windows.length < 2) return 0;

    // Calculate pairwise correlations
    let totalCorrelation = 0;
    let pairs = 0;

    for (let i = 0; i < windows.length; i++) {
      for (let j = i + 1; j < windows.length; j++) {
        const correlation = this.calculateCorrelation(
          windows[i].heartRates,
          windows[j].heartRates
        );
        totalCorrelation += Math.abs(correlation);
        pairs++;
      }
    }

    return pairs > 0 ? totalCorrelation / pairs : 0;
  }

  /**
   * Calculate breathing synchrony
   */
  private calculateBreathingSynchrony(): number {
    const windows = Array.from(this.windows.values());
    if (windows.length < 2) return 0;

    // Check for phase alignment in breathing
    const avgSynchrony = this.calculatePhaseSynchrony(
      windows.map(w => w.breathRates)
    );

    return avgSynchrony;
  }

  /**
   * Calculate EEG coherence (alpha band synchronization)
   */
  private calculateEEGCoherence(): number {
    const windows = Array.from(this.windows.values());
    if (windows.length < 2) return 0;

    // Alpha band coherence indicates synchronized relaxation/meditation
    const alphaValues = windows.map(w => {
      const recent = w.eegAlpha.slice(-10); // Last 10 samples
      return recent.reduce((a, b) => a + b, 0) / recent.length;
    });

    // Calculate variance - low variance means high coherence
    const mean = alphaValues.reduce((a, b) => a + b, 0) / alphaValues.length;
    const variance = alphaValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / alphaValues.length;
    const stdDev = Math.sqrt(variance);

    // Convert to coherence score (low std dev = high coherence)
    // Assuming alpha typically ranges 20-50 μV
    return Math.max(0, 1 - (stdDev / 15));
  }

  /**
   * Calculate emotional alignment across viewers
   */
  private calculateEmotionalAlignment(biometricData: BiometricData[]): number {
    if (biometricData.length < 2) return 0;

    // Calculate variance in valence and arousal
    const valences = biometricData.map(d => d.emotion.valence);
    const arousals = biometricData.map(d => d.emotion.arousal);

    const valenceVariance = this.calculateVariance(valences);
    const arousalVariance = this.calculateVariance(arousals);

    // Low variance = high alignment
    const valenceAlignment = Math.max(0, 1 - valenceVariance);
    const arousalAlignment = Math.max(0, 1 - arousalVariance);

    return (valenceAlignment + arousalAlignment) / 2;
  }

  /**
   * Detect synchronization patterns
   */
  private detectSyncPatterns(): {
    phaseLocking: number;
    rhythmicEntrainment: number;
    resonance: number;
  } {
    const windows = Array.from(this.windows.values());

    // Phase locking - signals peak at similar times
    const phaseLocking = this.detectPhaseLocking(windows);

    // Rhythmic entrainment - similar periodicities
    const rhythmicEntrainment = this.detectRhythmicEntrainment(windows);

    // Resonance - amplification through synchrony
    const resonance = (phaseLocking + rhythmicEntrainment) / 2;

    return { phaseLocking, rhythmicEntrainment, resonance };
  }

  /**
   * Detect collective flow state
   */
  private detectFlowState(coherence: number, biometricData: BiometricData[]): {
    isInFlow: boolean;
    flowIntensity: number;
    duration: number;
    quality: number;
  } {
    const now = Date.now();

    // Check flow state characteristics
    const avgEngagement = biometricData.reduce((sum, d) => sum + d.eeg.engagement, 0) / biometricData.length;
    const avgStress = biometricData.reduce((sum, d) => sum + d.hrv.stressIndex, 0) / biometricData.length;
    const avgAttention = biometricData.reduce((sum, d) => sum + d.emotion.attention, 0) / biometricData.length;

    const characteristics = {
      highEngagement: avgEngagement > 0.6,
      lowStress: avgStress < 0.4,
      rhythmicSync: coherence > this.flowThreshold,
      emotionalAlignment: this.calculateEmotionalAlignment(biometricData) > 0.6
    };

    const flowIntensity = coherence * avgEngagement * (1 - avgStress) * avgAttention;
    const isInFlow = coherence > this.flowThreshold && characteristics.highEngagement && characteristics.lowStress;

    // Track flow duration
    if (isInFlow) {
      if (!this.currentFlow) {
        this.currentFlow = {
          startTime: now,
          currentDuration: 0,
          peakCoherence: coherence,
          sustainedThreshold: false,
          characteristics
        };
      } else {
        this.currentFlow.currentDuration = now - this.currentFlow.startTime;
        this.currentFlow.peakCoherence = Math.max(this.currentFlow.peakCoherence, coherence);
        this.currentFlow.sustainedThreshold = this.currentFlow.currentDuration >= this.minSyncDuration;
      }
    } else {
      this.currentFlow = null;
    }

    const duration = this.currentFlow ? this.currentFlow.currentDuration : 0;
    const quality = isInFlow ? flowIntensity : 0;

    return { isInFlow, flowIntensity, duration, quality };
  }

  /**
   * Calculate participation rate
   */
  private calculateParticipationRate(coherence: number): number {
    // Estimate percentage of viewers actively contributing to coherence
    // Higher coherence typically means more participation
    return Math.min(1, coherence * 1.2); // Slightly boost to reach 100%
  }

  // Statistical helper methods

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const meanX = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
    const meanY = y.slice(0, n).reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let sumXSquared = 0;
    let sumYSquared = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      sumXSquared += dx * dx;
      sumYSquared += dy * dy;
    }

    const denominator = Math.sqrt(sumXSquared * sumYSquared);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculatePhaseSynchrony(signals: number[][]): number {
    if (signals.length < 2) return 0;

    // Simplified phase synchrony using peak detection
    const peaks = signals.map(signal => this.detectPeaks(signal));

    // Calculate average time difference between peaks
    let totalSync = 0;
    let pairs = 0;

    for (let i = 0; i < peaks.length; i++) {
      for (let j = i + 1; j < peaks.length; j++) {
        if (peaks[i].length > 0 && peaks[j].length > 0) {
          const avgTimeDiff = Math.abs(peaks[i][0] - peaks[j][0]);
          const maxPeriod = 10; // Assuming max 10 sample period
          const sync = Math.max(0, 1 - (avgTimeDiff / maxPeriod));
          totalSync += sync;
          pairs++;
        }
      }
    }

    return pairs > 0 ? totalSync / pairs : 0;
  }

  private detectPeaks(signal: number[]): number[] {
    const peaks: number[] = [];
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) {
        peaks.push(i);
      }
    }
    return peaks;
  }

  private detectPhaseLocking(windows: SynchronyWindow[]): number {
    // Detect if physiological rhythms lock into phase
    return this.calculatePhaseSynchrony(windows.map(w => w.heartRates));
  }

  private detectRhythmicEntrainment(windows: SynchronyWindow[]): number {
    // Detect if rhythms entrain to similar frequencies
    const heartRateSync = this.calculateHeartRateSynchrony();
    const breathSync = this.calculatePhaseSynchrony(windows.map(w => w.breathRates));
    return (heartRateSync + breathSync) / 2;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    return variance;
  }
}
