// SWE-bench Style Test Suite
// Real-world software engineering tasks for evaluating code generation

export const sweBenchTasks = [
  {
    id: "SWE-001",
    category: "Bug Fix",
    difficulty: "Easy",
    title: "Fix off-by-one error in pagination",
    description: "The pagination function returns one fewer item than requested. Fix the range calculation.",
    existingCode: `function paginate(items, page, perPage) {
  const start = (page - 1) * perPage;
  const end = start + perPage - 1;
  return items.slice(start, end);
}`,
    expectedBehavior: "Should return exactly perPage items (or remaining items if less available)",
    testCases: [
      { input: "paginate([1,2,3,4,5], 1, 3)", expected: "[1,2,3]" },
      { input: "paginate([1,2,3,4,5], 2, 3)", expected: "[4,5]" },
    ],
    hints: ["Check the slice() end parameter", "slice() end is exclusive"],
    correctSolution: `function paginate(items, page, perPage) {
  const start = (page - 1) * perPage;
  const end = start + perPage;
  return items.slice(start, end);
}`
  },

  {
    id: "SWE-002",
    category: "Bug Fix",
    difficulty: "Medium",
    title: "Fix race condition in async cache",
    description: "Cache can return stale data when multiple requests for the same key happen simultaneously.",
    existingCode: `class AsyncCache {
  constructor() {
    this.cache = {};
  }

  async get(key, fetchFn) {
    if (this.cache[key]) {
      return this.cache[key];
    }
    const value = await fetchFn();
    this.cache[key] = value;
    return value;
  }
}`,
    expectedBehavior: "Should prevent duplicate fetches for the same key",
    testCases: [
      { scenario: "Two simultaneous requests for same key should only call fetchFn once" }
    ],
    hints: ["Store pending promises", "Check for in-flight requests"],
    correctSolution: `class AsyncCache {
  constructor() {
    this.cache = {};
    this.pending = {};
  }

  async get(key, fetchFn) {
    if (this.cache[key]) {
      return this.cache[key];
    }
    if (this.pending[key]) {
      return this.pending[key];
    }
    this.pending[key] = fetchFn().then(value => {
      this.cache[key] = value;
      delete this.pending[key];
      return value;
    });
    return this.pending[key];
  }
}`
  },

  {
    id: "SWE-003",
    category: "Feature Implementation",
    difficulty: "Medium",
    title: "Implement debounce function",
    description: "Create a debounce function that delays invoking func until after wait milliseconds have elapsed since the last invocation.",
    existingCode: null,
    expectedBehavior: "Returns a debounced function that delays execution",
    testCases: [
      { scenario: "Rapid calls should only execute once after delay" },
      { scenario: "Should pass arguments correctly" },
      { scenario: "Should maintain this context" }
    ],
    hints: ["Use setTimeout/clearTimeout", "Store timeout reference", "Use closure for state"],
    correctSolution: `function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}`
  },

  {
    id: "SWE-004",
    category: "Algorithm",
    difficulty: "Medium",
    title: "Implement LRU Cache",
    description: "Design a data structure that follows Least Recently Used (LRU) cache constraints with O(1) operations.",
    existingCode: null,
    expectedBehavior: "get() and put() operations in O(1) time, evict least recently used when capacity exceeded",
    testCases: [
      { operations: "put(1,1), put(2,2), get(1), put(3,3), get(2)", expected: "get(2) returns -1" },
    ],
    hints: ["Use HashMap + Doubly Linked List", "Track access order", "Move to front on access"],
    correctSolution: `class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return -1;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  put(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, value);
    if (this.cache.size > this.capacity) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }
}`
  },

  {
    id: "SWE-005",
    category: "Bug Fix",
    difficulty: "Hard",
    title: "Fix memory leak in event listeners",
    description: "Component doesn't properly clean up event listeners, causing memory leaks.",
    existingCode: `class Component {
  constructor(element) {
    this.element = element;
    this.handleClick = () => this.onClick();
    element.addEventListener('click', this.handleClick);
  }

  onClick() {
    console.log('Clicked');
  }

  destroy() {
    this.element = null;
  }
}`,
    expectedBehavior: "Should remove event listeners in destroy() to prevent memory leaks",
    testCases: [
      { scenario: "Event listener should be removed on destroy" },
      { scenario: "No memory leaks after multiple create/destroy cycles" }
    ],
    hints: ["removeEventListener in destroy", "Store handler reference", "Clean up all references"],
    correctSolution: `class Component {
  constructor(element) {
    this.element = element;
    this.handleClick = () => this.onClick();
    element.addEventListener('click', this.handleClick);
  }

  onClick() {
    console.log('Clicked');
  }

  destroy() {
    if (this.element) {
      this.element.removeEventListener('click', this.handleClick);
      this.element = null;
    }
    this.handleClick = null;
  }
}`
  },

  {
    id: "SWE-006",
    category: "Feature Implementation",
    difficulty: "Hard",
    title: "Implement Promise.allSettled",
    description: "Implement Promise.allSettled that waits for all promises to settle (fulfilled or rejected).",
    existingCode: null,
    expectedBehavior: "Returns array of objects describing outcome of each promise",
    testCases: [
      { scenario: "All fulfilled: returns all results" },
      { scenario: "Some rejected: still waits for all and returns status objects" }
    ],
    hints: ["Wrap each promise", "Catch rejections", "Return status objects"],
    correctSolution: `Promise.myAllSettled = function(promises) {
  return Promise.all(
    promises.map(promise =>
      Promise.resolve(promise)
        .then(value => ({ status: 'fulfilled', value }))
        .catch(reason => ({ status: 'rejected', reason }))
    )
  );
}`
  },

  {
    id: "SWE-007",
    category: "Algorithm",
    difficulty: "Hard",
    title: "Implement deep clone with circular reference handling",
    description: "Create a deep clone function that handles circular references and various data types.",
    existingCode: null,
    expectedBehavior: "Clones objects deeply, handles circular refs, supports Date, RegExp, etc.",
    testCases: [
      { scenario: "Nested objects cloned correctly" },
      { scenario: "Circular references don't cause infinite loop" },
      { scenario: "Special objects (Date, RegExp) cloned correctly" }
    ],
    hints: ["Use WeakMap for circular refs", "Check object types", "Handle special cases"],
    correctSolution: `function deepClone(obj, hash = new WeakMap()) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof RegExp) return new RegExp(obj);
  if (hash.has(obj)) return hash.get(obj);

  const clone = Array.isArray(obj) ? [] : {};
  hash.set(obj, clone);

  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      clone[key] = deepClone(obj[key], hash);
    }
  }
  return clone;
}`
  },

  {
    id: "SWE-008",
    category: "Bug Fix",
    difficulty: "Easy",
    title: "Fix SQL injection vulnerability",
    description: "The query builder is vulnerable to SQL injection. Use parameterized queries.",
    existingCode: `function getUserByEmail(email) {
  const query = \`SELECT * FROM users WHERE email = '\${email}'\`;
  return db.query(query);
}`,
    expectedBehavior: "Should use parameterized queries to prevent SQL injection",
    testCases: [
      { input: "test@example.com", expected: "Safe query" },
      { input: "'; DROP TABLE users; --", expected: "Should not execute malicious SQL" }
    ],
    hints: ["Use parameterized queries", "Never concatenate user input", "Use ? placeholders"],
    correctSolution: `function getUserByEmail(email) {
  const query = 'SELECT * FROM users WHERE email = ?';
  return db.query(query, [email]);
}`
  },

  {
    id: "SWE-009",
    category: "Feature Implementation",
    difficulty: "Medium",
    title: "Implement retry mechanism with exponential backoff",
    description: "Create a retry function that retries failed operations with exponential backoff.",
    existingCode: null,
    expectedBehavior: "Retries with increasing delays: 1s, 2s, 4s, 8s, etc.",
    testCases: [
      { scenario: "Success on first try: returns immediately" },
      { scenario: "Fails 3 times then succeeds: retries with delays" },
      { scenario: "Always fails: throws after max retries" }
    ],
    hints: ["Recursive or loop approach", "Calculate delay: 2^attempt", "Track attempt count"],
    correctSolution: `async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}`
  },

  {
    id: "SWE-010",
    category: "Algorithm",
    difficulty: "Medium",
    title: "Implement efficient string matching (KMP algorithm)",
    description: "Implement string search using Knuth-Morris-Pratt algorithm for O(n+m) performance.",
    existingCode: null,
    expectedBehavior: "Find all occurrences of pattern in text efficiently",
    testCases: [
      { text: "ababcabcab", pattern: "abc", expected: "[2, 5]" },
      { text: "aaaa", pattern: "aa", expected: "[0, 1, 2]" }
    ],
    hints: ["Build failure function", "Use failure function to skip characters", "Linear time complexity"],
    correctSolution: `function kmpSearch(text, pattern) {
  const lps = buildLPS(pattern);
  const result = [];
  let i = 0, j = 0;

  while (i < text.length) {
    if (text[i] === pattern[j]) {
      i++; j++;
    }
    if (j === pattern.length) {
      result.push(i - j);
      j = lps[j - 1];
    } else if (i < text.length && text[i] !== pattern[j]) {
      j !== 0 ? j = lps[j - 1] : i++;
    }
  }
  return result;
}

function buildLPS(pattern) {
  const lps = [0];
  let len = 0, i = 1;
  while (i < pattern.length) {
    if (pattern[i] === pattern[len]) {
      lps[i++] = ++len;
    } else {
      len !== 0 ? len = lps[len - 1] : lps[i++] = 0;
    }
  }
  return lps;
}`
  }
];

export const evaluationCriteria = {
  correctness: {
    weight: 0.4,
    description: "Does the solution work correctly for all test cases?"
  },
  codeQuality: {
    weight: 0.2,
    description: "Is the code clean, readable, and well-structured?"
  },
  performance: {
    weight: 0.2,
    description: "Is the solution efficient (time and space complexity)?"
  },
  completeness: {
    weight: 0.1,
    description: "Does it handle edge cases and error conditions?"
  },
  security: {
    weight: 0.1,
    description: "Does it follow security best practices?"
  }
};

// Helper function to evaluate code similarity (simple heuristic)
export function evaluateCodeQuality(generated, correct) {
  // This is a simplified evaluation - in practice you'd use AST comparison
  // or execute tests

  const metrics = {
    correctness: 0,
    codeQuality: 0,
    performance: 0,
    completeness: 0,
    security: 0
  };

  if (!generated || generated.trim().length === 0) {
    return { ...metrics, overall: 0 };
  }

  // Check for key patterns
  const hasCorrectLogic = checkLogicSimilarity(generated, correct);
  const hasGoodStructure = checkCodeStructure(generated);
  const hasErrorHandling = generated.includes('try') || generated.includes('catch') ||
                          generated.includes('if') && generated.includes('throw');

  metrics.correctness = hasCorrectLogic ? 0.8 : 0.3;
  metrics.codeQuality = hasGoodStructure ? 0.7 : 0.4;
  metrics.performance = 0.6; // Would need execution to truly measure
  metrics.completeness = hasErrorHandling ? 0.7 : 0.5;
  metrics.security = 0.6; // Would need security analysis

  // Calculate weighted overall score
  metrics.overall =
    metrics.correctness * evaluationCriteria.correctness.weight +
    metrics.codeQuality * evaluationCriteria.codeQuality.weight +
    metrics.performance * evaluationCriteria.performance.weight +
    metrics.completeness * evaluationCriteria.completeness.weight +
    metrics.security * evaluationCriteria.security.weight;

  return metrics;
}

function checkLogicSimilarity(generated, correct) {
  // Remove whitespace and compare key tokens
  const normalize = (code) => code.replace(/\s+/g, ' ').toLowerCase();
  const genNorm = normalize(generated);
  const corrNorm = normalize(correct);

  // Extract key identifiers from correct solution
  const keyPatterns = [
    /function\s+\w+/g,
    /const\s+\w+/g,
    /let\s+\w+/g,
    /\.\w+\(/g,
    /=>/g
  ];

  let matchCount = 0;
  let totalPatterns = 0;

  keyPatterns.forEach(pattern => {
    const correctMatches = corrNorm.match(pattern) || [];
    totalPatterns += correctMatches.length;
    correctMatches.forEach(match => {
      if (genNorm.includes(match)) matchCount++;
    });
  });

  return totalPatterns > 0 ? matchCount / totalPatterns : 0.5;
}

function checkCodeStructure(code) {
  const hasComments = code.includes('//') || code.includes('/*');
  const hasProperIndentation = /\n\s{2,}/.test(code);
  const hasDescriptiveNames = /\b[a-z][a-zA-Z]{4,}\b/.test(code);
  const notTooLong = code.split('\n').length < 100;

  const score = [hasProperIndentation, hasDescriptiveNames, notTooLong]
    .filter(Boolean).length / 3;

  return score;
}
