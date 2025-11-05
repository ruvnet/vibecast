/**
 * PII Redactor - Privacy-First Defaults
 *
 * Automatically detects and redacts PII before external egress.
 * Inspired by Microsoft Presidio and similar PII detection systems.
 *
 * Patterns detected:
 * - Email addresses
 * - Phone numbers
 * - SSN (US)
 * - Credit card numbers
 * - IP addresses
 * - Custom patterns (configurable)
 */

import { connectAgentDB } from '../db/agentdb.js';

/**
 * PII detection patterns
 */
const PII_PATTERNS = {
  email: {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL_REDACTED]',
    confidence: 0.95
  },

  ssn: {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[SSN_REDACTED]',
    confidence: 0.99
  },

  credit_card: {
    pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
    replacement: '[CC_REDACTED]',
    confidence: 0.90
  },

  phone: {
    pattern: /\b(\+?1[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}\b/g,
    replacement: '[PHONE_REDACTED]',
    confidence: 0.85
  },

  ip_address: {
    pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    replacement: '[IP_REDACTED]',
    confidence: 0.80
  }
};

export class PIIRedactor {
  constructor(config = {}) {
    this.db = connectAgentDB();
    this.config = {
      redactionMode: config.redactionMode || 'replace',  // 'replace', 'hash', 'mask'
      logRedactions: config.logRedactions !== false,
      ...config
    };

    this.patterns = { ...PII_PATTERNS, ...(config.customPatterns || {}) };
  }

  /**
   * Detect PII in data
   *
   * @param {any} data - Data to scan
   * @returns {object} - Detection results with confidence scores
   */
  detect(data) {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    const detected = [];

    for (const [type, config] of Object.entries(this.patterns)) {
      const matches = str.match(config.pattern);

      if (matches && matches.length > 0) {
        detected.push({
          type,
          count: matches.length,
          confidence: config.confidence,
          samples: matches.slice(0, 3)  // First 3 samples
        });
      }
    }

    return {
      hasPII: detected.length > 0,
      types: detected.map(d => d.type),
      details: detected,
      confidence: detected.length > 0
        ? detected.reduce((sum, d) => sum + d.confidence, 0) / detected.length
        : 0
    };
  }

  /**
   * Redact PII from data
   *
   * @param {any} data - Data to redact
   * @returns {object} - Redacted data + redaction manifest
   */
  async redact(data) {
    const detection = this.detect(data);

    if (!detection.hasPII) {
      return {
        redacted: data,
        manifest: { redactions: 0, types: [] },
        original: data
      };
    }

    let redactedStr = typeof data === 'string' ? data : JSON.stringify(data);
    const manifest = {
      redactions: 0,
      types: [],
      timestamp: new Date().toISOString()
    };

    // Apply redactions
    for (const [type, config] of Object.entries(this.patterns)) {
      const beforeCount = redactedStr.length;

      if (this.config.redactionMode === 'replace') {
        redactedStr = redactedStr.replace(config.pattern, config.replacement);
      } else if (this.config.redactionMode === 'hash') {
        redactedStr = redactedStr.replace(config.pattern, (match) => {
          return `[${type.toUpperCase()}_${this._hash(match).substring(0, 8)}]`;
        });
      } else if (this.config.redactionMode === 'mask') {
        redactedStr = redactedStr.replace(config.pattern, (match) => {
          return match.substring(0, 3) + '*'.repeat(Math.max(0, match.length - 6)) + match.substring(match.length - 3);
        });
      }

      if (redactedStr.length !== beforeCount) {
        manifest.redactions++;
        manifest.types.push(type);
      }
    }

    // Parse back to original type if needed
    let redacted;
    try {
      redacted = typeof data === 'string' ? redactedStr : JSON.parse(redactedStr);
    } catch {
      redacted = redactedStr;
    }

    // Log redaction if enabled
    if (this.config.logRedactions) {
      await this._logRedaction(manifest, detection);
    }

    return {
      redacted,
      manifest,
      original: data  // Keep for audit (stored securely)
    };
  }

  /**
   * Hash a string (for hash redaction mode)
   */
  _hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Log redaction event
   */
  async _logRedaction(manifest, detection) {
    await this.db.insert('redaction_log', {
      redactions: manifest.redactions,
      types: manifest.types,
      confidence: detection.confidence,
      timestamp: manifest.timestamp
    });
  }

  /**
   * Get redaction statistics
   */
  async getStats(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await this.db.query('redaction_log', {
      where: {
        timestamp: { operator: 'gte', value: startDate.toISOString() }
      }
    });

    const stats = {
      totalRedactions: 0,
      byType: {},
      dailyAverage: 0
    };

    for (const log of logs) {
      stats.totalRedactions += log.redactions;

      for (const type of log.types) {
        stats.byType[type] = (stats.byType[type] || 0) + 1;
      }
    }

    stats.dailyAverage = stats.totalRedactions / days;

    return stats;
  }
}

export default PIIRedactor;
