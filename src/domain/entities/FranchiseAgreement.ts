/**
 * Franchise Agreement Domain Entity
 */

import {
  IFranchiseAgreement,
  AgreementStatus,
  RoyaltyType,
  AgreementTerms,
  FeeStructure,
  RoyaltyTier,
  Money
} from '../types';
import {
  AgreementSignedEvent,
  AgreementActivatedEvent,
  AgreementRenewedEvent,
  AgreementTerminatedEvent,
  AgreementExpiredEvent
} from '../events/AgreementEvents';

interface FranchiseAgreementProps {
  id?: string;
  franchiseId: string;
  franchiseeId: string;
  status?: AgreementStatus;
  terms: AgreementTerms;
  feeStructure: FeeStructure;
  startDate: Date;
  endDate: Date;
  signedDate?: Date;
  royaltyType: RoyaltyType;
  royaltyTiers?: RoyaltyTier[];
  specialConditions?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export class FranchiseAgreement implements IFranchiseAgreement {
  public readonly id: string;
  public readonly franchiseId: string;
  public readonly franchiseeId: string;
  public status: AgreementStatus;
  public readonly terms: AgreementTerms;
  public readonly feeStructure: FeeStructure;
  public readonly startDate: Date;
  public endDate: Date;
  public signedDate?: Date;
  public readonly royaltyType: RoyaltyType;
  public readonly royaltyTiers?: RoyaltyTier[];
  public specialConditions?: string[];
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: FranchiseAgreementProps) {
    this.validate(props);

    this.id = props.id || this.generateId();
    this.franchiseId = props.franchiseId;
    this.franchiseeId = props.franchiseeId;
    this.status = props.status || AgreementStatus.DRAFT;
    this.terms = props.terms;
    this.feeStructure = props.feeStructure;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.signedDate = props.signedDate;
    this.royaltyType = props.royaltyType;
    this.royaltyTiers = props.royaltyTiers;
    this.specialConditions = props.specialConditions || [];
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();
  }

  private validate(props: FranchiseAgreementProps): void {
    if (!props.franchiseId || props.franchiseId.trim().length === 0) {
      throw new Error('Franchise ID cannot be empty');
    }

    if (!props.franchiseeId || props.franchiseeId.trim().length === 0) {
      throw new Error('Franchisee ID cannot be empty');
    }

    if (props.endDate <= props.startDate) {
      throw new Error('End date must be after start date');
    }

    if (props.terms.duration < 12) {
      throw new Error('Agreement duration must be at least 12 months');
    }

    if (props.royaltyType === RoyaltyType.TIERED && (!props.royaltyTiers || props.royaltyTiers.length === 0)) {
      throw new Error('Tiered royalty type requires royalty tiers');
    }
  }

  private generateId(): string {
    return `agreement-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Status Management
   */

  public submitForSignature(): void {
    if (this.status !== AgreementStatus.DRAFT) {
      throw new Error('Can only submit draft agreements for signature');
    }

    this.status = AgreementStatus.PENDING_SIGNATURE;
    this.updatedAt = new Date();
  }

  public sign(signedBy: string): AgreementSignedEvent {
    if (this.status !== AgreementStatus.PENDING_SIGNATURE && this.status !== AgreementStatus.DRAFT) {
      throw new Error('Agreement must be in draft or pending signature status');
    }

    this.signedDate = new Date();
    this.status = AgreementStatus.PENDING_SIGNATURE;
    this.updatedAt = new Date();

    return new AgreementSignedEvent(
      this.id,
      signedBy,
      this.signedDate
    );
  }

  public activate(): AgreementActivatedEvent {
    if (!this.signedDate) {
      throw new Error('Agreement must be signed before activation');
    }

    if (this.status === AgreementStatus.ACTIVE) {
      throw new Error('Agreement is already active');
    }

    this.status = AgreementStatus.ACTIVE;
    this.updatedAt = new Date();

    return new AgreementActivatedEvent(
      this.id,
      new Date()
    );
  }

  public terminate(reason: string, terminatedBy: string): AgreementTerminatedEvent {
    if (this.status !== AgreementStatus.ACTIVE) {
      throw new Error('Can only terminate active agreements');
    }

    this.status = AgreementStatus.TERMINATED;
    this.updatedAt = new Date();

    return new AgreementTerminatedEvent(
      this.id,
      new Date(),
      reason,
      terminatedBy
    );
  }

  public expire(): AgreementExpiredEvent {
    this.status = AgreementStatus.EXPIRED;
    this.updatedAt = new Date();

    return new AgreementExpiredEvent(
      this.id,
      this.endDate
    );
  }

  /**
   * Renewal
   */

  public renew(newEndDate: Date, renewalTerms: Record<string, any>): AgreementRenewedEvent {
    if (!this.terms.renewalOption) {
      throw new Error('This agreement does not have a renewal option');
    }

    if (this.status !== AgreementStatus.ACTIVE) {
      throw new Error('Can only renew active agreements');
    }

    this.endDate = newEndDate;
    this.updatedAt = new Date();

    return new AgreementRenewedEvent(
      this.id,
      newEndDate,
      renewalTerms
    );
  }

  public isEligibleForRenewal(): boolean {
    if (!this.terms.renewalOption || this.status !== AgreementStatus.ACTIVE) {
      return false;
    }

    const monthsUntilExpiry = this.getRemainingTermMonths();
    return monthsUntilExpiry <= 6; // Eligible if 6 months or less remaining
  }

  public isExpired(): boolean {
    return new Date() > this.endDate;
  }

  public getRemainingTermMonths(): number {
    const now = new Date();
    const diffTime = this.endDate.getTime() - now.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.round(diffDays / 30));
  }

  /**
   * Fee Calculations
   */

  public calculateTotalInitialInvestment(): Money {
    let total = this.feeStructure.initialFranchiseFee.amount;

    if (this.feeStructure.trainingFee) {
      total += this.feeStructure.trainingFee.amount;
    }

    return {
      amount: total,
      currency: this.feeStructure.initialFranchiseFee.currency
    };
  }

  public calculateMonthlyFees(revenue: Money): {
    royalty: Money;
    marketing: Money;
    technology?: Money;
    total: Money;
  } {
    let royaltyAmount = 0;

    if (this.royaltyType === RoyaltyType.PERCENTAGE_OF_REVENUE) {
      const rate = typeof this.feeStructure.monthlyRoyaltyFee === 'number'
        ? this.feeStructure.monthlyRoyaltyFee
        : 0;
      royaltyAmount = revenue.amount * rate;
    } else if (this.royaltyType === RoyaltyType.FIXED_MONTHLY) {
      royaltyAmount = typeof this.feeStructure.monthlyRoyaltyFee === 'object'
        ? this.feeStructure.monthlyRoyaltyFee.amount
        : 0;
    } else if (this.royaltyType === RoyaltyType.TIERED) {
      royaltyAmount = this.calculateTieredRoyalty(revenue).amount;
    }

    const marketingRate = typeof this.feeStructure.marketingFee === 'number'
      ? this.feeStructure.marketingFee
      : 0;
    const marketingAmount = revenue.amount * marketingRate;

    const technologyAmount = this.feeStructure.technologyFee?.amount || 0;

    const totalAmount = royaltyAmount + marketingAmount + technologyAmount;

    return {
      royalty: { amount: royaltyAmount, currency: revenue.currency },
      marketing: { amount: marketingAmount, currency: revenue.currency },
      technology: this.feeStructure.technologyFee
        ? { amount: technologyAmount, currency: revenue.currency }
        : undefined,
      total: { amount: totalAmount, currency: revenue.currency }
    };
  }

  public calculateTieredRoyalty(revenue: Money): Money {
    if (!this.royaltyTiers || this.royaltyTiers.length === 0) {
      return { amount: 0, currency: revenue.currency };
    }

    let totalRoyalty = 0;
    let remainingRevenue = revenue.amount;

    for (const tier of this.royaltyTiers.sort((a, b) => a.minRevenue - b.minRevenue)) {
      if (remainingRevenue <= 0) break;

      const tierMin = tier.minRevenue;
      const tierMax = tier.maxRevenue;
      const revenueInTier = Math.min(
        remainingRevenue,
        Math.max(0, Math.min(tierMax, revenue.amount) - tierMin + 1)
      );

      if (revenue.amount >= tierMin) {
        const applicableRevenue = Math.min(revenueInTier, tierMax - tierMin);
        totalRoyalty += applicableRevenue * tier.rate;
        remainingRevenue -= applicableRevenue;
      }
    }

    return { amount: totalRoyalty, currency: revenue.currency };
  }

  /**
   * Special Conditions
   */

  public addSpecialCondition(condition: string): void {
    if (!this.specialConditions) {
      this.specialConditions = [];
    }
    this.specialConditions.push(condition);
    this.updatedAt = new Date();
  }

  public hasSpecialConditions(): boolean {
    return !!this.specialConditions && this.specialConditions.length > 0;
  }

  /**
   * Compliance
   */

  public validateCompliance(checks: {
    feesUpToDate: boolean;
    reportingCompliant: boolean;
    brandStandardsMet: boolean;
  }): boolean {
    return checks.feesUpToDate && checks.reportingCompliant && checks.brandStandardsMet;
  }

  /**
   * Serialization
   */

  public toJSON(): IFranchiseAgreement {
    return {
      id: this.id,
      franchiseId: this.franchiseId,
      franchiseeId: this.franchiseeId,
      status: this.status,
      terms: this.terms,
      feeStructure: this.feeStructure,
      startDate: this.startDate,
      endDate: this.endDate,
      signedDate: this.signedDate,
      royaltyType: this.royaltyType,
      royaltyTiers: this.royaltyTiers,
      specialConditions: this.specialConditions,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  public static fromJSON(data: IFranchiseAgreement): FranchiseAgreement {
    return new FranchiseAgreement({
      id: data.id,
      franchiseId: data.franchiseId,
      franchiseeId: data.franchiseeId,
      status: data.status,
      terms: data.terms,
      feeStructure: data.feeStructure,
      startDate: data.startDate,
      endDate: data.endDate,
      signedDate: data.signedDate,
      royaltyType: data.royaltyType,
      royaltyTiers: data.royaltyTiers,
      specialConditions: data.specialConditions,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
  }
}
