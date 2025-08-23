import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { SyncService, BillingEntryData } from '../services/syncService';
import { ConflictResolutionService } from '../services/conflictResolutionService';
import { PracticeManagementService } from '../services/practiceManagementService';
import { logger } from '../utils/logger';

// Extend Request interface to include user
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export class SyncController {
  private prisma: PrismaClient;
  private syncService: SyncService;
  private conflictResolutionService: ConflictResolutionService;
  private practiceManagementService: PracticeManagementService;

  constructor(
    prisma: PrismaClient,
    practiceManagementService: PracticeManagementService
  ) {
    this.prisma = prisma;
    this.practiceManagementService = practiceManagementService;
    this.syncService = new SyncService(prisma, practiceManagementService);
    this.conflictResolutionService = new ConflictResolutionService(prisma);
  }

  /**
   * Create a billing entry from email analysis
   */
  createBillingEntryFromEmail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { emailAnalysisId, platforms, autoSync = true } = req.body;

      if (!emailAnalysisId) {
        res.status(400).json({
          success: false,
          error: 'Email analysis ID is required'
        });
        return;
      }

      // Get email analysis data
      const emailAnalysis = await this.prisma.emailAnalysis.findUnique({
        where: { id: emailAnalysisId },
        include: { user: true }
      });

      if (!emailAnalysis) {
        res.status(404).json({
          success: false,
          error: 'Email analysis not found'
        });
        return;
      }

      if (!emailAnalysis.isLegalEmail) {
        res.status(400).json({
          success: false,
          error: 'Cannot create billing entry for non-legal email'
        });
        return;
      }

      // Create billing entry data from email analysis
      const billingEntryData: BillingEntryData = {
        id: '', // Will be generated
        description: emailAnalysis.subject,
        timeSpent: emailAnalysis.estimatedTime || 0.25, // Default 15 minutes
        hourlyRate: 250, // Default hourly rate - can be customized later
        client: emailAnalysis.suggestedClient || 'Unknown Client',
        matter: emailAnalysis.suggestedMatter || undefined,
        workType: emailAnalysis.workType || 'Email Review',
        workDate: emailAnalysis.timestamp,
        userId: emailAnalysis.userId
      };

      // Create billing entry with sync
      const result = await this.syncService.createBillingEntry(
        billingEntryData,
        platforms || [],
        autoSync
      );

      // Update email analysis to link to billing entry
      await this.prisma.emailAnalysis.update({
        where: { id: emailAnalysisId },
        data: { billingEntry: { connect: { id: result.billingEntry.id } } }
      });

      res.json({
        success: true,
        data: {
          billingEntry: result.billingEntry,
          syncResults: result.syncResults
        }
      });
    } catch (error) {
      logger.error('Error creating billing entry from email:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Create a manual billing entry
   */
  createManualBillingEntry = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { 
        description, 
        timeSpent, 
        hourlyRate, 
        client, 
        matter, 
        workType, 
        workDate,
        platforms = [],
        autoSync = true 
      } = req.body;
      
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      // Validate required fields
      if (!description || !timeSpent || !client) {
        res.status(400).json({
          success: false,
          error: 'Description, time spent, and client are required'
        });
        return;
      }

      const billingEntryData: BillingEntryData = {
        id: '',
        description,
        timeSpent: parseFloat(timeSpent),
        hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
        client,
        matter,
        workType,
        workDate: workDate ? new Date(workDate) : new Date(),
        userId
      };

      const result = await this.syncService.createBillingEntry(
        billingEntryData,
        platforms,
        autoSync
      );

      res.json({
        success: true,
        data: {
          billingEntry: result.billingEntry,
          syncResults: result.syncResults
        }
      });
    } catch (error) {
      logger.error('Error creating manual billing entry:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Update billing entry and sync changes
   */
  updateBillingEntry = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { platforms = [], ...updateData } = req.body;

      // Verify ownership
      const existingEntry = await this.prisma.billingEntry.findFirst({
        where: { 
          id,
          userId: req.user?.id 
        }
      });

      if (!existingEntry) {
        res.status(404).json({
          success: false,
          error: 'Billing entry not found'
        });
        return;
      }

      const result = await this.syncService.updateBillingEntry(
        id,
        updateData,
        platforms
      );

      res.json({
        success: true,
        data: {
          billingEntry: result.billingEntry,
          syncResults: result.syncResults
        }
      });
    } catch (error) {
      logger.error('Error updating billing entry:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get sync status for a billing entry
   */
  getSyncStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Verify ownership
      const billingEntry = await this.prisma.billingEntry.findFirst({
        where: { 
          id,
          userId: req.user?.id 
        }
      });

      if (!billingEntry) {
        res.status(404).json({
          success: false,
          error: 'Billing entry not found'
        });
        return;
      }

      const syncStatus = await this.syncService.getSyncStatus(id);

      res.json({
        success: true,
        data: syncStatus
      });
    } catch (error) {
      logger.error('Error getting sync status:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Retry failed sync for a billing entry
   */
  retrySyncEntry = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { platforms } = req.body;

      // Verify ownership
      const billingEntry = await this.prisma.billingEntry.findFirst({
        where: { 
          id,
          userId: req.user?.id 
        }
      });

      if (!billingEntry) {
        res.status(404).json({
          success: false,
          error: 'Billing entry not found'
        });
        return;
      }

      if (!platforms || platforms.length === 0) {
        res.status(400).json({
          success: false,
          error: 'At least one platform must be specified'
        });
        return;
      }

      // Reset sync status and queue for retry
      await this.prisma.billingEntry.update({
        where: { id },
        data: {
          syncStatus: 'pending',
          syncError: null,
          syncRetryCount: 0
        }
      });

      // Queue sync operations
      await this.syncService['queueSyncOperations'](id, platforms, 'create', 8); // Higher priority for retries

      res.json({
        success: true,
        message: 'Sync retry queued successfully'
      });
    } catch (error) {
      logger.error('Error retrying sync:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get user's billing entries with sync status
   */
  getUserBillingEntries = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { 
        status, 
        syncStatus, 
        platform, 
        limit = 50, 
        offset = 0,
        startDate,
        endDate 
      } = req.query;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      const where: any = { userId };

      if (status) where.status = status;
      if (syncStatus) where.syncStatus = syncStatus;
      if (platform) where.platform = platform;
      if (startDate || endDate) {
        where.workDate = {};
        if (startDate) where.workDate.gte = new Date(startDate as string);
        if (endDate) where.workDate.lte = new Date(endDate as string);
      }

      const [billingEntries, total] = await Promise.all([
        this.prisma.billingEntry.findMany({
          where,
          include: {
            emailAnalysis: {
              select: {
                id: true,
                subject: true,
                platform: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: parseInt(limit as string),
          skip: parseInt(offset as string)
        }),
        this.prisma.billingEntry.count({ where })
      ]);

      res.json({
        success: true,
        data: {
          entries: billingEntries,
          pagination: {
            total,
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
            hasMore: total > parseInt(offset as string) + parseInt(limit as string)
          }
        }
      });
    } catch (error) {
      logger.error('Error getting user billing entries:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get pending conflicts for user
   */
  getPendingConflicts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      const conflicts = await this.conflictResolutionService.getPendingConflicts({
        userId
      });

      res.json({
        success: true,
        data: { conflicts }
      });
    } catch (error) {
      logger.error('Error getting pending conflicts:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Resolve a conflict manually
   */
  resolveConflict = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { conflictId } = req.params;
      const { finalValue, strategy } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      await this.conflictResolutionService.manuallyResolveConflict(conflictId, {
        finalValue,
        strategy: strategy || 'manual_override',
        resolvedBy: userId
      });

      res.json({
        success: true,
        message: 'Conflict resolved successfully'
      });
    } catch (error) {
      logger.error('Error resolving conflict:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get sync statistics for user
   */
  getSyncStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { 
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        endDate = new Date() 
      } = req.query;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      const [
        totalEntries,
        syncedEntries,
        pendingEntries,
        errorEntries,
        entriesByPlatform,
        recentSyncHistory
      ] = await Promise.all([
        this.prisma.billingEntry.count({
          where: { 
            userId,
            createdAt: { gte: new Date(startDate as string), lte: new Date(endDate as string) }
          }
        }),
        this.prisma.billingEntry.count({
          where: { 
            userId,
            syncStatus: 'synced',
            createdAt: { gte: new Date(startDate as string), lte: new Date(endDate as string) }
          }
        }),
        this.prisma.billingEntry.count({
          where: { 
            userId,
            syncStatus: 'pending',
            createdAt: { gte: new Date(startDate as string), lte: new Date(endDate as string) }
          }
        }),
        this.prisma.billingEntry.count({
          where: { 
            userId,
            syncStatus: 'error',
            createdAt: { gte: new Date(startDate as string), lte: new Date(endDate as string) }
          }
        }),
        this.prisma.billingEntry.groupBy({
          by: ['platform'],
          where: { 
            userId,
            platform: { not: null },
            createdAt: { gte: new Date(startDate as string), lte: new Date(endDate as string) }
          },
          _count: true
        }),
        this.prisma.syncHistory.findMany({
          where: {
            billingEntry: { userId },
            syncStartedAt: { gte: new Date(startDate as string), lte: new Date(endDate as string) }
          },
          orderBy: { syncStartedAt: 'desc' },
          take: 10
        })
      ]);

      const conflictStats = await this.conflictResolutionService.getConflictStats({
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      });

      res.json({
        success: true,
        data: {
          summary: {
            totalEntries,
            syncedEntries,
            pendingEntries,
            errorEntries,
            syncRate: totalEntries > 0 ? (syncedEntries / totalEntries) * 100 : 0
          },
          platformBreakdown: entriesByPlatform.reduce((acc: Record<string, number>, item: any) => {
            acc[item.platform || 'unknown'] = item._count;
            return acc;
          }, {} as Record<string, number>),
          conflicts: conflictStats,
          recentActivity: recentSyncHistory
        }
      });
    } catch (error) {
      logger.error('Error getting sync stats:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Start sync service
   */
  startSyncService = (): void => {
    this.syncService.start();
  };

  /**
   * Stop sync service
   */
  stopSyncService = (): void => {
    this.syncService.stop();
  };
}
