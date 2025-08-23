import request from 'supertest';
import express from 'express';
import practiceManagementRoutes from '../../routes/practiceManagement';
import { practiceManagementService } from '../../services/practiceManagementService';

// Mock the practice management service
jest.mock('../../services/practiceManagementService', () => ({
  practiceManagementService: {
    getAvailablePlatforms: jest.fn(),
    getConfiguredPlatforms: jest.fn(),
    configurePlatform: jest.fn(),
    removePlatformConfiguration: jest.fn(),
    getPlatformConfiguration: jest.fn(),
    validateConnection: jest.fn(),
    getPlatformHealth: jest.fn(),
    createTimeEntry: jest.fn(),
    getTimeEntries: jest.fn(),
    updateTimeEntry: jest.fn(),
    deleteTimeEntry: jest.fn(),
    bulkCreateTimeEntries: jest.fn(),
    syncTimeEntries: jest.fn(),
    getClients: jest.fn(),
    getClient: jest.fn(),
    createClient: jest.fn(),
    getMatters: jest.fn(),
    getMatter: jest.fn(),
    createMatter: jest.fn(),
    getUsers: jest.fn(),
    getCurrentUser: jest.fn(),
    syncToAllPlatforms: jest.fn(),
    createBillingEntries: jest.fn(),
    searchClientsAcrossPlatforms: jest.fn(),
    searchMattersAcrossPlatforms: jest.fn()
  }
}));

const mockService = practiceManagementService as jest.Mocked<typeof practiceManagementService>;

// Create test app
const app = express();
app.use(express.json());
app.use('/api/practice-management', practiceManagementRoutes);

describe('Practice Management Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/practice-management/platforms', () => {
    it('should return available and configured platforms', async () => {
      mockService.getAvailablePlatforms.mockReturnValue(['cleo', 'practice-panther', 'mycase']);
      mockService.getConfiguredPlatforms.mockReturnValue(['cleo']);

      const response = await request(app)
        .get('/api/practice-management/platforms')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          available: ['cleo', 'practice-panther', 'mycase'],
          configured: ['cleo']
        }
      });
    });
  });

  describe('POST /api/practice-management/platforms/:platform/configure', () => {
    it('should configure a platform successfully', async () => {
      mockService.configurePlatform.mockResolvedValue(undefined);

      const config = {
        apiKey: 'test-api-key',
        baseUrl: 'https://api.cleo.com'
      };

      const response = await request(app)
        .post('/api/practice-management/platforms/cleo/configure')
        .send(config)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Successfully configured cleo'
      });

      expect(mockService.configurePlatform).toHaveBeenCalledWith({
        platform: 'cleo',
        ...config
      });
    });
  });

  describe('DELETE /api/practice-management/platforms/:platform/configure', () => {
    it('should remove platform configuration', async () => {
      mockService.removePlatformConfiguration.mockReturnValue(undefined);

      const response = await request(app)
        .delete('/api/practice-management/platforms/cleo/configure')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Configuration removed for cleo'
      });

      expect(mockService.removePlatformConfiguration).toHaveBeenCalledWith('cleo');
    });
  });

  describe('GET /api/practice-management/platforms/:platform/configure', () => {
    it('should return platform configuration', async () => {
      const config = {
        platform: 'cleo' as const,
        baseUrl: 'https://api.cleo.com'
      };
      mockService.getPlatformConfiguration.mockReturnValue(config);

      const response = await request(app)
        .get('/api/practice-management/platforms/cleo/configure')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: config
      });
    });

    it('should return 404 when configuration not found', async () => {
      mockService.getPlatformConfiguration.mockReturnValue(null);

      const response = await request(app)
        .get('/api/practice-management/platforms/unknown/configure')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'No configuration found for platform: unknown'
      });
    });
  });

  describe('GET /api/practice-management/health', () => {
    it('should return platform health status', async () => {
      const now = new Date('2025-08-23T10:46:59.283Z');
      const health = {
        cleo: { connected: true, lastSync: now },
        'practice-panther': { connected: false, error: 'API key invalid' }
      };
      mockService.getPlatformHealth.mockResolvedValue(health);

      const response = await request(app)
        .get('/api/practice-management/health')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          cleo: { connected: true, lastSync: now.toISOString() },
          'practice-panther': { connected: false, error: 'API key invalid' }
        }
      });
    });
  });

  describe('POST /api/practice-management/platforms/:platform/validate', () => {
    it('should validate platform connection', async () => {
      mockService.validateConnection.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/practice-management/platforms/cleo/validate')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          platform: 'cleo',
          connected: true
        }
      });
    });
  });

  describe('Time Entry Routes', () => {
    const sampleTimeEntry = {
      id: '1',
      date: '2024-01-15',
      hours: 2.5,
      description: 'Client consultation',
      clientId: 'client-1',
      matterId: 'matter-1',
      userId: 'user-1',
      billable: true
    };

    describe('GET /api/practice-management/platforms/:platform/time-entries', () => {
      it('should get time entries with filters', async () => {
        mockService.getTimeEntries.mockResolvedValue({
          success: true,
          data: [sampleTimeEntry]
        });

        const response = await request(app)
          .get('/api/practice-management/platforms/cleo/time-entries')
          .query({
            startDate: '2024-01-01',
            endDate: '2024-01-31',
            billable: 'true'
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual([sampleTimeEntry]);

        expect(mockService.getTimeEntries).toHaveBeenCalledWith('cleo', {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          clientId: undefined,
          matterId: undefined,
          userId: undefined,
          billable: true,
          limit: undefined,
          offset: undefined
        });
      });
    });

    describe('POST /api/practice-management/platforms/:platform/time-entries', () => {
      it('should create a time entry', async () => {
        mockService.createTimeEntry.mockResolvedValue({
          success: true,
          data: sampleTimeEntry
        });

        const response = await request(app)
          .post('/api/practice-management/platforms/cleo/time-entries')
          .send(sampleTimeEntry)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(sampleTimeEntry);
        expect(mockService.createTimeEntry).toHaveBeenCalledWith('cleo', sampleTimeEntry);
      });
    });

    describe('PUT /api/practice-management/platforms/:platform/time-entries/:id', () => {
      it('should update a time entry', async () => {
        const updates = { hours: 3.0 };
        const updatedEntry = { ...sampleTimeEntry, ...updates };

        mockService.updateTimeEntry.mockResolvedValue({
          success: true,
          data: updatedEntry
        });

        const response = await request(app)
          .put('/api/practice-management/platforms/cleo/time-entries/1')
          .send(updates)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(updatedEntry);
        expect(mockService.updateTimeEntry).toHaveBeenCalledWith('cleo', '1', updates);
      });
    });

    describe('DELETE /api/practice-management/platforms/:platform/time-entries/:id', () => {
      it('should delete a time entry', async () => {
        mockService.deleteTimeEntry.mockResolvedValue({
          success: true
        });

        const response = await request(app)
          .delete('/api/practice-management/platforms/cleo/time-entries/1')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(mockService.deleteTimeEntry).toHaveBeenCalledWith('cleo', '1');
      });
    });

    describe('POST /api/practice-management/platforms/:platform/time-entries/bulk', () => {
      it('should bulk create time entries', async () => {
        const entries = [sampleTimeEntry];
        mockService.bulkCreateTimeEntries.mockResolvedValue({
          success: true,
          data: entries
        });

        const response = await request(app)
          .post('/api/practice-management/platforms/cleo/time-entries/bulk')
          .send({ entries })
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(entries);
        expect(mockService.bulkCreateTimeEntries).toHaveBeenCalledWith('cleo', entries);
      });
    });

    describe('POST /api/practice-management/platforms/:platform/time-entries/sync', () => {
      it('should sync time entries', async () => {
        const entries = [sampleTimeEntry];
        const syncResult = { created: 1, updated: 0, errors: [] };

        mockService.syncTimeEntries.mockResolvedValue({
          success: true,
          data: syncResult
        });

        const response = await request(app)
          .post('/api/practice-management/platforms/cleo/time-entries/sync')
          .send({ entries })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(syncResult);
        expect(mockService.syncTimeEntries).toHaveBeenCalledWith('cleo', entries);
      });
    });
  });

  describe('Client Routes', () => {
    const sampleClient = {
      id: 'client-1',
      name: 'Test Client LLC',
      email: 'contact@testclient.com',
      phone: '+1-555-0123',
      status: 'active' as const
    };

    describe('GET /api/practice-management/platforms/:platform/clients', () => {
      it('should get clients with filters', async () => {
        mockService.getClients.mockResolvedValue({
          success: true,
          data: [sampleClient]
        });

        const response = await request(app)
          .get('/api/practice-management/platforms/cleo/clients')
          .query({ search: 'test', limit: '10' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual([sampleClient]);
        expect(mockService.getClients).toHaveBeenCalledWith('cleo', {
          search: 'test',
          limit: 10,
          offset: undefined
        });
      });
    });

    describe('GET /api/practice-management/platforms/:platform/clients/:id', () => {
      it('should get a specific client', async () => {
        mockService.getClient.mockResolvedValue({
          success: true,
          data: sampleClient
        });

        const response = await request(app)
          .get('/api/practice-management/platforms/cleo/clients/client-1')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(sampleClient);
        expect(mockService.getClient).toHaveBeenCalledWith('cleo', 'client-1');
      });
    });

    describe('POST /api/practice-management/platforms/:platform/clients', () => {
      it('should create a client', async () => {
        const newClient = { name: 'New Client', email: 'new@client.com', status: 'active' as const };
        const createdClient = { ...newClient, id: 'new-client-1' };

        mockService.createClient.mockResolvedValue({
          success: true,
          data: createdClient
        });

        const response = await request(app)
          .post('/api/practice-management/platforms/cleo/clients')
          .send(newClient)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(createdClient);
        expect(mockService.createClient).toHaveBeenCalledWith('cleo', newClient);
      });
    });
  });

  describe('Multi-platform Routes', () => {
    describe('POST /api/practice-management/sync-all', () => {
      it('should sync to all platforms', async () => {
        const entries = [{ id: '1', date: '2024-01-15', hours: 2.5, description: 'Test' }];
        const results = {
          cleo: { 
            success: true, 
            processed: 1, 
            created: 1, 
            updated: 0, 
            errors: [],
            summary: { totalTime: 2.5, billableTime: 2.5, clients: ['client-1'], matters: ['matter-1'] }
          },
          'practice-panther': { 
            success: true, 
            processed: 1, 
            created: 1, 
            updated: 0, 
            errors: [],
            summary: { totalTime: 2.5, billableTime: 2.5, clients: ['client-1'], matters: ['matter-1'] }
          }
        };

        mockService.syncToAllPlatforms.mockResolvedValue(results);

        const response = await request(app)
          .post('/api/practice-management/sync-all')
          .send({ entries })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(results);
        expect(mockService.syncToAllPlatforms).toHaveBeenCalledWith(entries);
      });
    });

    describe('GET /api/practice-management/search/clients', () => {
      it('should search clients across platforms', async () => {
        const results = {
          cleo: [{ id: '1', name: 'Client 1', status: 'active' as const }],
          'practice-panther': [{ id: '2', name: 'Client 2', status: 'active' as const }]
        };

        mockService.searchClientsAcrossPlatforms.mockResolvedValue(results);

        const response = await request(app)
          .get('/api/practice-management/search/clients')
          .query({ q: 'test' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(results);
        expect(mockService.searchClientsAcrossPlatforms).toHaveBeenCalledWith('test');
      });

      it('should return 400 when search query is missing', async () => {
        const response = await request(app)
          .get('/api/practice-management/search/clients')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Search query parameter "q" is required');
      });
    });

    describe('GET /api/practice-management/search/matters', () => {
      it('should search matters across platforms', async () => {
        const results = {
          cleo: [{ id: '1', name: 'Matter 1', clientId: 'client-1', status: 'active' as const, openDate: '2024-01-01' }],
          'practice-panther': [{ id: '2', name: 'Matter 2', clientId: 'client-2', status: 'active' as const, openDate: '2024-01-02' }]
        };

        mockService.searchMattersAcrossPlatforms.mockResolvedValue(results);

        const response = await request(app)
          .get('/api/practice-management/search/matters')
          .query({ q: 'contract', clientId: 'client-1' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(results);
        expect(mockService.searchMattersAcrossPlatforms).toHaveBeenCalledWith('contract', 'client-1');
      });

      it('should return 400 when search query is missing', async () => {
        const response = await request(app)
          .get('/api/practice-management/search/matters')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Search query parameter "q" is required');
      });
    });
  });
});
