/**
 * Franchise Domain Entity
 */

import {
  IFranchise,
  FranchiseStatus,
  Address,
  Coordinates,
  ContactInfo,
  PerformanceMetric,
  PerformanceMetricType
} from '../types';
import {
  FranchiseStatusChangedEvent,
  FranchiseOnboardedEvent,
  FranchiseTerminatedEvent
} from '../events/FranchiseEvents';

interface FranchiseProps {
  id?: string;
  franchiseNumber?: string;
  name: string;
  ownerId: string;
  ownerName: string;
  ownerContact: ContactInfo;
  location: Address;
  coordinates: Coordinates;
  territoryId: string;
  agreementId?: string;
  status?: FranchiseStatus;
  openingDate?: Date;
  performanceMetrics?: PerformanceMetric[];
  createdAt?: Date;
  updatedAt?: Date;
}

export class Franchise implements IFranchise {
  public readonly id: string;
  public readonly franchiseNumber: string;
  public readonly name: string;
  public readonly ownerId: string;
  public readonly ownerName: string;
  public readonly ownerContact: ContactInfo;
  public readonly location: Address;
  public readonly coordinates: Coordinates;
  public readonly territoryId: string;
  public agreementId: string;
  public status: FranchiseStatus;
  public openingDate: Date;
  public performanceMetrics: PerformanceMetric[];
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: FranchiseProps) {
    this.validate(props);

    this.id = props.id || this.generateId();
    this.franchiseNumber = props.franchiseNumber || this.generateFranchiseNumber();
    this.name = props.name;
    this.ownerId = props.ownerId;
    this.ownerName = props.ownerName;
    this.ownerContact = props.ownerContact;
    this.location = props.location;
    this.coordinates = props.coordinates;
    this.territoryId = props.territoryId;
    this.agreementId = props.agreementId || '';
    this.status = props.status || FranchiseStatus.PENDING;
    this.openingDate = props.openingDate || null as any;
    this.performanceMetrics = props.performanceMetrics || [];
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();
  }

  private validate(props: FranchiseProps): void {
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Franchise name cannot be empty');
    }

    if (!props.ownerId || props.ownerId.trim().length === 0) {
      throw new Error('Owner ID cannot be empty');
    }

    if (!props.ownerName || props.ownerName.trim().length === 0) {
      throw new Error('Owner name cannot be empty');
    }

    if (!this.isValidEmail(props.ownerContact.email)) {
      throw new Error('Invalid email format');
    }

    if (!this.isValidCoordinates(props.coordinates)) {
      throw new Error('Invalid coordinates');
    }

    if (!props.territoryId || props.territoryId.trim().length === 0) {
      throw new Error('Territory ID cannot be empty');
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidCoordinates(coordinates: Coordinates): boolean {
    return (
      coordinates.latitude >= -90 &&
      coordinates.latitude <= 90 &&
      coordinates.longitude >= -180 &&
      coordinates.longitude <= 180
    );
  }

  private generateId(): string {
    return `franchise-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateFranchiseNumber(): string {
    const prefix = 'FR';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `${prefix}-${timestamp}${random}`;
  }

  /**
   * Status Management
   */

  public activate(): FranchiseStatusChangedEvent {
    if (this.status === FranchiseStatus.ACTIVE) {
      throw new Error('Franchise is already active');
    }

    const oldStatus = this.status;
    this.status = FranchiseStatus.ACTIVE;
    this.updatedAt = new Date();

    return new FranchiseStatusChangedEvent(
      this.id,
      oldStatus,
      this.status
    );
  }

  public suspend(reason: string): FranchiseStatusChangedEvent {
    if (this.status !== FranchiseStatus.ACTIVE) {
      throw new Error('Can only suspend active franchises');
    }

    const oldStatus = this.status;
    this.status = FranchiseStatus.SUSPENDED;
    this.updatedAt = new Date();

    return new FranchiseStatusChangedEvent(
      this.id,
      oldStatus,
      this.status,
      reason
    );
  }

  public terminate(reason: string): FranchiseTerminatedEvent {
    if (this.status !== FranchiseStatus.ACTIVE && this.status !== FranchiseStatus.SUSPENDED) {
      throw new Error('Can only terminate active or suspended franchises');
    }

    this.status = FranchiseStatus.TERMINATED;
    this.updatedAt = new Date();

    return new FranchiseTerminatedEvent(
      this.id,
      reason,
      new Date(),
      this.agreementId
    );
  }

  public putUnderReview(reason: string): FranchiseStatusChangedEvent {
    const oldStatus = this.status;
    this.status = FranchiseStatus.UNDER_REVIEW;
    this.updatedAt = new Date();

    return new FranchiseStatusChangedEvent(
      this.id,
      oldStatus,
      this.status,
      reason
    );
  }

  /**
   * Onboarding
   */

  public onboard(agreementId: string, openingDate: Date): FranchiseOnboardedEvent {
    if (!agreementId || agreementId.trim().length === 0) {
      throw new Error('Agreement ID is required for onboarding');
    }

    if (this.agreementId && this.openingDate) {
      throw new Error('Franchise has already been onboarded');
    }

    this.agreementId = agreementId;
    this.openingDate = openingDate;
    this.status = FranchiseStatus.ACTIVE;
    this.updatedAt = new Date();

    return new FranchiseOnboardedEvent(
      this.id,
      openingDate,
      agreementId
    );
  }

  /**
   * Performance Metrics Management
   */

  public addPerformanceMetric(metric: PerformanceMetric): void {
    this.performanceMetrics.push(metric);
    this.updatedAt = new Date();
  }

  public updatePerformanceMetric(
    type: PerformanceMetricType,
    updatedMetric: PerformanceMetric
  ): void {
    const index = this.performanceMetrics.findIndex(m => m.type === type);
    if (index !== -1) {
      this.performanceMetrics[index] = updatedMetric;
      this.updatedAt = new Date();
    }
  }

  public getMetricsByType(type: PerformanceMetricType): PerformanceMetric[] {
    return this.performanceMetrics.filter(m => m.type === type);
  }

  public calculatePerformanceScore(): number {
    if (this.performanceMetrics.length === 0) {
      return 0;
    }

    const totalScore = this.performanceMetrics.reduce((sum, metric) => {
      const achievementRate = (metric.value / metric.target) * 100;
      return sum + Math.min(achievementRate, 150); // Cap at 150%
    }, 0);

    return Math.min(100, Math.round(totalScore / this.performanceMetrics.length));
  }

  public getLatestMetric(type: PerformanceMetricType): PerformanceMetric | undefined {
    const metrics = this.getMetricsByType(type);
    if (metrics.length === 0) {
      return undefined;
    }

    return metrics.reduce((latest, current) => {
      return current.period > latest.period ? current : latest;
    });
  }

  /**
   * Serialization
   */

  public toJSON(): IFranchise {
    return {
      id: this.id,
      franchiseNumber: this.franchiseNumber,
      name: this.name,
      ownerId: this.ownerId,
      ownerName: this.ownerName,
      ownerContact: this.ownerContact,
      location: this.location,
      coordinates: this.coordinates,
      territoryId: this.territoryId,
      agreementId: this.agreementId,
      status: this.status,
      openingDate: this.openingDate,
      performanceMetrics: this.performanceMetrics,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  public static fromJSON(data: IFranchise): Franchise {
    return new Franchise({
      id: data.id,
      franchiseNumber: data.franchiseNumber,
      name: data.name,
      ownerId: data.ownerId,
      ownerName: data.ownerName,
      ownerContact: data.ownerContact,
      location: data.location,
      coordinates: data.coordinates,
      territoryId: data.territoryId,
      agreementId: data.agreementId,
      status: data.status,
      openingDate: data.openingDate,
      performanceMetrics: data.performanceMetrics,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
  }
}
