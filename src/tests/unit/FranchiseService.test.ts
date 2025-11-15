/**
 * Franchise Service Unit Tests (TDD)
 */

import { FranchiseService } from '../../domain/services/FranchiseService';
import { Franchise } from '../../domain/entities/Franchise';
import { Territory } from '../../domain/entities/Territory';
import { FranchiseAgreement } from '../../domain/entities/FranchiseAgreement';
import {
  FranchiseStatus,
  TerritoryStatus,
  AgreementStatus,
  RoyaltyType,
  PerformanceMetricType
} from '../../domain/types';

describe('FranchiseService', () => {
  let service: FranchiseService;

  beforeEach(() => {
    service = new FranchiseService();
  });

  describe('Franchise Creation', () => {
    test('should create franchise with valid territory', () => {
      const territory = new Territory({
        name: 'Springfield Metro',
        code: 'SPR-01',
        boundaries: {
          type: 'circle',
          center: { latitude: 39.7817, longitude: -89.6501 },
          radius: 25
        },
        metadata: { population: 250000, averageIncome: 65000 }
      });

      const result = service.createFranchise({
        name: 'Springfield Downtown',
        ownerId: 'owner-123',
        ownerName: 'John Doe',
        ownerContact: { email: 'john@example.com', phone: '+1-555-0100' },
        location: {
          street: '123 Main St',
          city: 'Springfield',
          state: 'IL',
          postalCode: '62701',
          country: 'USA'
        },
        coordinates: { latitude: 39.7817, longitude: -89.6501 },
        territory
      });

      expect(result.franchise).toBeInstanceOf(Franchise);
      expect(result.events).toHaveLength(1); // TerritoryAllocated
      expect(territory.status).toBe(TerritoryStatus.ALLOCATED);
    });

    test('should throw error if territory is already allocated', () => {
      const territory = new Territory({
        name: 'Springfield Metro',
        code: 'SPR-01',
        boundaries: {
          type: 'circle',
          center: { latitude: 39.7817, longitude: -89.6501 },
          radius: 25
        },
        metadata: { population: 250000, averageIncome: 65000 }
      });

      territory.allocate('existing-franchise');

      expect(() => {
        service.createFranchise({
          name: 'Springfield Downtown',
          ownerId: 'owner-123',
          ownerName: 'John Doe',
          ownerContact: { email: 'john@example.com', phone: '+1-555-0100' },
          location: {
            street: '123 Main St',
            city: 'Springfield',
            state: 'IL',
            postalCode: '62701',
            country: 'USA'
          },
          coordinates: { latitude: 39.7817, longitude: -89.6501 },
          territory
        });
      }).toThrow('Territory is already allocated');
    });

    test('should validate franchise location is within territory', () => {
      const territory = new Territory({
        name: 'Springfield Metro',
        code: 'SPR-01',
        boundaries: {
          type: 'circle',
          center: { latitude: 39.7817, longitude: -89.6501 },
          radius: 10
        },
        metadata: { population: 250000, averageIncome: 65000 }
      });

      expect(() => {
        service.createFranchise({
          name: 'Far Away Location',
          ownerId: 'owner-123',
          ownerName: 'John Doe',
          ownerContact: { email: 'john@example.com', phone: '+1-555-0100' },
          location: {
            street: '999 Far St',
            city: 'Another City',
            state: 'CA',
            postalCode: '90001',
            country: 'USA'
          },
          coordinates: { latitude: 34.0522, longitude: -118.2437 }, // Los Angeles
          territory
        });
      }).toThrow('Franchise location must be within territory boundaries');
    });
  });

  describe('Franchise Onboarding', () => {
    let franchise: Franchise;
    let agreement: FranchiseAgreement;

    beforeEach(() => {
      franchise = new Franchise({
        name: 'Test Franchise',
        ownerId: 'owner-123',
        ownerName: 'John Doe',
        ownerContact: { email: 'john@example.com', phone: '+1-555-0100' },
        location: {
          street: '123 Main St',
          city: 'Springfield',
          state: 'IL',
          postalCode: '62701',
          country: 'USA'
        },
        coordinates: { latitude: 39.7817, longitude: -89.6501 },
        territoryId: 'territory-123'
      });

      agreement = new FranchiseAgreement({
        franchiseId: franchise.id,
        franchiseeId: 'owner-123',
        terms: {
          duration: 60,
          renewalOption: true,
          autoRenew: false,
          terminationNoticePeriod: 90,
          exclusivityClause: true,
          nonCompeteClause: true,
          nonCompeteDuration: 24
        },
        feeStructure: {
          initialFranchiseFee: { amount: 50000, currency: 'USD' },
          monthlyRoyaltyFee: 0.06,
          marketingFee: 0.02
        },
        startDate: new Date('2024-01-01'),
        endDate: new Date('2029-01-01'),
        royaltyType: RoyaltyType.PERCENTAGE_OF_REVENUE
      });
    });

    test('should onboard franchise with signed agreement', () => {
      agreement.submitForSignature();
      agreement.sign('owner-123');

      const result = service.onboardFranchise(
        franchise,
        agreement,
        new Date('2024-06-01')
      );

      expect(franchise.status).toBe(FranchiseStatus.ACTIVE);
      expect(franchise.agreementId).toBe(agreement.id);
      expect(agreement.status).toBe(AgreementStatus.ACTIVE);
      expect(result.events.length).toBeGreaterThan(0);
    });

    test('should not onboard franchise with unsigned agreement', () => {
      expect(() => {
        service.onboardFranchise(franchise, agreement, new Date('2024-06-01'));
      }).toThrow('Agreement must be signed before onboarding');
    });

    test('should complete onboarding checklist', () => {
      agreement.submitForSignature();
      agreement.sign('owner-123');

      const checklist = {
        trainingCompleted: true,
        systemsSetup: true,
        inventoryReceived: true,
        staffHired: true,
        inspectionPassed: true
      };

      const result = service.completeOnboardingChecklist(
        franchise,
        agreement,
        checklist,
        new Date('2024-06-01')
      );

      expect(result.success).toBe(true);
      expect(franchise.status).toBe(FranchiseStatus.ACTIVE);
    });

    test('should fail onboarding if checklist incomplete', () => {
      agreement.submitForSignature();
      agreement.sign('owner-123');

      const incompleteChecklist = {
        trainingCompleted: true,
        systemsSetup: false,
        inventoryReceived: true,
        staffHired: false,
        inspectionPassed: true
      };

      expect(() => {
        service.completeOnboardingChecklist(
          franchise,
          agreement,
          incompleteChecklist,
          new Date('2024-06-01')
        );
      }).toThrow('All onboarding requirements must be completed');
    });
  });

  describe('Performance Analytics', () => {
    let franchise: Franchise;

    beforeEach(() => {
      franchise = new Franchise({
        name: 'Test Franchise',
        ownerId: 'owner-123',
        ownerName: 'John Doe',
        ownerContact: { email: 'john@example.com', phone: '+1-555-0100' },
        location: {
          street: '123 Main St',
          city: 'Springfield',
          state: 'IL',
          postalCode: '62701',
          country: 'USA'
        },
        coordinates: { latitude: 39.7817, longitude: -89.6501 },
        territoryId: 'territory-123'
      });
      franchise.activate();

      // Add some performance metrics
      franchise.addPerformanceMetric({
        type: PerformanceMetricType.REVENUE,
        value: 120000,
        target: 100000,
        period: new Date('2024-01-01'),
        unit: 'USD'
      });

      franchise.addPerformanceMetric({
        type: PerformanceMetricType.CUSTOMER_SATISFACTION,
        value: 4.5,
        target: 4.0,
        period: new Date('2024-01-01'),
        unit: 'rating'
      });

      franchise.addPerformanceMetric({
        type: PerformanceMetricType.GROWTH_RATE,
        value: 15,
        target: 10,
        period: new Date('2024-01-01'),
        unit: 'percent'
      });
    });

    test('should generate performance report', () => {
      const report = service.generatePerformanceReport(franchise);

      expect(report.franchiseId).toBe(franchise.id);
      expect(report.overallScore).toBeGreaterThan(0);
      expect(report.metrics).toHaveLength(3);
      expect(report.performanceGrade).toBeDefined();
    });

    test('should calculate growth trajectory', () => {
      // Add historical metrics
      franchise.addPerformanceMetric({
        type: PerformanceMetricType.REVENUE,
        value: 110000,
        target: 100000,
        period: new Date('2023-12-01'),
        unit: 'USD'
      });

      franchise.addPerformanceMetric({
        type: PerformanceMetricType.REVENUE,
        value: 100000,
        target: 100000,
        period: new Date('2023-11-01'),
        unit: 'USD'
      });

      const trajectory = service.calculateGrowthTrajectory(
        franchise,
        PerformanceMetricType.REVENUE
      );

      expect(trajectory.trend).toBeDefined();
      expect(trajectory.averageGrowthRate).toBeDefined();
      expect(trajectory.projection).toBeDefined();
    });

    test('should identify at-risk franchises', () => {
      const poorPerformingFranchise = new Franchise({
        name: 'Poor Franchise',
        ownerId: 'owner-456',
        ownerName: 'Jane Doe',
        ownerContact: { email: 'jane@example.com', phone: '+1-555-0200' },
        location: {
          street: '456 Side St',
          city: 'Springfield',
          state: 'IL',
          postalCode: '62702',
          country: 'USA'
        },
        coordinates: { latitude: 39.7917, longitude: -89.6601 },
        territoryId: 'territory-456'
      });
      poorPerformingFranchise.activate();

      poorPerformingFranchise.addPerformanceMetric({
        type: PerformanceMetricType.REVENUE,
        value: 50000,
        target: 100000,
        period: new Date('2024-01-01'),
        unit: 'USD'
      });

      const franchises = [franchise, poorPerformingFranchise];
      const atRisk = service.identifyAtRiskFranchises(franchises);

      expect(atRisk).toContain(poorPerformingFranchise);
      expect(atRisk).not.toContain(franchise);
    });
  });

  describe('Growth Planning', () => {
    test('should recommend expansion territories', () => {
      const territories = [
        new Territory({
          name: 'High Value Territory',
          code: 'HVT-01',
          boundaries: {
            type: 'circle',
            center: { latitude: 40.7128, longitude: -74.0060 },
            radius: 25
          },
          metadata: {
            population: 500000,
            averageIncome: 85000,
            marketPotential: 10000000,
            competitorCount: 2
          }
        }),
        new Territory({
          name: 'Low Value Territory',
          code: 'LVT-01',
          boundaries: {
            type: 'circle',
            center: { latitude: 35.0, longitude: -85.0 },
            radius: 25
          },
          metadata: {
            population: 50000,
            averageIncome: 35000,
            marketPotential: 500000,
            competitorCount: 10
          }
        })
      ];

      const recommendations = service.recommendExpansionTerritories(territories, 1);

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].name).toBe('High Value Territory');
    });

    test('should calculate franchise density', () => {
      const territory = new Territory({
        name: 'Test Territory',
        code: 'TEST-01',
        boundaries: {
          type: 'circle',
          center: { latitude: 40.0, longitude: -85.0 },
          radius: 50
        },
        metadata: {
          population: 1000000,
          averageIncome: 65000,
          marketPotential: 20000000,
          competitorCount: 3
        }
      });

      const franchisesInTerritory = 5;

      const density = service.calculateFranchiseDensity(territory, franchisesInTerritory);

      expect(density.franchisesPerCapita).toBeDefined();
      expect(density.marketCoverage).toBeDefined();
      expect(density.saturationLevel).toBeDefined();
    });
  });

  describe('Territory Conflict Resolution', () => {
    test('should detect territory conflicts', () => {
      const territory1 = new Territory({
        name: 'Territory 1',
        code: 'T1',
        boundaries: {
          type: 'circle',
          center: { latitude: 39.7817, longitude: -89.6501 },
          radius: 10
        },
        metadata: { population: 250000, averageIncome: 65000 }
      });

      const territory2 = new Territory({
        name: 'Territory 2',
        code: 'T2',
        boundaries: {
          type: 'circle',
          center: { latitude: 39.79, longitude: -89.65 },
          radius: 10
        },
        metadata: { population: 200000, averageIncome: 60000 }
      });

      const conflicts = service.detectTerritoryConflicts([territory1, territory2]);

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].territories).toContain(territory1.id);
      expect(conflicts[0].territories).toContain(territory2.id);
    });

    test('should propose conflict resolution', () => {
      const territory1 = new Territory({
        name: 'Territory 1',
        code: 'T1',
        boundaries: {
          type: 'circle',
          center: { latitude: 39.7817, longitude: -89.6501 },
          radius: 10
        },
        metadata: { population: 250000, averageIncome: 65000 }
      });

      const territory2 = new Territory({
        name: 'Territory 2',
        code: 'T2',
        boundaries: {
          type: 'circle',
          center: { latitude: 39.79, longitude: -89.65 },
          radius: 10
        },
        metadata: { population: 200000, averageIncome: 60000 }
      });

      const resolution = service.proposeTerritoryResolution(territory1, territory2);

      expect(resolution.strategy).toBeDefined();
      expect(['adjust_boundaries', 'merge', 'split']).toContain(resolution.strategy);
    });
  });
});
