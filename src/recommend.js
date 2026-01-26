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
  console.log('║     Powered by Claude Flow & RuVector                           ║');
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
    console.log('No matching programs found based on your profile.\n');
    console.log('Consider the following to improve your eligibility:');
    console.log('  - Improving language scores (aim for CLB 7+)');
    console.log('  - Gaining more work experience');
    console.log('  - Obtaining higher education');
    console.log('  - Getting a job offer from a Canadian employer');
    console.log('  - Consulting a licensed immigration consultant');
    return;
  }

  const eligible = results.recommendations.filter(r => r.eligible);
  const potential = results.recommendations.filter(r => !r.eligible);

  if (eligible.length > 0) {
    console.log('ELIGIBLE PROGRAMS (you meet minimum requirements):\n');
    eligible.forEach((rec, i) => {
      console.log(`${i + 1}. ✓ ${rec.program.name}`);
      console.log(`   Category: ${rec.program.category}`);
      if (rec.program.province) {
        console.log(`   Province: ${rec.program.province}`);
      }
      console.log(`   Match Score: ${rec.score.total} points`);
      console.log(`   Why this program:`);
      rec.reasons.forEach(r => console.log(`     • ${r}`));
      console.log(`   More info: ${rec.program.url}`);
      console.log('');
    });
  }

  if (potential.length > 0 && eligible.length < 5) {
    console.log('\nPOTENTIAL PROGRAMS (may need additional qualifications):\n');
    potential.slice(0, 5 - eligible.length).forEach((rec, i) => {
      console.log(`${eligible.length + i + 1}. ✗ ${rec.program.name}`);
      console.log(`   Category: ${rec.program.category}`);
      if (rec.program.province) {
        console.log(`   Province: ${rec.program.province}`);
      }
      console.log(`   Gap analysis:`);
      rec.reasons.filter(r => r.includes('Requires')).forEach(r => console.log(`     ⚠ ${r}`));
      console.log(`   More info: ${rec.program.url}`);
      console.log('');
    });
  }

  // Summary and next steps
  console.log('═'.repeat(66));
  console.log('                           SUMMARY');
  console.log('═'.repeat(66));
  console.log(`  Programs you may be eligible for: ${eligible.length}`);
  console.log(`  Programs to work towards: ${potential.length}`);
  console.log('');

  console.log('═'.repeat(66));
  console.log('                         NEXT STEPS');
  console.log('═'.repeat(66));
  console.log('');
  console.log('1. View detailed eligibility requirements:');
  if (eligible.length > 0) {
    console.log(`   node src/cli.js eligibility ${eligible[0].program.id}`);
  }
  console.log('');
  console.log('2. Monitor requirement changes:');
  console.log('   npm run gather');
  console.log('');
  console.log('3. Check official sources for latest information');
  console.log('');
  console.log('4. Consider consulting a licensed immigration advisor (RCIC)');
  console.log('');
  console.log('═'.repeat(66));
  console.log('DISCLAIMER: This tool provides general guidance only.');
  console.log('Always verify with official IRCC sources and consider');
  console.log('consulting a regulated immigration consultant.');
  console.log('═'.repeat(66));
  console.log('');
}

main().catch(console.error);
