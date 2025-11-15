/**
 * Royalty Structure Domain Entity
 */

import {
  IRoyaltyStructure,
  RoyaltyType,
  Money,
  RoyaltyTier,
  RoyaltyCalculation
} from '../types';

interface RoyaltyStructureProps {
  id?: string;
  franchiseId: string;
  type: RoyaltyType;
  baseRate?: number;
  fixedAmount?: Money;
  tiers?: RoyaltyTier[];
  minimumFee?: Money;
  maximumFee?: Money;
  effectiveFrom: Date;
  effectiveUntil?: Date;
}

export class RoyaltyStructure implements IRoyaltyStructure {
  public readonly id: string;
  public readonly franchiseId: string;
  public readonly type: RoyaltyType;
  public readonly baseRate?: number;
  public readonly fixedAmount?: Money;
  public readonly tiers?: RoyaltyTier[];
  public readonly minimumFee?: Money;
  public readonly maximumFee?: Money;
  public readonly effectiveFrom: Date;
  public readonly effectiveUntil?: Date;

  constructor(props: RoyaltyStructureProps) {
    this.validate(props);

    this.id = props.id || this.generateId();
    this.franchiseId = props.franchiseId;
    this.type = props.type;
    this.baseRate = props.baseRate;
    this.fixedAmount = props.fixedAmount;
    this.tiers = props.tiers;
    this.minimumFee = props.minimumFee;
    this.maximumFee = props.maximumFee;
    this.effectiveFrom = props.effectiveFrom;
    this.effectiveUntil = props.effectiveUntil;
  }

  private validate(props: RoyaltyStructureProps): void {
    if (!props.franchiseId || props.franchiseId.trim().length === 0) {
      throw new Error('Franchise ID cannot be empty');
    }

    if (props.type === RoyaltyType.PERCENTAGE_OF_REVENUE || props.type === RoyaltyType.HYBRID) {
      if (props.baseRate === undefined || props.baseRate < 0 || props.baseRate > 1) {
        throw new Error('Base rate must be between 0 and 1');
      }
    }

    if (props.type === RoyaltyType.FIXED_MONTHLY) {
      if (!props.fixedAmount) {
        throw new Error('Fixed royalty structure requires fixed amount');
      }
    }

    if (props.type === RoyaltyType.TIERED) {
      if (!props.tiers || props.tiers.length === 0) {
        throw new Error('Tiered royalty structure requires tiers');
      }
      this.validateTiers(props.tiers);
    }
  }

  private validateTiers(tiers: RoyaltyTier[]): void {
    // Check for overlaps
    const sortedTiers = [...tiers].sort((a, b) => a.minRevenue - b.minRevenue);

    for (let i = 0; i < sortedTiers.length - 1; i++) {
      const current = sortedTiers[i];
      const next = sortedTiers[i + 1];

      if (current.maxRevenue >= next.minRevenue) {
        throw new Error('Royalty tiers cannot overlap');
      }
    }
  }

  private generateId(): string {
    return `royalty-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Royalty Calculation
   */

  public calculateRoyalty(
    revenue: Money,
    period: { start: Date; end: Date },
    deductions?: Money[]
  ): RoyaltyCalculation {
    let royaltyAmount = 0;
    let tier: string | undefined;

    switch (this.type) {
      case RoyaltyType.PERCENTAGE_OF_REVENUE:
        royaltyAmount = revenue.amount * (this.baseRate || 0);
        break;

      case RoyaltyType.FIXED_MONTHLY:
        royaltyAmount = this.fixedAmount?.amount || 0;
        break;

      case RoyaltyType.TIERED:
        royaltyAmount = this.calculateTieredRoyalty(revenue.amount);
        const applicableTier = this.findTierForRevenue(revenue.amount);
        tier = applicableTier ? `${applicableTier.minRevenue}-${applicableTier.maxRevenue}` : undefined;
        break;

      case RoyaltyType.HYBRID:
        royaltyAmount = (revenue.amount * (this.baseRate || 0)) + (this.fixedAmount?.amount || 0);
        break;
    }

    // Apply min/max constraints
    if (this.minimumFee && royaltyAmount < this.minimumFee.amount) {
      royaltyAmount = this.minimumFee.amount;
    }

    if (this.maximumFee && royaltyAmount > this.maximumFee.amount) {
      royaltyAmount = this.maximumFee.amount;
    }

    // Apply deductions
    const totalDeductions = deductions?.reduce((sum, d) => sum + d.amount, 0) || 0;
    const netAmount = Math.max(0, royaltyAmount - totalDeductions);

    const calculation: RoyaltyCalculation = {
      period,
      grossRevenue: revenue,
      royaltyAmount: { amount: royaltyAmount, currency: revenue.currency },
      royaltyRate: this.baseRate || 0,
      tier,
      deductions: deductions || [],
      netAmount: { amount: netAmount, currency: revenue.currency }
    };

    return calculation;
  }

  private calculateTieredRoyalty(revenueAmount: number): number {
    if (!this.tiers || this.tiers.length === 0) {
      return 0;
    }

    let totalRoyalty = 0;
    const sortedTiers = [...this.tiers].sort((a, b) => a.minRevenue - b.minRevenue);

    for (const tier of sortedTiers) {
      if (revenueAmount <= tier.minRevenue) {
        break;
      }

      const tierRevenue = Math.min(
        revenueAmount - tier.minRevenue,
        tier.maxRevenue - tier.minRevenue
      );

      if (tierRevenue > 0) {
        totalRoyalty += tierRevenue * tier.rate;
      }
    }

    return totalRoyalty;
  }

  public findTierForRevenue(revenue: number): RoyaltyTier | undefined {
    if (!this.tiers) {
      return undefined;
    }

    return this.tiers.find(
      tier => revenue >= tier.minRevenue && revenue <= tier.maxRevenue
    );
  }

  /**
   * Effective Date Management
   */

  public isEffective(date: Date = new Date()): boolean {
    if (date < this.effectiveFrom) {
      return false;
    }

    if (this.effectiveUntil && date > this.effectiveUntil) {
      return false;
    }

    return true;
  }

  /**
   * Serialization
   */

  public toJSON(): IRoyaltyStructure {
    return {
      id: this.id,
      franchiseId: this.franchiseId,
      type: this.type,
      baseRate: this.baseRate,
      fixedAmount: this.fixedAmount,
      tiers: this.tiers,
      minimumFee: this.minimumFee,
      maximumFee: this.maximumFee,
      effectiveFrom: this.effectiveFrom,
      effectiveUntil: this.effectiveUntil
    };
  }

  public static fromJSON(data: IRoyaltyStructure): RoyaltyStructure {
    return new RoyaltyStructure({
      id: data.id,
      franchiseId: data.franchiseId,
      type: data.type,
      baseRate: data.baseRate,
      fixedAmount: data.fixedAmount,
      tiers: data.tiers,
      minimumFee: data.minimumFee,
      maximumFee: data.maximumFee,
      effectiveFrom: data.effectiveFrom,
      effectiveUntil: data.effectiveUntil
    });
  }
}
