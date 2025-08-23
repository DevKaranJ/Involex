import express from 'express';
import { Request, Response } from 'express';
import { practiceManagementService } from '../services/practiceManagementService';
import { 
  PracticeManagementConfig, 
  TimeEntry, 
  BillingEntry, 
  PracticeManagementError,
  TimeEntryFilters,
  ClientFilters,
  MatterFilters 
} from '../types/practiceManagement';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * Error handler for practice management operations
 */
const handlePMError = (error: any, res: Response) => {
  if (error instanceof PracticeManagementError) {
    const statusCode = error.code === 'AUTHENTICATION_FAILED' ? 401 :
                      error.code === 'PLATFORM_NOT_FOUND' ? 404 :
                      error.code === 'PLATFORM_NOT_CONFIGURED' ? 400 :
                      error.code === 'VALIDATION_ERROR' ? 400 :
                      error.code === 'RATE_LIMIT_EXCEEDED' ? 429 :
                      error.code === 'API_ERROR' ? 502 : 500;

    return res.status(statusCode).json({
      error: error.message,
      code: error.code,
      platform: error.platform
    });
  }

  logger.error('Unexpected error in practice management API', error);
  return res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
};

/**
 * GET /api/practice-management/platforms
 * Get available practice management platforms
 */
router.get('/platforms', (req: Request, res: Response) => {
  try {
    const available = practiceManagementService.getAvailablePlatforms();
    const configured = practiceManagementService.getConfiguredPlatforms();
    
    res.json({
      success: true,
      data: {
        available,
        configured
      }
    });
  } catch (error) {
    handlePMError(error, res);
  }
});

/**
 * POST /api/practice-management/platforms/:platform/configure
 * Configure a practice management platform
 */
router.post('/platforms/:platform/configure', async (req: Request, res: Response) => {
  try {
    const { platform } = req.params;
    const config: PracticeManagementConfig = {
      platform,
      ...req.body
    };

    await practiceManagementService.configurePlatform(config);
    
    res.json({
      success: true,
      message: `Successfully configured ${platform}`
    });
  } catch (error) {
    handlePMError(error, res);
  }
});

/**
 * DELETE /api/practice-management/platforms/:platform/configure
 * Remove platform configuration
 */
router.delete('/platforms/:platform/configure', (req: Request, res: Response) => {
  try {
    const { platform } = req.params;
    practiceManagementService.removePlatformConfiguration(platform);
    
    res.json({
      success: true,
      message: `Configuration removed for ${platform}`
    });
  } catch (error) {
    handlePMError(error, res);
  }
});

/**
 * GET /api/practice-management/platforms/:platform/configure
 * Get platform configuration (without sensitive data)
 */
router.get('/platforms/:platform/configure', (req: Request, res: Response) => {
  try {
    const { platform } = req.params;
    const config = practiceManagementService.getPlatformConfiguration(platform);
    
    if (!config) {
      return res.status(404).json({
        success: false,
        error: `No configuration found for platform: ${platform}`
      });
    }
    
    return res.json({
      success: true,
      data: config
    });
  } catch (error) {
    return handlePMError(error, res);
  }
});

/**
 * GET /api/practice-management/health
 * Get health status of all configured platforms
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await practiceManagementService.getPlatformHealth();
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    handlePMError(error, res);
  }
});

/**
 * POST /api/practice-management/platforms/:platform/validate
 * Validate connection to a platform
 */
router.post('/platforms/:platform/validate', async (req: Request, res: Response) => {
  try {
    const { platform } = req.params;
    const isValid = await practiceManagementService.validateConnection(platform);
    
    res.json({
      success: true,
      data: {
        platform,
        connected: isValid
      }
    });
  } catch (error) {
    handlePMError(error, res);
  }
});

// Time Entry Routes

/**
 * GET /api/practice-management/platforms/:platform/time-entries
 * Get time entries from a platform
 */
router.get('/platforms/:platform/time-entries', async (req: Request, res: Response) => {
  try {
    const { platform } = req.params;
    const filters: TimeEntryFilters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      clientId: req.query.clientId as string,
      matterId: req.query.matterId as string,
      userId: req.query.userId as string,
      billable: req.query.billable === 'true' ? true : req.query.billable === 'false' ? false : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
    };

    const result = await practiceManagementService.getTimeEntries(platform, filters);
    
    res.json(result);
  } catch (error) {
    handlePMError(error, res);
  }
});

/**
 * POST /api/practice-management/platforms/:platform/time-entries
 * Create a time entry on a platform
 */
router.post('/platforms/:platform/time-entries', async (req: Request, res: Response) => {
  try {
    const { platform } = req.params;
    const timeEntry: TimeEntry = req.body;

    const result = await practiceManagementService.createTimeEntry(platform, timeEntry);
    
    res.status(201).json(result);
  } catch (error) {
    handlePMError(error, res);
  }
});

/**
 * PUT /api/practice-management/platforms/:platform/time-entries/:id
 * Update a time entry on a platform
 */
router.put('/platforms/:platform/time-entries/:id', async (req: Request, res: Response) => {
  try {
    const { platform, id } = req.params;
    const updates: Partial<TimeEntry> = req.body;

    const result = await practiceManagementService.updateTimeEntry(platform, id, updates);
    
    res.json(result);
  } catch (error) {
    handlePMError(error, res);
  }
});

/**
 * DELETE /api/practice-management/platforms/:platform/time-entries/:id
 * Delete a time entry on a platform
 */
router.delete('/platforms/:platform/time-entries/:id', async (req: Request, res: Response) => {
  try {
    const { platform, id } = req.params;

    const result = await practiceManagementService.deleteTimeEntry(platform, id);
    
    res.json(result);
  } catch (error) {
    handlePMError(error, res);
  }
});

/**
 * POST /api/practice-management/platforms/:platform/time-entries/bulk
 * Bulk create time entries on a platform
 */
router.post('/platforms/:platform/time-entries/bulk', async (req: Request, res: Response) => {
  try {
    const { platform } = req.params;
    const entries: TimeEntry[] = req.body.entries;

    const result = await practiceManagementService.bulkCreateTimeEntries(platform, entries);
    
    res.status(201).json(result);
  } catch (error) {
    handlePMError(error, res);
  }
});

/**
 * POST /api/practice-management/platforms/:platform/time-entries/sync
 * Sync time entries to a platform
 */
router.post('/platforms/:platform/time-entries/sync', async (req: Request, res: Response) => {
  try {
    const { platform } = req.params;
    const entries: TimeEntry[] = req.body.entries;

    const result = await practiceManagementService.syncTimeEntries(platform, entries);
    
    res.json(result);
  } catch (error) {
    handlePMError(error, res);
  }
});

// Client Routes

/**
 * GET /api/practice-management/platforms/:platform/clients
 * Get clients from a platform
 */
router.get('/platforms/:platform/clients', async (req: Request, res: Response) => {
  try {
    const { platform } = req.params;
    const filters: ClientFilters = {
      search: req.query.search as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
    };

    const result = await practiceManagementService.getClients(platform, filters);
    
    res.json(result);
  } catch (error) {
    handlePMError(error, res);
  }
});

/**
 * GET /api/practice-management/platforms/:platform/clients/:id
 * Get a specific client from a platform
 */
router.get('/platforms/:platform/clients/:id', async (req: Request, res: Response) => {
  try {
    const { platform, id } = req.params;

    const result = await practiceManagementService.getClient(platform, id);
    
    res.json(result);
  } catch (error) {
    handlePMError(error, res);
  }
});

/**
 * POST /api/practice-management/platforms/:platform/clients
 * Create a client on a platform
 */
router.post('/platforms/:platform/clients', async (req: Request, res: Response) => {
  try {
    const { platform } = req.params;
    const client = req.body;

    const result = await practiceManagementService.createClient(platform, client);
    
    res.status(201).json(result);
  } catch (error) {
    handlePMError(error, res);
  }
});

// Matter Routes

/**
 * GET /api/practice-management/platforms/:platform/matters
 * Get matters from a platform
 */
router.get('/platforms/:platform/matters', async (req: Request, res: Response) => {
  try {
    const { platform } = req.params;
    const clientId = req.query.clientId as string;
    const filters: MatterFilters = {
      search: req.query.search as string,
      status: req.query.status as ('active' | 'inactive' | 'closed') | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
    };

    const result = await practiceManagementService.getMatters(platform, clientId, filters);
    
    res.json(result);
  } catch (error) {
    handlePMError(error, res);
  }
});

/**
 * GET /api/practice-management/platforms/:platform/matters/:id
 * Get a specific matter from a platform
 */
router.get('/platforms/:platform/matters/:id', async (req: Request, res: Response) => {
  try {
    const { platform, id } = req.params;

    const result = await practiceManagementService.getMatter(platform, id);
    
    res.json(result);
  } catch (error) {
    handlePMError(error, res);
  }
});

/**
 * POST /api/practice-management/platforms/:platform/matters
 * Create a matter on a platform
 */
router.post('/platforms/:platform/matters', async (req: Request, res: Response) => {
  try {
    const { platform } = req.params;
    const matter = req.body;

    const result = await practiceManagementService.createMatter(platform, matter);
    
    res.status(201).json(result);
  } catch (error) {
    handlePMError(error, res);
  }
});

// User Routes

/**
 * GET /api/practice-management/platforms/:platform/users
 * Get users from a platform
 */
router.get('/platforms/:platform/users', async (req: Request, res: Response) => {
  try {
    const { platform } = req.params;

    const result = await practiceManagementService.getUsers(platform);
    
    res.json(result);
  } catch (error) {
    handlePMError(error, res);
  }
});

/**
 * GET /api/practice-management/platforms/:platform/users/current
 * Get current user from a platform
 */
router.get('/platforms/:platform/users/current', async (req: Request, res: Response) => {
  try {
    const { platform } = req.params;

    const result = await practiceManagementService.getCurrentUser(platform);
    
    res.json(result);
  } catch (error) {
    handlePMError(error, res);
  }
});

// Multi-platform Routes

/**
 * POST /api/practice-management/sync-all
 * Sync time entries to all configured platforms
 */
router.post('/sync-all', async (req: Request, res: Response) => {
  try {
    const entries: TimeEntry[] = req.body.entries;

    const results = await practiceManagementService.syncToAllPlatforms(entries);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    handlePMError(error, res);
  }
});

/**
 * POST /api/practice-management/billing
 * Create billing entries across all platforms
 */
router.post('/billing', async (req: Request, res: Response) => {
  try {
    const billingEntries: BillingEntry[] = req.body.entries;

    const results = await practiceManagementService.createBillingEntries(billingEntries);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    handlePMError(error, res);
  }
});

/**
 * GET /api/practice-management/search/clients
 * Search clients across all platforms
 */
router.get('/search/clients', async (req: Request, res: Response) => {
  try {
    const search = req.query.q as string;
    
    if (!search) {
      return res.status(400).json({
        success: false,
        error: 'Search query parameter "q" is required'
      });
    }

    const results = await practiceManagementService.searchClientsAcrossPlatforms(search);
    
    return res.json({
      success: true,
      data: results
    });
  } catch (error) {
    return handlePMError(error, res);
  }
});

/**
 * GET /api/practice-management/search/matters
 * Search matters across all platforms
 */
router.get('/search/matters', async (req: Request, res: Response) => {
  try {
    const search = req.query.q as string;
    const clientId = req.query.clientId as string;
    
    if (!search) {
      return res.status(400).json({
        success: false,
        error: 'Search query parameter "q" is required'
      });
    }

    const results = await practiceManagementService.searchMattersAcrossPlatforms(search, clientId);
    
    return res.json({
      success: true,
      data: results
    });
  } catch (error) {
    return handlePMError(error, res);
  }
});

export default router;
