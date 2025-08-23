import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PracticeManagementService } from '../../src/services/practiceManagementService';
import { CleoAdapter } from '../../src/adapters/CleoAdapter';
import { PracticePantherAdapter } from '../../src/adapters/PracticePantherAdapter';
import { MyCaseAdapter } from '../../src/adapters/MyCaseAdapter';
import { 
  PracticeManagementConfig, 
  TimeEntry, 
  Client, 
  Matter, 
  User,
  PracticeManagementError
} from '../../src/types/practiceManagement';

// Mock all adapters
jest.mock('../../src/adapters/CleoAdapter');
jest.mock('../../src/adapters/PracticePantherAdapter');
jest.mock('../../src/adapters/MyCaseAdapter');

const MockedCleoAdapter = CleoAdapter as jest.MockedClass<typeof CleoAdapter>;
const MockedPracticePantherAdapter = PracticePantherAdapter as jest.MockedClass<typeof PracticePantherAdapter>;
const MockedMyCaseAdapter = MyCaseAdapter as jest.MockedClass<typeof MyCaseAdapter>;

describe('PracticeManagementService', () => {
  let service: PracticeManagementService;
  let mockCleoAdapter: jest.Mocked<CleoAdapter>;
  let mockPracticePantherAdapter: jest.Mocked<PracticePantherAdapter>;
  let mockMyCaseAdapter: jest.Mocked<MyCaseAdapter>;

  const sampleConfig: PracticeManagementConfig = {
    platform: 'cleo',
    apiKey: 'test-api-key',
    baseUrl: 'https://api.cleo.com'
  };

  const sampleTimeEntry: TimeEntry = {
    id: '1',
    date: '2024-01-15',
    hours: 2.5,
    description: 'Client consultation',
    clientId: 'client-1',
    matterId: 'matter-1',
    userId: 'user-1',
    billable: true,
    rate: 250
  };

  const sampleClient: Client = {
    id: 'client-1',
    name: 'Test Client LLC',
    email: 'contact@testclient.com',
    phone: '+1-555-0123',
    status: 'active'
  };

  const sampleMatter: Matter = {
    id: 'matter-1',
    name: 'Contract Review',
    clientId: 'client-1',
    status: 'active',
    description: 'Review of employment contracts',
    openDate: '2024-01-15'
  };

  const sampleUser: User = {
    id: 'user-1',
    name: 'John Doe',
    email: 'john@law.com',
    hourlyRate: 250
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create new service instance
    service = new PracticeManagementService();

    // Get mock instances
    mockCleoAdapter = MockedCleoAdapter.mock.instances[0] as jest.Mocked<CleoAdapter>;
    mockPracticePantherAdapter = MockedPracticePantherAdapter.mock.instances[0] as jest.Mocked<PracticePantherAdapter>;
    mockMyCaseAdapter = MockedMyCaseAdapter.mock.instances[0] as jest.Mocked<MyCaseAdapter>;

    // Setup default mock implementations
    mockCleoAdapter.configure = jest.fn().mockResolvedValue(undefined);
    mockCleoAdapter.validateConnection = jest.fn().mockResolvedValue(true);
    mockCleoAdapter.createTimeEntry = jest.fn().mockResolvedValue({ success: true, data: sampleTimeEntry });
    mockCleoAdapter.getTimeEntries = jest.fn().mockResolvedValue({ success: true, data: [sampleTimeEntry] });
    mockCleoAdapter.getClients = jest.fn().mockResolvedValue({ success: true, data: [sampleClient] });
    mockCleoAdapter.getMatters = jest.fn().mockResolvedValue({ success: true, data: [sampleMatter] });
    mockCleoAdapter.getUsers = jest.fn().mockResolvedValue({ success: true, data: [sampleUser] });
    mockCleoAdapter.getCurrentUser = jest.fn().mockResolvedValue({ success: true, data: sampleUser });
    mockCleoAdapter.bulkCreateTimeEntries = jest.fn().mockResolvedValue({ success: true, data: [sampleTimeEntry] });
    mockCleoAdapter.syncTimeEntries = jest.fn().mockResolvedValue({ 
      success: true, 
      data: { created: 1, updated: 0, errors: [] } 
    });

    // Similar setup for other adapters
    mockPracticePantherAdapter.configure = jest.fn().mockResolvedValue(undefined);
    mockPracticePantherAdapter.validateConnection = jest.fn().mockResolvedValue(true);
    mockMyCaseAdapter.configure = jest.fn().mockResolvedValue(undefined);
    mockMyCaseAdapter.validateConnection = jest.fn().mockResolvedValue(true);
  });

  describe('Platform Management', () => {
    it('should return available platforms', () => {
      const platforms = service.getAvailablePlatforms();
      expect(platforms).toEqual(['cleo', 'practice-panther', 'mycase']);
    });

    it('should configure a platform successfully', async () => {
      await service.configurePlatform(sampleConfig);
      
      expect(mockCleoAdapter.configure).toHaveBeenCalledWith(sampleConfig);
      expect(service.getConfiguredPlatforms()).toContain('cleo');
    });

    it('should throw error for unknown platform', async () => {
      const invalidConfig: PracticeManagementConfig = {
        platform: 'unknown-platform',
        apiKey: 'test-key'
      };

      await expect(service.configurePlatform(invalidConfig))
        .rejects
        .toThrow(PracticeManagementError);
    });

    it('should validate connection successfully', async () => {
      await service.configurePlatform(sampleConfig);
      const isValid = await service.validateConnection('cleo');
      
      expect(isValid).toBe(true);
      expect(mockCleoAdapter.validateConnection).toHaveBeenCalled();
    });

    it('should validate all connections', async () => {
      await service.configurePlatform(sampleConfig);
      const results = await service.validateAllConnections();
      
      expect(results).toEqual({
        cleo: true
      });
    });

    it('should remove platform configuration', () => {
      service.configurePlatform(sampleConfig);
      service.removePlatformConfiguration('cleo');
      
      expect(service.getConfiguredPlatforms()).not.toContain('cleo');
    });

    it('should get platform configuration without sensitive data', async () => {
      await service.configurePlatform(sampleConfig);
      const config = service.getPlatformConfiguration('cleo');
      
      expect(config).toEqual({
        platform: 'cleo',
        subdomain: undefined,
        baseUrl: 'https://api.cleo.com',
        userId: undefined,
        metadata: undefined
      });
      expect(config).not.toHaveProperty('apiKey');
    });
  });

  describe('Time Entry Operations', () => {
    beforeEach(async () => {
      await service.configurePlatform(sampleConfig);
    });

    it('should create time entry', async () => {
      const result = await service.createTimeEntry('cleo', sampleTimeEntry);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(sampleTimeEntry);
      expect(mockCleoAdapter.createTimeEntry).toHaveBeenCalledWith(sampleTimeEntry);
    });

    it('should get time entries with filters', async () => {
      const filters = { clientId: 'client-1', billable: true };
      const result = await service.getTimeEntries('cleo', filters);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual([sampleTimeEntry]);
      expect(mockCleoAdapter.getTimeEntries).toHaveBeenCalledWith(filters);
    });

    it('should update time entry', async () => {
      const updates = { hours: 3.0 };
      mockCleoAdapter.updateTimeEntry = jest.fn().mockResolvedValue({ 
        success: true, 
        data: { ...sampleTimeEntry, ...updates } 
      });

      const result = await service.updateTimeEntry('cleo', '1', updates);
      
      expect(result.success).toBe(true);
      expect(mockCleoAdapter.updateTimeEntry).toHaveBeenCalledWith('1', updates);
    });

    it('should delete time entry', async () => {
      mockCleoAdapter.deleteTimeEntry = jest.fn().mockResolvedValue({ success: true });

      const result = await service.deleteTimeEntry('cleo', '1');
      
      expect(result.success).toBe(true);
      expect(mockCleoAdapter.deleteTimeEntry).toHaveBeenCalledWith('1');
    });

    it('should bulk create time entries', async () => {
      const entries = [sampleTimeEntry];
      const result = await service.bulkCreateTimeEntries('cleo', entries);
      
      expect(result.success).toBe(true);
      expect(mockCleoAdapter.bulkCreateTimeEntries).toHaveBeenCalledWith(entries);
    });

    it('should sync time entries', async () => {
      const entries = [sampleTimeEntry];
      const result = await service.syncTimeEntries('cleo', entries);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ created: 1, updated: 0, errors: [] });
      expect(mockCleoAdapter.syncTimeEntries).toHaveBeenCalledWith(entries);
    });
  });

  describe('Client Operations', () => {
    beforeEach(async () => {
      await service.configurePlatform(sampleConfig);
    });

    it('should get clients', async () => {
      const result = await service.getClients('cleo');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual([sampleClient]);
      expect(mockCleoAdapter.getClients).toHaveBeenCalled();
    });

    it('should get specific client', async () => {
      mockCleoAdapter.getClient = jest.fn().mockResolvedValue({ success: true, data: sampleClient });

      const result = await service.getClient('cleo', 'client-1');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(sampleClient);
      expect(mockCleoAdapter.getClient).toHaveBeenCalledWith('client-1');
    });

    it('should create client', async () => {
      const newClient = { name: 'New Client', email: 'new@client.com' };
      mockCleoAdapter.createClient = jest.fn().mockResolvedValue({ 
        success: true, 
        data: { ...newClient, id: 'new-client-1' } 
      });

      const result = await service.createClient('cleo', newClient);
      
      expect(result.success).toBe(true);
      expect(mockCleoAdapter.createClient).toHaveBeenCalledWith(newClient);
    });
  });

  describe('Matter Operations', () => {
    beforeEach(async () => {
      await service.configurePlatform(sampleConfig);
    });

    it('should get matters', async () => {
      const result = await service.getMatters('cleo');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual([sampleMatter]);
      expect(mockCleoAdapter.getMatters).toHaveBeenCalled();
    });

    it('should get matters for specific client', async () => {
      const result = await service.getMatters('cleo', 'client-1');
      
      expect(result.success).toBe(true);
      expect(mockCleoAdapter.getMatters).toHaveBeenCalledWith('client-1', undefined);
    });

    it('should get specific matter', async () => {
      mockCleoAdapter.getMatter = jest.fn().mockResolvedValue({ success: true, data: sampleMatter });

      const result = await service.getMatter('cleo', 'matter-1');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(sampleMatter);
      expect(mockCleoAdapter.getMatter).toHaveBeenCalledWith('matter-1');
    });

    it('should create matter', async () => {
      const newMatter = { name: 'New Matter', clientId: 'client-1', status: 'active' as const };
      mockCleoAdapter.createMatter = jest.fn().mockResolvedValue({ 
        success: true, 
        data: { ...newMatter, id: 'new-matter-1' } 
      });

      const result = await service.createMatter('cleo', newMatter);
      
      expect(result.success).toBe(true);
      expect(mockCleoAdapter.createMatter).toHaveBeenCalledWith(newMatter);
    });
  });

  describe('User Operations', () => {
    beforeEach(async () => {
      await service.configurePlatform(sampleConfig);
    });

    it('should get users', async () => {
      const result = await service.getUsers('cleo');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual([sampleUser]);
      expect(mockCleoAdapter.getUsers).toHaveBeenCalled();
    });

    it('should get current user', async () => {
      const result = await service.getCurrentUser('cleo');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(sampleUser);
      expect(mockCleoAdapter.getCurrentUser).toHaveBeenCalled();
    });
  });

  describe('Multi-platform Operations', () => {
    beforeEach(async () => {
      await service.configurePlatform(sampleConfig);
      await service.configurePlatform({ 
        platform: 'practice-panther', 
        apiKey: 'pp-key',
        baseUrl: 'https://api.practicepanther.com'
      });
    });

    it('should sync to all platforms', async () => {
      // Setup Practice Panther mock
      mockPracticePantherAdapter.syncTimeEntries = jest.fn().mockResolvedValue({ 
        success: true, 
        data: { created: 1, updated: 0, errors: [] } 
      });

      const entries = [sampleTimeEntry];
      const results = await service.syncToAllPlatforms(entries);
      
      expect(results['cleo'].success).toBe(true);
      expect(results['practice-panther'].success).toBe(true);
      expect(mockCleoAdapter.syncTimeEntries).toHaveBeenCalledWith(entries);
      expect(mockPracticePantherAdapter.syncTimeEntries).toHaveBeenCalledWith(entries);
    });

    it('should handle sync failures gracefully', async () => {
      mockCleoAdapter.syncTimeEntries = jest.fn().mockRejectedValue(new Error('API Error'));
      mockPracticePantherAdapter.syncTimeEntries = jest.fn().mockResolvedValue({ 
        success: true, 
        data: { created: 1, updated: 0, errors: [] } 
      });

      const entries = [sampleTimeEntry];
      const results = await service.syncToAllPlatforms(entries);
      
      expect(results['cleo'].success).toBe(false);
      expect(results['practice-panther'].success).toBe(true);
    });

    it('should search clients across platforms', async () => {
      mockCleoAdapter.getClients = jest.fn().mockResolvedValue({ 
        success: true, 
        data: [sampleClient] 
      });
      mockPracticePantherAdapter.getClients = jest.fn().mockResolvedValue({ 
        success: true, 
        data: [{ ...sampleClient, id: 'pp-client-1' }] 
      });

      const results = await service.searchClientsAcrossPlatforms('test');
      
      expect(results['cleo']).toHaveLength(1);
      expect(results['practice-panther']).toHaveLength(1);
      expect(mockCleoAdapter.getClients).toHaveBeenCalledWith({ search: 'test', limit: 20 });
      expect(mockPracticePantherAdapter.getClients).toHaveBeenCalledWith({ search: 'test', limit: 20 });
    });

    it('should search matters across platforms', async () => {
      mockCleoAdapter.getMatters = jest.fn().mockResolvedValue({ 
        success: true, 
        data: [sampleMatter] 
      });
      mockPracticePantherAdapter.getMatters = jest.fn().mockResolvedValue({ 
        success: true, 
        data: [{ ...sampleMatter, id: 'pp-matter-1' }] 
      });

      const results = await service.searchMattersAcrossPlatforms('test', 'client-1');
      
      expect(results['cleo']).toHaveLength(1);
      expect(results['practice-panther']).toHaveLength(1);
      expect(mockCleoAdapter.getMatters).toHaveBeenCalledWith('client-1', { search: 'test', limit: 20 });
      expect(mockPracticePantherAdapter.getMatters).toHaveBeenCalledWith('client-1', { search: 'test', limit: 20 });
    });
  });

  describe('Platform Health', () => {
    beforeEach(async () => {
      await service.configurePlatform(sampleConfig);
    });

    it('should return platform health status', async () => {
      const health = await service.getPlatformHealth();
      
      expect(health['cleo'].connected).toBe(true);
      expect(health['cleo'].lastSync).toBeInstanceOf(Date);
    });

    it('should handle connection failures in health check', async () => {
      mockCleoAdapter.validateConnection = jest.fn().mockRejectedValue(new Error('Connection failed'));

      const health = await service.getPlatformHealth();
      
      expect(health['cleo'].connected).toBe(false);
      expect(health['cleo'].error).toBe('Connection failed');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unconfigured platform', async () => {
      await expect(service.createTimeEntry('cleo', sampleTimeEntry))
        .rejects
        .toThrow(PracticeManagementError);
    });

    it('should throw error for unknown platform', async () => {
      await expect(service.createTimeEntry('unknown', sampleTimeEntry))
        .rejects
        .toThrow(PracticeManagementError);
    });
  });

  describe('Billing Operations', () => {
    beforeEach(async () => {
      await service.configurePlatform(sampleConfig);
    });

    it('should create billing entries', async () => {
      const billingEntries = [{ 
        timeEntry: sampleTimeEntry, 
        billableAmount: 625,
        invoiceId: 'inv-1'
      }];

      const results = await service.createBillingEntries(billingEntries);
      
      expect(results['cleo'].success).toBe(true);
      expect(mockCleoAdapter.syncTimeEntries).toHaveBeenCalledWith([sampleTimeEntry]);
    });
  });
});
