/**
 * FlowManager Document Intake API
 *
 * Main entry point for the application.
 */

// Domain Layer exports - source of truth for domain types
export * from './domain/index.js';

// Config exports
export * from './config/index.js';

// Note: Application and Infrastructure layers should be imported directly
// to avoid naming conflicts with domain layer exports
