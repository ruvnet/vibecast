/**
 * Core domain types and enums for franchise management
 */

export enum FranchiseStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  TERMINATED = 'TERMINATED',
  UNDER_REVIEW = 'UNDER_REVIEW'
}

export enum TerritoryStatus {
  AVAILABLE = 'AVAILABLE',
  ALLOCATED = 'ALLOCATED',
  RESERVED = 'RESERVED',
  DISPUTED = 'DISPUTED'
}

export enum AgreementStatus {
  DRAFT = 'DRAFT',
  PENDING_SIGNATURE = 'PENDING_SIGNATURE',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED'
}

export enum RoyaltyType {
  PERCENTAGE_OF_REVENUE = 'PERCENTAGE_OF_REVENUE',
  FIXED_MONTHLY = 'FIXED_MONTHLY',
  TIERED = 'TIERED',
  HYBRID = 'HYBRID'
}

export enum PerformanceMetricType {
  REVENUE = 'REVENUE',
  CUSTOMER_SATISFACTION = 'CUSTOMER_SATISFACTION',
  GROWTH_RATE = 'GROWTH_RATE',
  COMPLIANCE_SCORE = 'COMPLIANCE_SCORE',
  OPERATIONAL_EFFICIENCY = 'OPERATIONAL_EFFICIENCY'
}

/**
 * Value Objects
 */

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Money {
  amount: number;
  currency: string;
}

export interface PerformanceMetric {
  type: PerformanceMetricType;
  value: number;
  target: number;
  period: Date;
  unit: string;
}

export interface ContactInfo {
  email: string;
  phone: string;
  alternatePhone?: string;
}

/**
 * Territory Types
 */

export interface GeographicBoundary {
  type: 'polygon' | 'circle' | 'administrative';
  coordinates?: Coordinates[];
  radius?: number; // in kilometers
  center?: Coordinates;
  administrativeCode?: string; // zip code, county, etc.
}

export interface TerritoryMetadata {
  population?: number;
  averageIncome?: number;
  marketPotential?: number;
  competitorCount?: number;
}

/**
 * Agreement Types
 */

export interface AgreementTerms {
  duration: number; // in months
  renewalOption: boolean;
  autoRenew: boolean;
  terminationNoticePeriod: number; // in days
  exclusivityClause: boolean;
  nonCompeteClause: boolean;
  nonCompeteDuration?: number; // in months
}

export interface FeeStructure {
  initialFranchiseFee: Money;
  monthlyRoyaltyFee: Money | number; // Money for fixed, number for percentage
  marketingFee: Money | number;
  technologyFee?: Money;
  trainingFee?: Money;
}

/**
 * Royalty Types
 */

export interface RoyaltyTier {
  minRevenue: number;
  maxRevenue: number;
  rate: number; // percentage
}

export interface RoyaltyCalculation {
  period: {
    start: Date;
    end: Date;
  };
  grossRevenue: Money;
  royaltyAmount: Money;
  royaltyRate: number;
  tier?: string;
  deductions: Money[];
  netAmount: Money;
}

/**
 * Domain Entity Interfaces
 */

export interface IFranchise {
  id: string;
  franchiseNumber: string;
  name: string;
  ownerId: string;
  ownerName: string;
  ownerContact: ContactInfo;
  location: Address;
  coordinates: Coordinates;
  territoryId: string;
  agreementId: string;
  status: FranchiseStatus;
  openingDate: Date;
  performanceMetrics: PerformanceMetric[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ITerritory {
  id: string;
  name: string;
  code: string;
  boundaries: GeographicBoundary;
  status: TerritoryStatus;
  franchiseId?: string;
  metadata: TerritoryMetadata;
  reservedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFranchiseAgreement {
  id: string;
  franchiseId: string;
  franchiseeId: string;
  status: AgreementStatus;
  terms: AgreementTerms;
  feeStructure: FeeStructure;
  startDate: Date;
  endDate: Date;
  signedDate?: Date;
  royaltyType: RoyaltyType;
  royaltyTiers?: RoyaltyTier[];
  specialConditions?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IRoyaltyStructure {
  id: string;
  franchiseId: string;
  type: RoyaltyType;
  baseRate?: number; // percentage for simple types
  fixedAmount?: Money;
  tiers?: RoyaltyTier[];
  minimumFee?: Money;
  maximumFee?: Money;
  effectiveFrom: Date;
  effectiveUntil?: Date;
}
