/**
 * Franchise Service
 *
 * Business logic for franchise operations
 */

import { Franchise, FranchiseStatus } from './index';
import { FranchiseRepository } from './franchise-repository';

export class FranchiseService {
  constructor(private repository: FranchiseRepository) {}

  async createFranchise(data: Partial<Franchise>): Promise<Franchise> {
    const franchise: Franchise = {
      id: this.generateId(),
      name: data.name || '',
      ownerId: data.ownerId || '',
      location: data.location || {
        address: '',
        city: '',
        state: '',
        zipCode: '',
        country: '',
      },
      status: FranchiseStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return await this.repository.save(franchise);
  }

  async getFranchise(id: string): Promise<Franchise | null> {
    return await this.repository.findById(id);
  }

  async updateFranchise(
    id: string,
    updates: Partial<Franchise>
  ): Promise<Franchise | null> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      return null;
    }

    const updated: Franchise = {
      ...existing,
      ...updates,
      id: existing.id, // Ensure ID doesn't change
      updatedAt: new Date(),
    };

    return await this.repository.save(updated);
  }

  async activateFranchise(id: string): Promise<Franchise | null> {
    return await this.updateFranchise(id, { status: FranchiseStatus.ACTIVE });
  }

  async suspendFranchise(id: string): Promise<Franchise | null> {
    return await this.updateFranchise(id, {
      status: FranchiseStatus.SUSPENDED,
    });
  }

  async closeFranchise(id: string): Promise<Franchise | null> {
    return await this.updateFranchise(id, { status: FranchiseStatus.CLOSED });
  }

  private generateId(): string {
    return `franchise-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
