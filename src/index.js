/**
 * Canadian Visa Requirements Gatherer
 * Main module for scraping and tracking Canadian immigration requirements
 *
 * Usage with claude-flow:
 *   npx claude-flow@alpha browser-agent --task "gather visa requirements"
 *
 * Or programmatically:
 *   const { gatherVisaRequirements } = require('./src');
 *   const results = await gatherVisaRequirements();
 */

const {
  scrapeAllSources,
  scrapeSources,
  scrapeExpressEntry,
  scrapePNPSources,
  scrapeSingleSource,
  DEFAULT_CONFIG
} = require('./scrapers/visa-scraper');

const {
  detectChanges,
  loadBaseline,
  saveBaseline,
  listSnapshots,
  loadSnapshot,
  compareWithBaseline,
  generateDiffReport
} = require('./utils/diff-detector');

const {
  VISA_SOURCES,
  getAllSources,
  getSourcesByCategory,
  getSourceById,
  getPNPSources,
  getExpressEntrySources
} = require('./config/visa-sources');

/**
 * Main function to gather visa requirements and detect changes
 * @param {Object} options - Configuration options
 * @param {boolean} options.updateBaseline - Whether to update the baseline after scraping
 * @param {boolean} options.saveSnapshot - Whether to save a historical snapshot
 * @param {string[]} options.sourceIds - Specific source IDs to scrape (optional)
 * @param {string} options.category - Category to scrape (optional)
 * @param {number} options.concurrency - Number of concurrent requests
 * @param {number} options.timeout - Request timeout in ms
 * @returns {Object} Results with comparison and report
 */
async function gatherVisaRequirements(options = {}) {
  console.log('\n========================================');
  console.log(' Canadian Visa Requirements Gatherer');
  console.log('========================================\n');

  const config = {
    concurrency: options.concurrency || DEFAULT_CONFIG.concurrency,
    timeout: options.timeout || DEFAULT_CONFIG.timeout,
    useBrowser: options.useBrowser || false
  };

  let scrapeResults;

  // Determine what to scrape
  if (options.sourceIds && options.sourceIds.length > 0) {
    scrapeResults = await scrapeSources(options.sourceIds, config);
  } else if (options.category === 'express-entry') {
    scrapeResults = await scrapeExpressEntry(config);
  } else if (options.category === 'pnp') {
    scrapeResults = await scrapePNPSources(config);
  } else {
    scrapeResults = await scrapeAllSources(config);
  }

  // Detect changes and generate report
  const { comparison, report } = await detectChanges(scrapeResults, {
    updateBaseline: options.updateBaseline !== false,
    saveSnapshot: options.saveSnapshot !== false
  });

  // Print report
  console.log('\n' + report);

  return {
    scrapeResults,
    comparison,
    report
  };
}

/**
 * Quick check for changes without full scrape
 * Compares content hashes only
 */
async function quickChangeCheck(sourceIds = null) {
  const sources = sourceIds
    ? sourceIds.map(id => getSourceById(id)).filter(Boolean)
    : getAllSources();

  console.log(`\nQuick change check for ${sources.length} sources...\n`);

  const baseline = await loadBaseline();
  if (!baseline) {
    return {
      hasBaseline: false,
      message: 'No baseline found. Run full gather first.'
    };
  }

  const baselineById = {};
  for (const result of baseline.results || []) {
    baselineById[result.id] = result;
  }

  const changes = [];
  for (const source of sources.slice(0, 5)) { // Quick check first 5
    try {
      const result = await scrapeSingleSource(source, { timeout: 15000 });
      const baselineResult = baselineById[source.id];

      if (baselineResult && result.success) {
        if (result.contentHash !== baselineResult.contentHash) {
          changes.push({
            id: source.id,
            name: source.name,
            oldHash: baselineResult.contentHash,
            newHash: result.contentHash
          });
        }
      }
    } catch (e) {
      console.error(`  Error checking ${source.id}: ${e.message}`);
    }
  }

  return {
    hasBaseline: true,
    checkedSources: Math.min(5, sources.length),
    totalSources: sources.length,
    changesDetected: changes.length,
    changes
  };
}

/**
 * Get the list of all tracked visa programs
 */
function listPrograms() {
  const sources = getAllSources();
  const byCategory = {};

  for (const source of sources) {
    if (!byCategory[source.category]) {
      byCategory[source.category] = [];
    }
    byCategory[source.category].push({
      id: source.id,
      name: source.name,
      url: source.url,
      province: source.province || null
    });
  }

  return {
    total: sources.length,
    byCategory
  };
}

/**
 * Print program list to console
 */
function printProgramList() {
  const { total, byCategory } = listPrograms();

  console.log('\n========================================');
  console.log(' Tracked Canadian Visa Programs');
  console.log(`========================================\n`);
  console.log(`Total Programs: ${total}\n`);

  for (const [category, programs] of Object.entries(byCategory)) {
    console.log(`\n${category} (${programs.length})`);
    console.log('-'.repeat(40));
    for (const prog of programs) {
      console.log(`  ${prog.id.padEnd(12)} ${prog.name}`);
      if (prog.province) {
        console.log(`  ${''.padEnd(12)} Province: ${prog.province}`);
      }
    }
  }
  console.log('');
}

// Export all functions and data
module.exports = {
  // Main functions
  gatherVisaRequirements,
  quickChangeCheck,
  listPrograms,
  printProgramList,

  // Scraper functions
  scrapeAllSources,
  scrapeSources,
  scrapeExpressEntry,
  scrapePNPSources,
  scrapeSingleSource,

  // Diff detection
  detectChanges,
  loadBaseline,
  saveBaseline,
  listSnapshots,
  loadSnapshot,
  compareWithBaseline,
  generateDiffReport,

  // Configuration
  VISA_SOURCES,
  getAllSources,
  getSourcesByCategory,
  getSourceById,
  getPNPSources,
  getExpressEntrySources,
  DEFAULT_CONFIG
};
