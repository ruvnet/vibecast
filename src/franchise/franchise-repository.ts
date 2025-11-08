/**
 * Franchise Repository
 *
 * Data access layer for franchise entities
 * Will integrate with agentdb for persistence
 */

import { Franchise } from './index';

export interface FranchiseRepository {
  save(franchise: Franchise): Promise<Franchise>;
  findById(id: string): Promise<Franchise | null>;
  findAll(): Promise<Franchise[]>;
  delete(id: string): Promise<boolean>;
}

/**
 * In-memory implementation for development
 * Production should use AgentDB integration
 */
export class InMemoryFranchiseRepository implements FranchiseRepository {
  private franchises: Map<string, Franchise> = new Map();

  async save(franchise: Franchise): Promise<Franchise> {
    this.franchises.set(franchise.id, franchise);
    return franchise;
  }

  async findById(id: string): Promise<Franchise | null> {
    return this.franchises.get(id) || null;
  }

  async findAll(): Promise<Franchise[]> {
    return Array.from(this.franchises.values());
  }

  async delete(id: string): Promise<boolean> {
    return this.franchises.delete(id);
  }
}
