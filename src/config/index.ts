/**
 * Configuration - FlowManager Document Intake
 *
 * Application configuration management.
 */

import { z } from 'zod';

/**
 * Environment enum
 */
export const Environment = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
} as const;

export type Environment = (typeof Environment)[keyof typeof Environment];

/**
 * Configuration schema
 */
export const configSchema = z.object({
  /**
   * Application environment
   */
  environment: z.enum(['development', 'staging', 'production']).default('development'),

  /**
   * HTTP server configuration
   */
  server: z.object({
    port: z.coerce.number().int().min(1).max(65535).default(3000),
    host: z.string().default('0.0.0.0'),
    trustProxy: z.coerce.boolean().default(false),
    bodyLimit: z.string().default('1mb'),
    uploadLimit: z.string().default('100mb'),
    requestTimeoutMs: z.coerce.number().int().default(30000),
    keepAliveTimeoutMs: z.coerce.number().int().default(65000),
  }).default({}),

  /**
   * Database configuration
   */
  database: z.object({
    host: z.string().default('localhost'),
    port: z.coerce.number().int().default(5432),
    database: z.string().default('flowmanager'),
    username: z.string().default('postgres'),
    password: z.string().default(''),
    ssl: z.coerce.boolean().default(false),
    poolSize: z.coerce.number().int().default(10),
    connectionTimeoutMs: z.coerce.number().int().default(5000),
  }).default({}),

  /**
   * Redis configuration
   */
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.coerce.number().int().default(6379),
    password: z.string().optional(),
    db: z.coerce.number().int().default(0),
    tls: z.coerce.boolean().default(false),
    keyPrefix: z.string().default('flowmanager:'),
    connectionTimeoutMs: z.coerce.number().int().default(5000),
    commandTimeoutMs: z.coerce.number().int().default(1000),
    maxRetries: z.coerce.number().int().default(3),
  }).default({}),

  /**
   * Azure Blob Storage configuration
   */
  storage: z.object({
    accountName: z.string().default(''),
    accountKey: z.string().optional(),
    connectionString: z.string().optional(),
    containerName: z.string().default('document-intake'),
    quarantineContainerName: z.string().default('document-intake-quarantine'),
    useManagedIdentity: z.coerce.boolean().default(false),
    uploadTimeoutMs: z.coerce.number().int().default(60000),
    maxRetries: z.coerce.number().int().default(3),
  }).default({}),

  /**
   * OpenTelemetry configuration
   */
  telemetry: z.object({
    enabled: z.coerce.boolean().default(true),
    serviceName: z.string().default('flowmanager-document-intake'),
    serviceVersion: z.string().default('1.0.0'),
    otlpEndpoint: z.string().default('http://localhost:4318'),
    samplingRatio: z.coerce.number().min(0).max(1).default(1.0),
    metricsIntervalMs: z.coerce.number().int().default(60000),
  }).default({}),

  /**
   * Authentication configuration
   */
  auth: z.object({
    enabled: z.coerce.boolean().default(true),
    jwtIssuer: z.string().default(''),
    jwtAudience: z.string().default(''),
    jwksUri: z.string().optional(),
  }).default({}),

  /**
   * Rate limiting configuration
   */
  rateLimit: z.object({
    enabled: z.coerce.boolean().default(true),
    windowMs: z.coerce.number().int().default(60000),
    maxRequests: z.coerce.number().int().default(100),
  }).default({}),

  /**
   * Idempotency configuration
   */
  idempotency: z.object({
    completedTtlMs: z.coerce.number().int().default(24 * 60 * 60 * 1000), // 24 hours
    inProgressTtlMs: z.coerce.number().int().default(5 * 60 * 1000), // 5 minutes
    failedTtlMs: z.coerce.number().int().default(60 * 60 * 1000), // 1 hour
    lockTtlMs: z.coerce.number().int().default(30 * 1000), // 30 seconds
    contentHashTtlMs: z.coerce.number().int().default(7 * 24 * 60 * 60 * 1000), // 7 days
  }).default({}),

  /**
   * Logging configuration
   */
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    format: z.enum(['json', 'pretty']).default('json'),
    includeTimestamp: z.coerce.boolean().default(true),
    sanitizePii: z.coerce.boolean().default(true),
  }).default({}),
});

/**
 * Application configuration type
 */
export type AppConfig = z.infer<typeof configSchema>;

/**
 * Load configuration from environment variables
 */
export function loadConfig(): AppConfig {
  const raw = {
    environment: process.env['NODE_ENV'],
    server: {
      port: process.env['PORT'],
      host: process.env['HOST'],
      trustProxy: process.env['TRUST_PROXY'],
      bodyLimit: process.env['BODY_LIMIT'],
      uploadLimit: process.env['UPLOAD_LIMIT'],
      requestTimeoutMs: process.env['REQUEST_TIMEOUT_MS'],
      keepAliveTimeoutMs: process.env['KEEP_ALIVE_TIMEOUT_MS'],
    },
    database: {
      host: process.env['DB_HOST'],
      port: process.env['DB_PORT'],
      database: process.env['DB_NAME'],
      username: process.env['DB_USER'],
      password: process.env['DB_PASSWORD'],
      ssl: process.env['DB_SSL'],
      poolSize: process.env['DB_POOL_SIZE'],
      connectionTimeoutMs: process.env['DB_CONNECTION_TIMEOUT_MS'],
    },
    redis: {
      host: process.env['REDIS_HOST'],
      port: process.env['REDIS_PORT'],
      password: process.env['REDIS_PASSWORD'],
      db: process.env['REDIS_DB'],
      tls: process.env['REDIS_TLS'],
      keyPrefix: process.env['REDIS_KEY_PREFIX'],
      connectionTimeoutMs: process.env['REDIS_CONNECTION_TIMEOUT_MS'],
      commandTimeoutMs: process.env['REDIS_COMMAND_TIMEOUT_MS'],
      maxRetries: process.env['REDIS_MAX_RETRIES'],
    },
    storage: {
      accountName: process.env['AZURE_STORAGE_ACCOUNT_NAME'],
      accountKey: process.env['AZURE_STORAGE_ACCOUNT_KEY'],
      connectionString: process.env['AZURE_STORAGE_CONNECTION_STRING'],
      containerName: process.env['AZURE_STORAGE_CONTAINER_NAME'],
      quarantineContainerName: process.env['AZURE_STORAGE_QUARANTINE_CONTAINER_NAME'],
      useManagedIdentity: process.env['AZURE_USE_MANAGED_IDENTITY'],
      uploadTimeoutMs: process.env['AZURE_STORAGE_UPLOAD_TIMEOUT_MS'],
      maxRetries: process.env['AZURE_STORAGE_MAX_RETRIES'],
    },
    telemetry: {
      enabled: process.env['TELEMETRY_ENABLED'],
      serviceName: process.env['OTEL_SERVICE_NAME'],
      serviceVersion: process.env['OTEL_SERVICE_VERSION'],
      otlpEndpoint: process.env['OTEL_EXPORTER_OTLP_ENDPOINT'],
      samplingRatio: process.env['OTEL_SAMPLING_RATIO'],
      metricsIntervalMs: process.env['OTEL_METRICS_INTERVAL_MS'],
    },
    auth: {
      enabled: process.env['AUTH_ENABLED'],
      jwtIssuer: process.env['JWT_ISSUER'],
      jwtAudience: process.env['JWT_AUDIENCE'],
      jwksUri: process.env['JWKS_URI'],
    },
    rateLimit: {
      enabled: process.env['RATE_LIMIT_ENABLED'],
      windowMs: process.env['RATE_LIMIT_WINDOW_MS'],
      maxRequests: process.env['RATE_LIMIT_MAX_REQUESTS'],
    },
    idempotency: {
      completedTtlMs: process.env['IDEMPOTENCY_COMPLETED_TTL_MS'],
      inProgressTtlMs: process.env['IDEMPOTENCY_IN_PROGRESS_TTL_MS'],
      failedTtlMs: process.env['IDEMPOTENCY_FAILED_TTL_MS'],
      lockTtlMs: process.env['IDEMPOTENCY_LOCK_TTL_MS'],
      contentHashTtlMs: process.env['IDEMPOTENCY_CONTENT_HASH_TTL_MS'],
    },
    logging: {
      level: process.env['LOG_LEVEL'],
      format: process.env['LOG_FORMAT'],
      includeTimestamp: process.env['LOG_INCLUDE_TIMESTAMP'],
      sanitizePii: process.env['LOG_SANITIZE_PII'],
    },
  };

  return configSchema.parse(raw);
}

/**
 * Validate configuration
 */
export function validateConfig(config: unknown): AppConfig {
  return configSchema.parse(config);
}

/**
 * Get default configuration
 */
export function getDefaultConfig(): AppConfig {
  return configSchema.parse({});
}
