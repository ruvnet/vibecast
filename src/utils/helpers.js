/**
 * Utility functions for the Change Management Expert System
 */

/**
 * Strip ANSI color codes from text
 */
function stripAnsiCodes(text) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Extract JSON from AgentDB CLI output
 * AgentDB outputs status messages with ANSI codes followed by JSON
 */
function extractJSON(output) {
  if (!output || typeof output !== 'string') {
    return null;
  }

  // Strip ANSI codes first
  const clean = stripAnsiCodes(output);

  // Try to find JSON array or object
  const arrayMatch = clean.match(/\[[\s\S]*\]/);
  const objectMatch = clean.match(/\{[\s\S]*\}/);

  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch (e) {
      // Not valid JSON
    }
  }

  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch (e) {
      // Not valid JSON
    }
  }

  // Try parsing the entire string after cleaning
  try {
    return JSON.parse(clean);
  } catch (e) {
    return null;
  }
}

/**
 * Parse AgentDB command output
 */
function parseAgentDBOutput(output, defaultValue = null) {
  const json = extractJSON(output);
  return json !== null ? json : defaultValue;
}

/**
 * Check if output indicates success
 */
function isSuccessOutput(output) {
  if (!output) return false;
  const clean = stripAnsiCodes(output);
  return clean.includes('✅') || clean.includes('success') || clean.includes('created');
}

/**
 * Sanitize command arguments to prevent injection
 */
function sanitizeArgument(arg) {
  if (typeof arg !== 'string') return arg;

  // Remove dangerous characters
  return arg.replace(/[`$]/g, '');
}

/**
 * Format duration in human-readable format
 */
function formatDuration(minutes) {
  if (minutes < 60) {
    return `${minutes} minutes`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours} hours`;
}

/**
 * Truncate text to max length
 */
function truncate(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Deep clone an object
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Debounce function calls
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Simple in-memory cache with TTL
 */
class SimpleCache {
  constructor(ttlMs = 300000) { // 5 minutes default
    this.cache = new Map();
    this.ttl = ttlMs;
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      expires: Date.now() + this.ttl
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  has(key) {
    return this.get(key) !== null;
  }

  clear() {
    this.cache.clear();
  }

  size() {
    // Clean expired items first
    for (const [key, item] of this.cache.entries()) {
      if (Date.now() > item.expires) {
        this.cache.delete(key);
      }
    }
    return this.cache.size;
  }
}

module.exports = {
  stripAnsiCodes,
  extractJSON,
  parseAgentDBOutput,
  isSuccessOutput,
  sanitizeArgument,
  formatDuration,
  truncate,
  deepClone,
  debounce,
  SimpleCache
};
