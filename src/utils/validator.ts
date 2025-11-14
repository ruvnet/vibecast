/**
 * Input/Output Validator
 * Validates data against JSON Schema
 */

import { JSONSchema } from '../types/protocol.js';

/**
 * Validate input against JSON Schema
 */
export function validateInput(
  data: any,
  schema: JSONSchema
): string | null {
  return validate(data, schema, 'input');
}

/**
 * Validate output against JSON Schema
 */
export function validateOutput(
  data: any,
  schema: JSONSchema
): string | null {
  return validate(data, schema, 'output');
}

/**
 * Generic validation function
 */
function validate(
  data: any,
  schema: JSONSchema,
  context: string
): string | null {
  try {
    // Type validation
    if (!validateType(data, schema.type)) {
      return `Invalid ${context} type: expected ${schema.type}, got ${typeof data}`;
    }

    // Object validation
    if (schema.type === 'object' && typeof data === 'object' && data !== null) {
      // Required fields
      if (schema.required) {
        for (const field of schema.required) {
          if (!(field in data)) {
            return `Missing required ${context} field: ${field}`;
          }
        }
      }

      // Property validation
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          if (key in data) {
            const propError = validate(
              data[key],
              propSchema as JSONSchema,
              `${context}.${key}`
            );
            if (propError) {
              return propError;
            }
          }
        }
      }

      // Additional properties
      if (schema.additionalProperties === false && schema.properties) {
        const allowedKeys = Object.keys(schema.properties);
        for (const key of Object.keys(data)) {
          if (!allowedKeys.includes(key)) {
            return `Unexpected ${context} property: ${key}`;
          }
        }
      }
    }

    // Array validation
    if (schema.type === 'array' && Array.isArray(data)) {
      if (schema.items) {
        for (let i = 0; i < data.length; i++) {
          const itemError = validate(
            data[i],
            schema.items as JSONSchema,
            `${context}[${i}]`
          );
          if (itemError) {
            return itemError;
          }
        }
      }
    }

    return null;
  } catch (error) {
    return `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Validate data type
 */
function validateType(data: any, type: string): boolean {
  switch (type) {
    case 'string':
      return typeof data === 'string';
    case 'number':
      return typeof data === 'number';
    case 'integer':
      return typeof data === 'number' && Number.isInteger(data);
    case 'boolean':
      return typeof data === 'boolean';
    case 'object':
      return typeof data === 'object' && data !== null && !Array.isArray(data);
    case 'array':
      return Array.isArray(data);
    case 'null':
      return data === null;
    default:
      return true; // Allow unknown types
  }
}
