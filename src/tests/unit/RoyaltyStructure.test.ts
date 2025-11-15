/**
 * Royalty Structure Entity Unit Tests (TDD)
 */

import { RoyaltyStructure } from '../../domain/entities/RoyaltyStructure';
import { RoyaltyType, Money, RoyaltyTier } from '../../domain/types';

describe('RoyaltyStructure Entity', () => {
  describe('Creation and Validation', () => {
    test('should create a percentage-based royalty structure', () => {
      const structure = new RoyaltyStructure({
        franchiseId: 'franchise-123',
        type: RoyaltyType.PERCENTAGE_OF_REVENUE,
        baseRate: 0.06, // 6%
        effectiveFrom: new Date('2024-01-01')
      });

      expect(structure.id).toBeDefined();
      expect(structure.type).toBe(RoyaltyType.PERCENTAGE_OF_REVENUE);
      expect(structure.baseRate).toBe(0.06);
    });

    test('should create a fixed monthly royalty structure', () => {
      const fixedAmount: Money = { amount: 5000, currency: 'USD' };

      const structure = new RoyaltyStructure({
        franchiseId: 'franchise-123',
        type: RoyaltyType.FIXED_MONTHLY,
        fixedAmount,
        effectiveFrom: new Date('2024-01-01')
      });

      expect(structure.type).toBe(RoyaltyType.FIXED_MONTHLY);
      expect(structure.fixedAmount).toEqual(fixedAmount);
    });

    test('should create a tiered royalty structure', () => {
      const tiers: RoyaltyTier[] = [
        { minRevenue: 0, maxRevenue: 100000, rate: 0.05 },
        { minRevenue: 100001, maxRevenue: 500000, rate: 0.06 },
        { minRevenue: 500001, maxRevenue: Infinity, rate: 0.07 }
      ];

      const structure = new RoyaltyStructure({
        franchiseId: 'franchise-123',
        type: RoyaltyType.TIERED,
        tiers,
        effectiveFrom: new Date('2024-01-01')
      });

      expect(structure.type).toBe(RoyaltyType.TIERED);
      expect(structure.tiers).toEqual(tiers);
    });

    test('should throw error when franchise ID is empty', () => {
      expect(() => {
        new RoyaltyStructure({
          franchiseId: '',
          type: RoyaltyType.PERCENTAGE_OF_REVENUE,
          baseRate: 0.06,
          effectiveFrom: new Date()
        });
      }).toThrow('Franchise ID cannot be empty');
    });

    test('should throw error for invalid percentage rate', () => {
      expect(() => {
        new RoyaltyStructure({
          franchiseId: 'franchise-123',
          type: RoyaltyType.PERCENTAGE_OF_REVENUE,
          baseRate: 1.5, // 150% is unrealistic
          effectiveFrom: new Date()
        });
      }).toThrow('Base rate must be between 0 and 1');
    });

    test('should throw error when tiered structure has no tiers', () => {
      expect(() => {
        new RoyaltyStructure({
          franchiseId: 'franchise-123',
          type: RoyaltyType.TIERED,
          effectiveFrom: new Date()
        });
      }).toThrow('Tiered royalty structure requires tiers');
    });
  });

  describe('Royalty Calculation', () => {
    describe('Percentage-based', () => {
      let structure: RoyaltyStructure;

      beforeEach(() => {
        structure = new RoyaltyStructure({
          franchiseId: 'franchise-123',
          type: RoyaltyType.PERCENTAGE_OF_REVENUE,
          baseRate: 0.06,
          effectiveFrom: new Date('2024-01-01')
        });
      });

      test('should calculate royalty from revenue', () => {
        const revenue: Money = { amount: 100000, currency: 'USD' };
        const period = {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31')
        };

        const calculation = structure.calculateRoyalty(revenue, period);

        expect(calculation.grossRevenue).toEqual(revenue);
        expect(calculation.royaltyAmount.amount).toBe(6000); // 6% of 100000
        expect(calculation.royaltyRate).toBe(0.06);
      });

      test('should apply minimum fee if specified', () => {
        const structureWithMin = new RoyaltyStructure({
          franchiseId: 'franchise-123',
          type: RoyaltyType.PERCENTAGE_OF_REVENUE,
          baseRate: 0.06,
          minimumFee: { amount: 1000, currency: 'USD' },
          effectiveFrom: new Date('2024-01-01')
        });

        const lowRevenue: Money = { amount: 10000, currency: 'USD' };
        const period = {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31')
        };

        const calculation = structureWithMin.calculateRoyalty(lowRevenue, period);

        // 6% of 10000 = 600, but minimum is 1000
        expect(calculation.netAmount.amount).toBe(1000);
      });

      test('should apply maximum fee if specified', () => {
        const structureWithMax = new RoyaltyStructure({
          franchiseId: 'franchise-123',
          type: RoyaltyType.PERCENTAGE_OF_REVENUE,
          baseRate: 0.06,
          maximumFee: { amount: 5000, currency: 'USD' },
          effectiveFrom: new Date('2024-01-01')
        });

        const highRevenue: Money = { amount: 200000, currency: 'USD' };
        const period = {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31')
        };

        const calculation = structureWithMax.calculateRoyalty(highRevenue, period);

        // 6% of 200000 = 12000, but maximum is 5000
        expect(calculation.netAmount.amount).toBe(5000);
      });
    });

    describe('Fixed monthly', () => {
      test('should calculate fixed monthly royalty', () => {
        const fixedAmount: Money = { amount: 5000, currency: 'USD' };

        const structure = new RoyaltyStructure({
          franchiseId: 'franchise-123',
          type: RoyaltyType.FIXED_MONTHLY,
          fixedAmount,
          effectiveFrom: new Date('2024-01-01')
        });

        const revenue: Money = { amount: 100000, currency: 'USD' };
        const period = {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31')
        };

        const calculation = structure.calculateRoyalty(revenue, period);

        expect(calculation.royaltyAmount.amount).toBe(5000);
        expect(calculation.netAmount.amount).toBe(5000);
      });
    });

    describe('Tiered', () => {
      let structure: RoyaltyStructure;

      beforeEach(() => {
        const tiers: RoyaltyTier[] = [
          { minRevenue: 0, maxRevenue: 100000, rate: 0.05 },
          { minRevenue: 100001, maxRevenue: 500000, rate: 0.06 },
          { minRevenue: 500001, maxRevenue: Infinity, rate: 0.07 }
        ];

        structure = new RoyaltyStructure({
          franchiseId: 'franchise-123',
          type: RoyaltyType.TIERED,
          tiers,
          effectiveFrom: new Date('2024-01-01')
        });
      });

      test('should calculate tiered royalty for single tier', () => {
        const revenue: Money = { amount: 50000, currency: 'USD' };
        const period = {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31')
        };

        const calculation = structure.calculateRoyalty(revenue, period);

        // All in first tier: 50000 * 0.05 = 2500
        expect(calculation.royaltyAmount.amount).toBe(2500);
      });

      test('should calculate tiered royalty across multiple tiers', () => {
        const revenue: Money = { amount: 250000, currency: 'USD' };
        const period = {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31')
        };

        const calculation = structure.calculateRoyalty(revenue, period);

        // First tier: 100000 * 0.05 = 5000
        // Second tier: 150000 * 0.06 = 9000
        // Total: 14000
        expect(calculation.royaltyAmount.amount).toBeCloseTo(14000, 0);
      });

      test('should calculate tiered royalty into highest tier', () => {
        const revenue: Money = { amount: 600000, currency: 'USD' };
        const period = {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31')
        };

        const calculation = structure.calculateRoyalty(revenue, period);

        // First tier: 100000 * 0.05 = 5000
        // Second tier: 400000 * 0.06 = 24000
        // Third tier: 100000 * 0.07 = 7000
        // Total: 36000
        expect(calculation.royaltyAmount.amount).toBeCloseTo(36000, 0);
      });
    });

    describe('Hybrid', () => {
      test('should calculate hybrid royalty (percentage + fixed)', () => {
        const structure = new RoyaltyStructure({
          franchiseId: 'franchise-123',
          type: RoyaltyType.HYBRID,
          baseRate: 0.05,
          fixedAmount: { amount: 1000, currency: 'USD' },
          effectiveFrom: new Date('2024-01-01')
        });

        const revenue: Money = { amount: 100000, currency: 'USD' };
        const period = {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31')
        };

        const calculation = structure.calculateRoyalty(revenue, period);

        // 5% of 100000 = 5000, plus fixed 1000 = 6000
        expect(calculation.royaltyAmount.amount).toBe(6000);
      });
    });
  });

  describe('Deductions', () => {
    let structure: RoyaltyStructure;

    beforeEach(() => {
      structure = new RoyaltyStructure({
        franchiseId: 'franchise-123',
        type: RoyaltyType.PERCENTAGE_OF_REVENUE,
        baseRate: 0.06,
        effectiveFrom: new Date('2024-01-01')
      });
    });

    test('should apply deductions to royalty', () => {
      const revenue: Money = { amount: 100000, currency: 'USD' };
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      };

      const deductions: Money[] = [
        { amount: 500, currency: 'USD' }, // Credit
        { amount: 300, currency: 'USD' }  // Adjustment
      ];

      const calculation = structure.calculateRoyalty(revenue, period, deductions);

      // Base royalty: 6000, minus deductions: 800, net: 5200
      expect(calculation.royaltyAmount.amount).toBe(6000);
      expect(calculation.netAmount.amount).toBe(5200);
      expect(calculation.deductions).toEqual(deductions);
    });

    test('should not allow deductions to create negative royalty', () => {
      const revenue: Money = { amount: 10000, currency: 'USD' };
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      };

      const largeDeductions: Money[] = [
        { amount: 1000, currency: 'USD' }
      ];

      const calculation = structure.calculateRoyalty(revenue, period, largeDeductions);

      // Base royalty: 600, minus deductions: 1000, should be 0 not negative
      expect(calculation.netAmount.amount).toBe(0);
    });
  });

  describe('Effective Dates', () => {
    test('should check if structure is currently effective', () => {
      const structure = new RoyaltyStructure({
        franchiseId: 'franchise-123',
        type: RoyaltyType.PERCENTAGE_OF_REVENUE,
        baseRate: 0.06,
        effectiveFrom: new Date('2020-01-01'),
        effectiveUntil: new Date('2030-01-01')
      });

      expect(structure.isEffective()).toBe(true);
    });

    test('should check if structure is not yet effective', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const structure = new RoyaltyStructure({
        franchiseId: 'franchise-123',
        type: RoyaltyType.PERCENTAGE_OF_REVENUE,
        baseRate: 0.06,
        effectiveFrom: futureDate
      });

      expect(structure.isEffective()).toBe(false);
    });

    test('should check if structure has expired', () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);

      const structure = new RoyaltyStructure({
        franchiseId: 'franchise-123',
        type: RoyaltyType.PERCENTAGE_OF_REVENUE,
        baseRate: 0.06,
        effectiveFrom: new Date('2020-01-01'),
        effectiveUntil: pastDate
      });

      expect(structure.isEffective()).toBe(false);
    });
  });

  describe('Tier Management', () => {
    test('should find applicable tier for revenue', () => {
      const tiers: RoyaltyTier[] = [
        { minRevenue: 0, maxRevenue: 100000, rate: 0.05 },
        { minRevenue: 100001, maxRevenue: 500000, rate: 0.06 },
        { minRevenue: 500001, maxRevenue: Infinity, rate: 0.07 }
      ];

      const structure = new RoyaltyStructure({
        franchiseId: 'franchise-123',
        type: RoyaltyType.TIERED,
        tiers,
        effectiveFrom: new Date('2024-01-01')
      });

      const tier = structure.findTierForRevenue(250000);

      expect(tier).toBeDefined();
      expect(tier?.rate).toBe(0.06);
    });

    test('should validate tier structure', () => {
      const validTiers: RoyaltyTier[] = [
        { minRevenue: 0, maxRevenue: 100000, rate: 0.05 },
        { minRevenue: 100001, maxRevenue: 500000, rate: 0.06 }
      ];

      expect(() => {
        new RoyaltyStructure({
          franchiseId: 'franchise-123',
          type: RoyaltyType.TIERED,
          tiers: validTiers,
          effectiveFrom: new Date('2024-01-01')
        });
      }).not.toThrow();
    });

    test('should throw error for overlapping tiers', () => {
      const overlappingTiers: RoyaltyTier[] = [
        { minRevenue: 0, maxRevenue: 100000, rate: 0.05 },
        { minRevenue: 50000, maxRevenue: 200000, rate: 0.06 } // Overlaps with first
      ];

      expect(() => {
        new RoyaltyStructure({
          franchiseId: 'franchise-123',
          type: RoyaltyType.TIERED,
          tiers: overlappingTiers,
          effectiveFrom: new Date('2024-01-01')
        });
      }).toThrow('Royalty tiers cannot overlap');
    });
  });

  describe('Serialization', () => {
    test('should convert to JSON', () => {
      const structure = new RoyaltyStructure({
        franchiseId: 'franchise-123',
        type: RoyaltyType.PERCENTAGE_OF_REVENUE,
        baseRate: 0.06,
        effectiveFrom: new Date('2024-01-01')
      });

      const json = structure.toJSON();

      expect(json.id).toBe(structure.id);
      expect(json.franchiseId).toBe('franchise-123');
      expect(json.type).toBe(RoyaltyType.PERCENTAGE_OF_REVENUE);
    });

    test('should create from JSON', () => {
      const data = {
        id: 'royalty-123',
        franchiseId: 'franchise-456',
        type: RoyaltyType.PERCENTAGE_OF_REVENUE,
        baseRate: 0.06,
        effectiveFrom: new Date('2024-01-01')
      };

      const structure = RoyaltyStructure.fromJSON(data);

      expect(structure.id).toBe('royalty-123');
      expect(structure.baseRate).toBe(0.06);
    });
  });
});
