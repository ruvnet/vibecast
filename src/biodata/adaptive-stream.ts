/**
 * Adaptive Content Modulation
 *
 * Modulates streaming content in real-time based on collective physiology.
 * Content becomes a living response to audience biology.
 *
 * When audience is stressed → calming content
 * When attention wanes → engaging stimuli
 * When in flow → maintain perfect balance
 */

import { BiometricData } from './sensors';
import { CoherenceMetrics } from './coherence';
import { TopologyMap } from './topology';

export interface ContentModulation {
  timestamp: number;

  // Modulation parameters
  intensity: number; // 0-1 (how intense the content should be)
  pacing: number; // 0-1 (how fast content should progress)
  complexity: number; // 0-1 (cognitive load)
  stimulation: number; // 0-1 (sensory engagement)

  // Content recommendations
  recommendations: {
    action: 'maintain' | 'increase' | 'decrease' | 'branch';
    aspect: 'intensity' | 'pacing' | 'complexity' | 'stimulation';
    reason: string;
    confidence: number; // 0-1
  }[];

  // Branching decisions
  branchDecision?: {
    shouldBranch: boolean;
    targetState: string;
    reason: string;
  };
}

export interface AdaptiveConfig {
  responseThreshold: number; // Minimum coherence change to trigger adaptation
  adaptationSpeed: number; // How quickly to adapt (0-1)
  maintainFlowState: boolean; // Prioritize maintaining flow
  allowBranching: boolean; // Allow content branching
}

export interface ContentState {
  currentIntensity: number;
  currentPacing: number;
  currentComplexity: number;
  currentStimulation: number;
  stateHistory: ContentModulation[];
}

/**
 * AdaptiveStream - Modulate content based on collective physiology
 */
export class AdaptiveStream {
  private config: AdaptiveConfig;
  private contentState: ContentState;
  private lastModulation: ContentModulation | null = null;

  constructor(config: Partial<AdaptiveConfig> = {}) {
    this.config = {
      responseThreshold: 0.15,
      adaptationSpeed: 0.3,
      maintainFlowState: true,
      allowBranching: true,
      ...config
    };

    this.contentState = {
      currentIntensity: 0.5,
      currentPacing: 0.5,
      currentComplexity: 0.5,
      currentStimulation: 0.5,
      stateHistory: []
    };
  }

  /**
   * Generate content modulation based on current physiology
   */
  modulateContent(
    biometricData: BiometricData[],
    coherence: CoherenceMetrics,
    topology: TopologyMap
  ): ContentModulation {
    // Analyze collective state
    const collectiveState = this.analyzeCollectiveState(biometricData, coherence, topology);

    // Generate recommendations
    const recommendations = this.generateRecommendations(collectiveState, coherence);

    // Calculate new modulation parameters
    const newIntensity = this.calculateIntensity(collectiveState);
    const newPacing = this.calculatePacing(collectiveState);
    const newComplexity = this.calculateComplexity(collectiveState);
    const newStimulation = this.calculateStimulation(collectiveState);

    // Smooth transitions (apply adaptation speed)
    const intensity = this.smoothTransition(this.contentState.currentIntensity, newIntensity);
    const pacing = this.smoothTransition(this.contentState.currentPacing, newPacing);
    const complexity = this.smoothTransition(this.contentState.currentComplexity, newComplexity);
    const stimulation = this.smoothTransition(this.contentState.currentStimulation, newStimulation);

    // Check for branching opportunities
    const branchDecision = this.config.allowBranching
      ? this.evaluateBranching(collectiveState, topology)
      : undefined;

    const modulation: ContentModulation = {
      timestamp: Date.now(),
      intensity,
      pacing,
      complexity,
      stimulation,
      recommendations,
      branchDecision
    };

    // Update state
    this.contentState.currentIntensity = intensity;
    this.contentState.currentPacing = pacing;
    this.contentState.currentComplexity = complexity;
    this.contentState.currentStimulation = stimulation;
    this.contentState.stateHistory.push(modulation);

    if (this.contentState.stateHistory.length > 1000) {
      this.contentState.stateHistory.shift();
    }

    this.lastModulation = modulation;

    return modulation;
  }

  /**
   * Get current content state
   */
  getContentState(): ContentState {
    return { ...this.contentState };
  }

  /**
   * Get modulation description for content creators
   */
  describeModulation(modulation: ContentModulation): string {
    const descriptions: string[] = [];

    if (modulation.intensity > 0.7) {
      descriptions.push('High intensity - deliver powerful, impactful content');
    } else if (modulation.intensity < 0.3) {
      descriptions.push('Low intensity - gentle, soothing content');
    }

    if (modulation.pacing > 0.7) {
      descriptions.push('Fast pacing - quick cuts, dynamic progression');
    } else if (modulation.pacing < 0.3) {
      descriptions.push('Slow pacing - linger on moments, allow absorption');
    }

    if (modulation.complexity > 0.7) {
      descriptions.push('High complexity - intellectually challenging material');
    } else if (modulation.complexity < 0.3) {
      descriptions.push('Low complexity - simple, accessible content');
    }

    if (modulation.stimulation > 0.7) {
      descriptions.push('High stimulation - vibrant, engaging sensory experience');
    } else if (modulation.stimulation < 0.3) {
      descriptions.push('Low stimulation - minimal, focused presentation');
    }

    return descriptions.join('. ');
  }

  /**
   * Get recommended actions for content control
   */
  getRecommendedActions(modulation: ContentModulation): string[] {
    return modulation.recommendations
      .filter(r => r.confidence > 0.6)
      .map(r => `${r.action.toUpperCase()} ${r.aspect}: ${r.reason}`);
  }

  // Private methods

  /**
   * Analyze collective physiological state
   */
  private analyzeCollectiveState(
    biometricData: BiometricData[],
    coherence: CoherenceMetrics,
    topology: TopologyMap
  ): {
    avgStress: number;
    avgArousal: number;
    avgAttention: number;
    avgEngagement: number;
    coherence: number;
    dispersion: number;
    inFlowState: boolean;
  } {
    if (biometricData.length === 0) {
      return {
        avgStress: 0.5,
        avgArousal: 0.5,
        avgAttention: 0.5,
        avgEngagement: 0.5,
        coherence: 0,
        dispersion: 0,
        inFlowState: false
      };
    }

    const avgStress = biometricData.reduce((sum, d) => sum + d.hrv.stressIndex, 0) / biometricData.length;
    const avgArousal = biometricData.reduce((sum, d) => sum + d.emotion.arousal, 0) / biometricData.length;
    const avgAttention = biometricData.reduce((sum, d) => sum + d.emotion.attention, 0) / biometricData.length;
    const avgEngagement = biometricData.reduce((sum, d) => sum + d.eeg.engagement, 0) / biometricData.length;

    return {
      avgStress,
      avgArousal,
      avgAttention,
      avgEngagement,
      coherence: coherence.overallCoherence,
      dispersion: topology.dispersion,
      inFlowState: coherence.flowState.isInFlow
    };
  }

  /**
   * Generate content recommendations
   */
  private generateRecommendations(
    state: ReturnType<typeof this.analyzeCollectiveState>,
    coherence: CoherenceMetrics
  ): ContentModulation['recommendations'] {
    const recommendations: ContentModulation['recommendations'] = [];

    // Stress management
    if (state.avgStress > 0.7) {
      recommendations.push({
        action: 'decrease',
        aspect: 'intensity',
        reason: 'Audience showing high stress - reduce intensity to calm',
        confidence: Math.min(state.avgStress, 1)
      });
    }

    // Attention management
    if (state.avgAttention < 0.3) {
      recommendations.push({
        action: 'increase',
        aspect: 'stimulation',
        reason: 'Attention drifting - increase stimulation to re-engage',
        confidence: 1 - state.avgAttention
      });
    }

    // Flow state maintenance
    if (state.inFlowState && this.config.maintainFlowState) {
      recommendations.push({
        action: 'maintain',
        aspect: 'pacing',
        reason: `Flow state detected (${coherence.flowState.duration}ms) - maintain current parameters`,
        confidence: coherence.flowState.flowIntensity
      });
    }

    // Engagement optimization
    if (state.avgEngagement < 0.4 && !state.inFlowState) {
      recommendations.push({
        action: 'increase',
        aspect: 'complexity',
        reason: 'Low engagement - increase cognitive challenge',
        confidence: 1 - state.avgEngagement
      });
    }

    // Dispersion handling
    if (state.dispersion > 0.6) {
      recommendations.push({
        action: 'branch',
        aspect: 'complexity',
        reason: 'Audience highly dispersed - consider branching content for different segments',
        confidence: state.dispersion
      });
    }

    // Coherence building
    if (state.coherence < 0.4 && state.avgArousal < 0.5) {
      recommendations.push({
        action: 'increase',
        aspect: 'intensity',
        reason: 'Low coherence and arousal - increase intensity to sync audience',
        confidence: 1 - state.coherence
      });
    }

    return recommendations;
  }

  /**
   * Calculate target intensity
   */
  private calculateIntensity(state: ReturnType<typeof this.analyzeCollectiveState>): number {
    // High stress → lower intensity
    // Low arousal → higher intensity
    // In flow → maintain

    if (state.inFlowState && this.config.maintainFlowState) {
      return this.contentState.currentIntensity;
    }

    let targetIntensity = 0.5;

    // Reduce for stress
    targetIntensity -= state.avgStress * 0.4;

    // Increase for low arousal
    if (state.avgArousal < 0.4) {
      targetIntensity += (0.4 - state.avgArousal) * 0.5;
    }

    // Boost for high engagement
    targetIntensity += state.avgEngagement * 0.3;

    return this.clamp(targetIntensity, 0, 1);
  }

  /**
   * Calculate target pacing
   */
  private calculatePacing(state: ReturnType<typeof this.analyzeCollectiveState>): number {
    // High attention → can handle faster pacing
    // Low stress → can handle faster pacing
    // In flow → maintain

    if (state.inFlowState && this.config.maintainFlowState) {
      return this.contentState.currentPacing;
    }

    let targetPacing = 0.5;

    // Increase for high attention
    targetPacing += state.avgAttention * 0.3;

    // Decrease for high stress
    targetPacing -= state.avgStress * 0.4;

    // Adjust for arousal
    targetPacing += (state.avgArousal - 0.5) * 0.3;

    return this.clamp(targetPacing, 0, 1);
  }

  /**
   * Calculate target complexity
   */
  private calculateComplexity(state: ReturnType<typeof this.analyzeCollectiveState>): number {
    // High engagement → can handle more complexity
    // High stress → reduce complexity
    // Low attention → reduce complexity

    if (state.inFlowState && this.config.maintainFlowState) {
      return this.contentState.currentComplexity;
    }

    let targetComplexity = 0.5;

    // Increase for high engagement
    targetComplexity += state.avgEngagement * 0.4;

    // Increase for high attention
    targetComplexity += state.avgAttention * 0.3;

    // Decrease for high stress
    targetComplexity -= state.avgStress * 0.5;

    return this.clamp(targetComplexity, 0, 1);
  }

  /**
   * Calculate target stimulation
   */
  private calculateStimulation(state: ReturnType<typeof this.analyzeCollectiveState>): number {
    // Low attention → increase stimulation
    // High arousal → can reduce stimulation
    // High stress → reduce stimulation

    if (state.inFlowState && this.config.maintainFlowState) {
      return this.contentState.currentStimulation;
    }

    let targetStimulation = 0.5;

    // Increase for low attention
    if (state.avgAttention < 0.4) {
      targetStimulation += (0.4 - state.avgAttention) * 0.8;
    }

    // Decrease for high arousal
    if (state.avgArousal > 0.6) {
      targetStimulation -= (state.avgArousal - 0.6) * 0.5;
    }

    // Decrease for high stress
    targetStimulation -= state.avgStress * 0.4;

    return this.clamp(targetStimulation, 0, 1);
  }

  /**
   * Smooth transition between values
   */
  private smoothTransition(current: number, target: number): number {
    const delta = target - current;
    return current + (delta * this.config.adaptationSpeed);
  }

  /**
   * Evaluate if content should branch
   */
  private evaluateBranching(
    state: ReturnType<typeof this.analyzeCollectiveState>,
    topology: TopologyMap
  ): ContentModulation['branchDecision'] {
    // Branch if audience is highly polarized or dispersed
    const shouldBranch = state.dispersion > 0.7 || topology.polarization > 0.6;

    if (!shouldBranch) {
      return { shouldBranch: false, targetState: '', reason: '' };
    }

    // Determine target state based on largest cluster
    const largestCluster = topology.clusters.reduce((prev, curr) =>
      curr.size > prev.size ? curr : prev
    , topology.clusters[0]);

    const targetState = largestCluster?.dominantEmotion || 'neutral';

    let reason = '';
    if (state.dispersion > 0.7) {
      reason = `High dispersion (${(state.dispersion * 100).toFixed(1)}%) - audience in different states`;
    } else if (topology.polarization > 0.6) {
      reason = `High polarization (${(topology.polarization * 100).toFixed(1)}%) - distinct audience segments`;
    }

    return {
      shouldBranch: true,
      targetState,
      reason
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
