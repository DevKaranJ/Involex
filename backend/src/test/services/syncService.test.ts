import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SyncService, BillingEntryData } from '../../services/syncService';
import { ConflictResolutionService } from '../../services/conflictResolutionService';
import { PracticeManagementService } from '../../services/practiceManagementService';

// Mock dependencies
const mockPrisma = {
  billingEntry: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn()
  },
  syncQueue: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn()
  },
  syncHistory: {
    create: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn()
  },
  emailAnalysis: {
    update: jest.fn()
  }
} as any;

const mockPracticeManagementService = {
  getConfiguredPlatforms: jest.fn(),
  createTimeEntry: jest.fn(),
  updateTimeEntry: jest.fn(),
  deleteTimeEntry: jest.fn()
} as any;

describe('SyncService', () => {
  let syncService: SyncService;
  let conflictResolutionService: ConflictResolutionService;

  const sampleBillingEntryData: BillingEntryData = {
    id: 'billing-entry-123',
    description: 'Client consultation via email',
    timeSpent: 0.5,
    hourlyRate: 300,
    client: 'Test Client LLC',
    matter: 'General Legal Matters',
    workType: 'Email Review',
    workDate: new Date('2024-01-15'),
    userId: 'user-123'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    syncService = new SyncService(mockPrisma, mockPracticeManagementService, {
      enableRealTimeSync: false, // Disable for testing
      maxRetries: 2,
      retryDelay: 1000,
      batchSize: 5,
      syncInterval: 10000
    });

    conflictResolutionService = new ConflictResolutionService(mockPrisma);

    // Setup default mock responses
    mockPrisma.billingEntry.create.mockResolvedValue({
      id: 'billing-entry-123',
      description: sampleBillingEntryData.description,
      timeSpent: sampleBillingEntryData.timeSpent,
      hourlyRate: sampleBillingEntryData.hourlyRate,
      client: sampleBillingEntryData.client,
      matter: sampleBillingEntryData.matter,
      workType: sampleBillingEntryData.workType,
      workDate: sampleBillingEntryData.workDate,
      userId: sampleBillingEntryData.userId,
      status: 'draft',
      syncStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    mockPracticeManagementService.getConfiguredPlatforms.mockReturnValue(['cleo']);
    mockPracticeManagementService.createTimeEntry.mockResolvedValue({
      success: true,
      data: { 
        id: 'time-entry-456', 
        clientId: sampleBillingEntryData.client,
        date: sampleBillingEntryData.workDate.toISOString(),
        hours: sampleBillingEntryData.timeSpent,
        description: sampleBillingEntryData.description,
        billable: true
      }
    });
  });

  afterEach(() => {
    syncService.stop();
  });

  describe('Billing Entry Creation', () => {
    it('should create billing entry without sync', async () => {
      const result = await syncService.createBillingEntry(
        sampleBillingEntryData,
        [], // No platforms
        false // No auto sync
      );

      expect(result.billingEntry).toBeDefined();
      expect(result.billingEntry.id).toBe('billing-entry-123');
      expect(result.syncResults).toBeUndefined();
      expect(mockPrisma.billingEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          description: sampleBillingEntryData.description,
          timeSpent: sampleBillingEntryData.timeSpent,
          client: sampleBillingEntryData.client,
          userId: sampleBillingEntryData.userId,
          totalAmount: 150 // 0.5 * 300
        })
      });
    });

    it('should create billing entry with sync queue', async () => {
      const platforms = ['cleo'];
      
      const result = await syncService.createBillingEntry(
        sampleBillingEntryData,
        platforms,
        true
      );

      expect(result.billingEntry).toBeDefined();
      expect(mockPrisma.syncQueue.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            billingEntryId: 'billing-entry-123',
            platform: 'cleo',
            action: 'create'
          })
        ])
      });
    });

    it('should handle creation errors gracefully', async () => {
      mockPrisma.billingEntry.create.mockRejectedValue(new Error('Database error'));

      await expect(syncService.createBillingEntry(sampleBillingEntryData))
        .rejects
        .toThrow('Failed to create billing entry: Database error');
    });
  });

  describe('Billing Entry Updates', () => {
    beforeEach(() => {
      mockPrisma.billingEntry.update.mockResolvedValue({
        id: 'billing-entry-123',
        description: 'Updated description',
        timeSpent: sampleBillingEntryData.timeSpent,
        hourlyRate: sampleBillingEntryData.hourlyRate,
        client: sampleBillingEntryData.client,
        matter: sampleBillingEntryData.matter,
        workType: sampleBillingEntryData.workType,
        workDate: sampleBillingEntryData.workDate,
        userId: sampleBillingEntryData.userId,
        updatedAt: new Date()
      });

      mockPrisma.billingEntry.findFirst.mockResolvedValue({
        id: 'billing-entry-123',
        externalId: 'time-entry-456',
        platform: 'cleo'
      });
    });

    it('should update billing entry and queue sync', async () => {
      const updateData = { description: 'Updated description' };
      const platforms = ['cleo'];

      const result = await syncService.updateBillingEntry(
        'billing-entry-123',
        updateData,
        platforms
      );

      expect(result.billingEntry).toBeDefined();
      expect(mockPrisma.billingEntry.update).toHaveBeenCalledWith({
        where: { id: 'billing-entry-123' },
        data: expect.objectContaining({
          description: 'Updated description'
        })
      });
    });

    it('should handle update errors gracefully', async () => {
      mockPrisma.billingEntry.update.mockRejectedValue(new Error('Update failed'));

      await expect(syncService.updateBillingEntry('billing-entry-123', {}))
        .rejects
        .toThrow('Failed to update billing entry: Update failed');
    });
  });

  describe('Sync Status Tracking', () => {
    it('should get sync status for billing entry', async () => {
      const mockSyncHistory = [
        {
          id: 'history-1',
          platform: 'cleo',
          action: 'create',
          status: 'success',
          syncStartedAt: new Date()
        }
      ];

      const mockQueueStatus = [
        {
          id: 'queue-1',
          platform: 'cleo',
          action: 'create',
          status: 'completed'
        }
      ];

      mockPrisma.billingEntry.findUnique.mockResolvedValue({
        id: 'billing-entry-123',
        syncStatus: 'synced',
        externalId: 'time-entry-456'
      });

      mockPrisma.syncHistory.findMany.mockResolvedValue(mockSyncHistory);
      mockPrisma.syncQueue.findMany.mockResolvedValue(mockQueueStatus);

      const status = await syncService.getSyncStatus('billing-entry-123');

      expect(status.entry).toBeDefined();
      expect(status.syncHistory).toEqual(mockSyncHistory);
      expect(status.queueStatus).toEqual(mockQueueStatus);
    });
  });

  describe('Sync Queue Processing', () => {
    it('should process empty sync queue', async () => {
      mockPrisma.syncQueue.findMany.mockResolvedValue([]);

      await syncService.processSyncQueue();

      expect(mockPrisma.syncQueue.findMany).toHaveBeenCalled();
      // Should not attempt to process any items
    });

    it('should handle sync queue processing errors', async () => {
      mockPrisma.syncQueue.findMany.mockRejectedValue(new Error('Queue error'));

      // Should not throw, just log error
      await expect(syncService.processSyncQueue()).resolves.toBeUndefined();
    });
  });

  describe('Service Lifecycle', () => {
    it('should start and stop sync service', () => {
      // Create a service with real-time sync enabled
      const realtimeSyncService = new SyncService(mockPrisma, mockPracticeManagementService, {
        enableRealTimeSync: true,
        maxRetries: 2,
        retryDelay: 1000,
        batchSize: 5,
        syncInterval: 10000
      });

      expect(realtimeSyncService['syncIntervalId']).toBeUndefined();
      
      realtimeSyncService.start();
      expect(realtimeSyncService['syncIntervalId']).toBeDefined();
      
      realtimeSyncService.stop();
      expect(realtimeSyncService['syncIntervalId']).toBeUndefined();
    });
  });

  describe('Data Cleanup', () => {
    it('should clean up old sync data', async () => {
      const olderThanDays = 7;
      
      mockPrisma.syncQueue.deleteMany.mockResolvedValue({ count: 5 });
      mockPrisma.syncHistory.deleteMany.mockResolvedValue({ count: 10 });

      await syncService.cleanup(olderThanDays);

      expect(mockPrisma.syncQueue.deleteMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['completed', 'failed'] },
          updatedAt: { lt: expect.any(Date) }
        }
      });

      expect(mockPrisma.syncHistory.deleteMany).toHaveBeenCalledWith({
        where: {
          syncCompletedAt: { lt: expect.any(Date) }
        }
      });
    });
  });
});

describe('ConflictResolutionService', () => {
  let conflictResolutionService: ConflictResolutionService;

  beforeEach(() => {
    jest.clearAllMocks();
    conflictResolutionService = new ConflictResolutionService(mockPrisma);
  });

  describe('Conflict Detection', () => {
    it('should detect no conflicts for identical data', async () => {
      const billingEntry = {
        id: 'billing-entry-123',
        timeSpent: 2.5,
        description: 'Client consultation',
        client: 'Test Client',
        matter: 'Legal Matter'
      };

      const remoteTimeEntry = {
        id: 'time-entry-456',
        hours: 2.5,
        description: 'Client consultation',
        clientId: 'Test Client',
        matterId: 'Legal Matter',
        date: '2024-01-15',
        billable: true
      };

      mockPrisma.billingEntry.findMany.mockResolvedValue([]);

      const conflicts = await conflictResolutionService.detectConflicts(
        billingEntry,
        remoteTimeEntry,
        'cleo'
      );

      expect(conflicts).toHaveLength(0);
    });

    it('should detect conflicts for different time values', async () => {
      const billingEntry = {
        id: 'billing-entry-123',
        timeSpent: 2.5,
        description: 'Client consultation',
        client: 'Test Client',
        matter: 'Legal Matter'
      };

      const remoteTimeEntry = {
        id: 'time-entry-456',
        hours: 3.0, // Different time
        description: 'Client consultation',
        clientId: 'Test Client',
        matterId: 'Legal Matter',
        date: '2024-01-15',
        billable: true
      };

      mockPrisma.billingEntry.findMany.mockResolvedValue([]);

      const conflicts = await conflictResolutionService.detectConflicts(
        billingEntry,
        remoteTimeEntry,
        'cleo'
      );

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].field).toBe('timeSpent');
      expect(conflicts[0].conflictType).toBe('data_mismatch');
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve conflict with source_wins strategy', async () => {
      const conflict = {
        id: 'conflict-123',
        billingEntryId: 'billing-entry-123',
        platform: 'cleo',
        field: 'timeSpent',
        sourceValue: 2.5,
        targetValue: 3.0,
        conflictType: 'data_mismatch' as const,
        detectedAt: new Date(),
        status: 'pending' as const
      };

      const result = await conflictResolutionService.resolveConflict(conflict);

      expect(result.resolved).toBe(true);
      expect(result.strategy).toBe('latest_wins');
      expect(result.finalValue).toBe(2.5);
      expect(result.requiresManualReview).toBe(false);
    });

    it('should require manual review for client field conflicts', async () => {
      const conflict = {
        id: 'conflict-123',
        billingEntryId: 'billing-entry-123',
        platform: 'cleo',
        field: 'client',
        sourceValue: 'Client A',
        targetValue: 'Client B',
        conflictType: 'data_mismatch' as const,
        detectedAt: new Date(),
        status: 'pending' as const
      };

      const result = await conflictResolutionService.resolveConflict(conflict);

      expect(result.resolved).toBe(false);
      expect(result.requiresManualReview).toBe(true);
      expect(result.strategy).toBe('manual_review');
    });
  });

  describe('Conflict Statistics', () => {
    it('should return empty stats for time period', async () => {
      const stats = await conflictResolutionService.getConflictStats({
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      });

      expect(stats.totalConflicts).toBe(0);
      expect(stats.resolvedConflicts).toBe(0);
      expect(stats.pendingConflicts).toBe(0);
    });
  });
});
