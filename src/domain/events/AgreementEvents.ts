/**
 * Agreement Domain Events
 */

import { BaseDomainEvent } from './DomainEvent';

export class AgreementCreatedEvent extends BaseDomainEvent {
  constructor(
    agreementId: string,
    public readonly franchiseId: string,
    public readonly franchiseeId: string,
    public readonly startDate: Date,
    public readonly endDate: Date,
    metadata?: Record<string, any>
  ) {
    super(agreementId, 'AgreementCreated', metadata);
  }
}

export class AgreementSignedEvent extends BaseDomainEvent {
  constructor(
    agreementId: string,
    public readonly signedBy: string,
    public readonly signedDate: Date,
    metadata?: Record<string, any>
  ) {
    super(agreementId, 'AgreementSigned', metadata);
  }
}

export class AgreementActivatedEvent extends BaseDomainEvent {
  constructor(
    agreementId: string,
    public readonly activationDate: Date,
    metadata?: Record<string, any>
  ) {
    super(agreementId, 'AgreementActivated', metadata);
  }
}

export class AgreementRenewedEvent extends BaseDomainEvent {
  constructor(
    agreementId: string,
    public readonly newEndDate: Date,
    public readonly renewalTerms: Record<string, any>,
    metadata?: Record<string, any>
  ) {
    super(agreementId, 'AgreementRenewed', metadata);
  }
}

export class AgreementTerminatedEvent extends BaseDomainEvent {
  constructor(
    agreementId: string,
    public readonly terminationDate: Date,
    public readonly reason: string,
    public readonly terminatedBy: string,
    metadata?: Record<string, any>
  ) {
    super(agreementId, 'AgreementTerminated', metadata);
  }
}

export class AgreementExpiredEvent extends BaseDomainEvent {
  constructor(
    agreementId: string,
    public readonly expirationDate: Date,
    metadata?: Record<string, any>
  ) {
    super(agreementId, 'AgreementExpired', metadata);
  }
}
