/**
 * Franchise Service Tests
 *
 * TDD test suite for FranchiseService
 */

import { FranchiseService } from '../src/franchise/franchise-service';
import { InMemoryFranchiseRepository } from '../src/franchise/franchise-repository';
import { FranchiseStatus } from '../src/franchise';

describe('FranchiseService', () => {
  let service: FranchiseService;
  let repository: InMemoryFranchiseRepository;

  beforeEach(() => {
    repository = new InMemoryFranchiseRepository();
    service = new FranchiseService(repository);
  });

  describe('createFranchise', () => {
    it('should create a new franchise with pending status', async () => {
      const data = {
        name: 'Test Franchise',
        ownerId: 'owner-001',
        location: {
          address: '123 Main St',
          city: 'Test City',
          state: 'CA',
          zipCode: '90001',
          country: 'USA',
        },
      };

      const franchise = await service.createFranchise(data);

      expect(franchise).toBeDefined();
      expect(franchise.id).toBeDefined();
      expect(franchise.name).toBe(data.name);
      expect(franchise.status).toBe(FranchiseStatus.PENDING);
      expect(franchise.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('getFranchise', () => {
    it('should return a franchise by id', async () => {
      const created = await service.createFranchise({
        name: 'Test Franchise',
        ownerId: 'owner-001',
      });

      const found = await service.getFranchise(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe(created.name);
    });

    it('should return null for non-existent franchise', async () => {
      const found = await service.getFranchise('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('activateFranchise', () => {
    it('should change franchise status to active', async () => {
      const created = await service.createFranchise({
        name: 'Test Franchise',
        ownerId: 'owner-001',
      });

      const activated = await service.activateFranchise(created.id);

      expect(activated).toBeDefined();
      expect(activated?.status).toBe(FranchiseStatus.ACTIVE);
    });
  });

  describe('suspendFranchise', () => {
    it('should change franchise status to suspended', async () => {
      const created = await service.createFranchise({
        name: 'Test Franchise',
        ownerId: 'owner-001',
      });

      const suspended = await service.suspendFranchise(created.id);

      expect(suspended).toBeDefined();
      expect(suspended?.status).toBe(FranchiseStatus.SUSPENDED);
    });
  });

  describe('closeFranchise', () => {
    it('should change franchise status to closed', async () => {
      const created = await service.createFranchise({
        name: 'Test Franchise',
        ownerId: 'owner-001',
      });

      const closed = await service.closeFranchise(created.id);

      expect(closed).toBeDefined();
      expect(closed?.status).toBe(FranchiseStatus.CLOSED);
    });
  });
});
