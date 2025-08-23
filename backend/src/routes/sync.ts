import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { SyncController } from '../controllers/syncController';
import { PracticeManagementService } from '../services/practiceManagementService';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();
const practiceManagementService = new PracticeManagementService();
const syncController = new SyncController(prisma, practiceManagementService);

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route POST /api/sync/billing-entries/from-email
 * @desc Create billing entry from email analysis
 * @access Private
 */
router.post('/billing-entries/from-email', syncController.createBillingEntryFromEmail);

/**
 * @route POST /api/sync/billing-entries
 * @desc Create manual billing entry
 * @access Private
 */
router.post('/billing-entries', syncController.createManualBillingEntry);

/**
 * @route PUT /api/sync/billing-entries/:id
 * @desc Update billing entry and sync changes
 * @access Private
 */
router.put('/billing-entries/:id', syncController.updateBillingEntry);

/**
 * @route GET /api/sync/billing-entries
 * @desc Get user's billing entries with sync status
 * @access Private
 */
router.get('/billing-entries', syncController.getUserBillingEntries);

/**
 * @route GET /api/sync/billing-entries/:id/status
 * @desc Get sync status for a billing entry
 * @access Private
 */
router.get('/billing-entries/:id/status', syncController.getSyncStatus);

/**
 * @route POST /api/sync/billing-entries/:id/retry
 * @desc Retry failed sync for a billing entry
 * @access Private
 */
router.post('/billing-entries/:id/retry', syncController.retrySyncEntry);

/**
 * @route GET /api/sync/conflicts
 * @desc Get pending conflicts for user
 * @access Private
 */
router.get('/conflicts', syncController.getPendingConflicts);

/**
 * @route POST /api/sync/conflicts/:conflictId/resolve
 * @desc Resolve a conflict manually
 * @access Private
 */
router.post('/conflicts/:conflictId/resolve', syncController.resolveConflict);

/**
 * @route GET /api/sync/stats
 * @desc Get sync statistics for user
 * @access Private
 */
router.get('/stats', syncController.getSyncStats);

// Start sync service when routes are loaded
syncController.startSyncService();

// Graceful shutdown
process.on('SIGTERM', () => {
  syncController.stopSyncService();
});

process.on('SIGINT', () => {
  syncController.stopSyncService();
});

export default router;
