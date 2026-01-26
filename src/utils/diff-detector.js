/**
 * Diff Detector - Compares visa requirements and detects changes
 * Identifies new programs, modified conditions, and removed requirements
 * Includes eligibility requirements in reports
 */

const fs = require('fs').promises;
const path = require('path');
const { getEligibility, getAllEligibilitySummaries } = require('../config/visa-sources');

const DATA_DIR = path.join(__dirname, '../../data');
const BASELINE_FILE = path.join(DATA_DIR, 'baseline.json');
const HISTORY_DIR = path.join(DATA_DIR, 'history');

/**
 * Ensure data directories exist
 */
async function ensureDataDirs() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(HISTORY_DIR, { recursive: true });
  } catch (e) {
    // Directories may already exist
  }
}

/**
 * Load the baseline data (previous scrape results)
 */
async function loadBaseline() {
  try {
    const data = await fs.readFile(BASELINE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}

/**
 * Save new baseline data
 */
async function saveBaseline(data) {
  await ensureDataDirs();
  await fs.writeFile(BASELINE_FILE, JSON.stringify(data, null, 2));
}

/**
 * Save historical snapshot
 */
async function saveSnapshot(data) {
  await ensureDataDirs();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.join(HISTORY_DIR, `snapshot-${timestamp}.json`);
  await fs.writeFile(filename, JSON.stringify(data, null, 2));
  return filename;
}

/**
 * List available historical snapshots
 */
async function listSnapshots() {
  await ensureDataDirs();
  try {
    const files = await fs.readdir(HISTORY_DIR);
    return files
      .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
      .map(f => ({
        filename: f,
        timestamp: f.replace('snapshot-', '').replace('.json', '').replace(/-/g, ':'),
        path: path.join(HISTORY_DIR, f)
      }))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch (e) {
    return [];
  }
}

/**
 * Load a specific snapshot
 */
async function loadSnapshot(filename) {
  const filepath = path.join(HISTORY_DIR, filename);
  const data = await fs.readFile(filepath, 'utf-8');
  return JSON.parse(data);
}

/**
 * Calculate text similarity using Jaccard index
 */
function calculateSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;

  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Compare two requirement lists
 */
function compareRequirements(oldReqs = [], newReqs = []) {
  const changes = {
    added: [],
    removed: [],
    similar: []
  };

  const oldSet = new Set(oldReqs);
  const newSet = new Set(newReqs);

  // Find exact matches and removals
  for (const req of oldReqs) {
    if (!newSet.has(req)) {
      // Check for similar requirements (may have been reworded)
      let foundSimilar = false;
      for (const newReq of newReqs) {
        const similarity = calculateSimilarity(req, newReq);
        if (similarity > 0.7) {
          changes.similar.push({
            old: req,
            new: newReq,
            similarity: Math.round(similarity * 100)
          });
          foundSimilar = true;
          break;
        }
      }
      if (!foundSimilar) {
        changes.removed.push(req);
      }
    }
  }

  // Find new requirements
  for (const req of newReqs) {
    if (!oldSet.has(req)) {
      // Check if it's not already captured as similar
      const isSimilar = changes.similar.some(s => s.new === req);
      if (!isSimilar) {
        changes.added.push(req);
      }
    }
  }

  return changes;
}

/**
 * Compare conditions between old and new data
 */
function compareConditions(oldConditions = [], newConditions = []) {
  const changes = {
    added: [],
    removed: [],
    modified: []
  };

  // Create lookup maps
  const oldByType = {};
  for (const c of oldConditions) {
    const key = `${c.type}:${c.value}`;
    oldByType[key] = c;
  }

  const newByType = {};
  for (const c of newConditions) {
    const key = `${c.type}:${c.value}`;
    newByType[key] = c;
  }

  // Find changes
  for (const key of Object.keys(oldByType)) {
    if (!newByType[key]) {
      changes.removed.push(oldByType[key]);
    }
  }

  for (const key of Object.keys(newByType)) {
    if (!oldByType[key]) {
      changes.added.push(newByType[key]);
    }
  }

  return changes;
}

/**
 * Compare a single source between old and new data
 */
function compareSingleSource(oldData, newData) {
  const diff = {
    id: newData.id,
    name: newData.name,
    url: newData.url,
    category: newData.category,
    province: newData.province,
    hasChanges: false,
    hashChanged: oldData?.contentHash !== newData.contentHash,
    lastModifiedChanged: oldData?.lastModified !== newData.lastModified,
    oldLastModified: oldData?.lastModified,
    newLastModified: newData.lastModified,
    requirements: null,
    conditions: null,
    sections: null
  };

  // Compare requirements
  if (oldData?.requirements || newData?.requirements) {
    diff.requirements = compareRequirements(
      oldData?.requirements || [],
      newData?.requirements || []
    );
    if (diff.requirements.added.length > 0 ||
        diff.requirements.removed.length > 0 ||
        diff.requirements.similar.length > 0) {
      diff.hasChanges = true;
    }
  }

  // Compare conditions
  if (oldData?.conditions || newData?.conditions) {
    diff.conditions = compareConditions(
      oldData?.conditions || [],
      newData?.conditions || []
    );
    if (diff.conditions.added.length > 0 ||
        diff.conditions.removed.length > 0) {
      diff.hasChanges = true;
    }
  }

  // Compare sections
  const oldSections = (oldData?.sections || []).map(s => s.text).join('|');
  const newSections = (newData?.sections || []).map(s => s.text).join('|');
  if (oldSections !== newSections) {
    diff.sections = {
      old: oldData?.sections || [],
      new: newData?.sections || []
    };
    diff.hasChanges = true;
  }

  return diff;
}

/**
 * Compare full scrape results with baseline
 */
async function compareWithBaseline(newResults) {
  const baseline = await loadBaseline();

  if (!baseline) {
    return {
      isFirstRun: true,
      message: 'No baseline found. This is the first scrape. Saving as baseline.',
      newPrograms: newResults.results.map(r => ({
        id: r.id,
        name: r.name,
        category: r.category
      })),
      changes: [],
      removedPrograms: []
    };
  }

  const comparison = {
    isFirstRun: false,
    baselineDate: baseline.scrapedAt,
    currentDate: newResults.scrapedAt,
    newPrograms: [],
    removedPrograms: [],
    changes: [],
    unchanged: []
  };

  // Create lookup maps
  const baselineById = {};
  for (const result of baseline.results || []) {
    baselineById[result.id] = result;
  }

  const newById = {};
  for (const result of newResults.results || []) {
    newById[result.id] = result;
  }

  // Find new programs
  for (const result of newResults.results) {
    if (!baselineById[result.id] && result.success) {
      comparison.newPrograms.push({
        id: result.id,
        name: result.name,
        category: result.category,
        province: result.province,
        url: result.url
      });
    }
  }

  // Find removed programs
  for (const result of baseline.results || []) {
    if (!newById[result.id]) {
      comparison.removedPrograms.push({
        id: result.id,
        name: result.name,
        category: result.category,
        province: result.province
      });
    }
  }

  // Compare existing programs
  for (const newResult of newResults.results) {
    const oldResult = baselineById[newResult.id];
    if (oldResult && newResult.success) {
      const diff = compareSingleSource(oldResult, newResult);
      if (diff.hasChanges || diff.hashChanged) {
        comparison.changes.push(diff);
      } else {
        comparison.unchanged.push({
          id: newResult.id,
          name: newResult.name
        });
      }
    }
  }

  return comparison;
}

/**
 * Generate a human-readable diff report
 */
function generateDiffReport(comparison) {
  const lines = [];

  lines.push('=' .repeat(80));
  lines.push('CANADIAN VISA REQUIREMENTS - CHANGE REPORT');
  lines.push('=' .repeat(80));
  lines.push('');

  if (comparison.isFirstRun) {
    lines.push('First run - no previous data to compare.');
    lines.push(`Found ${comparison.newPrograms.length} programs.`);
    lines.push('');
    return lines.join('\n');
  }

  lines.push(`Baseline Date: ${comparison.baselineDate}`);
  lines.push(`Current Date:  ${comparison.currentDate}`);
  lines.push('');

  // New Programs
  if (comparison.newPrograms.length > 0) {
    lines.push('-'.repeat(80));
    lines.push(`NEW PROGRAMS DETECTED (${comparison.newPrograms.length})`);
    lines.push('-'.repeat(80));
    for (const prog of comparison.newPrograms) {
      lines.push(`  + [${prog.category}] ${prog.name}`);
      if (prog.province) lines.push(`    Province: ${prog.province}`);
      lines.push(`    URL: ${prog.url}`);
      lines.push('');
    }
  }

  // Removed Programs
  if (comparison.removedPrograms.length > 0) {
    lines.push('-'.repeat(80));
    lines.push(`REMOVED/UNAVAILABLE PROGRAMS (${comparison.removedPrograms.length})`);
    lines.push('-'.repeat(80));
    for (const prog of comparison.removedPrograms) {
      lines.push(`  - [${prog.category}] ${prog.name}`);
      if (prog.province) lines.push(`    Province: ${prog.province}`);
      lines.push('');
    }
  }

  // Changed Programs
  if (comparison.changes.length > 0) {
    lines.push('-'.repeat(80));
    lines.push(`PROGRAMS WITH CHANGES (${comparison.changes.length})`);
    lines.push('-'.repeat(80));

    for (const change of comparison.changes) {
      lines.push('');
      lines.push(`[${change.category}] ${change.name}`);
      lines.push(`URL: ${change.url}`);

      if (change.hashChanged) {
        lines.push('  * Content hash changed (page was updated)');
      }

      if (change.lastModifiedChanged) {
        lines.push(`  * Last modified: ${change.oldLastModified || 'N/A'} -> ${change.newLastModified || 'N/A'}`);
      }

      // Requirements changes
      if (change.requirements) {
        if (change.requirements.added.length > 0) {
          lines.push('');
          lines.push(`  NEW REQUIREMENTS (${change.requirements.added.length}):`);
          for (const req of change.requirements.added.slice(0, 10)) {
            lines.push(`    + ${req.substring(0, 100)}${req.length > 100 ? '...' : ''}`);
          }
          if (change.requirements.added.length > 10) {
            lines.push(`    ... and ${change.requirements.added.length - 10} more`);
          }
        }

        if (change.requirements.removed.length > 0) {
          lines.push('');
          lines.push(`  REMOVED REQUIREMENTS (${change.requirements.removed.length}):`);
          for (const req of change.requirements.removed.slice(0, 10)) {
            lines.push(`    - ${req.substring(0, 100)}${req.length > 100 ? '...' : ''}`);
          }
          if (change.requirements.removed.length > 10) {
            lines.push(`    ... and ${change.requirements.removed.length - 10} more`);
          }
        }

        if (change.requirements.similar.length > 0) {
          lines.push('');
          lines.push(`  MODIFIED REQUIREMENTS (${change.requirements.similar.length}):`);
          for (const sim of change.requirements.similar.slice(0, 5)) {
            lines.push(`    ~ Old: ${sim.old.substring(0, 80)}${sim.old.length > 80 ? '...' : ''}`);
            lines.push(`      New: ${sim.new.substring(0, 80)}${sim.new.length > 80 ? '...' : ''}`);
            lines.push(`      (${sim.similarity}% similar)`);
          }
        }
      }

      // Conditions changes
      if (change.conditions) {
        if (change.conditions.added.length > 0) {
          lines.push('');
          lines.push(`  NEW CONDITIONS (${change.conditions.added.length}):`);
          for (const cond of change.conditions.added.slice(0, 10)) {
            lines.push(`    + [${cond.type}] ${cond.value}`);
          }
        }

        if (change.conditions.removed.length > 0) {
          lines.push('');
          lines.push(`  REMOVED CONDITIONS (${change.conditions.removed.length}):`);
          for (const cond of change.conditions.removed.slice(0, 10)) {
            lines.push(`    - [${cond.type}] ${cond.value}`);
          }
        }
      }

      lines.push('');
    }
  }

  // Summary
  lines.push('='.repeat(80));
  lines.push('SUMMARY');
  lines.push('='.repeat(80));
  lines.push(`  New Programs:     ${comparison.newPrograms.length}`);
  lines.push(`  Removed Programs: ${comparison.removedPrograms.length}`);
  lines.push(`  Changed Programs: ${comparison.changes.length}`);
  lines.push(`  Unchanged:        ${comparison.unchanged.length}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Run full comparison and generate report
 */
async function detectChanges(newResults, options = {}) {
  const comparison = await compareWithBaseline(newResults);
  const report = generateDiffReport(comparison);

  // Save snapshot for history
  if (options.saveSnapshot !== false) {
    await saveSnapshot(newResults);
  }

  // Update baseline if requested
  if (options.updateBaseline) {
    await saveBaseline(newResults);
  }

  return {
    comparison,
    report
  };
}

/**
 * Format eligibility requirements for display
 */
function formatEligibility(eligibility, indent = '  ') {
  if (!eligibility) return [];

  const lines = [];

  // Handle minimum requirements array
  if (eligibility.minimumRequirements) {
    lines.push(`${indent}MINIMUM REQUIREMENTS:`);
    for (const req of eligibility.minimumRequirements) {
      lines.push(`${indent}  - ${req}`);
    }
  }

  // Handle general requirements array
  if (eligibility.generalRequirements) {
    lines.push(`${indent}GENERAL REQUIREMENTS:`);
    for (const req of eligibility.generalRequirements) {
      lines.push(`${indent}  - ${req}`);
    }
  }

  // Handle language requirements
  if (eligibility.language) {
    lines.push(`${indent}LANGUAGE:`);
    if (typeof eligibility.language === 'object') {
      if (eligibility.language.minimum) {
        lines.push(`${indent}  Minimum: ${eligibility.language.minimum}`);
      }
      if (eligibility.language.acceptedTests) {
        lines.push(`${indent}  Accepted Tests: ${eligibility.language.acceptedTests.join(', ')}`);
      }
      if (eligibility.language.teer0or1) {
        lines.push(`${indent}  TEER 0/1: ${eligibility.language.teer0or1}`);
      }
      if (eligibility.language.teer2or3) {
        lines.push(`${indent}  TEER 2/3: ${eligibility.language.teer2or3}`);
      }
    }
  }

  // Handle work experience requirements
  if (eligibility.workExperience) {
    lines.push(`${indent}WORK EXPERIENCE:`);
    if (eligibility.workExperience.minimum) {
      lines.push(`${indent}  Minimum: ${eligibility.workExperience.minimum}`);
    }
    if (eligibility.workExperience.recency) {
      lines.push(`${indent}  Recency: ${eligibility.workExperience.recency}`);
    }
    if (eligibility.workExperience.type) {
      lines.push(`${indent}  Type: ${eligibility.workExperience.type}`);
    }
  }

  // Handle education requirements
  if (eligibility.education) {
    lines.push(`${indent}EDUCATION:`);
    if (eligibility.education.minimum) {
      lines.push(`${indent}  Minimum: ${eligibility.education.minimum}`);
    }
    if (eligibility.education.ecaRequired !== undefined) {
      lines.push(`${indent}  ECA Required: ${eligibility.education.ecaRequired ? 'Yes' : 'No'}`);
    }
  }

  // Handle points grid
  if (eligibility.pointsGrid) {
    lines.push(`${indent}POINTS GRID:`);
    for (const [factor, details] of Object.entries(eligibility.pointsGrid)) {
      if (typeof details === 'object' && details.max) {
        lines.push(`${indent}  ${factor}: Max ${details.max} points - ${details.description || ''}`);
      }
    }
    if (eligibility.passingScore) {
      lines.push(`${indent}  Passing Score: ${eligibility.passingScore} points`);
    }
  }

  // Handle streams for PNP
  if (eligibility.streams) {
    lines.push(`${indent}AVAILABLE STREAMS:`);
    for (const [key, stream] of Object.entries(eligibility.streams)) {
      if (stream.name) {
        lines.push(`${indent}  ${stream.name}:`);
        if (stream.requirements) {
          for (const req of stream.requirements.slice(0, 3)) {
            lines.push(`${indent}    - ${req}`);
          }
        }
      }
    }
  }

  // Handle common requirements
  if (eligibility.commonRequirements) {
    lines.push(`${indent}COMMON REQUIREMENTS:`);
    for (const req of eligibility.commonRequirements) {
      lines.push(`${indent}  - ${req}`);
    }
  }

  return lines;
}

/**
 * Generate eligibility report for all programs
 */
function generateEligibilityReport(results = []) {
  const lines = [];

  lines.push('='.repeat(80));
  lines.push('CANADIAN VISA PROGRAMS - ELIGIBILITY REQUIREMENTS');
  lines.push('='.repeat(80));
  lines.push('');

  // Group by category
  const byCategory = {};
  for (const result of results) {
    if (!result.eligibility) continue;
    const cat = result.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(result);
  }

  for (const [category, programs] of Object.entries(byCategory)) {
    lines.push('-'.repeat(80));
    lines.push(`${category.toUpperCase()}`);
    lines.push('-'.repeat(80));

    for (const prog of programs) {
      lines.push('');
      lines.push(`[${prog.id}] ${prog.name}`);
      if (prog.province) lines.push(`Province: ${prog.province}`);
      lines.push(`URL: ${prog.url}`);
      if (prog.description) lines.push(`Description: ${prog.description}`);
      lines.push('');

      const eligLines = formatEligibility(prog.eligibility);
      lines.push(...eligLines);
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Generate a program-specific eligibility summary
 */
function getProgramEligibilitySummary(programId) {
  const eligibility = getEligibility(programId);
  if (!eligibility) return null;

  return formatEligibility(eligibility, '').join('\n');
}

module.exports = {
  loadBaseline,
  saveBaseline,
  saveSnapshot,
  listSnapshots,
  loadSnapshot,
  compareSingleSource,
  compareWithBaseline,
  generateDiffReport,
  detectChanges,
  compareRequirements,
  compareConditions,
  calculateSimilarity,
  formatEligibility,
  generateEligibilityReport,
  getProgramEligibilitySummary
};
