/**
 * Territory Domain Events
 */

import { BaseDomainEvent } from './DomainEvent';

export class TerritoryCreatedEvent extends BaseDomainEvent {
  constructor(
    territoryId: string,
    public readonly name: string,
    public readonly code: string,
    metadata?: Record<string, any>
  ) {
    super(territoryId, 'TerritoryCreated', metadata);
  }
}

export class TerritoryAllocatedEvent extends BaseDomainEvent {
  constructor(
    territoryId: string,
    public readonly franchiseId: string,
    public readonly allocationDate: Date,
    metadata?: Record<string, any>
  ) {
    super(territoryId, 'TerritoryAllocated', metadata);
  }
}

export class TerritoryReservedEvent extends BaseDomainEvent {
  constructor(
    territoryId: string,
    public readonly reservedFor: string,
    public readonly reservedUntil: Date,
    metadata?: Record<string, any>
  ) {
    super(territoryId, 'TerritoryReserved', metadata);
  }
}

export class TerritoryDisputeRaisedEvent extends BaseDomainEvent {
  constructor(
    territoryId: string,
    public readonly disputingFranchiseId: string,
    public readonly reason: string,
    metadata?: Record<string, any>
  ) {
    super(territoryId, 'TerritoryDisputeRaised', metadata);
  }
}

export class TerritoryDisputeResolvedEvent extends BaseDomainEvent {
  constructor(
    territoryId: string,
    public readonly resolution: string,
    public readonly resolvedInFavorOf: string,
    metadata?: Record<string, any>
  ) {
    super(territoryId, 'TerritoryDisputeResolved', metadata);
  }
}

export class TerritoryReleasedEvent extends BaseDomainEvent {
  constructor(
    territoryId: string,
    public readonly previousFranchiseId: string,
    public readonly releaseDate: Date,
    metadata?: Record<string, any>
  ) {
    super(territoryId, 'TerritoryReleased', metadata);
  }
}
