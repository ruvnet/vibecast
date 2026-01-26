# ADR-001: Visa Recommendation System with RuVector Learning

## Status
Proposed

## Context
The Canadian Visa Requirements Gatherer needs an intelligent recommendation system that can:
1. Learn from user profiles and preferences
2. Find optimal visa pathways based on questionnaire responses
3. Use vector embeddings to match user profiles with suitable programs
4. Integrate with claude-flow for orchestration and browser automation

## Decision
Implement a Domain-Driven Design (DDD) architecture with RuVector for embeddings and similarity search, integrated with claude-flow and Claude Code for development workflow.

## Architecture

### Domain Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         VISA RECOMMENDATION SYSTEM                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐  │
│  │   Applicant  │    │   Programs   │    │     Recommendations      │  │
│  │   Profiles   │───>│   Database   │───>│         Engine           │  │
│  └──────────────┘    └──────────────┘    └──────────────────────────┘  │
│         │                   │                        │                  │
│         v                   v                        v                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐  │
│  │   RuVector   │    │  Eligibility │    │      Claude Flow         │  │
│  │  Embeddings  │    │   Matching   │    │     Orchestration        │  │
│  └──────────────┘    └──────────────┘    └──────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Bounded Contexts

1. **Applicant Context** - User profiles, questionnaire responses, document status
2. **Program Context** - Visa programs, eligibility criteria, requirements
3. **Recommendation Context** - Matching algorithms, scoring, pathway suggestions
4. **Monitoring Context** - Change detection, compliance updates, notifications

## Consequences

### Positive
- Scalable vector-based matching for complex eligibility criteria
- AI-powered recommendations adapt to policy changes
- Automated tracking of requirements updates
- Clear domain boundaries improve maintainability

### Negative
- Increased complexity with vector database
- Requires continuous model fine-tuning
- Initial setup requires careful domain modeling

---

# Domain-Driven Design (DDD) Tutorial

## Step 1: Understanding the Domain

### Core Domain Concepts

```javascript
// Applicant Aggregate Root
class Applicant {
  constructor(id, profile) {
    this.id = id;
    this.profile = profile;        // ApplicantProfile value object
    this.education = [];           // Education entities
    this.workExperience = [];      // WorkExperience entities
    this.languageScores = null;    // LanguageScores value object
    this.preferences = null;       // Preferences value object
  }
}

// Value Objects
class ApplicantProfile {
  constructor(age, nationality, maritalStatus, dependents) {
    this.age = age;
    this.nationality = nationality;
    this.maritalStatus = maritalStatus;
    this.dependents = dependents;
  }
}

class LanguageScores {
  constructor(english, french) {
    this.english = english;  // { reading, writing, speaking, listening, clb }
    this.french = french;    // { reading, writing, speaking, listening, clb }
  }

  getHighestCLB() {
    return Math.max(this.english?.clb || 0, this.french?.clb || 0);
  }
}
```

## Step 2: Install Script

Create `scripts/setup-recommendation-system.sh`:

```bash
#!/bin/bash

# ============================================================================
# Visa Recommendation System Setup Script
# Integrates RuVector, Claude Flow, and DDD Architecture
# ============================================================================

set -e

echo "=========================================="
echo " Visa Recommendation System Setup"
echo "=========================================="

# Check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."

    if ! command -v node &> /dev/null; then
        echo "Error: Node.js is required. Install from https://nodejs.org"
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        echo "Error: npm is required"
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo "Error: Node.js 18+ required. Current: $(node -v)"
        exit 1
    fi

    echo "✓ Prerequisites met"
}

# Install claude-flow
install_claude_flow() {
    echo ""
    echo "Installing claude-flow..."
    curl -fsSL https://cdn.jsdelivr.net/gh/ruvnet/claude-flow@main/scripts/install.sh | bash -s -- --full
    echo "✓ claude-flow installed"
}

# Install project dependencies
install_dependencies() {
    echo ""
    echo "Installing project dependencies..."
    npm install

    # Install additional dependencies for recommendation system
    npm install \
        @anthropic-ai/sdk \
        uuid \
        dotenv

    echo "✓ Dependencies installed"
}

# Create domain structure
create_domain_structure() {
    echo ""
    echo "Creating DDD domain structure..."

    # Create directories
    mkdir -p src/domain/{applicant,program,recommendation,shared}
    mkdir -p src/domain/applicant/{entities,value-objects,services,repositories}
    mkdir -p src/domain/program/{entities,value-objects,services,repositories}
    mkdir -p src/domain/recommendation/{entities,services,repositories}
    mkdir -p src/domain/shared/{events,interfaces}
    mkdir -p src/application/{commands,queries,services}
    mkdir -p src/infrastructure/{persistence,vector-store,external}
    mkdir -p src/interfaces/{cli,api}

    echo "✓ Domain structure created"
}

# Create questionnaire module
create_questionnaire() {
    echo ""
    echo "Creating questionnaire module..."

    cat > src/interfaces/questionnaire.js << 'QUESTIONNAIRE_EOF'
/**
 * Visa Eligibility Questionnaire
 * Collects user information for optimal program matching
 */

const readline = require('readline');

const QUESTIONS = [
  {
    id: 'age',
    question: 'What is your age?',
    type: 'number',
    validate: (v) => v >= 18 && v <= 65
  },
  {
    id: 'nationality',
    question: 'What is your nationality/citizenship?',
    type: 'text'
  },
  {
    id: 'education',
    question: 'Highest level of education completed?',
    type: 'choice',
    options: [
      { value: 'high_school', label: 'High School' },
      { value: 'diploma', label: 'Diploma/Certificate (1-2 years)' },
      { value: 'bachelors', label: 'Bachelor\'s Degree' },
      { value: 'masters', label: 'Master\'s Degree' },
      { value: 'phd', label: 'PhD/Doctorate' }
    ]
  },
  {
    id: 'workExperience',
    question: 'Years of skilled work experience?',
    type: 'number',
    validate: (v) => v >= 0 && v <= 50
  },
  {
    id: 'canadianExperience',
    question: 'Years of work experience IN CANADA?',
    type: 'number',
    validate: (v) => v >= 0 && v <= 50
  },
  {
    id: 'englishCLB',
    question: 'English language CLB level (4-12, or 0 if not tested)?',
    type: 'number',
    validate: (v) => v >= 0 && v <= 12
  },
  {
    id: 'frenchCLB',
    question: 'French language CLB level (4-12, or 0 if not tested)?',
    type: 'number',
    validate: (v) => v >= 0 && v <= 12
  },
  {
    id: 'jobOffer',
    question: 'Do you have a valid job offer from a Canadian employer?',
    type: 'boolean'
  },
  {
    id: 'provincePreference',
    question: 'Preferred province to settle in?',
    type: 'choice',
    options: [
      { value: 'any', label: 'No preference' },
      { value: 'ON', label: 'Ontario' },
      { value: 'BC', label: 'British Columbia' },
      { value: 'AB', label: 'Alberta' },
      { value: 'QC', label: 'Quebec' },
      { value: 'MB', label: 'Manitoba' },
      { value: 'SK', label: 'Saskatchewan' },
      { value: 'NS', label: 'Nova Scotia' },
      { value: 'NB', label: 'New Brunswick' },
      { value: 'other', label: 'Other province/territory' }
    ]
  },
  {
    id: 'pathwayType',
    question: 'What type of pathway are you looking for?',
    type: 'choice',
    options: [
      { value: 'permanent', label: 'Permanent Residence (PR)' },
      { value: 'work', label: 'Work Permit' },
      { value: 'study', label: 'Study Permit' },
      { value: 'visit', label: 'Visitor Visa' }
    ]
  }
];

class Questionnaire {
  constructor() {
    this.responses = {};
    this.rl = null;
  }

  async run() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n========================================');
    console.log(' Canadian Visa Eligibility Questionnaire');
    console.log('========================================\n');
    console.log('Answer the following questions to find the best visa pathway for you.\n');

    for (const q of QUESTIONS) {
      this.responses[q.id] = await this.askQuestion(q);
    }

    this.rl.close();
    return this.responses;
  }

  askQuestion(q) {
    return new Promise((resolve) => {
      let prompt = q.question;

      if (q.type === 'choice') {
        prompt += '\n';
        q.options.forEach((opt, i) => {
          prompt += `  ${i + 1}. ${opt.label}\n`;
        });
        prompt += 'Enter number: ';
      } else if (q.type === 'boolean') {
        prompt += ' (yes/no): ';
      } else {
        prompt += ': ';
      }

      this.rl.question(prompt, (answer) => {
        let value;

        if (q.type === 'number') {
          value = parseInt(answer, 10);
          if (isNaN(value) || (q.validate && !q.validate(value))) {
            console.log('Invalid input. Please try again.');
            resolve(this.askQuestion(q));
            return;
          }
        } else if (q.type === 'boolean') {
          value = answer.toLowerCase().startsWith('y');
        } else if (q.type === 'choice') {
          const idx = parseInt(answer, 10) - 1;
          if (idx >= 0 && idx < q.options.length) {
            value = q.options[idx].value;
          } else {
            console.log('Invalid selection. Please try again.');
            resolve(this.askQuestion(q));
            return;
          }
        } else {
          value = answer.trim();
        }

        resolve(value);
      });
    });
  }
}

module.exports = { Questionnaire, QUESTIONS };
QUESTIONNAIRE_EOF

    echo "✓ Questionnaire module created"
}

# Create recommendation engine
create_recommendation_engine() {
    echo ""
    echo "Creating recommendation engine..."

    cat > src/domain/recommendation/services/RecommendationEngine.js << 'ENGINE_EOF'
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
      if (score.total > 0) {
        scores.push({
          program,
          score,
          eligible: score.eligible,
          reasons: score.reasons
        });
      }
    }

    // Sort by score descending
    scores.sort((a, b) => b.score.total - a.score.total);

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
        permanent: ['Express Entry', 'Provincial Nominee Program', 'Quebec Immigration'],
        work: ['Work Permits'],
        study: ['Study Permits'],
        visit: ['Visitor']
      };

      if (!categoryMap[profile.pathwayType]?.includes(program.category)) {
        result.eligible = false;
        result.reasons.push(`Not a ${profile.pathwayType} pathway`);
        return result;
      }
    }

    // Check province preference
    if (profile.provincePreference && profile.provincePreference !== 'any') {
      if (program.province) {
        const provinceMap = {
          'ON': 'Ontario', 'BC': 'British Columbia', 'AB': 'Alberta',
          'QC': 'Quebec', 'MB': 'Manitoba', 'SK': 'Saskatchewan',
          'NS': 'Nova Scotia', 'NB': 'New Brunswick', 'PE': 'Prince Edward Island',
          'NL': 'Newfoundland and Labrador', 'YT': 'Yukon', 'NT': 'Northwest Territories'
        };

        if (program.province !== provinceMap[profile.provincePreference]) {
          result.breakdown.provinceMatch = 0;
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

    if (requiredCLB > 0 && userCLB < requiredCLB) {
      result.eligible = false;
      result.reasons.push(`Requires CLB ${requiredCLB}, you have CLB ${userCLB}`);
    } else if (userCLB >= requiredCLB) {
      const langScore = Math.min(30, (userCLB - requiredCLB + 1) * 5);
      result.breakdown.language = langScore;
      result.total += langScore;
      if (userCLB > requiredCLB) {
        result.reasons.push(`Language exceeds minimum (CLB ${userCLB} > ${requiredCLB})`);
      }
    }

    // Work experience score
    const requiredExp = this.getRequiredExperience(eligibility);
    const userExp = profile.workExperience || 0;
    const canadianExp = profile.canadianExperience || 0;

    if (requiredExp > 0 && userExp < requiredExp) {
      result.eligible = false;
      result.reasons.push(`Requires ${requiredExp}+ years experience, you have ${userExp}`);
    } else if (userExp >= requiredExp) {
      const expScore = Math.min(20, userExp * 3);
      result.breakdown.experience = expScore;
      result.total += expScore;
    }

    // Canadian experience bonus
    if (canadianExp > 0) {
      const canExpScore = Math.min(25, canadianExp * 8);
      result.breakdown.canadianExperience = canExpScore;
      result.total += canExpScore;
      result.reasons.push(`Canadian experience bonus (+${canExpScore})`);
    }

    // Education score
    const eduScore = this.getEducationScore(profile.education);
    result.breakdown.education = eduScore;
    result.total += eduScore;

    // Job offer bonus
    if (profile.jobOffer) {
      result.breakdown.jobOffer = 15;
      result.total += 15;
      result.reasons.push('Job offer bonus (+15)');
    }

    // French bonus (Quebec and francophone streams)
    if (profile.frenchCLB >= 7) {
      if (program.province === 'Quebec' || program.id.includes('francophone')) {
        result.breakdown.frenchBonus = 20;
        result.total += 20;
        result.reasons.push('French language bonus (+20)');
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
    return 0;
  }

  getRequiredExperience(eligibility) {
    if (eligibility.workExperience?.minimum) {
      const match = eligibility.workExperience.minimum.match(/(\d+)/);
      if (match) return parseInt(match[1], 10);
    }
    return 0;
  }

  getEducationScore(education) {
    const scores = {
      'high_school': 5,
      'diploma': 10,
      'bachelors': 15,
      'masters': 20,
      'phd': 25
    };
    return scores[education] || 0;
  }
}

module.exports = { RecommendationEngine };
ENGINE_EOF

    echo "✓ Recommendation engine created"
}

# Create main recommendation CLI
create_recommendation_cli() {
    echo ""
    echo "Creating recommendation CLI..."

    cat > src/recommend.js << 'CLI_EOF'
#!/usr/bin/env node
/**
 * Visa Recommendation CLI
 * Guides users through questionnaire and provides recommendations
 */

const { Questionnaire } = require('./interfaces/questionnaire');
const { RecommendationEngine } = require('./domain/recommendation/services/RecommendationEngine');

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║     Canadian Visa Pathway Recommendation System                 ║');
  console.log('║     Powered by RuVector & Claude Flow                           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Collect user profile through questionnaire
  const questionnaire = new Questionnaire();
  const profile = await questionnaire.run();

  console.log('\n========================================');
  console.log(' Analyzing your profile...');
  console.log('========================================\n');

  // Generate recommendations
  const engine = new RecommendationEngine();
  const results = engine.recommend(profile);

  // Display results
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    YOUR TOP RECOMMENDATIONS                     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  if (results.recommendations.length === 0) {
    console.log('No matching programs found. Consider:');
    console.log('  - Improving language scores');
    console.log('  - Gaining more work experience');
    console.log('  - Obtaining higher education');
    console.log('  - Consulting an immigration consultant');
    return;
  }

  results.recommendations.forEach((rec, i) => {
    const eligible = rec.eligible ? '✓' : '✗';
    console.log(`${i + 1}. [${eligible}] ${rec.program.name}`);
    console.log(`   Category: ${rec.program.category}`);
    if (rec.program.province) {
      console.log(`   Province: ${rec.program.province}`);
    }
    console.log(`   Score: ${rec.score.total} points`);
    console.log(`   Reasons:`);
    rec.reasons.forEach(r => console.log(`     - ${r}`));
    console.log(`   URL: ${rec.program.url}`);
    console.log('');
  });

  console.log('========================================');
  console.log(' Next Steps');
  console.log('========================================');
  console.log('1. Review eligibility requirements: node src/cli.js eligibility <program-id>');
  console.log('2. Monitor requirement changes: npm run gather');
  console.log('3. Consult official sources for latest information');
  console.log('4. Consider consulting a licensed immigration advisor');
  console.log('');
}

main().catch(console.error);
CLI_EOF

    chmod +x src/recommend.js
    echo "✓ Recommendation CLI created"
}

# Update package.json
update_package_json() {
    echo ""
    echo "Updating package.json..."

    # Add recommend script
    npm pkg set scripts.recommend="node src/recommend.js"

    echo "✓ package.json updated"
}

# Main execution
main() {
    check_prerequisites
    install_claude_flow
    install_dependencies
    create_domain_structure
    create_questionnaire
    create_recommendation_engine
    create_recommendation_cli
    update_package_json

    echo ""
    echo "=========================================="
    echo " Setup Complete!"
    echo "=========================================="
    echo ""
    echo "Run the recommendation system:"
    echo "  npm run recommend"
    echo ""
    echo "Other commands:"
    echo "  npm run gather          # Gather latest visa requirements"
    echo "  npm run eligibility     # View eligibility requirements"
    echo "  npm run list            # List all programs"
    echo ""
}

main "$@"
```

## Step 3: Development Workflow with Claude Code

### Using Claude Code for Development

1. **Initialize the project**
```bash
# Run setup script
chmod +x scripts/setup-recommendation-system.sh
./scripts/setup-recommendation-system.sh
```

2. **Use Claude Code for implementation**
```bash
# Start Claude Code session
claude

# Example prompts:
# "Add age scoring to the recommendation engine based on CRS criteria"
# "Create a repository pattern for storing user profiles"
# "Implement vector embeddings for program matching"
```

3. **Use claude-flow for orchestration**
```bash
# Run browser automation for data gathering
npx claude-flow@alpha browser-agent --script src/claude-flow-agent.js

# Multi-agent workflow
npx claude-flow@alpha orchestrate --agents "gatherer,analyzer,recommender"
```

## Step 4: RuVector Integration (Future Enhancement)

RuVector can be integrated for:
- Semantic matching between user profiles and program requirements
- Learning from successful applications
- Clustering similar programs
- Personalized pathway suggestions

```javascript
// Future: Vector-based matching
const { RuVector } = require('ruvector');

class VectorMatcher {
  constructor() {
    this.vectorStore = new RuVector({
      dimensions: 384,
      similarity: 'cosine'
    });
  }

  async indexPrograms(programs) {
    for (const program of programs) {
      const embedding = await this.embed(program.eligibility);
      await this.vectorStore.upsert({
        id: program.id,
        vector: embedding,
        metadata: program
      });
    }
  }

  async findSimilar(userProfile, topK = 10) {
    const queryVector = await this.embed(userProfile);
    return this.vectorStore.query({
      vector: queryVector,
      topK,
      includeMetadata: true
    });
  }
}
```

## References

- [Claude Flow Documentation](https://github.com/ruvnet/claude-flow)
- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
- [Domain-Driven Design Reference](https://martinfowler.com/bliki/DomainDrivenDesign.html)
- [IRCC Official Website](https://www.canada.ca/en/immigration-refugees-citizenship.html)
