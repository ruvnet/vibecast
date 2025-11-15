/**
 * Base Domain Event
 */

export interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  occurredAt: Date;
  version: number;
  metadata?: Record<string, any>;
}

export abstract class BaseDomainEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventType: string;
  public readonly occurredAt: Date;
  public readonly version: number;

  constructor(
    public readonly aggregateId: string,
    eventType: string,
    public readonly metadata?: Record<string, any>
  ) {
    this.eventId = this.generateEventId();
    this.eventType = eventType;
    this.occurredAt = new Date();
    this.version = 1;
  }

  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
