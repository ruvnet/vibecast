/**
 * Royalty Domain Events
 */

import { BaseDomainEvent } from './DomainEvent';
import { Money, RoyaltyCalculation } from '../types';

export class RoyaltyCalculatedEvent extends BaseDomainEvent {
  constructor(
    franchiseId: string,
    public readonly calculation: RoyaltyCalculation,
    metadata?: Record<string, any>
  ) {
    super(franchiseId, 'RoyaltyCalculated', metadata);
  }
}

export class RoyaltyPaidEvent extends BaseDomainEvent {
  constructor(
    franchiseId: string,
    public readonly amount: Money,
    public readonly period: { start: Date; end: Date },
    public readonly paymentDate: Date,
    public readonly transactionId: string,
    metadata?: Record<string, any>
  ) {
    super(franchiseId, 'RoyaltyPaid', metadata);
  }
}

export class RoyaltyOverdueEvent extends BaseDomainEvent {
  constructor(
    franchiseId: string,
    public readonly amount: Money,
    public readonly dueDate: Date,
    public readonly daysOverdue: number,
    metadata?: Record<string, any>
  ) {
    super(franchiseId, 'RoyaltyOverdue', metadata);
  }
}

export class RoyaltyStructureChangedEvent extends BaseDomainEvent {
  constructor(
    franchiseId: string,
    public readonly oldStructure: any,
    public readonly newStructure: any,
    public readonly effectiveDate: Date,
    metadata?: Record<string, any>
  ) {
    super(franchiseId, 'RoyaltyStructureChanged', metadata);
  }
}
