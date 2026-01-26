#!/usr/bin/env node

/**
 * CLI for Canadian Visa Requirements Gatherer
 *
 * Usage:
 *   node src/cli.js gather              # Gather all visa requirements
 *   node src/cli.js gather --express    # Gather Express Entry only
 *   node src/cli.js gather --pnp        # Gather PNP programs only
 *   node src/cli.js list                # List all tracked programs
 *   node src/cli.js eligibility         # Show all eligibility requirements
 *   node src/cli.js eligibility <id>    # Show eligibility for specific program
 *   node src/cli.js check               # Quick change check
 *   node src/cli.js history             # List historical snapshots
 *   node src/cli.js compare <snapshot>  # Compare with specific snapshot
 */

const {
  gatherVisaRequirements,
  quickChangeCheck,
  printProgramList,
  listSnapshots,
  loadSnapshot,
  loadBaseline,
  generateDiffReport,
  compareWithBaseline,
  getSourceById,
  getAllSources,
  getEligibility,
  generateEligibilityReport,
  formatEligibility
} = require('./index');

const args = process.argv.slice(2);
const command = args[0];

// Parse flags
const flags = {
  express: args.includes('--express') || args.includes('-e'),
  pnp: args.includes('--pnp') || args.includes('-p'),
  all: args.includes('--all') || args.includes('-a'),
  noUpdate: args.includes('--no-update'),
  browser: args.includes('--browser') || args.includes('-b'),
  help: args.includes('--help') || args.includes('-h'),
  json: args.includes('--json')
};

function printHelp() {
  console.log(`
Canadian Visa Requirements Gatherer CLI
========================================

Usage: node src/cli.js <command> [options]

Commands:
  gather              Scrape and gather visa requirements from all sources
  list                List all tracked visa programs
  eligibility [id]    Show eligibility requirements (all programs or specific ID)
  check               Quick change check (compares hashes)
  history             List historical snapshots
  compare <file>      Compare current baseline with a snapshot

Options:
  --express, -e       Gather Express Entry programs only
  --pnp, -p           Gather PNP programs only
  --all, -a           Gather all programs (default)
  --no-update         Don't update baseline after gathering
  --browser, -b       Use browser automation (requires Playwright)
  --json              Output results as JSON
  --help, -h          Show this help message

Examples:
  node src/cli.js gather                    # Gather all visa requirements
  node src/cli.js gather --express          # Express Entry only
  node src/cli.js gather --pnp              # Provincial programs only
  node src/cli.js list                      # List all programs
  node src/cli.js eligibility               # Show all eligibility requirements
  node src/cli.js eligibility ee-fsw        # Show FSW eligibility
  node src/cli.js eligibility pnp-on        # Show Ontario PNP eligibility
  node src/cli.js check                     # Quick change detection
  node src/cli.js history                   # View history
  node src/cli.js compare snapshot-2024.json

Program IDs:
  Express Entry: ee-fsw, ee-fst, ee-cec, ee-crs, ee-lang
  Work Permits:  wp-iec, wp-general
  Study Permits: sp-main, sp-pal, sp-pgwp, sp-spouse
  Visitor:       vp-trv
  PNP Programs:  pnp-on, pnp-bc, pnp-ab, pnp-sk, pnp-mb, pnp-nb, pnp-ns, pnp-pe, pnp-nl, pnp-nt, pnp-yt
  Quebec:        qc-skilled
  Nunavut:       nu-imm
`);
}

/**
 * Print eligibility for a specific program
 */
function printProgramEligibility(programId) {
  const source = getSourceById(programId);
  if (!source) {
    console.error(`Program not found: ${programId}`);
    console.log('\nUse "node src/cli.js list" to see available programs.');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(80));
  console.log(`ELIGIBILITY REQUIREMENTS: ${source.name}`);
  console.log('='.repeat(80));
  console.log(`\nID: ${source.id}`);
  console.log(`Category: ${source.category}`);
  if (source.province) console.log(`Province: ${source.province}`);
  console.log(`URL: ${source.url}`);
  if (source.description) console.log(`\nDescription: ${source.description}`);
  console.log('');

  if (!source.eligibility) {
    console.log('No eligibility requirements defined for this program.');
    console.log('(This may be a news source or informational page)');
    return;
  }

  const lines = formatEligibility(source.eligibility, '');
  console.log(lines.join('\n'));
  console.log('');
}

/**
 * Print eligibility for all programs
 */
function printAllEligibility() {
  const sources = getAllSources().filter(s => s.eligibility);

  console.log('\n' + '='.repeat(80));
  console.log('CANADIAN VISA PROGRAMS - ELIGIBILITY REQUIREMENTS');
  console.log('='.repeat(80));
  console.log(`\nTotal Programs with Eligibility Data: ${sources.length}\n`);

  // Group by category
  const byCategory = {};
  for (const source of sources) {
    const cat = source.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(source);
  }

  for (const [category, programs] of Object.entries(byCategory)) {
    console.log('\n' + '-'.repeat(80));
    console.log(`${category.toUpperCase()} (${programs.length} programs)`);
    console.log('-'.repeat(80));

    for (const prog of programs) {
      console.log(`\n[${prog.id}] ${prog.name}`);
      if (prog.province) console.log(`Province: ${prog.province}`);
      console.log(`URL: ${prog.url}`);
      console.log('');

      const lines = formatEligibility(prog.eligibility, '  ');
      console.log(lines.join('\n'));
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('Use "node src/cli.js eligibility <program-id>" for detailed view');
  console.log('='.repeat(80) + '\n');
}

async function main() {
  if (flags.help || !command) {
    printHelp();
    process.exit(0);
  }

  try {
    switch (command) {
      case 'gather': {
        let category = null;
        if (flags.express) category = 'express-entry';
        if (flags.pnp) category = 'pnp';

        const results = await gatherVisaRequirements({
          category,
          updateBaseline: !flags.noUpdate,
          useBrowser: flags.browser
        });

        if (flags.json) {
          console.log(JSON.stringify(results, null, 2));
        }

        // Summary
        console.log('\n========================================');
        console.log(' Gathering Complete');
        console.log('========================================');
        console.log(`Successful: ${results.scrapeResults.successful}/${results.scrapeResults.totalSources}`);
        if (results.comparison.isFirstRun) {
          console.log('First run - baseline saved');
        } else {
          console.log(`Changes detected: ${results.comparison.changes.length}`);
          console.log(`New programs: ${results.comparison.newPrograms.length}`);
          console.log(`Removed programs: ${results.comparison.removedPrograms.length}`);
        }
        break;
      }

      case 'list': {
        printProgramList();
        break;
      }

      case 'eligibility': {
        const programId = args[1];
        if (programId && !programId.startsWith('-')) {
          printProgramEligibility(programId);
        } else {
          printAllEligibility();
        }
        break;
      }

      case 'check': {
        const result = await quickChangeCheck();
        if (flags.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          if (!result.hasBaseline) {
            console.log(result.message);
          } else {
            console.log(`\nQuick Check Results:`);
            console.log(`Checked: ${result.checkedSources} of ${result.totalSources} sources`);
            console.log(`Changes detected: ${result.changesDetected}`);
            if (result.changes.length > 0) {
              console.log('\nChanged sources:');
              for (const c of result.changes) {
                console.log(`  - ${c.name} (${c.id})`);
              }
            }
          }
        }
        break;
      }

      case 'history': {
        const snapshots = await listSnapshots();
        if (snapshots.length === 0) {
          console.log('\nNo historical snapshots found.');
        } else {
          console.log(`\nHistorical Snapshots (${snapshots.length}):`);
          console.log('-'.repeat(60));
          for (const snap of snapshots.slice(0, 20)) {
            console.log(`  ${snap.filename}`);
          }
          if (snapshots.length > 20) {
            console.log(`  ... and ${snapshots.length - 20} more`);
          }
        }
        break;
      }

      case 'compare': {
        const snapshotFile = args[1];
        if (!snapshotFile) {
          console.error('Error: Please specify a snapshot file to compare');
          console.log('Usage: node src/cli.js compare <snapshot-filename>');
          process.exit(1);
        }

        const baseline = await loadBaseline();
        if (!baseline) {
          console.error('Error: No baseline found. Run "gather" first.');
          process.exit(1);
        }

        try {
          const snapshot = await loadSnapshot(snapshotFile);
          const comparison = await compareWithBaseline(snapshot);
          const report = generateDiffReport(comparison);
          console.log(report);
        } catch (e) {
          console.error(`Error loading snapshot: ${e.message}`);
          process.exit(1);
        }
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
