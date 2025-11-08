/**
 * Franchise Agreement Entity Unit Tests (TDD)
 */

import { FranchiseAgreement } from '../../domain/entities/FranchiseAgreement';
import {
  AgreementStatus,
  RoyaltyType,
  AgreementTerms,
  FeeStructure,
  RoyaltyTier,
  Money
} from '../../domain/types';

describe('FranchiseAgreement Entity', () => {
  const validTerms: AgreementTerms = {
    duration: 60, // 5 years
    renewalOption: true,
    autoRenew: false,
    terminationNoticePeriod: 90,
    exclusivityClause: true,
    nonCompeteClause: true,
    nonCompeteDuration: 24
  };

  const validFeeStructure: FeeStructure = {
    initialFranchiseFee: { amount: 50000, currency: 'USD' },
    monthlyRoyaltyFee: 0.06, // 6%
    marketingFee: 0.02, // 2%
    technologyFee: { amount: 500, currency: 'USD' }
  };

  describe('Creation and Validation', () => {
    test('should create a valid franchise agreement', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2029-01-01');

      const agreement = new FranchiseAgreement({
        franchiseId: 'franchise-123',
        franchiseeId: 'franchisee-456',
        terms: validTerms,
        feeStructure: validFeeStructure,
        startDate,
        endDate,
        royaltyType: RoyaltyType.PERCENTAGE_OF_REVENUE
      });

      expect(agreement.id).toBeDefined();
      expect(agreement.status).toBe(AgreementStatus.DRAFT);
      expect(agreement.franchiseId).toBe('franchise-123');
      expect(agreement.createdAt).toBeInstanceOf(Date);
    });

    test('should throw error when franchise ID is empty', () => {
      expect(() => {
        new FranchiseAgreement({
          franchiseId: '',
          franchiseeId: 'franchisee-456',
          terms: validTerms,
          feeStructure: validFeeStructure,
          startDate: new Date(),
          endDate: new Date(),
          royaltyType: RoyaltyType.PERCENTAGE_OF_REVENUE
        });
      }).toThrow('Franchise ID cannot be empty');
    });

    test('should throw error when end date is before start date', () => {
      expect(() => {
        new FranchiseAgreement({
          franchiseId: 'franchise-123',
          franchiseeId: 'franchisee-456',
          terms: validTerms,
          feeStructure: validFeeStructure,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2023-01-01'),
          royaltyType: RoyaltyType.PERCENTAGE_OF_REVENUE
        });
      }).toThrow('End date must be after start date');
    });

    test('should throw error when duration is too short', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-06-01'); // 5 months

      expect(() => {
        new FranchiseAgreement({
          franchiseId: 'franchise-123',
          franchiseeId: 'franchisee-456',
          terms: { ...validTerms, duration: 6 },
          feeStructure: validFeeStructure,
          startDate,
          endDate,
          royaltyType: RoyaltyType.PERCENTAGE_OF_REVENUE
        });
      }).toThrow('Agreement duration must be at least 12 months');
    });

    test('should create agreement with tiered royalty structure', () => {
      const tiers: RoyaltyTier[] = [
        { minRevenue: 0, maxRevenue: 100000, rate: 0.05 },
        { minRevenue: 100001, maxRevenue: 500000, rate: 0.06 },
        { minRevenue: 500001, maxRevenue: Infinity, rate: 0.07 }
      ];

      const agreement = new FranchiseAgreement({
        franchiseId: 'franchise-123',
        franchiseeId: 'franchisee-456',
        terms: validTerms,
        feeStructure: validFeeStructure,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2029-01-01'),
        royaltyType: RoyaltyType.TIERED,
        royaltyTiers: tiers
      });

      expect(agreement.royaltyTiers).toEqual(tiers);
    });
  });

  describe('Status Management', () => {
    let agreement: FranchiseAgreement;

    beforeEach(() => {
      agreement = new FranchiseAgreement({
        franchiseId: 'franchise-123',
        franchiseeId: 'franchisee-456',
        terms: validTerms,
        feeStructure: validFeeStructure,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2029-01-01'),
        royaltyType: RoyaltyType.PERCENTAGE_OF_REVENUE
      });
    });

    test('should submit agreement for signature', () => {
      agreement.submitForSignature();

      expect(agreement.status).toBe(AgreementStatus.PENDING_SIGNATURE);
    });

    test('should sign agreement', () => {
      agreement.submitForSignature();
      const event = agreement.sign('franchisee-456');

      expect(agreement.status).toBe(AgreementStatus.PENDING_SIGNATURE);
      expect(agreement.signedDate).toBeInstanceOf(Date);
      expect(event.eventType).toBe('AgreementSigned');
    });

    test('should activate agreement', () => {
      agreement.submitForSignature();
      agreement.sign('franchisee-456');
      const event = agreement.activate();

      expect(agreement.status).toBe(AgreementStatus.ACTIVE);
      expect(event.eventType).toBe('AgreementActivated');
    });

    test('should not activate unsigned agreement', () => {
      expect(() => {
        agreement.activate();
      }).toThrow('Agreement must be signed before activation');
    });

    test('should terminate agreement', () => {
      agreement.submitForSignature();
      agreement.sign('franchisee-456');
      agreement.activate();

      const event = agreement.terminate('Contract breach', 'franchisor');

      expect(agreement.status).toBe(AgreementStatus.TERMINATED);
      expect(event.eventType).toBe('AgreementTerminated');
      expect(event.reason).toBe('Contract breach');
    });

    test('should not terminate draft agreement', () => {
      expect(() => {
        agreement.terminate('Some reason', 'franchisor');
      }).toThrow('Can only terminate active agreements');
    });
  });

  describe('Renewal', () => {
    let agreement: FranchiseAgreement;

    beforeEach(() => {
      agreement = new FranchiseAgreement({
        franchiseId: 'franchise-123',
        franchiseeId: 'franchisee-456',
        terms: validTerms,
        feeStructure: validFeeStructure,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2029-01-01'),
        royaltyType: RoyaltyType.PERCENTAGE_OF_REVENUE
      });
      agreement.submitForSignature();
      agreement.sign('franchisee-456');
      agreement.activate();
    });

    test('should renew agreement', () => {
      const newEndDate = new Date('2034-01-01');
      const event = agreement.renew(newEndDate, { feeIncrease: 0.05 });

      expect(agreement.endDate).toEqual(newEndDate);
      expect(event.eventType).toBe('AgreementRenewed');
    });

    test('should not renew if renewal option is disabled', () => {
      const noRenewalAgreement = new FranchiseAgreement({
        franchiseId: 'franchise-123',
        franchiseeId: 'franchisee-456',
        terms: { ...validTerms, renewalOption: false },
        feeStructure: validFeeStructure,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2029-01-01'),
        royaltyType: RoyaltyType.PERCENTAGE_OF_REVENUE
      });

      expect(() => {
        noRenewalAgreement.renew(new Date('2034-01-01'), {});
      }).toThrow('This agreement does not have a renewal option');
    });

    test('should check if agreement is eligible for renewal', () => {
      // Set end date to near future (within renewal window)
      const nearFutureDate = new Date();
      nearFutureDate.setMonth(nearFutureDate.getMonth() + 3);

      const renewableAgreement = new FranchiseAgreement({
        franchiseId: 'franchise-123',
        franchiseeId: 'franchisee-456',
        terms: validTerms,
        feeStructure: validFeeStructure,
        startDate: new Date(),
        endDate: nearFutureDate,
        royaltyType: RoyaltyType.PERCENTAGE_OF_REVENUE
      });
      renewableAgreement.submitForSignature();
      renewableAgreement.sign('franchisee-456');
      renewableAgreement.activate();

      expect(renewableAgreement.isEligibleForRenewal()).toBe(true);
    });
  });

  describe('Expiration', () => {
    test('should mark agreement as expired', () => {
      const agreement = new FranchiseAgreement({
        franchiseId: 'franchise-123',
        franchiseeId: 'franchisee-456',
        terms: validTerms,
        feeStructure: validFeeStructure,
        startDate: new Date('2020-01-01'),
        endDate: new Date('2023-01-01'),
        royaltyType: RoyaltyType.PERCENTAGE_OF_REVENUE
      });
      agreement.submitForSignature();
      agreement.sign('franchisee-456');
      agreement.activate();

      const event = agreement.expire();

      expect(agreement.status).toBe(AgreementStatus.EXPIRED);
      expect(event.eventType).toBe('AgreementExpired');
    });

    test('should check if agreement is expired', () => {
      const expiredAgreement = new FranchiseAgreement({
        franchiseId: 'franchise-123',
        franchiseeId: 'franchisee-456',
        terms: validTerms,
        feeStructure: validFeeStructure,
        startDate: new Date('2020-01-01'),
        endDate: new Date('2023-01-01'),
        royaltyType: RoyaltyType.PERCENTAGE_OF_REVENUE
      });

      expect(expiredAgreement.isExpired()).toBe(true);
    });

    test('should get remaining term in months', () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 12);

      const agreement = new FranchiseAgreement({
        franchiseId: 'franchise-123',
        franchiseeId: 'franchisee-456',
        terms: validTerms,
        feeStructure: validFeeStructure,
        startDate: new Date(),
        endDate: futureDate,
        royaltyType: RoyaltyType.PERCENTAGE_OF_REVENUE
      });

      const remaining = agreement.getRemainingTermMonths();
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(12);
    });
  });

  describe('Fee Calculations', () => {
    let agreement: FranchiseAgreement;

    beforeEach(() => {
      agreement = new FranchiseAgreement({
        franchiseId: 'franchise-123',
        franchiseeId: 'franchisee-456',
        terms: validTerms,
        feeStructure: validFeeStructure,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2029-01-01'),
        royaltyType: RoyaltyType.PERCENTAGE_OF_REVENUE
      });
    });

    test('should calculate total initial investment', () => {
      const total = agreement.calculateTotalInitialInvestment();

      expect(total.amount).toBeGreaterThan(0);
      expect(total.currency).toBe('USD');
    });

    test('should calculate monthly recurring fees', () => {
      const revenue: Money = { amount: 100000, currency: 'USD' };
      const fees = agreement.calculateMonthlyFees(revenue);

      expect(fees.royalty).toBeDefined();
      expect(fees.marketing).toBeDefined();
      expect(fees.technology).toBeDefined();
      expect(fees.total.amount).toBeGreaterThan(0);
    });

    test('should calculate tiered royalty correctly', () => {
      const tiers: RoyaltyTier[] = [
        { minRevenue: 0, maxRevenue: 100000, rate: 0.05 },
        { minRevenue: 100001, maxRevenue: 500000, rate: 0.06 },
        { minRevenue: 500001, maxRevenue: Infinity, rate: 0.07 }
      ];

      const tieredAgreement = new FranchiseAgreement({
        franchiseId: 'franchise-123',
        franchiseeId: 'franchisee-456',
        terms: validTerms,
        feeStructure: validFeeStructure,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2029-01-01'),
        royaltyType: RoyaltyType.TIERED,
        royaltyTiers: tiers
      });

      const revenue: Money = { amount: 200000, currency: 'USD' };
      const royalty = tieredAgreement.calculateTieredRoyalty(revenue);

      expect(royalty.amount).toBeGreaterThan(0);
      // 100000 * 0.05 + 100000 * 0.06 = 5000 + 6000 = 11000
      expect(royalty.amount).toBe(11000);
    });
  });

  describe('Compliance', () => {
    let agreement: FranchiseAgreement;

    beforeEach(() => {
      agreement = new FranchiseAgreement({
        franchiseId: 'franchise-123',
        franchiseeId: 'franchisee-456',
        terms: validTerms,
        feeStructure: validFeeStructure,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2029-01-01'),
        royaltyType: RoyaltyType.PERCENTAGE_OF_REVENUE
      });
    });

    test('should add special condition', () => {
      agreement.addSpecialCondition('Must achieve 90% customer satisfaction');

      expect(agreement.specialConditions).toContain('Must achieve 90% customer satisfaction');
    });

    test('should check if agreement has special conditions', () => {
      agreement.addSpecialCondition('Special condition 1');

      expect(agreement.hasSpecialConditions()).toBe(true);
    });

    test('should validate compliance requirements', () => {
      const isCompliant = agreement.validateCompliance({
        feesUpToDate: true,
        reportingCompliant: true,
        brandStandardsMet: true
      });

      expect(isCompliant).toBe(true);
    });
  });

  describe('Serialization', () => {
    test('should convert to JSON', () => {
      const agreement = new FranchiseAgreement({
        franchiseId: 'franchise-123',
        franchiseeId: 'franchisee-456',
        terms: validTerms,
        feeStructure: validFeeStructure,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2029-01-01'),
        royaltyType: RoyaltyType.PERCENTAGE_OF_REVENUE
      });

      const json = agreement.toJSON();

      expect(json.id).toBe(agreement.id);
      expect(json.franchiseId).toBe('franchise-123');
      expect(json.status).toBe(AgreementStatus.DRAFT);
    });

    test('should create from JSON', () => {
      const data = {
        id: 'agreement-123',
        franchiseId: 'franchise-456',
        franchiseeId: 'franchisee-789',
        status: AgreementStatus.ACTIVE,
        terms: validTerms,
        feeStructure: validFeeStructure,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2029-01-01'),
        signedDate: new Date('2024-01-01'),
        royaltyType: RoyaltyType.PERCENTAGE_OF_REVENUE,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const agreement = FranchiseAgreement.fromJSON(data);

      expect(agreement.id).toBe('agreement-123');
      expect(agreement.status).toBe(AgreementStatus.ACTIVE);
    });
  });
});
