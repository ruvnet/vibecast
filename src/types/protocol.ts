/**
 * Model Context Protocol (MCP) Type Definitions
 * Based on MCP Specification (Release Candidate: November 14, 2025)
 */

import { z } from 'zod';

/**
 * JSON Schema definition for tool inputs/outputs
 */
export const JSONSchemaSchema = z.object({
  type: z.string(),
  properties: z.record(z.any()).optional(),
  required: z.array(z.string()).optional(),
  description: z.string().optional(),
  items: z.any().optional(),
  additionalProperties: z.boolean().optional(),
});

export type JSONSchema = z.infer<typeof JSONSchemaSchema>;

/**
 * Tool metadata including cost and latency estimates
 */
export const ToolMetadataSchema = z.object({
  costEstimate: z.number().optional(),
  latencyTarget: z.number().optional(),
  version: z.string().optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type ToolMetadata = z.infer<typeof ToolMetadataSchema>;

/**
 * Tool descriptor (JSON Schema 1.1)
 */
export const ToolDescriptorSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  inputSchema: JSONSchemaSchema,
  outputSchema: JSONSchemaSchema,
  metadata: ToolMetadataSchema.optional(),
});

export type ToolDescriptor = z.infer<typeof ToolDescriptorSchema>;

/**
 * Execution mode for tool invocation
 */
export enum ExecutionMode {
  SYNC = 'sync',
  ASYNC = 'async',
}

/**
 * Tool invocation request
 */
export const ToolRequestSchema = z.object({
  requestId: z.string().uuid(),
  toolId: z.string(),
  arguments: z.record(z.any()),
  sessionId: z.string().optional(),
  executionMode: z.nativeEnum(ExecutionMode).default(ExecutionMode.SYNC),
  context: z.record(z.any()).optional(),
});

export type ToolRequest = z.infer<typeof ToolRequestSchema>;

/**
 * Tool invocation response status
 */
export enum ResponseStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
}

/**
 * Tool invocation response
 */
export const ToolResponseSchema = z.object({
  requestId: z.string().uuid(),
  status: z.nativeEnum(ResponseStatus),
  result: z.any().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.any().optional(),
    })
    .optional(),
  metadata: z
    .object({
      executionDuration: z.number(),
      tokenConsumption: z.number().optional(),
      jobHandle: z.string().optional(),
    })
    .optional(),
  progress: z
    .object({
      current: z.number(),
      total: z.number(),
      message: z.string().optional(),
    })
    .optional(),
});

export type ToolResponse = z.infer<typeof ToolResponseSchema>;

/**
 * Authentication types
 */
export enum AuthType {
  BEARER = 'bearer',
  MTLS = 'mtls',
  KEYPAIR = 'keypair',
  NONE = 'none',
}

/**
 * Authentication configuration
 */
export const AuthConfigSchema = z.object({
  type: z.nativeEnum(AuthType),
  token: z.string().optional(),
  certificate: z.string().optional(),
  privateKey: z.string().optional(),
});

export type AuthConfig = z.infer<typeof AuthConfigSchema>;

/**
 * Server configuration
 */
export const ServerConfigSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  toolsDirectory: z.string().default('./tools'),
  transport: z.enum(['stdio', 'http', 'websocket']).default('stdio'),
  auth: AuthConfigSchema.optional(),
  logging: z
    .object({
      level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
      auditLog: z.boolean().default(true),
    })
    .optional(),
  security: z
    .object({
      enableSandbox: z.boolean().default(false),
      resourceQuota: z
        .object({
          maxMemoryMB: z.number().optional(),
          maxCpuPercent: z.number().optional(),
          maxExecutionTime: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  timestamp: string;
  requestId: string;
  toolId: string;
  userId?: string;
  action: 'invoke' | 'discover' | 'authenticate';
  status: ResponseStatus;
  duration: number;
  metadata?: Record<string, any>;
}
