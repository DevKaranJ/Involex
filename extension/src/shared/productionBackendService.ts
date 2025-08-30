// Backend Integration Service
// Coordinates all backend connections and handles service orchestration

import { ApiClient } from './apiClient';
import { StorageManager } from './storage';
import { config, debugLog, performanceLog } from './config';
import { BillingEntry, EmailData, UserSettings } from './types';

export interface ServiceHealth {
  api: boolean;
  ai: boolean;
  overall: boolean;
  lastChecked: string;
  latency?: number;
  error?: string;
}

class BackendIntegrationService {
  private apiClient: ApiClient;
  private storageManager: StorageManager;
  private serviceHealth: ServiceHealth;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    this.apiClient = new ApiClient();
    this.storageManager = new StorageManager();
    this.serviceHealth = this.initializeHealthStatus();
    
    this.initializeService();
  }

  private initializeHealthStatus(): ServiceHealth {
    return {
      api: false,
      ai: false,
      overall: false,
      lastChecked: new Date().toISOString()
    };
  }

  private async initializeService(): Promise<void> {
    debugLog('Initializing Backend Integration Service');
    
    // Perform initial health check
    await this.checkServiceHealth();
    
    // Set up periodic health checks (every 5 minutes)
    this.setupHealthMonitoring();
    
    debugLog('Backend Integration Service initialized successfully');
  }

  private setupHealthMonitoring(): void {
    // Clear existing interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Set up new interval
    this.healthCheckInterval = setInterval(async () => {
      await this.checkServiceHealth();
    }, 5 * 60 * 1000); // 5 minutes
  }

  // Health Management
  async checkServiceHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      debugLog('Checking service health...');
      
      // Test API connection
      const connectionTest = await this.apiClient.testConnection();
      this.serviceHealth.api = connectionTest.success;
      this.serviceHealth.latency = connectionTest.latency;
      this.serviceHealth.error = connectionTest.error;
      
      // Test AI service if API is healthy
      if (this.serviceHealth.api && config.isFeatureEnabled('enableAI')) {
        const aiHealth = await this.apiClient.checkAIServiceHealth();
        this.serviceHealth.ai = aiHealth.success;
      } else {
        this.serviceHealth.ai = false;
      }
      
      // Overall health
      this.serviceHealth.overall = this.serviceHealth.api;
      this.serviceHealth.lastChecked = new Date().toISOString();
      
      performanceLog('Health Check', startTime);
      
      return this.serviceHealth;
      
    } catch (error) {
      debugLog('Health check failed:', error);
      
      this.serviceHealth = {
        ...this.initializeHealthStatus(),
        lastChecked: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      return this.serviceHealth;
    }
  }

  getServiceHealth(): ServiceHealth {
    return { ...this.serviceHealth };
  }

  isHealthy(): boolean {
    return this.serviceHealth.overall;
  }

  // Email Analysis Integration
  async analyzeEmailWithBackend(emailData: EmailData): Promise<any> {
    if (!config.isFeatureEnabled('enableAI')) {
      throw new Error('AI analysis is disabled in current environment');
    }

    if (!this.serviceHealth.api) {
      throw new Error('Backend API is not available');
    }

    const startTime = Date.now();
    
    try {
      debugLog('Analyzing email with backend AI service');
      
      const response = await this.apiClient.analyzeEmail(emailData);
      
      if (response.success) {
        performanceLog('Email Analysis with Backend', startTime);
        return response.data;
      } else {
        throw new Error(response.error || 'Email analysis failed');
      }
      
    } catch (error) {
      debugLog('Backend email analysis failed:', error);
      throw error;
    }
  }

  async bulkAnalyzeEmails(emails: EmailData[]): Promise<any[]> {
    if (!config.isFeatureEnabled('enableAI')) {
      throw new Error('AI analysis is disabled in current environment');
    }

    if (!this.serviceHealth.api) {
      throw new Error('Backend API is not available');
    }

    const startTime = Date.now();
    
    try {
      debugLog(`Bulk analyzing ${emails.length} emails`);
      
      const response = await this.apiClient.bulkAnalyzeEmails(emails);
      
      if (response.success && response.data) {
        performanceLog('Bulk Email Analysis', startTime);
        return response.data;
      } else {
        throw new Error(response.error || 'Bulk analysis failed');
      }
      
    } catch (error) {
      debugLog('Bulk analysis failed:', error);
      throw error;
    }
  }

  // Billing Entry Synchronization
  async syncBillingEntry(entry: BillingEntry): Promise<void> {
    if (!config.isFeatureEnabled('enableSync')) {
      debugLog('Sync is disabled, storing locally only');
      return;
    }

    if (!this.serviceHealth.api) {
      throw new Error('Backend API is not available for sync');
    }

    const startTime = Date.now();
    
    try {
      debugLog('Syncing billing entry:', entry.id);
      
      const response = await this.apiClient.syncBillingEntry(entry);
      
      if (response.success) {
        // Update local entry
        await this.storageManager.updateBillingEntry(entry.id, entry);
        performanceLog('Billing Entry Sync', startTime);
      } else {
        throw new Error(response.error || 'Sync failed');
      }
      
    } catch (error) {
      debugLog('Billing entry sync failed:', error);
      throw error;
    }
  }

  // Practice Management Integration
  async connectPracticeManagement(platform: string, credentials: any): Promise<void> {
    if (!this.serviceHealth.api) {
      throw new Error('Backend API is not available');
    }

    const startTime = Date.now();
    
    try {
      debugLog(`Connecting to practice management platform: ${platform}`);
      
      const response = await this.apiClient.connectPracticeManagement(platform, credentials);
      
      if (response.success) {
        // Update user settings with connection status
        const currentSettings = await this.storageManager.getUserSettings();
        await this.storageManager.updateUserSettings({
          ...currentSettings,
          practiceManagement: {
            platform: platform as any,
            credentials,
            lastSync: new Date().toISOString()
          }
        });
        
        performanceLog('Practice Management Connection', startTime);
      } else {
        throw new Error(response.error || 'Connection failed');
      }
      
    } catch (error) {
      debugLog('Practice management connection failed:', error);
      throw error;
    }
  }

  // Configuration Management
  async updateBackendUrl(url: string): Promise<void> {
    try {
      // Validate URL
      new URL(url);
      
      // Update configuration
      config.setCustomApiUrl(url);
      this.apiClient.setBaseUrl(url);
      
      // Test new connection
      await this.checkServiceHealth();
      
      debugLog(`Backend URL updated to: ${url}`);
    } catch (error) {
      throw new Error('Invalid backend URL provided');
    }
  }

  // Development helpers
  async testBackendConnection(): Promise<{ success: boolean; details: any }> {
    try {
      const healthCheck = await this.checkServiceHealth();
      const apiTest = await this.apiClient.testConnection();
      
      return {
        success: healthCheck.overall,
        details: {
          health: healthCheck,
          connection: apiTest,
          config: config.getConfigSummary()
        }
      };
    } catch (error) {
      return {
        success: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  // Cleanup
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    debugLog('Backend Integration Service destroyed');
  }
}

// Singleton instance
export const backendService = new BackendIntegrationService();

// Export for use in other components
export { BackendIntegrationService };
