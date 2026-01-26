/**
 * Visa Recommendation Engine
 * Uses eligibility criteria to score and rank programs
 */

const { getAllSources, getEligibility } = require('../../../config/visa-sources');

class RecommendationEngine {
  constructor() {
    this.programs = getAllSources();
  }

  /**
   * Generate recommendations based on user profile
   */
  recommend(profile) {
    const scores = [];

    for (const program of this.programs) {
      if (!program.eligibility) continue;

      const score = this.scoreProgram(program, profile);
      if (score.total > 0 || score.eligible) {
        scores.push({
          program,
          score,
          eligible: score.eligible,
          reasons: score.reasons
        });
      }
    }

    // Sort by eligible first, then by score descending
    scores.sort((a, b) => {
      if (a.eligible !== b.eligible) return b.eligible - a.eligible;
      return b.score.total - a.score.total;
    });

    return {
      profile,
      recommendations: scores.slice(0, 10), // Top 10
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Score a single program for the given profile
   */
  scoreProgram(program, profile) {
    const result = {
      total: 0,
      eligible: true,
      reasons: [],
      breakdown: {}
    };

    const eligibility = program.eligibility;

    // Check pathway type preference
    if (profile.pathwayType) {
      const categoryMap = {
        permanent: ['Express Entry', 'Provincial Nominee Program', 'Territorial Nominee Program', 'Quebec Immigration', 'Economic Immigration'],
        work: ['Work Permits'],
        study: ['Study Permits'],
        visit: ['Visitor']
      };

      const validCategories = categoryMap[profile.pathwayType] || [];
      if (!validCategories.includes(program.category)) {
        result.eligible = false;
        result.reasons.push(`Not a ${profile.pathwayType} pathway`);
        return result;
      }
      result.reasons.push(`Matches ${profile.pathwayType} pathway type`);
    }

    // Check province preference
    if (profile.provincePreference && profile.provincePreference !== 'any') {
      const provinceMap = {
        'ON': 'Ontario', 'BC': 'British Columbia', 'AB': 'Alberta',
        'QC': 'Quebec', 'MB': 'Manitoba', 'SK': 'Saskatchewan',
        'NS': 'Nova Scotia', 'NB': 'New Brunswick', 'PE': 'Prince Edward Island',
        'NL': 'Newfoundland and Labrador', 'YT': 'Yukon', 'NT': 'Northwest Territories'
      };

      if (program.province) {
        if (program.province !== provinceMap[profile.provincePreference]) {
          // Slight penalty but not disqualifying
          result.breakdown.provinceMatch = -5;
          result.total -= 5;
        } else {
          result.breakdown.provinceMatch = 20;
          result.total += 20;
          result.reasons.push('Matches province preference');
        }
      }
    }

    // Language score
    const requiredCLB = this.getRequiredCLB(eligibility);
    const userCLB = Math.max(profile.englishCLB || 0, profile.frenchCLB || 0);

    if (requiredCLB > 0) {
      if (userCLB < requiredCLB) {
        result.eligible = false;
        result.reasons.push(`Requires CLB ${requiredCLB}, you have CLB ${userCLB}`);
      } else {
        const langScore = Math.min(30, (userCLB - requiredCLB + 1) * 5);
        result.breakdown.language = langScore;
        result.total += langScore;
        if (userCLB > requiredCLB) {
          result.reasons.push(`Language exceeds minimum (CLB ${userCLB} > ${requiredCLB})`);
        }
      }
    } else {
      // No specific language requirement
      if (userCLB >= 7) {
        result.breakdown.language = 15;
        result.total += 15;
      }
    }

    // Work experience score
    const requiredExp = this.getRequiredExperience(eligibility);
    const userExp = profile.workExperience || 0;
    const canadianExp = profile.canadianExperience || 0;

    if (requiredExp > 0) {
      if (userExp < requiredExp) {
        result.eligible = false;
        result.reasons.push(`Requires ${requiredExp}+ years experience, you have ${userExp}`);
      } else {
        const expScore = Math.min(20, (userExp - requiredExp + 1) * 4);
        result.breakdown.experience = expScore;
        result.total += expScore;
      }
    } else if (userExp > 0) {
      const expScore = Math.min(15, userExp * 2);
      result.breakdown.experience = expScore;
      result.total += expScore;
    }

    // Canadian experience bonus (very valuable)
    if (canadianExp > 0) {
      const canExpScore = Math.min(30, canadianExp * 10);
      result.breakdown.canadianExperience = canExpScore;
      result.total += canExpScore;
      result.reasons.push(`Canadian experience bonus (+${canExpScore})`);

      // CEC eligibility boost
      if (program.id === 'ee-cec' && canadianExp >= 1) {
        result.total += 20;
        result.reasons.push('Eligible for Canadian Experience Class');
      }
    }

    // Education score
    const eduScore = this.getEducationScore(profile.education);
    result.breakdown.education = eduScore;
    result.total += eduScore;

    // Masters/PhD stream bonus
    if ((profile.education === 'masters' || profile.education === 'phd') &&
        (program.name.toLowerCase().includes('master') ||
         program.name.toLowerCase().includes('phd') ||
         program.name.toLowerCase().includes('graduate'))) {
      result.total += 15;
      result.reasons.push('Graduate stream eligibility bonus');
    }

    // Job offer bonus
    if (profile.jobOffer) {
      result.breakdown.jobOffer = 15;
      result.total += 15;
      result.reasons.push('Job offer bonus (+15)');
    }

    // Age factor (optimal age is 20-29)
    if (profile.age) {
      let ageScore = 0;
      if (profile.age >= 20 && profile.age <= 29) {
        ageScore = 12;
      } else if (profile.age >= 30 && profile.age <= 34) {
        ageScore = 10;
      } else if (profile.age >= 35 && profile.age <= 39) {
        ageScore = 8;
      } else if (profile.age >= 40 && profile.age <= 44) {
        ageScore = 6;
      } else if (profile.age >= 45) {
        ageScore = 4;
      }
      result.breakdown.age = ageScore;
      result.total += ageScore;
    }

    // French bonus (Quebec and francophone streams)
    if (profile.frenchCLB >= 7) {
      if (program.province === 'Quebec') {
        result.breakdown.frenchBonus = 25;
        result.total += 25;
        result.reasons.push('French language bonus for Quebec (+25)');
      } else if (program.name.toLowerCase().includes('francophone') ||
                 program.name.toLowerCase().includes('french')) {
        result.breakdown.frenchBonus = 20;
        result.total += 20;
        result.reasons.push('French language stream bonus (+20)');
      } else {
        result.breakdown.frenchBonus = 10;
        result.total += 10;
        result.reasons.push('Bilingual bonus (+10)');
      }
    }

    if (result.eligible && result.reasons.length === 0) {
      result.reasons.push('Meets minimum eligibility criteria');
    }

    return result;
  }

  getRequiredCLB(eligibility) {
    if (eligibility.language?.minimum) {
      const match = eligibility.language.minimum.match(/CLB\s*(\d+)/i);
      if (match) return parseInt(match[1], 10);
    }
    if (eligibility.language?.teer0or1) {
      const match = eligibility.language.teer0or1.match(/CLB\s*(\d+)/i);
      if (match) return parseInt(match[1], 10);
    }
    if (eligibility.language?.teer2or3) {
      const match = eligibility.language.teer2or3.match(/CLB\s*(\d+)/i);
      if (match) return parseInt(match[1], 10);
    }

    // Check minimum requirements array
    if (eligibility.minimumRequirements) {
      for (const req of eligibility.minimumRequirements) {
        const match = req.match(/CLB\s*(\d+)/i);
        if (match) return parseInt(match[1], 10);
      }
    }

    return 0;
  }

  getRequiredExperience(eligibility) {
    if (eligibility.workExperience?.minimum) {
      const match = eligibility.workExperience.minimum.match(/(\d+)/);
      if (match) return parseInt(match[1], 10);
    }

    // Check minimum requirements array
    if (eligibility.minimumRequirements) {
      for (const req of eligibility.minimumRequirements) {
        const match = req.match(/(\d+)\s*year/i);
        if (match) return parseInt(match[1], 10);
      }
    }

    return 0;
  }

  getEducationScore(education) {
    const scores = {
      'high_school': 5,
      'diploma': 12,
      'bachelors': 18,
      'masters': 23,
      'phd': 25
    };
    return scores[education] || 0;
  }
}

module.exports = { RecommendationEngine };
