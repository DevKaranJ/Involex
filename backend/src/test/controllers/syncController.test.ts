import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SyncController } from '../../controllers/syncController';
import { SyncService } from '../../services/syncService';
import { PracticeManagementService } from '../../services/practiceManagementService';
import { ConflictResolutionService } from '../../services/conflictResolutionService';
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

// AuthenticatedRequest interface
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

describe('SyncController', () => {
  let syncController: SyncController;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockPracticeManagementService: jest.Mocked<PracticeManagementService>;
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    // Mock PrismaClient
    mockPrisma = {
      billingEntry: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      syncHistory: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      syncQueue: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      emailAnalysis: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    } as any;

    // Mock PracticeManagementService
    mockPracticeManagementService = {
      authenticateWithPlatform: jest.fn(),
      getBillingEntries: jest.fn(),
      createBillingEntry: jest.fn(),
      updateBillingEntry: jest.fn(),
      deleteBillingEntry: jest.fn(),
    } as any;

    // Create SyncController instance
    syncController = new SyncController(mockPrisma, mockPracticeManagementService);

    // Mock request and response
    mockReq = {
      user: { id: 'user123', email: 'test@example.com' },
      body: {},
      params: {},
      query: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    } as any;
  });

  describe('createManualBillingEntry', () => {
    it('should create a manual billing entry successfully', async () => {
      const billingData = {
        description: 'Legal consultation',
        timeSpent: 2.5,
        hourlyRate: 200,
        client: 'ABC Corp',
        matter: 'Contract Review',
        workType: 'Legal Advisory',
        workDate: '2024-01-01',
        platforms: ['clio'],
      };

      mockReq.body = billingData;
      
      const expectedResult = {
        billingEntry: {
          id: '1',
          userId: 'user123',
          ...billingData,
          createdAt: new Date(),
        },
        syncResults: []
      };

      // Mock the SyncService method
      jest.spyOn(syncController['syncService'], 'createBillingEntry').mockResolvedValue(expectedResult as any);

      await syncController.createManualBillingEntry(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            billingEntry: expect.any(Object),
          }),
        })
      );
    });

    it('should handle validation errors', async () => {
      mockReq.body = { description: 'Legal consultation' }; // Missing required fields

      await syncController.createManualBillingEntry(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Description, time spent, and client are required',
        })
      );
    });

    it('should handle missing user in request', async () => {
      mockReq.user = undefined;
      mockReq.body = { description: 'Legal consultation' };

      await syncController.createManualBillingEntry(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'User not authenticated',
        })
      );
    });
  });

  describe('getUserBillingEntries', () => {
    it('should get user billing entries successfully', async () => {
      const expectedEntries = [
        { id: '1', description: 'Legal consultation', timeSpent: 2.5, userId: 'user123' },
        { id: '2', description: 'Document review', timeSpent: 1.0, userId: 'user123' },
      ];

      mockPrisma.billingEntry.findMany.mockResolvedValue(expectedEntries as any);

      await syncController.getUserBillingEntries(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockPrisma.billingEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user123' },
        })
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            entries: expectedEntries,
          }),
        })
      );
    });

    it('should handle errors during retrieval', async () => {
      mockPrisma.billingEntry.findMany.mockRejectedValue(new Error('Retrieval failed'));

      await syncController.getUserBillingEntries(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Retrieval failed',
        })
      );
    });

    it('should handle missing user in request', async () => {
      mockReq.user = undefined;

      await syncController.getUserBillingEntries(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'User not authenticated',
        })
      );
    });
  });

  describe('updateBillingEntry', () => {
    it('should update billing entry successfully', async () => {
      const entryId = '1';
      const updateData = { timeSpent: 3.0, hourlyRate: 250 };
      
      mockReq.params = { id: entryId };
      mockReq.body = updateData;

      const existingEntry = {
        id: entryId,
        userId: 'user123',
        description: 'Legal consultation',
        timeSpent: 2.5,
        hourlyRate: 200,
      };

      const updatedResult = {
        billingEntry: { ...existingEntry, ...updateData },
        syncResults: []
      };

      mockPrisma.billingEntry.findFirst.mockResolvedValue(existingEntry as any);
      jest.spyOn(syncController['syncService'], 'updateBillingEntry').mockResolvedValue(updatedResult as any);

      await syncController.updateBillingEntry(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockPrisma.billingEntry.findFirst).toHaveBeenCalledWith({
        where: { id: entryId, userId: 'user123' },
      });
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            billingEntry: expect.any(Object),
          }),
        })
      );
    });

    it('should handle errors during update', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { timeSpent: 3.0 };
      mockPrisma.billingEntry.findFirst.mockRejectedValue(new Error('Update failed'));

      await syncController.updateBillingEntry(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Update failed',
        })
      );
    });

    it('should handle missing user in request', async () => {
      mockReq.user = undefined;
      mockReq.params = { id: '1' };
      mockReq.body = { timeSpent: 3.0 };

      // Mock that no entry is found because user is undefined
      mockPrisma.billingEntry.findFirst.mockResolvedValue(null);

      await syncController.updateBillingEntry(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Billing entry not found',
        })
      );
    });

    it('should handle entry not found', async () => {
      mockReq.params = { id: '999' };
      mockReq.body = { timeSpent: 3.0 };

      mockPrisma.billingEntry.findFirst.mockResolvedValue(null);

      await syncController.updateBillingEntry(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Billing entry not found',
        })
      );
    });
  });

  describe('getSyncStatus', () => {
    it('should get sync status successfully', async () => {
      const entryId = '1';
      mockReq.params = { id: entryId };

      const billingEntry = {
        id: entryId,
        description: 'Legal consultation',
        userId: 'user123',
      };

      const expectedStatus = {
        entry: billingEntry,
        syncHistory: [
          { platform: 'clio', status: 'completed', timestamp: new Date() },
        ],
        queueStatus: [
          { platform: 'clio', status: 'pending', position: 1 },
        ],
      };

      // Mock the billing entry lookup first
      mockPrisma.billingEntry.findFirst.mockResolvedValue(billingEntry as any);
      // Mock the SyncService getSyncStatus method
      jest.spyOn(syncController['syncService'], 'getSyncStatus').mockResolvedValue(expectedStatus as any);

      await syncController.getSyncStatus(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expectedStatus,
        })
      );
    });

    it('should handle errors during status retrieval', async () => {
      mockReq.params = { id: '1' };
      
      // Mock billing entry exists
      mockPrisma.billingEntry.findFirst.mockResolvedValue({ id: '1', userId: 'user123' } as any);
      // Mock SyncService error
      jest.spyOn(syncController['syncService'], 'getSyncStatus').mockRejectedValue(new Error('Status retrieval failed'));

      await syncController.getSyncStatus(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Status retrieval failed',
        })
      );
    });

    it('should handle missing user in request', async () => {
      mockReq.user = undefined;
      mockReq.params = { id: '1' };

      // Mock that no entry is found because user is undefined
      mockPrisma.billingEntry.findFirst.mockResolvedValue(null);

      await syncController.getSyncStatus(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Billing entry not found',
        })
      );
    });
  });

  // Simplified for initial testing - retrySyncEntry test can be added later
  // describe('retrySyncEntry', () => { ... });

  describe('getPendingConflicts', () => {
    it('should get pending conflicts successfully', async () => {
      const expectedConflicts = [
        { id: '1', type: 'billing_entry', status: 'pending' },
        { id: '2', type: 'time_entry', status: 'pending' },
      ];

      // Mock the ConflictResolutionService method
      jest.spyOn(syncController['conflictResolutionService'], 'getPendingConflicts').mockResolvedValue(expectedConflicts as any);

      await syncController.getPendingConflicts(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            conflicts: expectedConflicts,
          }),
        })
      );
    });

    it('should handle errors during conflict retrieval', async () => {
      jest.spyOn(syncController['conflictResolutionService'], 'getPendingConflicts').mockRejectedValue(new Error('Conflict retrieval failed'));

      await syncController.getPendingConflicts(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Conflict retrieval failed',
        })
      );
    });
  });

  describe('resolveConflict', () => {
    it('should resolve conflict successfully', async () => {
      const conflictId = '1';
      const resolutionData = { finalValue: { timeSpent: 2.5 }, strategy: 'manual_override' };
      
      mockReq.params = { conflictId };
      mockReq.body = resolutionData;

      // Mock the ConflictResolutionService method
      jest.spyOn(syncController['conflictResolutionService'], 'manuallyResolveConflict').mockResolvedValue(undefined);

      await syncController.resolveConflict(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Conflict resolved successfully',
        })
      );
    });

    it('should handle errors during conflict resolution', async () => {
      mockReq.params = { conflictId: '1' };
      mockReq.body = { finalValue: { timeSpent: 2.5 } };
      jest.spyOn(syncController['conflictResolutionService'], 'manuallyResolveConflict').mockRejectedValue(new Error('Conflict resolution failed'));

      await syncController.resolveConflict(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Conflict resolution failed',
        })
      );
    });

    it('should handle missing user in request', async () => {
      mockReq.user = undefined;
      mockReq.params = { conflictId: '1' };
      mockReq.body = { finalValue: { timeSpent: 2.5 } };

      await syncController.resolveConflict(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'User not authenticated',
        })
      );
    });
  });

  describe('getSyncStats', () => {
    it('should get sync stats successfully', async () => {
      // Mock database queries for stats - need to mock both count and groupBy
      mockPrisma.billingEntry.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(85)  // synced
        .mockResolvedValueOnce(10)  // pending
        .mockResolvedValueOnce(5);  // failed

      mockPrisma.billingEntry.groupBy.mockResolvedValue([
        { platform: 'clio', _count: 50 },
        { platform: 'mycase', _count: 35 }
      ] as any);

      mockPrisma.syncHistory.findMany.mockResolvedValue([
        { id: '1', platform: 'clio', status: 'success' },
        { id: '2', platform: 'mycase', status: 'success' }
      ] as any);

      // Mock ConflictResolutionService
      jest.spyOn(syncController['conflictResolutionService'], 'getConflictStats').mockResolvedValue({
        totalConflicts: 3,
        resolvedConflicts: 2,
        pendingConflicts: 1
      } as any);

      await syncController.getSyncStats(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            summary: expect.objectContaining({
              totalEntries: 100,
              syncedEntries: 85,
              pendingEntries: 10,
              errorEntries: 5,
            }),
          }),
        })
      );
    });

    it('should handle errors during stats retrieval', async () => {
      mockPrisma.billingEntry.count.mockRejectedValue(new Error('Stats retrieval failed'));

      await syncController.getSyncStats(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Stats retrieval failed',
        })
      );
    });
  });
});
