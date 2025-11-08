/**
 * Territory Domain Entity
 */

import {
  ITerritory,
  TerritoryStatus,
  GeographicBoundary,
  TerritoryMetadata,
  Coordinates
} from '../types';
import {
  TerritoryAllocatedEvent,
  TerritoryReservedEvent,
  TerritoryDisputeRaisedEvent,
  TerritoryDisputeResolvedEvent,
  TerritoryReleasedEvent
} from '../events/TerritoryEvents';

interface TerritoryProps {
  id?: string;
  name: string;
  code: string;
  boundaries: GeographicBoundary;
  status?: TerritoryStatus;
  franchiseId?: string;
  metadata: TerritoryMetadata;
  reservedUntil?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Territory implements ITerritory {
  public readonly id: string;
  public readonly name: string;
  public readonly code: string;
  public readonly boundaries: GeographicBoundary;
  public status: TerritoryStatus;
  public franchiseId?: string;
  public readonly metadata: TerritoryMetadata;
  public reservedUntil?: Date;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: TerritoryProps) {
    this.validate(props);

    this.id = props.id || this.generateId();
    this.name = props.name;
    this.code = props.code;
    this.boundaries = props.boundaries;
    this.status = props.status || TerritoryStatus.AVAILABLE;
    this.franchiseId = props.franchiseId;
    this.metadata = props.metadata;
    this.reservedUntil = props.reservedUntil;
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();
  }

  private validate(props: TerritoryProps): void {
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Territory name cannot be empty');
    }

    if (!props.code || props.code.trim().length === 0) {
      throw new Error('Territory code cannot be empty');
    }

    this.validateBoundary(props.boundaries);
  }

  private validateBoundary(boundary: GeographicBoundary): void {
    if (boundary.type === 'circle') {
      if (!boundary.center || !boundary.radius || boundary.radius <= 0) {
        throw new Error('Invalid circular boundary');
      }
    } else if (boundary.type === 'polygon') {
      if (!boundary.coordinates || boundary.coordinates.length < 3) {
        throw new Error('Polygon boundary must have at least 3 points');
      }
    }
  }

  private generateId(): string {
    return `territory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Allocation and Reservation
   */

  public allocate(franchiseId: string): TerritoryAllocatedEvent {
    if (this.status === TerritoryStatus.ALLOCATED) {
      throw new Error('Territory is already allocated');
    }

    this.status = TerritoryStatus.ALLOCATED;
    this.franchiseId = franchiseId;
    this.reservedUntil = undefined;
    this.updatedAt = new Date();

    return new TerritoryAllocatedEvent(
      this.id,
      franchiseId,
      new Date()
    );
  }

  public reserve(reservedFor: string, reservedUntil: Date): TerritoryReservedEvent {
    if (this.status === TerritoryStatus.ALLOCATED) {
      throw new Error('Cannot reserve an allocated territory');
    }

    this.status = TerritoryStatus.RESERVED;
    this.reservedUntil = reservedUntil;
    this.updatedAt = new Date();

    return new TerritoryReservedEvent(
      this.id,
      reservedFor,
      reservedUntil
    );
  }

  public release(): TerritoryReleasedEvent {
    if (this.status !== TerritoryStatus.ALLOCATED) {
      throw new Error('Can only release allocated territories');
    }

    const previousFranchiseId = this.franchiseId!;
    this.status = TerritoryStatus.AVAILABLE;
    this.franchiseId = undefined;
    this.updatedAt = new Date();

    return new TerritoryReleasedEvent(
      this.id,
      previousFranchiseId,
      new Date()
    );
  }

  public isReservationExpired(): boolean {
    if (!this.reservedUntil) {
      return false;
    }
    return new Date() > this.reservedUntil;
  }

  /**
   * Dispute Management
   */

  public raiseDispute(disputingFranchiseId: string, reason: string): TerritoryDisputeRaisedEvent {
    if (this.status !== TerritoryStatus.ALLOCATED) {
      throw new Error('Can only raise disputes on allocated territories');
    }

    this.status = TerritoryStatus.DISPUTED;
    this.updatedAt = new Date();

    return new TerritoryDisputeRaisedEvent(
      this.id,
      disputingFranchiseId,
      reason
    );
  }

  public resolveDispute(resolution: string, resolvedInFavorOf: string): TerritoryDisputeResolvedEvent {
    if (this.status !== TerritoryStatus.DISPUTED) {
      throw new Error('No active dispute to resolve');
    }

    this.status = TerritoryStatus.ALLOCATED;
    this.updatedAt = new Date();

    return new TerritoryDisputeResolvedEvent(
      this.id,
      resolution,
      resolvedInFavorOf
    );
  }

  /**
   * Geographic Operations
   */

  public containsPoint(point: Coordinates): boolean {
    if (this.boundaries.type === 'circle') {
      return this.isPointInCircle(point, this.boundaries.center!, this.boundaries.radius!);
    }

    if (this.boundaries.type === 'polygon') {
      return this.isPointInPolygon(point, this.boundaries.coordinates!);
    }

    return false;
  }

  private isPointInCircle(point: Coordinates, center: Coordinates, radius: number): boolean {
    const distance = this.calculateDistance(point, center);
    return distance <= radius;
  }

  private isPointInPolygon(point: Coordinates, vertices: Coordinates[]): boolean {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i].latitude;
      const yi = vertices[i].longitude;
      const xj = vertices[j].latitude;
      const yj = vertices[j].longitude;

      const intersect = ((yi > point.longitude) !== (yj > point.longitude)) &&
        (point.latitude < (xj - xi) * (point.longitude - yi) / (yj - yi) + xi);

      if (intersect) inside = !inside;
    }
    return inside;
  }

  public hasOverlapWith(other: Territory): boolean {
    if (this.boundaries.type === 'circle' && other.boundaries.type === 'circle') {
      const distance = this.calculateDistance(
        this.boundaries.center!,
        other.boundaries.center!
      );
      const combinedRadius = this.boundaries.radius! + other.boundaries.radius!;
      return distance < combinedRadius;
    }

    // Simplified overlap detection for other types
    return false;
  }

  public calculateArea(): number {
    if (this.boundaries.type === 'circle') {
      return Math.PI * Math.pow(this.boundaries.radius!, 2);
    }

    if (this.boundaries.type === 'polygon' && this.boundaries.coordinates) {
      // Simplified area calculation using Shoelace formula
      const coords = this.boundaries.coordinates;
      let area = 0;
      for (let i = 0; i < coords.length; i++) {
        const j = (i + 1) % coords.length;
        area += coords[i].latitude * coords[j].longitude;
        area -= coords[j].latitude * coords[i].longitude;
      }
      return Math.abs(area / 2);
    }

    return 0;
  }

  private calculateDistance(point1: Coordinates, point2: Coordinates): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(point2.latitude - point1.latitude);
    const dLon = this.toRadians(point2.longitude - point1.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(point1.latitude)) *
      Math.cos(this.toRadians(point2.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Market Analysis
   */

  public getMarketPotentialPerCapita(): number {
    if (!this.metadata.population || this.metadata.population === 0) {
      return 0;
    }
    return (this.metadata.marketPotential || 0) / this.metadata.population;
  }

  public assessAttractiveness(): number {
    let score = 0;

    // Population score (0-30 points)
    if (this.metadata.population) {
      score += Math.min((this.metadata.population / 500000) * 30, 30);
    }

    // Income score (0-30 points)
    if (this.metadata.averageIncome) {
      score += Math.min((this.metadata.averageIncome / 100000) * 30, 30);
    }

    // Market potential score (0-25 points)
    if (this.metadata.marketPotential) {
      score += Math.min((this.metadata.marketPotential / 10000000) * 25, 25);
    }

    // Competition score (0-15 points, inverse - fewer competitors is better)
    if (this.metadata.competitorCount !== undefined) {
      score += Math.max(15 - (this.metadata.competitorCount * 3), 0);
    }

    return Math.round(Math.min(score, 100));
  }

  /**
   * Serialization
   */

  public toJSON(): ITerritory {
    return {
      id: this.id,
      name: this.name,
      code: this.code,
      boundaries: this.boundaries,
      status: this.status,
      franchiseId: this.franchiseId,
      metadata: this.metadata,
      reservedUntil: this.reservedUntil,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  public static fromJSON(data: ITerritory): Territory {
    return new Territory({
      id: data.id,
      name: data.name,
      code: data.code,
      boundaries: data.boundaries,
      status: data.status,
      franchiseId: data.franchiseId,
      metadata: data.metadata,
      reservedUntil: data.reservedUntil,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
  }
}
