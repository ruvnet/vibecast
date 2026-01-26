/**
 * Visa Requirements Scraper
 * Uses HTTP fetch with cheerio for parsing, with optional browser automation support
 */

const cheerio = require('cheerio');
const crypto = require('crypto');
const { getAllSources, getSourceById } = require('../config/visa-sources');

// Try to load playwright for browser automation (optional)
let playwright;
try {
  playwright = require('playwright');
} catch (e) {
  playwright = null;
}

/**
 * Configuration options for the scraper
 */
const DEFAULT_CONFIG = {
  timeout: 30000,
  retries: 3,
  retryDelay: 2000,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  useBrowser: false, // Use headless browser instead of fetch
  concurrency: 3 // Number of concurrent requests
};

/**
 * Create a content hash for change detection
 */
function createContentHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch page content using native fetch with retry logic
 */
async function fetchWithRetry(url, config = {}) {
  const { timeout, retries, retryDelay, userAgent } = { ...DEFAULT_CONFIG, ...config };

  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        console.log(`  Retry ${attempt}/${retries} for ${url} after error: ${error.message}`);
        await sleep(retryDelay * attempt);
      }
    }
  }

  throw lastError;
}

/**
 * Fetch page content using browser automation (for JavaScript-heavy sites)
 */
async function fetchWithBrowser(url, config = {}) {
  if (!playwright) {
    throw new Error('Playwright not available. Install with: npm install playwright && npx playwright install chromium');
  }

  const { timeout } = { ...DEFAULT_CONFIG, ...config };
  const browser = await playwright.chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      userAgent: config.userAgent || DEFAULT_CONFIG.userAgent
    });
    const page = await context.newPage();
    await page.goto(url, { timeout, waitUntil: 'networkidle' });
    const content = await page.content();
    return content;
  } finally {
    await browser.close();
  }
}

/**
 * Extract content from HTML using cheerio
 */
function extractContent($, selectors) {
  const contentSelector = selectors?.content || 'main, article, .content, #content, body';
  const requirementsSelector = selectors?.requirements || 'ul li, ol li, p, .requirement, .condition';

  // Get main content
  let $content = $(contentSelector).first();
  if ($content.length === 0) {
    $content = $('body');
  }

  // Remove scripts, styles, and navigation
  $content.find('script, style, nav, header, footer, .breadcrumb, .sidebar').remove();

  // Extract text content
  const textContent = $content.text()
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();

  // Extract structured requirements
  const requirements = [];
  $content.find(requirementsSelector).each((i, el) => {
    const text = $(el).text().trim();
    if (text.length > 10 && text.length < 1000) {
      requirements.push(text);
    }
  });

  // Extract headings for structure
  const sections = [];
  $content.find('h1, h2, h3, h4').each((i, el) => {
    sections.push({
      level: parseInt(el.tagName.replace('h', '').replace('H', '')),
      text: $(el).text().trim()
    });
  });

  // Try to find last updated date
  const dateSelector = selectors?.lastUpdated || '.date-modified, time, .last-updated';
  let lastModified = null;
  const $date = $(dateSelector).first();
  if ($date.length > 0) {
    lastModified = $date.text().trim() || $date.attr('datetime');
  }

  // Extract links for further exploration
  const links = [];
  $content.find('a[href]').each((i, el) => {
    const href = $(el).attr('href');
    const linkText = $(el).text().trim();
    if (href && linkText && !href.startsWith('#') && !href.startsWith('javascript:')) {
      links.push({ href, text: linkText });
    }
  });

  return {
    textContent,
    requirements: [...new Set(requirements)], // Remove duplicates
    sections,
    lastModified,
    links
  };
}

/**
 * Extract key requirements and conditions from content
 */
function extractKeyConditions(content) {
  const conditions = [];
  const text = content.textContent || '';

  // Common requirement patterns
  const patterns = [
    // Age requirements
    /(?:age|minimum age|maximum age)[:\s]+(\d+(?:\s*(?:to|-)\s*\d+)?(?:\s*years)?)/gi,
    // Education requirements
    /(?:education|degree|diploma|certificate)[:\s]+([^.]+)/gi,
    // Work experience
    /(?:work experience|experience required|years of experience)[:\s]+([^.]+)/gi,
    // Language requirements
    /(?:CLB|IELTS|TEF|language level|language requirement)[:\s]+([^.]+)/gi,
    // Points requirements
    /(?:minimum points|points required|CRS score|minimum score)[:\s]+(\d+)/gi,
    // Processing time
    /(?:processing time|processing takes)[:\s]+([^.]+)/gi,
    // Fees
    /(?:fee|fees|cost)[:\s]+\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      conditions.push({
        type: pattern.source.match(/\w+/)[0],
        value: match[1].trim(),
        fullMatch: match[0].trim()
      });
    }
  }

  // Extract bullet point requirements
  for (const req of content.requirements || []) {
    if (req.toLowerCase().includes('must') ||
        req.toLowerCase().includes('require') ||
        req.toLowerCase().includes('eligible') ||
        req.toLowerCase().includes('minimum') ||
        req.toLowerCase().includes('need')) {
      conditions.push({
        type: 'requirement',
        value: req
      });
    }
  }

  return conditions;
}

/**
 * Scrape a single visa source
 */
async function scrapeSingleSource(source, config = {}) {
  const startTime = Date.now();
  console.log(`Scraping: ${source.name}`);

  try {
    // Fetch HTML content
    const html = config.useBrowser
      ? await fetchWithBrowser(source.url, config)
      : await fetchWithRetry(source.url, config);

    // Parse with cheerio
    const $ = cheerio.load(html);

    // Extract content
    const content = extractContent($, source.selectors);

    // Extract key conditions
    const conditions = extractKeyConditions(content);

    // Create content hash for change detection
    const contentHash = createContentHash(content.textContent);

    const result = {
      id: source.id,
      name: source.name,
      url: source.url,
      category: source.category,
      province: source.province || null,
      scrapedAt: new Date().toISOString(),
      processingTime: Date.now() - startTime,
      contentHash,
      lastModified: content.lastModified,
      sections: content.sections,
      requirements: content.requirements.slice(0, 100), // Limit to top 100
      conditions,
      links: content.links.slice(0, 50), // Limit to top 50 links
      rawTextLength: content.textContent.length,
      success: true,
      error: null
    };

    console.log(`  Done: ${source.id} (${result.processingTime}ms, ${content.requirements.length} requirements found)`);
    return result;

  } catch (error) {
    console.error(`  Error scraping ${source.id}: ${error.message}`);
    return {
      id: source.id,
      name: source.name,
      url: source.url,
      category: source.category,
      province: source.province || null,
      scrapedAt: new Date().toISOString(),
      processingTime: Date.now() - startTime,
      success: false,
      error: error.message
    };
  }
}

/**
 * Scrape multiple sources with concurrency control
 */
async function scrapeWithConcurrency(sources, config = {}) {
  const concurrency = config.concurrency || DEFAULT_CONFIG.concurrency;
  const results = [];
  const queue = [...sources];

  async function worker() {
    while (queue.length > 0) {
      const source = queue.shift();
      if (source) {
        const result = await scrapeSingleSource(source, config);
        results.push(result);
      }
    }
  }

  // Create worker pool
  const workers = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(worker());
  }

  // Wait for all workers to complete
  await Promise.all(workers);

  return results;
}

/**
 * Scrape all visa sources
 */
async function scrapeAllSources(config = {}) {
  const sources = getAllSources();
  console.log(`\nStarting scrape of ${sources.length} visa sources...\n`);

  const startTime = Date.now();
  const results = await scrapeWithConcurrency(sources, config);

  const summary = {
    totalSources: sources.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    totalTime: Date.now() - startTime,
    scrapedAt: new Date().toISOString(),
    results
  };

  console.log(`\nScrape complete: ${summary.successful}/${summary.totalSources} successful (${summary.totalTime}ms)\n`);

  return summary;
}

/**
 * Scrape specific sources by IDs
 */
async function scrapeSources(sourceIds, config = {}) {
  const sources = sourceIds.map(id => getSourceById(id)).filter(Boolean);

  if (sources.length === 0) {
    throw new Error('No valid source IDs provided');
  }

  console.log(`\nScraping ${sources.length} specified sources...\n`);

  const startTime = Date.now();
  const results = await scrapeWithConcurrency(sources, config);

  return {
    totalSources: sources.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    totalTime: Date.now() - startTime,
    scrapedAt: new Date().toISOString(),
    results
  };
}

/**
 * Scrape Express Entry sources only
 */
async function scrapeExpressEntry(config = {}) {
  const { getExpressEntrySources } = require('../config/visa-sources');
  const sources = getExpressEntrySources();

  console.log(`\nScraping ${sources.length} Express Entry sources...\n`);

  const startTime = Date.now();
  const results = await scrapeWithConcurrency(sources, config);

  return {
    totalSources: sources.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    totalTime: Date.now() - startTime,
    scrapedAt: new Date().toISOString(),
    results
  };
}

/**
 * Scrape PNP sources only
 */
async function scrapePNPSources(config = {}) {
  const { getPNPSources } = require('../config/visa-sources');
  const sources = getPNPSources();

  console.log(`\nScraping ${sources.length} Provincial/Territorial Nominee Program sources...\n`);

  const startTime = Date.now();
  const results = await scrapeWithConcurrency(sources, config);

  return {
    totalSources: sources.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    totalTime: Date.now() - startTime,
    scrapedAt: new Date().toISOString(),
    results
  };
}

module.exports = {
  scrapeSingleSource,
  scrapeAllSources,
  scrapeSources,
  scrapeExpressEntry,
  scrapePNPSources,
  fetchWithRetry,
  fetchWithBrowser,
  extractContent,
  extractKeyConditions,
  createContentHash,
  DEFAULT_CONFIG
};
