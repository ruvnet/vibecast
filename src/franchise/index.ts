/**
 * Franchise Domain
 *
 * Core domain models and business logic for franchise management
 */

export interface Franchise {
  id: string;
  name: string;
  ownerId: string;
  location: Location;
  status: FranchiseStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Location {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export enum FranchiseStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CLOSED = 'closed',
}

export * from './franchise-service';
export * from './franchise-repository';
