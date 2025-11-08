/**
 * Franchise Entity Unit Tests (TDD)
 */

import { Franchise } from '../../domain/entities/Franchise';
import {
  FranchiseStatus,
  PerformanceMetricType,
  Address,
  Coordinates,
  ContactInfo,
  PerformanceMetric
} from '../../domain/types';

describe('Franchise Entity', () => {
  const validAddress: Address = {
    street: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    postalCode: '62701',
    country: 'USA'
  };

  const validCoordinates: Coordinates = {
    latitude: 39.7817,
    longitude: -89.6501
  };

  const validContactInfo: ContactInfo = {
    email: 'owner@example.com',
    phone: '+1-555-0100'
  };

  describe('Creation and Validation', () => {
    test('should create a valid franchise', () => {
      const franchise = new Franchise({
        name: 'Springfield Downtown',
        ownerId: 'owner-123',
        ownerName: 'John Doe',
        ownerContact: validContactInfo,
        location: validAddress,
        coordinates: validCoordinates,
        territoryId: 'territory-456'
      });

      expect(franchise.id).toBeDefined();
      expect(franchise.franchiseNumber).toBeDefined();
      expect(franchise.name).toBe('Springfield Downtown');
      expect(franchise.status).toBe(FranchiseStatus.PENDING);
      expect(franchise.createdAt).toBeInstanceOf(Date);
    });

    test('should throw error when name is empty', () => {
      expect(() => {
        new Franchise({
          name: '',
          ownerId: 'owner-123',
          ownerName: 'John Doe',
          ownerContact: validContactInfo,
          location: validAddress,
          coordinates: validCoordinates,
          territoryId: 'territory-456'
        });
      }).toThrow('Franchise name cannot be empty');
    });

    test('should throw error when ownerId is empty', () => {
      expect(() => {
        new Franchise({
          name: 'Springfield Downtown',
          ownerId: '',
          ownerName: 'John Doe',
          ownerContact: validContactInfo,
          location: validAddress,
          coordinates: validCoordinates,
          territoryId: 'territory-456'
        });
      }).toThrow('Owner ID cannot be empty');
    });

    test('should throw error when email is invalid', () => {
      expect(() => {
        new Franchise({
          name: 'Springfield Downtown',
          ownerId: 'owner-123',
          ownerName: 'John Doe',
          ownerContact: { ...validContactInfo, email: 'invalid-email' },
          location: validAddress,
          coordinates: validCoordinates,
          territoryId: 'territory-456'
        });
      }).toThrow('Invalid email format');
    });

    test('should throw error when coordinates are invalid', () => {
      expect(() => {
        new Franchise({
          name: 'Springfield Downtown',
          ownerId: 'owner-123',
          ownerName: 'John Doe',
          ownerContact: validContactInfo,
          location: validAddress,
          coordinates: { latitude: 91, longitude: -89.6501 },
          territoryId: 'territory-456'
        });
      }).toThrow('Invalid coordinates');
    });

    test('should generate unique franchise numbers', () => {
      const franchise1 = new Franchise({
        name: 'Franchise 1',
        ownerId: 'owner-123',
        ownerName: 'John Doe',
        ownerContact: validContactInfo,
        location: validAddress,
        coordinates: validCoordinates,
        territoryId: 'territory-456'
      });

      const franchise2 = new Franchise({
        name: 'Franchise 2',
        ownerId: 'owner-124',
        ownerName: 'Jane Doe',
        ownerContact: validContactInfo,
        location: validAddress,
        coordinates: validCoordinates,
        territoryId: 'territory-457'
      });

      expect(franchise1.franchiseNumber).not.toBe(franchise2.franchiseNumber);
    });
  });

  describe('Status Management', () => {
    let franchise: Franchise;

    beforeEach(() => {
      franchise = new Franchise({
        name: 'Test Franchise',
        ownerId: 'owner-123',
        ownerName: 'John Doe',
        ownerContact: validContactInfo,
        location: validAddress,
        coordinates: validCoordinates,
        territoryId: 'territory-456'
      });
    });

    test('should activate franchise', () => {
      const event = franchise.activate();

      expect(franchise.status).toBe(FranchiseStatus.ACTIVE);
      expect(event).toBeDefined();
      expect(event.eventType).toBe('FranchiseStatusChanged');
    });

    test('should suspend franchise', () => {
      franchise.activate();
      const event = franchise.suspend('Compliance violation');

      expect(franchise.status).toBe(FranchiseStatus.SUSPENDED);
      expect(event.reason).toBe('Compliance violation');
    });

    test('should terminate franchise', () => {
      franchise.activate();
      const event = franchise.terminate('Contract breach');

      expect(franchise.status).toBe(FranchiseStatus.TERMINATED);
      expect(event.reason).toBe('Contract breach');
    });

    test('should not activate an already active franchise', () => {
      franchise.activate();

      expect(() => {
        franchise.activate();
      }).toThrow('Franchise is already active');
    });

    test('should not terminate a pending franchise', () => {
      expect(() => {
        franchise.terminate('Some reason');
      }).toThrow('Can only terminate active or suspended franchises');
    });
  });

  describe('Performance Metrics', () => {
    let franchise: Franchise;

    beforeEach(() => {
      franchise = new Franchise({
        name: 'Test Franchise',
        ownerId: 'owner-123',
        ownerName: 'John Doe',
        ownerContact: validContactInfo,
        location: validAddress,
        coordinates: validCoordinates,
        territoryId: 'territory-456'
      });
      franchise.activate();
    });

    test('should add performance metrics', () => {
      const metric: PerformanceMetric = {
        type: PerformanceMetricType.REVENUE,
        value: 100000,
        target: 120000,
        period: new Date('2024-01-01'),
        unit: 'USD'
      };

      franchise.addPerformanceMetric(metric);

      expect(franchise.performanceMetrics).toHaveLength(1);
      expect(franchise.performanceMetrics[0]).toEqual(metric);
    });

    test('should update performance metrics', () => {
      const metric: PerformanceMetric = {
        type: PerformanceMetricType.REVENUE,
        value: 100000,
        target: 120000,
        period: new Date('2024-01-01'),
        unit: 'USD'
      };

      franchise.addPerformanceMetric(metric);

      const updatedMetric: PerformanceMetric = {
        type: PerformanceMetricType.REVENUE,
        value: 110000,
        target: 120000,
        period: new Date('2024-01-01'),
        unit: 'USD'
      };

      franchise.updatePerformanceMetric(PerformanceMetricType.REVENUE, updatedMetric);

      expect(franchise.performanceMetrics[0].value).toBe(110000);
    });

    test('should calculate performance score', () => {
      franchise.addPerformanceMetric({
        type: PerformanceMetricType.REVENUE,
        value: 100000,
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

      const score = franchise.calculatePerformanceScore();

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    test('should get metrics by type', () => {
      franchise.addPerformanceMetric({
        type: PerformanceMetricType.REVENUE,
        value: 100000,
        target: 100000,
        period: new Date('2024-01-01'),
        unit: 'USD'
      });

      franchise.addPerformanceMetric({
        type: PerformanceMetricType.REVENUE,
        value: 110000,
        target: 120000,
        period: new Date('2024-02-01'),
        unit: 'USD'
      });

      const revenueMetrics = franchise.getMetricsByType(PerformanceMetricType.REVENUE);

      expect(revenueMetrics).toHaveLength(2);
    });
  });

  describe('Onboarding', () => {
    let franchise: Franchise;

    beforeEach(() => {
      franchise = new Franchise({
        name: 'Test Franchise',
        ownerId: 'owner-123',
        ownerName: 'John Doe',
        ownerContact: validContactInfo,
        location: validAddress,
        coordinates: validCoordinates,
        territoryId: 'territory-456'
      });
    });

    test('should onboard franchise successfully', () => {
      const agreementId = 'agreement-789';
      const openingDate = new Date('2024-06-01');

      const event = franchise.onboard(agreementId, openingDate);

      expect(franchise.status).toBe(FranchiseStatus.ACTIVE);
      expect(franchise.agreementId).toBe(agreementId);
      expect(franchise.openingDate).toEqual(openingDate);
      expect(event.eventType).toBe('FranchiseOnboarded');
    });

    test('should not onboard franchise without agreement', () => {
      expect(() => {
        franchise.onboard('', new Date());
      }).toThrow('Agreement ID is required for onboarding');
    });

    test('should not onboard already onboarded franchise', () => {
      franchise.onboard('agreement-789', new Date());

      expect(() => {
        franchise.onboard('agreement-790', new Date());
      }).toThrow('Franchise has already been onboarded');
    });
  });

  describe('Serialization', () => {
    test('should convert to JSON', () => {
      const franchise = new Franchise({
        name: 'Test Franchise',
        ownerId: 'owner-123',
        ownerName: 'John Doe',
        ownerContact: validContactInfo,
        location: validAddress,
        coordinates: validCoordinates,
        territoryId: 'territory-456'
      });

      const json = franchise.toJSON();

      expect(json.id).toBe(franchise.id);
      expect(json.name).toBe('Test Franchise');
      expect(json.status).toBe(FranchiseStatus.PENDING);
    });

    test('should create from JSON', () => {
      const data = {
        id: 'franchise-123',
        franchiseNumber: 'FR-123456',
        name: 'Test Franchise',
        ownerId: 'owner-123',
        ownerName: 'John Doe',
        ownerContact: validContactInfo,
        location: validAddress,
        coordinates: validCoordinates,
        territoryId: 'territory-456',
        agreementId: 'agreement-123',
        status: FranchiseStatus.ACTIVE,
        openingDate: new Date('2024-01-01'),
        performanceMetrics: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const franchise = Franchise.fromJSON(data);

      expect(franchise.id).toBe('franchise-123');
      expect(franchise.name).toBe('Test Franchise');
      expect(franchise.status).toBe(FranchiseStatus.ACTIVE);
    });
  });
});
