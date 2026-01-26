/**
 * Claude Flow Browser Agent Integration
 * Use this with: npx claude-flow@alpha browser-agent
 *
 * This module provides integration with claude-flow's browser automation
 * for enhanced scraping capabilities on JavaScript-heavy government sites.
 */

const { gatherVisaRequirements, getAllSources, getSourceById } = require('./index');

/**
 * Claude Flow Agent Configuration
 * Defines the agent's capabilities and behavior
 */
const agentConfig = {
  name: 'visa-requirements-gatherer',
  description: 'Gathers and tracks Canadian visa requirements from official government sources',
  version: '1.0.0',

  capabilities: {
    webScraping: true,
    pdfParsing: false,
    formFilling: false,
    screenshot: true
  },

  // Sites that require browser automation (JavaScript rendering)
  browserRequiredSites: [
    'welcomebc.ca',
    'immigratemanitoba.com',
    'liveinnovascotia.com',
    'immigratenwt.ca'
  ],

  // Rate limiting configuration
  rateLimit: {
    requestsPerMinute: 10,
    delayBetweenRequests: 3000 // ms
  }
};

/**
 * Agent task handlers for claude-flow integration
 */
const taskHandlers = {
  /**
   * Gather all visa requirements
   */
  async gatherAll(context) {
    console.log('[Agent] Starting full visa requirements gather...');
    const results = await gatherVisaRequirements({
      updateBaseline: true,
      useBrowser: context?.useBrowser || false
    });
    return {
      success: true,
      totalPrograms: results.scrapeResults.totalSources,
      successfulScrapes: results.scrapeResults.successful,
      changesDetected: results.comparison.changes?.length || 0,
      newPrograms: results.comparison.newPrograms?.length || 0,
      report: results.report
    };
  },

  /**
   * Gather Express Entry requirements only
   */
  async gatherExpressEntry(context) {
    console.log('[Agent] Gathering Express Entry requirements...');
    const results = await gatherVisaRequirements({
      category: 'express-entry',
      updateBaseline: true,
      useBrowser: context?.useBrowser || false
    });
    return {
      success: true,
      programs: results.scrapeResults.results.map(r => ({
        id: r.id,
        name: r.name,
        success: r.success,
        requirementsCount: r.requirements?.length || 0
      })),
      report: results.report
    };
  },

  /**
   * Gather PNP requirements only
   */
  async gatherPNP(context) {
    console.log('[Agent] Gathering Provincial Nominee Program requirements...');
    const results = await gatherVisaRequirements({
      category: 'pnp',
      updateBaseline: true,
      useBrowser: context?.useBrowser || false
    });
    return {
      success: true,
      programs: results.scrapeResults.results.map(r => ({
        id: r.id,
        name: r.name,
        province: r.province,
        success: r.success,
        requirementsCount: r.requirements?.length || 0
      })),
      report: results.report
    };
  },

  /**
   * Gather specific program requirements
   */
  async gatherProgram(context) {
    const { programId } = context;
    if (!programId) {
      throw new Error('programId is required');
    }

    const source = getSourceById(programId);
    if (!source) {
      throw new Error(`Program not found: ${programId}`);
    }

    console.log(`[Agent] Gathering requirements for: ${source.name}`);

    const results = await gatherVisaRequirements({
      sourceIds: [programId],
      updateBaseline: false,
      useBrowser: context?.useBrowser || false
    });

    const result = results.scrapeResults.results[0];
    return {
      success: result.success,
      program: {
        id: result.id,
        name: result.name,
        url: result.url,
        category: result.category,
        province: result.province
      },
      requirements: result.requirements,
      conditions: result.conditions,
      sections: result.sections,
      error: result.error
    };
  },

  /**
   * List all tracked programs
   */
  async listPrograms() {
    const sources = getAllSources();
    return {
      total: sources.length,
      programs: sources.map(s => ({
        id: s.id,
        name: s.name,
        category: s.category,
        province: s.province || null,
        url: s.url
      }))
    };
  },

  /**
   * Get program details
   */
  async getProgram(context) {
    const { programId } = context;
    const source = getSourceById(programId);

    if (!source) {
      return { found: false, programId };
    }

    return {
      found: true,
      program: {
        id: source.id,
        name: source.name,
        category: source.category,
        province: source.province || null,
        url: source.url,
        description: source.description
      }
    };
  }
};

/**
 * Claude Flow Browser Agent Entry Point
 * Call this when running as a claude-flow agent
 */
async function runAgent(task, context = {}) {
  console.log(`[Visa Agent] Received task: ${task}`);

  const handler = taskHandlers[task];
  if (!handler) {
    const availableTasks = Object.keys(taskHandlers).join(', ');
    throw new Error(`Unknown task: ${task}. Available tasks: ${availableTasks}`);
  }

  try {
    const result = await handler(context);
    console.log(`[Visa Agent] Task ${task} completed successfully`);
    return result;
  } catch (error) {
    console.error(`[Visa Agent] Task ${task} failed: ${error.message}`);
    throw error;
  }
}

// Export for claude-flow integration
module.exports = {
  agentConfig,
  taskHandlers,
  runAgent
};

// CLI execution
if (require.main === module) {
  const task = process.argv[2] || 'gatherAll';
  const context = {};

  // Parse context from command line
  for (let i = 3; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      context[key] = value || true;
    }
  }

  runAgent(task, context)
    .then(result => {
      console.log('\n========== RESULT ==========');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error('Agent error:', error.message);
      process.exit(1);
    });
}
