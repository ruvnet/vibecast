/**
 * Franchise Domain Events
 */

import { BaseDomainEvent } from './DomainEvent';
import { FranchiseStatus, PerformanceMetric } from '../types';

export class FranchiseCreatedEvent extends BaseDomainEvent {
  constructor(
    franchiseId: string,
    public readonly franchiseNumber: string,
    public readonly name: string,
    public readonly ownerId: string,
    public readonly territoryId: string,
    metadata?: Record<string, any>
  ) {
    super(franchiseId, 'FranchiseCreated', metadata);
  }
}

export class FranchiseStatusChangedEvent extends BaseDomainEvent {
  constructor(
    franchiseId: string,
    public readonly oldStatus: FranchiseStatus,
    public readonly newStatus: FranchiseStatus,
    public readonly reason?: string,
    metadata?: Record<string, any>
  ) {
    super(franchiseId, 'FranchiseStatusChanged', metadata);
  }
}

export class FranchiseOnboardedEvent extends BaseDomainEvent {
  constructor(
    franchiseId: string,
    public readonly openingDate: Date,
    public readonly agreementId: string,
    metadata?: Record<string, any>
  ) {
    super(franchiseId, 'FranchiseOnboarded', metadata);
  }
}

export class FranchisePerformanceUpdatedEvent extends BaseDomainEvent {
  constructor(
    franchiseId: string,
    public readonly metrics: PerformanceMetric[],
    public readonly period: Date,
    metadata?: Record<string, any>
  ) {
    super(franchiseId, 'FranchisePerformanceUpdated', metadata);
  }
}

export class FranchiseTerminatedEvent extends BaseDomainEvent {
  constructor(
    franchiseId: string,
    public readonly reason: string,
    public readonly terminationDate: Date,
    public readonly agreementId: string,
    metadata?: Record<string, any>
  ) {
    super(franchiseId, 'FranchiseTerminated', metadata);
  }
}
