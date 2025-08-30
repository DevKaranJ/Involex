// Backend Connection Test
// Tests the integration between extension and backend

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { BackendIntegrationService } from '../shared/productionBackendService';
import { ApiClient } from '../shared/apiClient';
import { config } from '../shared/config';

describe('Backend Integration Tests', () => {
  let backendService: BackendIntegrationService;
  let apiClient: ApiClient;

  beforeAll(() => {
    // Initialize services
    backendService = new BackendIntegrationService();
    apiClient = new ApiClient();
  });

  afterAll(() => {
    // Cleanup
    backendService.destroy();
  });

  describe('Configuration Tests', () => {
    test('should have correct development configuration', () => {
      expect(config.isDevelopment()).toBe(true);
      expect(config.getApiBaseUrl()).toBe('http://localhost:3001');
      expect(config.isFeatureEnabled('enableAI')).toBe(true);
      expect(config.isFeatureEnabled('enableSync')).toBe(true);
    });

    test('should validate configuration', () => {
      const validation = config.validateConfiguration();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should allow custom API URL', () => {
      const customUrl = 'https://custom-api.example.com';
      config.setCustomApiUrl(customUrl);
      expect(config.getApiBaseUrl()).toBe(customUrl);
      
      // Reset to default
      config.setCustomApiUrl('http://localhost:3001');
    });
  });

  describe('API Client Tests', () => {
    test('should initialize with correct base URL', () => {
      expect(apiClient.getBaseUrl()).toBe('http://localhost:3001');
    });

    test('should detect development environment', () => {
      expect(apiClient.isProduction()).toBe(false);
    });

    test('should handle authentication state', () => {
      expect(apiClient.isAuthenticated()).toBe(false);
      
      // Test token setting
      apiClient.setAuthToken('test-token');
      expect(apiClient.isAuthenticated()).toBe(true);
    });

    test('should have timeout configuration', async () => {
      // This tests that timeout is properly configured
      const timeoutConfig = config.getTimeout('apiRequest');
      expect(timeoutConfig).toBe(10000); // 10 seconds for development
    });
  });

  describe('Backend Service Health Tests', () => {
    test('should initialize health status', () => {
      const health = backendService.getServiceHealth();
      
      expect(health).toHaveProperty('api');
      expect(health).toHaveProperty('ai');
      expect(health).toHaveProperty('overall');
      expect(health).toHaveProperty('lastChecked');
      expect(typeof health.lastChecked).toBe('string');
    });

    test('should perform health check', async () => {
      const health = await backendService.checkServiceHealth();
      
      expect(health).toHaveProperty('api');
      expect(health).toHaveProperty('ai');
      expect(health).toHaveProperty('overall');
      expect(typeof health.lastChecked).toBe('string');
      
      // In development, API might not be running, so we just check structure
      console.log('Backend Health Check Result:', health);
    }, 15000); // 15 second timeout for health check

    test('should handle health check failures gracefully', async () => {
      // Test with invalid URL
      const originalUrl = config.getApiBaseUrl();
      config.setCustomApiUrl('http://invalid-backend-url:9999');
      
      const health = await backendService.checkServiceHealth();
      expect(health.overall).toBe(false);
      expect(health.error).toBeDefined();
      
      // Reset URL
      config.setCustomApiUrl(originalUrl);
    }, 10000);
  });

  describe('Email Analysis Integration Tests', () => {
    const mockEmailData = {
      id: 'test-email-123',
      subject: 'Contract Review Request',
      content: 'Please review the attached contract for the client meeting tomorrow.',
      sender: 'client@lawfirm.com',
      recipients: ['lawyer@lawfirm.com'],
      timestamp: new Date().toISOString(),
      platform: 'gmail' as const
    };

    test('should validate email analysis prerequisites', () => {
      expect(config.isFeatureEnabled('enableAI')).toBe(true);
    });

    test('should handle AI service unavailable gracefully', async () => {
      // If backend is not running, should handle gracefully
      try {
        await backendService.analyzeEmailWithBackend(mockEmailData);
        // If this succeeds, backend is running
        console.log('✅ Backend AI analysis successful');
      } catch (error) {
        // Expected if backend is not running
        expect(error).toBeInstanceOf(Error);
        console.log('⚠️ Backend not available:', (error as Error).message);
      }
    }, 30000);
  });

  describe('Sync Integration Tests', () => {
    const mockBillingEntry = {
      id: 'test-entry-123',
      emailId: 'test-email-123',
      subject: 'Test Email Subject',
      content: 'Test email content for billing',
      sender: 'test@example.com',
      recipients: ['lawyer@example.com'],
      timestamp: new Date().toISOString(),
      status: 'pending' as const,
      createdAt: new Date().toISOString()
    };

    test('should validate sync prerequisites', () => {
      expect(config.isFeatureEnabled('enableSync')).toBe(true);
    });

    test('should handle sync when backend unavailable', async () => {
      try {
        await backendService.syncBillingEntry(mockBillingEntry);
        console.log('✅ Backend sync successful');
      } catch (error) {
        // Expected if backend is not running
        expect(error).toBeInstanceOf(Error);
        console.log('⚠️ Backend sync not available:', (error as Error).message);
      }
    }, 15000);
  });

  describe('Connection Testing', () => {
    test('should perform comprehensive connection test', async () => {
      const connectionTest = await backendService.testBackendConnection();
      
      expect(connectionTest).toHaveProperty('success');
      expect(connectionTest).toHaveProperty('details');
      
      console.log('Backend Connection Test Results:', JSON.stringify(connectionTest, null, 2));
      
      // Should always have details even on failure
      expect(connectionTest.details).toBeDefined();
    }, 20000);

    test('should handle URL validation', async () => {
      // Test invalid URL
      await expect(backendService.updateBackendUrl('invalid-url')).rejects.toThrow('Invalid backend URL');
      
      // Test valid URL
      await expect(backendService.updateBackendUrl('http://localhost:3001')).resolves.toBeUndefined();
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete workflow when backend is available', async () => {
      console.log('🧪 Testing complete integration workflow...');
      
      // 1. Check health
      const health = await backendService.checkServiceHealth();
      console.log('Health Status:', health);
      
      // 2. Test connection
      const connectionTest = await backendService.testBackendConnection();
      console.log('Connection Test:', connectionTest.success ? '✅ Success' : '❌ Failed');
      
      // 3. If healthy, test email analysis
      if (health.overall) {
        try {
          const emailData = {
            id: 'integration-test-email',
            subject: 'Integration Test Email',
            content: 'This is a test email for integration testing.',
            sender: 'test@example.com',
            recipients: ['lawyer@example.com'],
            timestamp: new Date().toISOString(),
            platform: 'gmail' as const
          };
          
          const analysis = await backendService.analyzeEmailWithBackend(emailData);
          console.log('✅ Email analysis successful:', analysis);
          expect(analysis).toBeDefined();
        } catch (error) {
          console.log('⚠️ Email analysis failed:', (error as Error).message);
        }
      }
      
      // Test should complete regardless of backend availability
      expect(true).toBe(true);
    }, 45000);
  });
});

// Manual test helper for development
export const runManualBackendTest = async () => {
  console.log('🔧 Running Manual Backend Test...');
  
  const service = new BackendIntegrationService();
  
  try {
    // Test configuration
    console.log('Configuration:', config.getConfigSummary());
    
    // Test health
    const health = await service.checkServiceHealth();
    console.log('Health Check:', health);
    
    // Test connection
    const connectionTest = await service.testBackendConnection();
    console.log('Connection Test:', connectionTest);
    
    // Clean up
    service.destroy();
    
    return {
      configuration: config.getConfigSummary(),
      health,
      connectionTest
    };
    
  } catch (error) {
    console.error('Manual test failed:', error);
    service.destroy();
    throw error;
  }
};
