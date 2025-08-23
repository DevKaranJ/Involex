import { PrismaClient } from '@prisma/client';
import { PracticeManagementService } from './practiceManagementService';
import { logger } from '../utils/logger';
import { TimeEntry, ApiResponse } from '../types/practiceManagement';

export interface SyncServiceConfig {
  enableRealTimeSync: boolean;
  maxRetries: number;
  retryDelay: number;
  batchSize: number;
  syncInterval: number;
}

export interface BillingEntryData {
  id: string;
  description: string;
  timeSpent: number;
  hourlyRate?: number;
  client: string;
  matter?: string;
  workType?: string;
  workDate: Date;
  userId: string;
}

export interface SyncResult {
  success: boolean;
  entryId: string;
  platform: string;
  externalId?: string;
  error?: string;
  conflictReason?: string;
}

export class SyncService {
  private prisma: PrismaClient;
  private practiceManagementService: PracticeManagementService;
  private config: SyncServiceConfig;
  private syncIntervalId?: NodeJS.Timeout;

  constructor(
    prisma: PrismaClient,
    practiceManagementService: PracticeManagementService,
    config: Partial<SyncServiceConfig> = {}
  ) {
    this.prisma = prisma;
    this.practiceManagementService = practiceManagementService;
    this.config = {
      enableRealTimeSync: true,
      maxRetries: 3,
      retryDelay: 5000,
      batchSize: 10,
      syncInterval: 30000, // 30 seconds
      ...config
    };
  }

  /**
   * Start the sync service with periodic processing
   */
  start(): void {
    if (this.config.enableRealTimeSync && !this.syncIntervalId) {
      logger.info('Starting sync service with real-time processing');
      this.syncIntervalId = setInterval(() => {
        this.processSyncQueue().catch(error => {
          logger.error('Error in periodic sync processing:', error);
        });
      }, this.config.syncInterval);
    }
  }

  /**
   * Stop the sync service
   */
  stop(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = undefined;
      logger.info('Sync service stopped');
    }
  }

  /**
   * Create a billing entry and optionally sync to practice management platforms
   */
  async createBillingEntry(
    entryData: BillingEntryData,
    platforms: string[] = [],
    autoSync: boolean = true
  ): Promise<{ billingEntry: any; syncResults?: SyncResult[] }> {
    try {
      // Create billing entry in database
      const billingEntry = await this.prisma.billingEntry.create({
        data: {
          description: entryData.description,
          timeSpent: entryData.timeSpent,
          hourlyRate: entryData.hourlyRate,
          totalAmount: entryData.hourlyRate ? entryData.timeSpent * entryData.hourlyRate : undefined,
          client: entryData.client,
          matter: entryData.matter,
          workType: entryData.workType,
          workDate: entryData.workDate,
          userId: entryData.userId,
          status: 'draft'
        }
      });

      logger.info(`Created billing entry ${billingEntry.id} for user ${entryData.userId}`);

      let syncResults: SyncResult[] = [];

      if (autoSync && platforms.length > 0) {
        // Queue sync operations for each platform
        await this.queueSyncOperations(billingEntry.id, platforms, 'create');
        
        if (this.config.enableRealTimeSync) {
          // Process immediately for real-time sync
          syncResults = await this.syncBillingEntryToPlatforms(billingEntry.id, platforms);
        }
      }

      return { 
        billingEntry, 
        syncResults: syncResults.length > 0 ? syncResults : undefined 
      };
    } catch (error) {
      logger.error('Error creating billing entry:', error);
      throw new Error(`Failed to create billing entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update a billing entry and sync changes to practice management platforms
   */
  async updateBillingEntry(
    entryId: string,
    updateData: Partial<BillingEntryData>,
    platforms: string[] = []
  ): Promise<{ billingEntry: any; syncResults?: SyncResult[] }> {
    try {
      // Update billing entry in database
      const billingEntry = await this.prisma.billingEntry.update({
        where: { id: entryId },
        data: {
          ...updateData,
          totalAmount: updateData.hourlyRate && updateData.timeSpent 
            ? updateData.timeSpent * updateData.hourlyRate 
            : undefined,
          updatedAt: new Date()
        }
      });

      logger.info(`Updated billing entry ${entryId}`);

      let syncResults: SyncResult[] = [];

      if (platforms.length > 0) {
        // Queue sync operations for platforms that have external IDs
        const existingSyncs = await this.prisma.billingEntry.findFirst({
          where: { id: entryId },
          select: { externalId: true, platform: true }
        });

        if (existingSyncs?.externalId) {
          await this.queueSyncOperations(entryId, platforms, 'update');
          
          if (this.config.enableRealTimeSync) {
            syncResults = await this.syncBillingEntryToPlatforms(entryId, platforms, 'update');
          }
        }
      }

      return { billingEntry, syncResults };
    } catch (error) {
      logger.error('Error updating billing entry:', error);
      throw new Error(`Failed to update billing entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Queue sync operations for later processing
   */
  private async queueSyncOperations(
    billingEntryId: string,
    platforms: string[],
    action: 'create' | 'update' | 'delete',
    priority: number = 5
  ): Promise<void> {
    try {
      const queueEntries = platforms.map(platform => ({
        billingEntryId,
        platform,
        action,
        priority,
        maxRetries: this.config.maxRetries,
        retryDelay: this.config.retryDelay
      }));

      await this.prisma.syncQueue.createMany({
        data: queueEntries
      });

      logger.info(`Queued ${platforms.length} sync operations for billing entry ${billingEntryId}`);
    } catch (error) {
      logger.error('Error queuing sync operations:', error);
      throw error;
    }
  }

  /**
   * Process pending sync queue items
   */
  async processSyncQueue(): Promise<void> {
    try {
      // Get pending items, prioritized and limited by batch size
      const queueItems = await this.prisma.syncQueue.findMany({
        where: {
          status: 'pending',
          scheduledFor: { lte: new Date() },
          OR: [
            { lockedUntil: null },
            { lockedUntil: { lt: new Date() } }
          ]
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' }
        ],
        take: this.config.batchSize
      });

      if (queueItems.length === 0) {
        return;
      }

      logger.info(`Processing ${queueItems.length} sync queue items`);

      // Process each item
      for (const item of queueItems) {
        await this.processSyncQueueItem(item.id);
      }
    } catch (error) {
      logger.error('Error processing sync queue:', error);
    }
  }

  /**
   * Process a single sync queue item
   */
  private async processSyncQueueItem(queueItemId: string): Promise<void> {
    const lockUntil = new Date(Date.now() + 300000); // 5 minutes lock

    try {
      // Lock the item for processing
      const queueItem = await this.prisma.syncQueue.update({
        where: { id: queueItemId },
        data: { 
          status: 'processing',
          lockedUntil: lockUntil,
          processedBy: process.pid?.toString() || 'unknown'
        }
      });

      // Get billing entry data
      const billingEntry = await this.prisma.billingEntry.findUnique({
        where: { id: queueItem.billingEntryId },
        include: { user: true }
      });

      if (!billingEntry) {
        await this.markQueueItemFailed(queueItemId, 'Billing entry not found');
        return;
      }

      // Perform sync operation
      const syncResult = await this.syncSingleEntry(
        billingEntry,
        queueItem.platform,
        queueItem.action as 'create' | 'update' | 'delete'
      );

      if (syncResult.success) {
        // Mark as completed
        await this.prisma.syncQueue.update({
          where: { id: queueItemId },
          data: { status: 'completed' }
        });
      } else {
        // Handle failure with retry logic
        await this.handleSyncFailure(queueItem, syncResult.error || 'Unknown error');
      }
    } catch (error) {
      logger.error(`Error processing sync queue item ${queueItemId}:`, error);
      await this.handleSyncFailure(
        await this.prisma.syncQueue.findUnique({ where: { id: queueItemId } }),
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Sync billing entry to multiple platforms
   */
  private async syncBillingEntryToPlatforms(
    billingEntryId: string,
    platforms: string[],
    action: 'create' | 'update' | 'delete' = 'create'
  ): Promise<SyncResult[]> {
    const billingEntry = await this.prisma.billingEntry.findUnique({
      where: { id: billingEntryId },
      include: { user: true }
    });

    if (!billingEntry) {
      throw new Error('Billing entry not found');
    }

    const syncResults: SyncResult[] = [];

    for (const platform of platforms) {
      try {
        const result = await this.syncSingleEntry(billingEntry, platform, action);
        syncResults.push(result);
      } catch (error) {
        syncResults.push({
          success: false,
          entryId: billingEntryId,
          platform,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return syncResults;
  }

  /**
   * Sync a single billing entry to a specific platform
   */
  private async syncSingleEntry(
    billingEntry: any,
    platform: string,
    action: 'create' | 'update' | 'delete'
  ): Promise<SyncResult> {
    const syncStartTime = Date.now();

    try {
      // Check if platform is configured
      const configuredPlatforms = this.practiceManagementService.getConfiguredPlatforms();
      if (!configuredPlatforms.includes(platform)) {
        throw new Error(`Platform ${platform} is not configured`);
      }

      // Convert billing entry to time entry format
      const timeEntry: TimeEntry = {
        id: billingEntry.externalId || undefined,
        clientId: billingEntry.client,
        matterId: billingEntry.matter || undefined,
        date: billingEntry.workDate.toISOString().split('T')[0],
        hours: billingEntry.timeSpent,
        description: billingEntry.description,
        billable: true,
        userId: billingEntry.userId
      };

      let response: ApiResponse<TimeEntry | void>;
      let syncAction = action;

      if (action === 'create') {
        response = await this.practiceManagementService.createTimeEntry(platform, timeEntry);
      } else if (action === 'update' && billingEntry.externalId) {
        response = await this.practiceManagementService.updateTimeEntry(
          platform,
          billingEntry.externalId,
          timeEntry
        );
      } else if (action === 'delete' && billingEntry.externalId) {
        response = await this.practiceManagementService.deleteTimeEntry(
          platform,
          billingEntry.externalId
        );
      } else {
        throw new Error(`Invalid action ${action} or missing external ID`);
      }

      const syncDuration = Date.now() - syncStartTime;

      if (response.success) {
        // Update billing entry with sync information
        await this.prisma.billingEntry.update({
          where: { id: billingEntry.id },
          data: {
            externalId: action !== 'delete' ? (response.data as TimeEntry)?.id : null,
            platform: action !== 'delete' ? platform : null,
            syncedAt: new Date(),
            syncStatus: 'synced',
            syncError: null,
            lastSyncAttempt: new Date(),
            syncRetryCount: 0
          }
        });

        // Record sync history
        await this.prisma.syncHistory.create({
          data: {
            billingEntryId: billingEntry.id,
            platform,
            action: syncAction,
            status: 'success',
            dataSnapshot: JSON.stringify(timeEntry),
            externalId: action !== 'delete' ? (response.data as TimeEntry)?.id : null,
            syncStartedAt: new Date(syncStartTime),
            syncCompletedAt: new Date(),
            duration: syncDuration
          }
        });

        return {
          success: true,
          entryId: billingEntry.id,
          platform,
          externalId: action !== 'delete' ? (response.data as TimeEntry)?.id : undefined
        };
      } else {
        throw new Error(response.error || 'Sync failed');
      }
    } catch (error) {
      const syncDuration = Date.now() - syncStartTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update billing entry with error
      await this.prisma.billingEntry.update({
        where: { id: billingEntry.id },
        data: {
          syncStatus: 'error',
          syncError: errorMessage,
          lastSyncAttempt: new Date(),
          syncRetryCount: { increment: 1 }
        }
      });

      // Record sync history
      await this.prisma.syncHistory.create({
        data: {
          billingEntryId: billingEntry.id,
          platform,
          action,
          status: 'error',
          dataSnapshot: JSON.stringify({
            clientId: billingEntry.client,
            description: billingEntry.description,
            hours: billingEntry.timeSpent
          }),
          errorMessage,
          syncStartedAt: new Date(syncStartTime),
          syncCompletedAt: new Date(),
          duration: syncDuration
        }
      });

      return {
        success: false,
        entryId: billingEntry.id,
        platform,
        error: errorMessage
      };
    }
  }

  /**
   * Handle sync failure with retry logic
   */
  private async handleSyncFailure(queueItem: any, errorMessage: string): Promise<void> {
    if (!queueItem) return;

    const shouldRetry = queueItem.currentRetries < queueItem.maxRetries;

    if (shouldRetry) {
      // Schedule retry with exponential backoff
      const retryDelay = queueItem.retryDelay * Math.pow(2, queueItem.currentRetries);
      const scheduledFor = new Date(Date.now() + retryDelay);

      await this.prisma.syncQueue.update({
        where: { id: queueItem.id },
        data: {
          status: 'pending',
          currentRetries: { increment: 1 },
          scheduledFor,
          lockedUntil: null,
          errorMessage
        }
      });

      logger.warn(`Scheduled retry ${queueItem.currentRetries + 1}/${queueItem.maxRetries} for sync queue item ${queueItem.id}`);
    } else {
      // Mark as failed
      await this.markQueueItemFailed(queueItem.id, errorMessage);
    }
  }

  /**
   * Mark queue item as failed
   */
  private async markQueueItemFailed(queueItemId: string, errorMessage: string): Promise<void> {
    await this.prisma.syncQueue.update({
      where: { id: queueItemId },
      data: {
        status: 'failed',
        errorMessage,
        lockedUntil: null
      }
    });

    logger.error(`Sync queue item ${queueItemId} marked as failed: ${errorMessage}`);
  }

  /**
   * Get sync status for a billing entry
   */
  async getSyncStatus(billingEntryId: string): Promise<{
    entry: any;
    syncHistory: any[];
    queueStatus: any[];
  }> {
    const [entry, syncHistory, queueStatus] = await Promise.all([
      this.prisma.billingEntry.findUnique({
        where: { id: billingEntryId },
        select: {
          id: true,
          syncStatus: true,
          syncError: true,
          lastSyncAttempt: true,
          syncRetryCount: true,
          externalId: true,
          platform: true,
          syncedAt: true
        }
      }),
      this.prisma.syncHistory.findMany({
        where: { billingEntryId },
        orderBy: { syncStartedAt: 'desc' },
        take: 10
      }),
      this.prisma.syncQueue.findMany({
        where: { billingEntryId },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return { entry, syncHistory, queueStatus };
  }

  /**
   * Clean up old sync queue items and history
   */
  async cleanup(olderThanDays: number = 7): Promise<void> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    try {
      // Clean up completed/failed queue items
      const deletedQueue = await this.prisma.syncQueue.deleteMany({
        where: {
          status: { in: ['completed', 'failed'] },
          updatedAt: { lt: cutoffDate }
        }
      });

      // Clean up old sync history
      const deletedHistory = await this.prisma.syncHistory.deleteMany({
        where: {
          syncCompletedAt: { lt: cutoffDate }
        }
      });

      logger.info(`Cleanup completed: ${deletedQueue.count} queue items, ${deletedHistory.count} history records deleted`);
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }
}
