/**
 * Territory Entity Unit Tests (TDD)
 */

import { Territory } from '../../domain/entities/Territory';
import {
  TerritoryStatus,
  GeographicBoundary,
  TerritoryMetadata,
  Coordinates
} from '../../domain/types';

describe('Territory Entity', () => {
  const validBoundary: GeographicBoundary = {
    type: 'circle',
    center: { latitude: 39.7817, longitude: -89.6501 },
    radius: 25
  };

  const validMetadata: TerritoryMetadata = {
    population: 250000,
    averageIncome: 65000,
    marketPotential: 5000000,
    competitorCount: 3
  };

  describe('Creation and Validation', () => {
    test('should create a valid territory', () => {
      const territory = new Territory({
        name: 'Springfield Metro',
        code: 'SPR-01',
        boundaries: validBoundary,
        metadata: validMetadata
      });

      expect(territory.id).toBeDefined();
      expect(territory.name).toBe('Springfield Metro');
      expect(territory.code).toBe('SPR-01');
      expect(territory.status).toBe(TerritoryStatus.AVAILABLE);
      expect(territory.createdAt).toBeInstanceOf(Date);
    });

    test('should throw error when name is empty', () => {
      expect(() => {
        new Territory({
          name: '',
          code: 'SPR-01',
          boundaries: validBoundary,
          metadata: validMetadata
        });
      }).toThrow('Territory name cannot be empty');
    });

    test('should throw error when code is empty', () => {
      expect(() => {
        new Territory({
          name: 'Springfield Metro',
          code: '',
          boundaries: validBoundary,
          metadata: validMetadata
        });
      }).toThrow('Territory code cannot be empty');
    });

    test('should throw error for invalid circular boundary', () => {
      expect(() => {
        new Territory({
          name: 'Springfield Metro',
          code: 'SPR-01',
          boundaries: {
            type: 'circle',
            center: { latitude: 39.7817, longitude: -89.6501 },
            radius: -5
          },
          metadata: validMetadata
        });
      }).toThrow('Invalid circular boundary');
    });

    test('should create territory with polygon boundary', () => {
      const polygonBoundary: GeographicBoundary = {
        type: 'polygon',
        coordinates: [
          { latitude: 39.7817, longitude: -89.6501 },
          { latitude: 39.8817, longitude: -89.6501 },
          { latitude: 39.8817, longitude: -89.5501 },
          { latitude: 39.7817, longitude: -89.5501 }
        ]
      };

      const territory = new Territory({
        name: 'Springfield Metro',
        code: 'SPR-01',
        boundaries: polygonBoundary,
        metadata: validMetadata
      });

      expect(territory.boundaries.type).toBe('polygon');
      expect(territory.boundaries.coordinates).toHaveLength(4);
    });
  });

  describe('Allocation and Reservation', () => {
    let territory: Territory;

    beforeEach(() => {
      territory = new Territory({
        name: 'Springfield Metro',
        code: 'SPR-01',
        boundaries: validBoundary,
        metadata: validMetadata
      });
    });

    test('should allocate territory to franchise', () => {
      const franchiseId = 'franchise-123';
      const event = territory.allocate(franchiseId);

      expect(territory.status).toBe(TerritoryStatus.ALLOCATED);
      expect(territory.franchiseId).toBe(franchiseId);
      expect(event.eventType).toBe('TerritoryAllocated');
      expect(event.franchiseId).toBe(franchiseId);
    });

    test('should not allocate already allocated territory', () => {
      territory.allocate('franchise-123');

      expect(() => {
        territory.allocate('franchise-456');
      }).toThrow('Territory is already allocated');
    });

    test('should reserve territory', () => {
      const reservedFor = 'franchise-123';
      const reservedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const event = territory.reserve(reservedFor, reservedUntil);

      expect(territory.status).toBe(TerritoryStatus.RESERVED);
      expect(territory.reservedUntil).toEqual(reservedUntil);
      expect(event.eventType).toBe('TerritoryReserved');
    });

    test('should not reserve allocated territory', () => {
      territory.allocate('franchise-123');

      expect(() => {
        territory.reserve('franchise-456', new Date());
      }).toThrow('Cannot reserve an allocated territory');
    });

    test('should release territory', () => {
      const franchiseId = 'franchise-123';
      territory.allocate(franchiseId);
      const event = territory.release();

      expect(territory.status).toBe(TerritoryStatus.AVAILABLE);
      expect(territory.franchiseId).toBeUndefined();
      expect(event.eventType).toBe('TerritoryReleased');
      expect(event.previousFranchiseId).toBe(franchiseId);
    });

    test('should expire reservation automatically', () => {
      const pastDate = new Date(Date.now() - 1000);
      territory.reserve('franchise-123', pastDate);

      expect(territory.isReservationExpired()).toBe(true);
    });

    test('should check if reservation is active', () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      territory.reserve('franchise-123', futureDate);

      expect(territory.isReservationExpired()).toBe(false);
    });
  });

  describe('Dispute Management', () => {
    let territory: Territory;

    beforeEach(() => {
      territory = new Territory({
        name: 'Springfield Metro',
        code: 'SPR-01',
        boundaries: validBoundary,
        metadata: validMetadata
      });
      territory.allocate('franchise-123');
    });

    test('should raise dispute', () => {
      const disputingFranchiseId = 'franchise-456';
      const reason = 'Boundary overlap';
      const event = territory.raiseDispute(disputingFranchiseId, reason);

      expect(territory.status).toBe(TerritoryStatus.DISPUTED);
      expect(event.eventType).toBe('TerritoryDisputeRaised');
      expect(event.reason).toBe(reason);
    });

    test('should resolve dispute', () => {
      territory.raiseDispute('franchise-456', 'Boundary overlap');
      const event = territory.resolveDispute('Boundaries clarified', 'franchise-123');

      expect(territory.status).toBe(TerritoryStatus.ALLOCATED);
      expect(event.eventType).toBe('TerritoryDisputeResolved');
    });

    test('should not raise dispute on available territory', () => {
      const availableTerritory = new Territory({
        name: 'Available Territory',
        code: 'AVL-01',
        boundaries: validBoundary,
        metadata: validMetadata
      });

      expect(() => {
        availableTerritory.raiseDispute('franchise-123', 'Some reason');
      }).toThrow('Can only raise disputes on allocated territories');
    });
  });

  describe('Boundary Operations', () => {
    test('should check if point is within circular boundary', () => {
      const territory = new Territory({
        name: 'Springfield Metro',
        code: 'SPR-01',
        boundaries: {
          type: 'circle',
          center: { latitude: 39.7817, longitude: -89.6501 },
          radius: 10
        },
        metadata: validMetadata
      });

      // Point close to center
      const nearPoint: Coordinates = { latitude: 39.7817, longitude: -89.6501 };
      expect(territory.containsPoint(nearPoint)).toBe(true);

      // Point far from center
      const farPoint: Coordinates = { latitude: 40.0, longitude: -90.0 };
      expect(territory.containsPoint(farPoint)).toBe(false);
    });

    test('should detect boundary overlap with another territory', () => {
      const territory1 = new Territory({
        name: 'Territory 1',
        code: 'T1',
        boundaries: {
          type: 'circle',
          center: { latitude: 39.7817, longitude: -89.6501 },
          radius: 10
        },
        metadata: validMetadata
      });

      const territory2 = new Territory({
        name: 'Territory 2',
        code: 'T2',
        boundaries: {
          type: 'circle',
          center: { latitude: 39.8, longitude: -89.65 },
          radius: 10
        },
        metadata: validMetadata
      });

      expect(territory1.hasOverlapWith(territory2)).toBe(true);
    });

    test('should not detect overlap with distant territory', () => {
      const territory1 = new Territory({
        name: 'Territory 1',
        code: 'T1',
        boundaries: {
          type: 'circle',
          center: { latitude: 39.7817, longitude: -89.6501 },
          radius: 10
        },
        metadata: validMetadata
      });

      const territory2 = new Territory({
        name: 'Territory 2',
        code: 'T2',
        boundaries: {
          type: 'circle',
          center: { latitude: 45.0, longitude: -95.0 },
          radius: 10
        },
        metadata: validMetadata
      });

      expect(territory1.hasOverlapWith(territory2)).toBe(false);
    });

    test('should calculate territory area for circular boundary', () => {
      const territory = new Territory({
        name: 'Springfield Metro',
        code: 'SPR-01',
        boundaries: {
          type: 'circle',
          center: { latitude: 39.7817, longitude: -89.6501 },
          radius: 10
        },
        metadata: validMetadata
      });

      const area = territory.calculateArea();
      expect(area).toBeGreaterThan(0);
      expect(area).toBeCloseTo(314.16, 1); // π * 10^2
    });
  });

  describe('Market Analysis', () => {
    test('should calculate market potential per capita', () => {
      const territory = new Territory({
        name: 'Springfield Metro',
        code: 'SPR-01',
        boundaries: validBoundary,
        metadata: validMetadata
      });

      const perCapita = territory.getMarketPotentialPerCapita();
      expect(perCapita).toBe(20); // 5000000 / 250000
    });

    test('should assess territory attractiveness', () => {
      const territory = new Territory({
        name: 'Springfield Metro',
        code: 'SPR-01',
        boundaries: validBoundary,
        metadata: validMetadata
      });

      const score = territory.assessAttractiveness();
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('Serialization', () => {
    test('should convert to JSON', () => {
      const territory = new Territory({
        name: 'Springfield Metro',
        code: 'SPR-01',
        boundaries: validBoundary,
        metadata: validMetadata
      });

      const json = territory.toJSON();

      expect(json.id).toBe(territory.id);
      expect(json.name).toBe('Springfield Metro');
      expect(json.status).toBe(TerritoryStatus.AVAILABLE);
    });

    test('should create from JSON', () => {
      const data = {
        id: 'territory-123',
        name: 'Springfield Metro',
        code: 'SPR-01',
        boundaries: validBoundary,
        status: TerritoryStatus.ALLOCATED,
        franchiseId: 'franchise-456',
        metadata: validMetadata,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const territory = Territory.fromJSON(data);

      expect(territory.id).toBe('territory-123');
      expect(territory.name).toBe('Springfield Metro');
      expect(territory.status).toBe(TerritoryStatus.ALLOCATED);
    });
  });
});
