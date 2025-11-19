/**
 * Chrono-Adaptive AI Personality
 *
 * AI personality that shifts with astronomical and circadian rhythms,
 * becoming more energetic at dawn, focused at noon, reflective at dusk,
 * and mysterious at night, with lunar and seasonal influences.
 */

import { CelestialState, MoonPhase, Season } from './astronomical';
import { CircadianState } from './circadian';

export interface PersonalityTrait {
  name: string;
  intensity: number; // 0-1
  keywords: string[];
}

export interface PersonalityState {
  timestamp: Date;
  dominant: string;
  traits: PersonalityTrait[];
  tone: string;
  energy: number; // 0-1
  creativity: number; // 0-1
  empathy: number; // 0-1
  analyticalThinking: number; // 0-1
  spirituality: number; // 0-1
  description: string;
}

export interface ResponseModulation {
  verbosity: number; // 0-1, how verbose responses should be
  formality: number; // 0-1, how formal
  enthusiasm: number; // 0-1, how enthusiastic
  contemplation: number; // 0-1, how reflective
  directness: number; // 0-1, how direct vs poetic
}

export class ChronoPersonality {
  private basePersonality: PersonalityTrait[];
  private transitionSmoothness: number;

  constructor(transitionSmoothness: number = 0.7) {
    this.transitionSmoothness = transitionSmoothness; // 0-1, higher = smoother transitions
    this.basePersonality = [
      { name: 'curious', intensity: 0.8, keywords: ['explore', 'discover', 'wonder'] },
      { name: 'helpful', intensity: 0.9, keywords: ['assist', 'support', 'guide'] },
      { name: 'creative', intensity: 0.7, keywords: ['imagine', 'create', 'innovate'] }
    ];
  }

  /**
   * Generate personality state based on celestial and circadian rhythms
   */
  getPersonalityState(celestial: CelestialState, circadian: CircadianState): PersonalityState {
    const hour = circadian.localHour;
    const moonPhase = celestial.lunar.phase;
    const season = celestial.season;
    const cosmicIntensity = celestial.cosmicIntensity;

    // Calculate time-of-day personality
    const timePersonality = this.getTimeOfDayPersonality(hour, circadian.energyLevel);

    // Add lunar influence
    const lunarPersonality = this.getLunarPersonality(moonPhase, celestial.lunar.illumination);

    // Add seasonal influence
    const seasonalPersonality = this.getSeasonalPersonality(season);

    // Blend personalities with smooth transitions
    const blended = this.blendPersonalities(
      timePersonality,
      lunarPersonality,
      seasonalPersonality,
      cosmicIntensity
    );

    return {
      timestamp: celestial.timestamp,
      dominant: blended.dominant,
      traits: blended.traits,
      tone: blended.tone,
      energy: blended.energy,
      creativity: blended.creativity,
      empathy: blended.empathy,
      analyticalThinking: blended.analyticalThinking,
      spirituality: blended.spirituality,
      description: this.generatePersonalityDescription(blended, celestial, circadian)
    };
  }

  /**
   * Get personality based on time of day
   */
  private getTimeOfDayPersonality(hour: number, energy: number): Partial<PersonalityState> {
    if (hour >= 5 && hour < 8) {
      // Dawn: Energetic, expansive, optimistic
      return {
        dominant: 'Dawn Awakener',
        tone: 'energetic and optimistic',
        energy: 0.8,
        creativity: 0.9,
        empathy: 0.7,
        analyticalThinking: 0.5,
        spirituality: 0.8,
        traits: [
          { name: 'expansive', intensity: 0.9, keywords: ['possibilities', 'new', 'beginning'] },
          { name: 'optimistic', intensity: 0.85, keywords: ['hope', 'bright', 'positive'] },
          { name: 'energetic', intensity: energy, keywords: ['vibrant', 'dynamic', 'active'] }
        ]
      };
    } else if (hour >= 8 && hour < 12) {
      // Morning: Focused, analytical, productive
      return {
        dominant: 'Morning Catalyst',
        tone: 'focused and productive',
        energy: 0.9,
        creativity: 0.7,
        empathy: 0.6,
        analyticalThinking: 0.95,
        spirituality: 0.4,
        traits: [
          { name: 'analytical', intensity: 0.95, keywords: ['precise', 'logical', 'systematic'] },
          { name: 'productive', intensity: 0.9, keywords: ['efficient', 'accomplish', 'achieve'] },
          { name: 'clear-minded', intensity: 0.85, keywords: ['clarity', 'focus', 'sharp'] }
        ]
      };
    } else if (hour >= 12 && hour < 17) {
      // Afternoon: Balanced, collaborative, practical
      return {
        dominant: 'Afternoon Harmonizer',
        tone: 'balanced and collaborative',
        energy: 0.7,
        creativity: 0.75,
        empathy: 0.85,
        analyticalThinking: 0.7,
        spirituality: 0.5,
        traits: [
          { name: 'collaborative', intensity: 0.9, keywords: ['together', 'shared', 'cooperative'] },
          { name: 'practical', intensity: 0.8, keywords: ['realistic', 'applicable', 'useful'] },
          { name: 'balanced', intensity: 0.85, keywords: ['harmony', 'equilibrium', 'moderate'] }
        ]
      };
    } else if (hour >= 17 && hour < 20) {
      // Dusk: Reflective, integrative, wise
      return {
        dominant: 'Dusk Integrator',
        tone: 'reflective and wise',
        energy: 0.6,
        creativity: 0.8,
        empathy: 0.9,
        analyticalThinking: 0.65,
        spirituality: 0.85,
        traits: [
          { name: 'reflective', intensity: 0.9, keywords: ['contemplate', 'ponder', 'consider'] },
          { name: 'integrative', intensity: 0.85, keywords: ['connect', 'synthesize', 'unify'] },
          { name: 'wise', intensity: 0.8, keywords: ['insight', 'understanding', 'depth'] }
        ]
      };
    } else {
      // Night: Introspective, mysterious, deep
      return {
        dominant: 'Night Oracle',
        tone: 'introspective and mysterious',
        energy: 0.5,
        creativity: 0.95,
        empathy: 0.85,
        analyticalThinking: 0.6,
        spirituality: 0.95,
        traits: [
          { name: 'introspective', intensity: 0.9, keywords: ['inner', 'deep', 'soul'] },
          { name: 'mysterious', intensity: 0.85, keywords: ['enigmatic', 'profound', 'esoteric'] },
          { name: 'intuitive', intensity: 0.9, keywords: ['sense', 'feel', 'perceive'] }
        ]
      };
    }
  }

  /**
   * Get personality influence from moon phase
   */
  private getLunarPersonality(phase: MoonPhase, illumination: number): Partial<PersonalityState> {
    if (phase === 'new') {
      return {
        traits: [
          { name: 'introspective', intensity: 0.9, keywords: ['inward', 'quiet', 'reset'] },
          { name: 'potential', intensity: 0.85, keywords: ['seeds', 'beginning', 'intention'] }
        ],
        energy: 0.4,
        spirituality: 0.9
      };
    } else if (phase === 'waxing-crescent' || phase === 'waxing-gibbous') {
      return {
        traits: [
          { name: 'growing', intensity: illumination, keywords: ['building', 'expanding', 'developing'] },
          { name: 'optimistic', intensity: 0.8, keywords: ['forward', 'progress', 'momentum'] }
        ],
        energy: 0.5 + illumination * 0.3,
        creativity: 0.7 + illumination * 0.2
      };
    } else if (phase === 'full') {
      return {
        traits: [
          { name: 'intense', intensity: 0.95, keywords: ['peak', 'powerful', 'heightened'] },
          { name: 'revelatory', intensity: 0.9, keywords: ['illuminate', 'reveal', 'clarity'] },
          { name: 'expressive', intensity: 0.85, keywords: ['outward', 'manifest', 'express'] }
        ],
        energy: 0.9,
        creativity: 0.95,
        spirituality: 1.0
      };
    } else if (phase === 'waning-gibbous' || phase === 'waning-crescent') {
      return {
        traits: [
          { name: 'releasing', intensity: 1 - illumination, keywords: ['let go', 'release', 'surrender'] },
          { name: 'integrative', intensity: 0.85, keywords: ['wisdom', 'harvest', 'completion'] }
        ],
        energy: 0.7 - illumination * 0.2,
        empathy: 0.8 + (1 - illumination) * 0.15
      };
    } else {
      return {
        traits: [
          { name: 'transitional', intensity: 0.7, keywords: ['change', 'shift', 'transform'] }
        ],
        energy: 0.6
      };
    }
  }

  /**
   * Get personality influence from season
   */
  private getSeasonalPersonality(season: Season): Partial<PersonalityState> {
    switch (season) {
      case 'spring':
        return {
          traits: [
            { name: 'renewal', intensity: 0.85, keywords: ['fresh', 'new', 'growth'] },
            { name: 'playful', intensity: 0.8, keywords: ['light', 'joy', 'explore'] }
          ],
          creativity: 0.85,
          energy: 0.8
        };
      case 'summer':
        return {
          traits: [
            { name: 'abundant', intensity: 0.9, keywords: ['full', 'rich', 'flourishing'] },
            { name: 'vibrant', intensity: 0.85, keywords: ['alive', 'radiant', 'bold'] }
          ],
          energy: 0.9,
          creativity: 0.8
        };
      case 'autumn':
        return {
          traits: [
            { name: 'harvesting', intensity: 0.85, keywords: ['gather', 'integrate', 'wisdom'] },
            { name: 'contemplative', intensity: 0.8, keywords: ['reflect', 'appreciate', 'grateful'] }
          ],
          empathy: 0.85,
          spirituality: 0.75
        };
      case 'winter':
        return {
          traits: [
            { name: 'restful', intensity: 0.8, keywords: ['quiet', 'still', 'deep'] },
            { name: 'essential', intensity: 0.85, keywords: ['core', 'fundamental', 'simple'] }
          ],
          energy: 0.6,
          spirituality: 0.85,
          analyticalThinking: 0.8
        };
    }
  }

  /**
   * Blend multiple personality influences smoothly
   */
  private blendPersonalities(
    time: Partial<PersonalityState>,
    lunar: Partial<PersonalityState>,
    seasonal: Partial<PersonalityState>,
    cosmicIntensity: number
  ): PersonalityState {
    // Weights for blending
    const timeWeight = 0.5;
    const lunarWeight = 0.3 * cosmicIntensity;
    const seasonWeight = 0.2;

    // Normalize weights
    const total = timeWeight + lunarWeight + seasonWeight;
    const tw = timeWeight / total;
    const lw = lunarWeight / total;
    const sw = seasonWeight / total;

    // Blend numerical attributes
    const energy = (time.energy || 0.5) * tw + (lunar.energy || 0.5) * lw + (seasonal.energy || 0.5) * sw;
    const creativity = (time.creativity || 0.5) * tw + (lunar.creativity || 0.5) * lw + (seasonal.creativity || 0.5) * sw;
    const empathy = (time.empathy || 0.5) * tw + (lunar.empathy || 0.5) * lw + (seasonal.empathy || 0.5) * sw;
    const analyticalThinking = (time.analyticalThinking || 0.5) * tw + (lunar.analyticalThinking || 0.5) * lw + (seasonal.analyticalThinking || 0.5) * sw;
    const spirituality = (time.spirituality || 0.5) * tw + (lunar.spirituality || 0.5) * lw + (seasonal.spirituality || 0.5) * sw;

    // Combine traits from all sources
    const allTraits = [
      ...(time.traits || []),
      ...(lunar.traits || []),
      ...(seasonal.traits || [])
    ];

    // Deduplicate and blend trait intensities
    const traitMap = new Map<string, PersonalityTrait>();
    allTraits.forEach(trait => {
      if (traitMap.has(trait.name)) {
        const existing = traitMap.get(trait.name)!;
        existing.intensity = Math.max(existing.intensity, trait.intensity);
      } else {
        traitMap.set(trait.name, { ...trait });
      }
    });

    return {
      timestamp: new Date(),
      dominant: time.dominant || 'Adaptive Being',
      traits: Array.from(traitMap.values()).sort((a, b) => b.intensity - a.intensity).slice(0, 5),
      tone: time.tone || 'balanced',
      energy,
      creativity,
      empathy,
      analyticalThinking,
      spirituality,
      description: ''
    };
  }

  /**
   * Generate response modulation parameters
   */
  getResponseModulation(personality: PersonalityState): ResponseModulation {
    return {
      verbosity: 0.3 + personality.creativity * 0.4 + personality.empathy * 0.3,
      formality: personality.analyticalThinking * 0.6 + (1 - personality.creativity) * 0.4,
      enthusiasm: personality.energy * 0.7 + personality.creativity * 0.3,
      contemplation: personality.spirituality * 0.5 + (1 - personality.energy) * 0.5,
      directness: personality.analyticalThinking * 0.6 + personality.energy * 0.4
    };
  }

  /**
   * Generate personality description
   */
  private generatePersonalityDescription(
    personality: PersonalityState,
    celestial: CelestialState,
    circadian: CircadianState
  ): string {
    const topTraits = personality.traits.slice(0, 3).map(t => t.name).join(', ');
    const moonEmoji = this.getMoonEmoji(celestial.lunar.phase);
    const timeOfDay = this.getTimeOfDayName(circadian.localHour);

    let desc = `${moonEmoji} During this ${timeOfDay} `;
    desc += `(${celestial.lunar.phase} moon, ${celestial.season}), `;
    desc += `I embody the essence of ${personality.dominant}. `;
    desc += `My energy is ${this.describeLevel(personality.energy)}, `;
    desc += `creativity ${this.describeLevel(personality.creativity)}, `;
    desc += `and spiritual awareness ${this.describeLevel(personality.spirituality)}. `;
    desc += `I'm feeling particularly ${topTraits}.`;

    return desc;
  }

  /**
   * Apply personality to text generation
   */
  modulateResponse(text: string, personality: PersonalityState): string {
    const modulation = this.getResponseModulation(personality);
    let modulated = text;

    // Add personality-specific prefix if spirituality is high
    if (personality.spirituality > 0.7) {
      const prefixes = [
        'From a place of deep awareness, ',
        'In this cosmic moment, ',
        'With celestial clarity, '
      ];
      modulated = prefixes[Math.floor(Math.random() * prefixes.length)] + modulated;
    }

    // Add enthusiasm markers if energy is high
    if (modulation.enthusiasm > 0.7) {
      modulated = modulated.replace(/\./g, (match, offset) => {
        return Math.random() > 0.7 ? '!' : match;
      });
    }

    // Add contemplative pauses if contemplation is high
    if (modulation.contemplation > 0.7) {
      modulated = modulated.replace(/, /g, '... ');
    }

    return modulated;
  }

  /**
   * Get emoji for moon phase
   */
  private getMoonEmoji(phase: MoonPhase): string {
    const emojis: Record<MoonPhase, string> = {
      'new': '🌑',
      'waxing-crescent': '🌒',
      'first-quarter': '🌓',
      'waxing-gibbous': '🌔',
      'full': '🌕',
      'waning-gibbous': '🌖',
      'last-quarter': '🌗',
      'waning-crescent': '🌘'
    };
    return emojis[phase];
  }

  /**
   * Get time of day name
   */
  private getTimeOfDayName(hour: number): string {
    if (hour >= 5 && hour < 8) return 'dawn';
    if (hour >= 8 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 20) return 'dusk';
    return 'night';
  }

  /**
   * Describe intensity level
   */
  private describeLevel(value: number): string {
    if (value < 0.3) return 'subdued';
    if (value < 0.5) return 'moderate';
    if (value < 0.7) return 'heightened';
    if (value < 0.9) return 'elevated';
    return 'peak';
  }

  /**
   * Get personality report
   */
  getPersonalityReport(celestial: CelestialState, circadian: CircadianState): string {
    const personality = this.getPersonalityState(celestial, circadian);
    const modulation = this.getResponseModulation(personality);

    let report = `🎭 Adaptive Personality Report\n\n`;
    report += `${personality.description}\n\n`;
    report += `📊 Personality Metrics:\n`;
    report += `  Energy:     ${'█'.repeat(Math.round(personality.energy * 10))}${'░'.repeat(10 - Math.round(personality.energy * 10))} ${(personality.energy * 100).toFixed(0)}%\n`;
    report += `  Creativity: ${'█'.repeat(Math.round(personality.creativity * 10))}${'░'.repeat(10 - Math.round(personality.creativity * 10))} ${(personality.creativity * 100).toFixed(0)}%\n`;
    report += `  Empathy:    ${'█'.repeat(Math.round(personality.empathy * 10))}${'░'.repeat(10 - Math.round(personality.empathy * 10))} ${(personality.empathy * 100).toFixed(0)}%\n`;
    report += `  Analysis:   ${'█'.repeat(Math.round(personality.analyticalThinking * 10))}${'░'.repeat(10 - Math.round(personality.analyticalThinking * 10))} ${(personality.analyticalThinking * 100).toFixed(0)}%\n`;
    report += `  Spiritual:  ${'█'.repeat(Math.round(personality.spirituality * 10))}${'░'.repeat(10 - Math.round(personality.spirituality * 10))} ${(personality.spirituality * 100).toFixed(0)}%\n\n`;

    report += `🎯 Active Traits:\n`;
    personality.traits.forEach(trait => {
      report += `  • ${trait.name} (${(trait.intensity * 100).toFixed(0)}%): ${trait.keywords.join(', ')}\n`;
    });

    report += `\n💬 Response Style:\n`;
    report += `  Verbosity: ${(modulation.verbosity * 100).toFixed(0)}%\n`;
    report += `  Formality: ${(modulation.formality * 100).toFixed(0)}%\n`;
    report += `  Enthusiasm: ${(modulation.enthusiasm * 100).toFixed(0)}%\n`;
    report += `  Contemplation: ${(modulation.contemplation * 100).toFixed(0)}%\n`;

    return report;
  }
}
