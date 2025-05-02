// Jest setup file

// Mock global fetch
global.fetch = jest.fn();

// Mock Headers, Request, and Response
global.Headers = jest.fn().mockImplementation(function(init) {
  const headers = new Map();
  
  // Initialize with any provided headers
  if (init) {
    Object.entries(init).forEach(([key, value]) => {
      headers.set(key.toLowerCase(), value);
    });
  }
  
  return {
    get: jest.fn(name => headers.get(name.toLowerCase())),
    set: jest.fn((name, value) => headers.set(name.toLowerCase(), value)),
    append: jest.fn((name, value) => {
      const key = name.toLowerCase();
      const current = headers.get(key);
      headers.set(key, current ? `${current}, ${value}` : value);
    }),
    delete: jest.fn(name => headers.delete(name.toLowerCase())),
    has: jest.fn(name => headers.has(name.toLowerCase())),
    forEach: jest.fn(callback => headers.forEach((value, key) => callback(value, key))),
  };
});

global.Request = jest.fn().mockImplementation(() => ({
  url: 'https://example.com',
  method: 'GET',
  headers: new Headers(),
  json: jest.fn(),
  text: jest.fn(),
}));

global.Response = jest.fn().mockImplementation((body, init) => {
  const headers = new Headers(init?.headers);
  
  // Ensure JSON content is properly stringified
  const processedBody = typeof body === 'object' && body !== null
    ? JSON.stringify(body)
    : body;
    
  return {
    body: processedBody,
    status: init?.status || 200,
    statusText: init?.statusText || 'OK',
    headers: headers,
    json: jest.fn().mockImplementation(() => {
      try {
        return Promise.resolve(typeof body === 'string' ? JSON.parse(body) : body);
      } catch (e) {
        return Promise.reject(new Error('Invalid JSON'));
      }
    }),
    text: jest.fn().mockImplementation(() => {
      return Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body));
    }),
    clone: jest.fn().mockImplementation(() => {
      return new global.Response(processedBody, init);
    }),
  };
}) as unknown as typeof Response;

// Mock Cloudflare Worker environment
global.caches = {
  open: jest.fn().mockResolvedValue({
    match: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  }),
  default: jest.fn().mockResolvedValue({
    match: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  }),
} as unknown as CacheStorage;

// Mock console methods for testing
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Clear all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});