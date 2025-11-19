/**
 * Observatory - Real-time Monitoring Across All Dimensions
 *
 * The control center for observing the Xenosphere in action
 */

import { Xenosphere } from './xenosphere.js';
import { XenosphereState } from './interfaces.js';

export interface ObservatoryMetrics {
  timestamp: number;

  // Hyperdimensional metrics
  hdSpace: {
    dimensions: number;
    totalVectors: number;
    density: number;
    entropy: number;
    memoryUsage: string;
  };

  // Stigmergy metrics
  emergence: {
    patterns: number;
    convergencePoints: number;
    activity: number;
    trailStrength: number;
  };

  // Chrono metrics
  temporal: {
    moonPhase: string;
    circadianPhase: string;
    seasonalContext: string;
    astronomicalEvents: string[];
  };

  // Biodata metrics
  collective: {
    coherence: number;
    synchronization: number;
    emotionalValence: number;
    resonantPeaks: number[];
  };

  // System health
  health: {
    overall: number;
    subsystems: {
      hyperdimensional: number;
      stigmergy: number;
      chrono: number;
      biodata: number;
    };
    warnings: string[];
  };
}

/**
 * Observatory: Monitor and visualize the Xenosphere
 */
export class Observatory {
  private sphere: Xenosphere;
  private history: ObservatoryMetrics[] = [];
  private maxHistory: number = 1000;

  constructor(sphere: Xenosphere) {
    this.sphere = sphere;
  }

  /**
   * Capture current metrics snapshot
   */
  public capture(): ObservatoryMetrics {
    const state = this.sphere.getState();
    const rawMetrics = this.sphere.getMetrics();

    const metrics: ObservatoryMetrics = {
      timestamp: Date.now(),

      hdSpace: {
        dimensions: 10000,
        totalVectors: rawMetrics.hyperdimensional.entries,
        density: rawMetrics.hyperdimensional.density,
        entropy: rawMetrics.hyperdimensional.entropy,
        memoryUsage: this.formatBytes(rawMetrics.hyperdimensional.entries * 1250) // ~1.25KB per vector
      },

      emergence: {
        patterns: rawMetrics.stigmergy.emergentPatterns,
        convergencePoints: rawMetrics.stigmergy.convergencePoints,
        activity: rawMetrics.stigmergy.activity,
        trailStrength: 0.5 // Would calculate from actual trails
      },

      temporal: {
        moonPhase: this.formatMoonPhase(state.astronomicalState.moonPhase),
        circadianPhase: this.formatCircadian(state.astronomicalState.circadianPhase),
        seasonalContext: state.temporalContext,
        astronomicalEvents: state.astronomicalState.astrological
      },

      collective: {
        coherence: state.collectiveCoherence.collective,
        synchronization: state.collectiveCoherence.synchronization,
        emotionalValence: state.emotionalField.valence,
        resonantPeaks: state.collectiveCoherence.resonance
      },

      health: {
        overall: state.systemHealth,
        subsystems: {
          hyperdimensional: 1.0,
          stigmergy: 0.75, // Stub implementation
          chrono: 0.75, // Stub implementation
          biodata: 0.75 // Stub implementation
        },
        warnings: this.detectWarnings(state)
      }
    };

    // Add to history
    this.history.push(metrics);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    return metrics;
  }

  /**
   * Get metrics history
   */
  public getHistory(duration?: number): ObservatoryMetrics[] {
    if (!duration) return this.history;

    const cutoff = Date.now() - duration;
    return this.history.filter(m => m.timestamp > cutoff);
  }

  /**
   * Generate real-time dashboard (text-based)
   */
  public dashboard(): string {
    const metrics = this.capture();

    return `
╔═══════════════════════════════════════════════════════════════════════╗
║                    XENOSPHERE OBSERVATORY                             ║
║                   ${new Date(metrics.timestamp).toISOString()}                    ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║  🌌 HYPERDIMENSIONAL SPACE                                           ║
║     Dimensions:  ${metrics.hdSpace.dimensions.toLocaleString()}                                         ║
║     Vectors:     ${metrics.hdSpace.totalVectors.toLocaleString()}                                             ║
║     Density:     ${this.progressBar(metrics.hdSpace.density, 40)}  ${(metrics.hdSpace.density * 100).toFixed(1)}%  ║
║     Entropy:     ${this.progressBar(metrics.hdSpace.entropy, 40)}  ${(metrics.hdSpace.entropy * 100).toFixed(1)}%  ║
║     Memory:      ${metrics.hdSpace.memoryUsage}                                      ║
║                                                                       ║
║  🐜 STIGMERGIC EMERGENCE                                             ║
║     Patterns:    ${metrics.emergence.patterns} detected                                    ║
║     Convergence: ${metrics.emergence.convergencePoints} points                                     ║
║     Activity:    ${this.progressBar(metrics.emergence.activity, 40)}  ${(metrics.emergence.activity * 100).toFixed(1)}%  ║
║     Trails:      ${this.progressBar(metrics.emergence.trailStrength, 40)}  ${(metrics.emergence.trailStrength * 100).toFixed(1)}%  ║
║                                                                       ║
║  🌙 CHRONOLOGICAL CONTEXT                                            ║
║     Moon:        ${metrics.temporal.moonPhase.padEnd(46)}║
║     Circadian:   ${metrics.temporal.circadianPhase.padEnd(46)}║
║     Season:      ${metrics.temporal.seasonalContext.padEnd(46)}║
║                                                                       ║
║  💓 COLLECTIVE BIODATA                                               ║
║     Coherence:   ${this.progressBar(metrics.collective.coherence, 40)}  ${(metrics.collective.coherence * 100).toFixed(1)}%  ║
║     Sync:        ${this.progressBar(metrics.collective.synchronization, 40)}  ${(metrics.collective.synchronization * 100).toFixed(1)}%  ║
║     Emotion:     ${this.emotionBar(metrics.collective.emotionalValence)}           ║
║     Resonance:   ${metrics.collective.resonantPeaks.map(f => f.toFixed(0) + 'Hz').join(', ')}                       ║
║                                                                       ║
║  ⚡ SYSTEM HEALTH                                                     ║
║     Overall:     ${this.progressBar(metrics.health.overall, 40)}  ${(metrics.health.overall * 100).toFixed(1)}%  ║
║     HD:          ${this.progressBar(metrics.health.subsystems.hyperdimensional, 20)} ${(metrics.health.subsystems.hyperdimensional * 100).toFixed(0)}%  ║
║     Stigmergy:   ${this.progressBar(metrics.health.subsystems.stigmergy, 20)} ${(metrics.health.subsystems.stigmergy * 100).toFixed(0)}%  ║
║     Chrono:      ${this.progressBar(metrics.health.subsystems.chrono, 20)} ${(metrics.health.subsystems.chrono * 100).toFixed(0)}%  ║
║     Biodata:     ${this.progressBar(metrics.health.subsystems.biodata, 20)} ${(metrics.health.subsystems.biodata * 100).toFixed(0)}%  ║
${metrics.health.warnings.length > 0 ? '║                                                                       ║\n║  ⚠️  WARNINGS:                                                        ║\n' + metrics.health.warnings.map(w => `║     • ${w.padEnd(60)}║`).join('\n') : ''}
╚═══════════════════════════════════════════════════════════════════════╝
    `.trim();
  }

  /**
   * Detect anomalies and trends
   */
  public analyze(): {
    anomalies: string[];
    trends: string[];
    recommendations: string[];
  } {
    const recent = this.getHistory(60000); // Last minute
    if (recent.length < 2) {
      return {
        anomalies: [],
        trends: [],
        recommendations: ['Insufficient data for analysis']
      };
    }

    const anomalies: string[] = [];
    const trends: string[] = [];
    const recommendations: string[] = [];

    // Check for anomalies
    const latest = recent[recent.length - 1];
    if (latest.health.overall < 0.7) {
      anomalies.push('System health below 70%');
    }
    if (latest.hdSpace.entropy > 0.9) {
      anomalies.push('Hyperdimensional entropy very high');
    }
    if (latest.collective.coherence < 0.3) {
      anomalies.push('Low collective coherence');
    }

    // Analyze trends
    const coherenceTrend = this.calculateTrend(recent.map(m => m.collective.coherence));
    if (coherenceTrend > 0.1) {
      trends.push('Coherence increasing');
    } else if (coherenceTrend < -0.1) {
      trends.push('Coherence decreasing');
    }

    const entropyTrend = this.calculateTrend(recent.map(m => m.hdSpace.entropy));
    if (entropyTrend > 0.1) {
      trends.push('System complexity increasing');
    }

    // Generate recommendations
    if (latest.emergence.patterns === 0) {
      recommendations.push('Consider increasing swarm activity to generate emergence');
    }
    if (latest.collective.coherence < 0.5) {
      recommendations.push('Enhance biofeedback loops to improve coherence');
    }
    if (latest.hdSpace.entropy < 0.3) {
      recommendations.push('System underutilized - consider adding more data');
    }

    return { anomalies, trends, recommendations };
  }

  // =========================================================================
  // VISUALIZATION HELPERS
  // =========================================================================

  private progressBar(value: number, length: number): string {
    const filled = Math.round(value * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  private emotionBar(valence: number): string {
    // -1 (negative) to +1 (positive)
    const center = 20;
    const pos = Math.round((valence + 1) * center);

    let bar = '│' + ' '.repeat(40) + '│';
    const chars = bar.split('');
    chars[pos] = '●';
    bar = chars.join('');

    const label = valence < -0.3 ? '😟 Negative' :
                  valence > 0.3 ? '😊 Positive' : '😐 Neutral';

    return bar + '  ' + label;
  }

  private formatMoonPhase(phase: number): string {
    const emoji = phase < 0.125 ? '🌑' :
                  phase < 0.375 ? '🌒' :
                  phase < 0.625 ? '🌕' :
                  phase < 0.875 ? '🌘' : '🌑';

    const name = phase < 0.125 ? 'New Moon' :
                 phase < 0.375 ? 'Waxing Crescent' :
                 phase < 0.625 ? 'Full Moon' :
                 phase < 0.875 ? 'Waning Gibbous' : 'New Moon';

    return `${emoji} ${name} (${(phase * 100).toFixed(1)}%)`;
  }

  private formatCircadian(phase: number): string {
    const hour = Math.floor(phase * 24);
    const period = hour < 6 ? 'Night' :
                   hour < 12 ? 'Morning' :
                   hour < 18 ? 'Afternoon' : 'Evening';

    return `${period} (~${hour}:00)`;
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  private detectWarnings(state: XenosphereState): string[] {
    const warnings: string[] = [];

    if (state.systemHealth < 0.7) {
      warnings.push('System health degraded');
    }
    if (state.vectorSpace.entropy > 0.95) {
      warnings.push('Hyperdimensional space near capacity');
    }
    if (state.collectiveCoherence.collective < 0.2) {
      warnings.push('Collective coherence very low');
    }

    return warnings;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const first = values[0];
    const last = values[values.length - 1];

    return (last - first) / first;
  }

  /**
   * Export metrics for external analysis
   */
  public export(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.history, null, 2);
    }

    // CSV format
    const headers = 'timestamp,hdDensity,hdEntropy,emergence,coherence,synchronization,health\n';
    const rows = this.history.map(m =>
      `${m.timestamp},${m.hdSpace.density},${m.hdSpace.entropy},${m.emergence.activity},${m.collective.coherence},${m.collective.synchronization},${m.health.overall}`
    ).join('\n');

    return headers + rows;
  }
}

/**
 * Create an observatory for monitoring
 */
export function createObservatory(sphere: Xenosphere): Observatory {
  return new Observatory(sphere);
}
