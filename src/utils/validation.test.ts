import { z } from 'zod';
import {
  validate,
  generateUUID,
  isValidUUID,
  safeJsonParse
} from './validation';

describe('validate', () => {
  const testSchema = z.object({
    name: z.string().min(1),
    age: z.number().positive()
  });

  it('should return success for valid data', () => {
    const result = validate(testSchema, { name: 'John', age: 25 });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'John', age: 25 });
    expect(result.errors).toBeUndefined();
  });

  it('should return errors for invalid data', () => {
    const result = validate(testSchema, { name: '', age: -5 });

    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('should include field path in error messages', () => {
    const result = validate(testSchema, { name: 'John', age: -5 });

    expect(result.success).toBe(false);
    expect(result.errors!.some(e => e.includes('age'))).toBe(true);
  });

  it('should handle missing required fields', () => {
    const result = validate(testSchema, { name: 'John' });

    expect(result.success).toBe(false);
    expect(result.errors!.some(e => e.includes('age'))).toBe(true);
  });
});

describe('generateUUID', () => {
  it('should generate a valid UUID v4', () => {
    const uuid = generateUUID();

    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('should generate unique UUIDs', () => {
    const uuids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      uuids.add(generateUUID());
    }

    expect(uuids.size).toBe(100);
  });
});

describe('isValidUUID', () => {
  it('should return true for valid UUID v4', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUUID('6ba7b810-9dad-41d9-80b4-00c04fd430c8')).toBe(true);
  });

  it('should return false for invalid UUIDs', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false);
    expect(isValidUUID('550e8400-e29b-51d4-a716-446655440000')).toBe(false); // wrong version
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false); // too short
  });

  it('should validate generated UUIDs', () => {
    const uuid = generateUUID();
    expect(isValidUUID(uuid)).toBe(true);
  });
});

describe('safeJsonParse', () => {
  it('should parse valid JSON', () => {
    const result = safeJsonParse<{ foo: string }>('{"foo": "bar"}');

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ foo: 'bar' });
  });

  it('should return error for invalid JSON', () => {
    const result = safeJsonParse('not valid json');

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('should handle empty string', () => {
    const result = safeJsonParse('');

    expect(result.success).toBe(false);
  });

  it('should parse arrays', () => {
    const result = safeJsonParse<number[]>('[1, 2, 3]');

    expect(result.success).toBe(true);
    expect(result.data).toEqual([1, 2, 3]);
  });
});
