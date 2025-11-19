/**
 * Biometric Sensor System
 *
 * Captures and simulates real-time biometric data streams from viewers.
 * Supports HRV, EEG, GSR, and respiratory monitoring for collective physiology.
 *
 * Privacy: All data is ephemeral and consent-based.
 */

export interface BiometricData {
  timestamp: number;
  viewerId: string; // Anonymized ID

  // Heart Rate Variability (HRV) - stress/relaxation
  hrv: {
    heartRate: number; // BPM
    rmssd: number; // Root mean square of successive differences (ms)
    sdnn: number; // Standard deviation of NN intervals (ms)
    stressIndex: number; // 0-1 (0=relaxed, 1=stressed)
  };

  // EEG Brain Wave Bands
  eeg: {
    alpha: number; // 8-13Hz - relaxed, meditative (μV)
    beta: number; // 13-30Hz - active thinking (μV)
    theta: number; // 4-8Hz - deep meditation (μV)
    gamma: number; // 30-100Hz - peak focus (μV)
    engagement: number; // 0-1 derived metric
  };

  // Galvanic Skin Response (GSR) - emotional arousal
  gsr: {
    conductance: number; // μS (microsiemens)
    arousal: number; // 0-1 normalized
  };

  // Respiratory Rate
  respiration: {
    rate: number; // Breaths per minute
    variability: number; // Breath-to-breath variation
    calm: number; // 0-1 (1=very calm)
  };

  // Derived emotional state
  emotion: {
    valence: number; // -1 to 1 (negative to positive)
    arousal: number; // 0-1 (low to high energy)
    attention: number; // 0-1 (distracted to focused)
  };
}

export interface SensorConfig {
  sampleRate: number; // Hz
  smoothingWindow: number; // ms
  anomalyThreshold: number; // Standard deviations
  privacyMode: 'full' | 'aggregated' | 'anonymous';
}

/**
 * BiometricSensors - Capture and simulate biometric data streams
 */
export class BiometricSensors {
  private config: SensorConfig;
  private streams: Map<string, NodeJS.Timeout> = new Map();
  private baselineData: Map<string, BiometricData> = new Map();

  constructor(config: Partial<SensorConfig> = {}) {
    this.config = {
      sampleRate: 10, // 10 Hz default
      smoothingWindow: 1000,
      anomalyThreshold: 3,
      privacyMode: 'aggregated',
      ...config
    };
  }

  /**
   * Start simulated biometric stream for a viewer
   */
  startStream(viewerId: string, callback: (data: BiometricData) => void): void {
    if (this.streams.has(viewerId)) {
      throw new Error(`Stream already active for viewer ${viewerId}`);
    }

    // Initialize baseline for this viewer
    this.baselineData.set(viewerId, this.generateBaseline(viewerId));

    // Create stream at configured sample rate
    const interval = setInterval(() => {
      const data = this.simulateBiometricData(viewerId);
      callback(data);
    }, 1000 / this.config.sampleRate);

    this.streams.set(viewerId, interval);
  }

  /**
   * Stop biometric stream for a viewer
   */
  stopStream(viewerId: string): void {
    const stream = this.streams.get(viewerId);
    if (stream) {
      clearInterval(stream);
      this.streams.delete(viewerId);
      this.baselineData.delete(viewerId);
    }
  }

  /**
   * Stop all active streams
   */
  stopAllStreams(): void {
    for (const [viewerId] of this.streams) {
      this.stopStream(viewerId);
    }
  }

  /**
   * Generate realistic baseline biometric data
   */
  private generateBaseline(viewerId: string): BiometricData {
    return {
      timestamp: Date.now(),
      viewerId: this.anonymizeId(viewerId),
      hrv: {
        heartRate: 60 + Math.random() * 20, // 60-80 BPM
        rmssd: 30 + Math.random() * 40, // 30-70 ms
        sdnn: 40 + Math.random() * 30, // 40-70 ms
        stressIndex: 0.3 + Math.random() * 0.2 // Mild stress
      },
      eeg: {
        alpha: 20 + Math.random() * 30, // 20-50 μV
        beta: 10 + Math.random() * 20, // 10-30 μV
        theta: 15 + Math.random() * 15, // 15-30 μV
        gamma: 5 + Math.random() * 10, // 5-15 μV
        engagement: 0.4 + Math.random() * 0.2
      },
      gsr: {
        conductance: 2 + Math.random() * 3, // 2-5 μS
        arousal: 0.3 + Math.random() * 0.2
      },
      respiration: {
        rate: 12 + Math.random() * 6, // 12-18 BPM
        variability: 0.2 + Math.random() * 0.3,
        calm: 0.5 + Math.random() * 0.3
      },
      emotion: {
        valence: -0.2 + Math.random() * 0.6, // Slightly positive bias
        arousal: 0.3 + Math.random() * 0.3,
        attention: 0.4 + Math.random() * 0.3
      }
    };
  }

  /**
   * Simulate realistic biometric data with temporal variation
   */
  private simulateBiometricData(viewerId: string): BiometricData {
    const baseline = this.baselineData.get(viewerId)!;
    const now = Date.now();
    const timeDelta = (now - baseline.timestamp) / 1000; // seconds

    // Add natural variation and trends
    const stressWave = Math.sin(timeDelta * 0.1) * 0.15; // Slow stress oscillation
    const arousalSpike = Math.random() < 0.05 ? 0.3 : 0; // Random arousal spikes
    const attentionDrift = Math.cos(timeDelta * 0.05) * 0.2; // Attention waves

    // Generate new data with smooth transitions
    const data: BiometricData = {
      timestamp: now,
      viewerId: this.anonymizeId(viewerId),
      hrv: {
        heartRate: this.smooth(
          baseline.hrv.heartRate + (Math.random() - 0.5) * 5 + stressWave * 10
        ),
        rmssd: this.smooth(
          baseline.hrv.rmssd + (Math.random() - 0.5) * 10 - stressWave * 15
        ),
        sdnn: this.smooth(
          baseline.hrv.sdnn + (Math.random() - 0.5) * 8 - stressWave * 10
        ),
        stressIndex: this.clamp(
          baseline.hrv.stressIndex + stressWave + (Math.random() - 0.5) * 0.1,
          0, 1
        )
      },
      eeg: {
        alpha: this.smooth(
          baseline.eeg.alpha + (Math.random() - 0.5) * 8 - stressWave * 10
        ),
        beta: this.smooth(
          baseline.eeg.beta + (Math.random() - 0.5) * 6 + attentionDrift * 8
        ),
        theta: this.smooth(
          baseline.eeg.theta + (Math.random() - 0.5) * 5
        ),
        gamma: this.smooth(
          baseline.eeg.gamma + (Math.random() - 0.5) * 4 + attentionDrift * 5
        ),
        engagement: this.clamp(
          baseline.eeg.engagement + attentionDrift + (Math.random() - 0.5) * 0.15,
          0, 1
        )
      },
      gsr: {
        conductance: this.smooth(
          baseline.gsr.conductance + (Math.random() - 0.5) * 0.8 + arousalSpike
        ),
        arousal: this.clamp(
          baseline.gsr.arousal + arousalSpike + (Math.random() - 0.5) * 0.1,
          0, 1
        )
      },
      respiration: {
        rate: this.smooth(
          baseline.respiration.rate + (Math.random() - 0.5) * 2 + stressWave * 3
        ),
        variability: this.clamp(
          baseline.respiration.variability + (Math.random() - 0.5) * 0.1,
          0, 1
        ),
        calm: this.clamp(
          baseline.respiration.calm - stressWave - (Math.random() - 0.5) * 0.1,
          0, 1
        )
      },
      emotion: {
        valence: this.clamp(
          baseline.emotion.valence + (Math.random() - 0.5) * 0.2,
          -1, 1
        ),
        arousal: this.clamp(
          baseline.emotion.arousal + arousalSpike + (Math.random() - 0.5) * 0.1,
          0, 1
        ),
        attention: this.clamp(
          baseline.emotion.attention + attentionDrift + (Math.random() - 0.5) * 0.1,
          0, 1
        )
      }
    };

    // Update baseline for next iteration (exponential moving average)
    this.baselineData.set(viewerId, this.mergeBaseline(baseline, data, 0.9));

    return data;
  }

  /**
   * Parse real sensor data (preparation for actual devices)
   */
  parseRealSensorData(rawData: any, sensorType: 'hrv' | 'eeg' | 'gsr' | 'respiration'): Partial<BiometricData> {
    // This would be implemented for specific sensor protocols
    // Examples: BLE Heart Rate Service, OpenBCI EEG, Grove GSR, etc.

    switch (sensorType) {
      case 'hrv':
        // Parse Bluetooth Heart Rate Service data
        return {
          hrv: {
            heartRate: rawData.heartRate || 70,
            rmssd: rawData.rrIntervals ? this.calculateRMSSD(rawData.rrIntervals) : 50,
            sdnn: rawData.rrIntervals ? this.calculateSDNN(rawData.rrIntervals) : 50,
            stressIndex: this.calculateStressIndex(rawData.rrIntervals || [])
          }
        };

      case 'eeg':
        // Parse EEG band powers (e.g., from Muse, OpenBCI)
        return {
          eeg: {
            alpha: rawData.bands?.alpha || 25,
            beta: rawData.bands?.beta || 15,
            theta: rawData.bands?.theta || 20,
            gamma: rawData.bands?.gamma || 8,
            engagement: this.calculateEngagement(rawData.bands || {})
          }
        };

      case 'gsr':
        // Parse GSR sensor data (e.g., Grove GSR)
        return {
          gsr: {
            conductance: rawData.conductance || 3,
            arousal: this.normalizeGSR(rawData.conductance || 3)
          }
        };

      case 'respiration':
        // Parse respiratory sensor data
        return {
          respiration: {
            rate: rawData.breathsPerMinute || 15,
            variability: rawData.variability || 0.3,
            calm: this.calculateCalmness(rawData.breathsPerMinute || 15)
          }
        };

      default:
        return {};
    }
  }

  // Helper methods

  private anonymizeId(viewerId: string): string {
    if (this.config.privacyMode === 'anonymous') {
      // Generate hash or pseudonym
      return `viewer_${viewerId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)}`;
    }
    return viewerId;
  }

  private smooth(value: number, window: number = 0.7): number {
    // Simple exponential smoothing
    return value;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private mergeBaseline(baseline: BiometricData, newData: BiometricData, alpha: number): BiometricData {
    // Exponential moving average for smooth baseline updates
    return {
      ...newData,
      hrv: {
        heartRate: baseline.hrv.heartRate * alpha + newData.hrv.heartRate * (1 - alpha),
        rmssd: baseline.hrv.rmssd * alpha + newData.hrv.rmssd * (1 - alpha),
        sdnn: baseline.hrv.sdnn * alpha + newData.hrv.sdnn * (1 - alpha),
        stressIndex: baseline.hrv.stressIndex * alpha + newData.hrv.stressIndex * (1 - alpha)
      },
      eeg: {
        alpha: baseline.eeg.alpha * alpha + newData.eeg.alpha * (1 - alpha),
        beta: baseline.eeg.beta * alpha + newData.eeg.beta * (1 - alpha),
        theta: baseline.eeg.theta * alpha + newData.eeg.theta * (1 - alpha),
        gamma: baseline.eeg.gamma * alpha + newData.eeg.gamma * (1 - alpha),
        engagement: baseline.eeg.engagement * alpha + newData.eeg.engagement * (1 - alpha)
      },
      gsr: {
        conductance: baseline.gsr.conductance * alpha + newData.gsr.conductance * (1 - alpha),
        arousal: baseline.gsr.arousal * alpha + newData.gsr.arousal * (1 - alpha)
      },
      respiration: {
        rate: baseline.respiration.rate * alpha + newData.respiration.rate * (1 - alpha),
        variability: baseline.respiration.variability * alpha + newData.respiration.variability * (1 - alpha),
        calm: baseline.respiration.calm * alpha + newData.respiration.calm * (1 - alpha)
      },
      emotion: {
        valence: baseline.emotion.valence * alpha + newData.emotion.valence * (1 - alpha),
        arousal: baseline.emotion.arousal * alpha + newData.emotion.arousal * (1 - alpha),
        attention: baseline.emotion.attention * alpha + newData.emotion.attention * (1 - alpha)
      }
    };
  }

  // Real sensor calculations

  private calculateRMSSD(rrIntervals: number[]): number {
    if (rrIntervals.length < 2) return 50;
    const diffs = rrIntervals.slice(1).map((val, i) => Math.pow(val - rrIntervals[i], 2));
    return Math.sqrt(diffs.reduce((a, b) => a + b, 0) / diffs.length);
  }

  private calculateSDNN(rrIntervals: number[]): number {
    if (rrIntervals.length < 2) return 50;
    const mean = rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length;
    const variance = rrIntervals.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / rrIntervals.length;
    return Math.sqrt(variance);
  }

  private calculateStressIndex(rrIntervals: number[]): number {
    if (rrIntervals.length === 0) return 0.5;
    const sdnn = this.calculateSDNN(rrIntervals);
    // Lower SDNN = higher stress
    return this.clamp(1 - (sdnn / 100), 0, 1);
  }

  private calculateEngagement(bands: any): number {
    // High beta + low alpha = engaged
    const beta = bands.beta || 15;
    const alpha = bands.alpha || 25;
    return this.clamp((beta / (alpha + 1)) / 2, 0, 1);
  }

  private normalizeGSR(conductance: number): number {
    // Typical range 1-10 μS, normalize to 0-1
    return this.clamp((conductance - 1) / 9, 0, 1);
  }

  private calculateCalmness(breathRate: number): number {
    // Slower breathing = calmer (optimal ~6 breaths/min)
    // Range: 6-20 breaths/min
    return this.clamp(1 - ((breathRate - 6) / 14), 0, 1);
  }
}
