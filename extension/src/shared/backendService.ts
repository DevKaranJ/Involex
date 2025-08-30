// Backend Integration Service
// Coordinates all backend connections and handles service orchestration

import { ApiClient } from './apiClient';
import { StorageManager } from './storage';
import { config, debugLog, performanceLog } from './config';
import { BillingEntry, EmailData, UserSettings } from './types';

export interface ServiceHealth {
  api: boolean;
  ai: boolean;
  sync: boolean;
  overall: boolean;
  lastChecked: string;
  latency?: number;
}

export interface SyncStatus {
  isRunning: boolean;
  lastSync: string;
  nextSync?: string;
  itemsInQueue: number;
  errors: string[];
}

class BackendIntegrationService {
  private apiClient: ApiClient;
  private storageManager: StorageManager;
  private serviceHealth: ServiceHealth;
  private syncInProgress: boolean = false;
  private healthCheckInterval?: NodeJS.Timeout;
  private syncQueueInterval?: NodeJS.Timeout;

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
      sync: false,
      overall: false,
      lastChecked: new Date().toISOString()
    };
  }

  private async initializeService(): Promise<void> {
    debugLog('Initializing Backend Integration Service');
    
    // Perform initial health check
    await this.checkServiceHealth();
    
    // Set up periodic health checks (every 5 minutes)
    if (config.isFeatureEnabled('enableSync')) {
      this.setupHealthMonitoring();
      this.setupSyncQueue();
    }
    
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

  private setupSyncQueue(): void {
    // Clear existing interval
    if (this.syncQueueInterval) {
      clearInterval(this.syncQueueInterval);
    }

    // Process sync queue every 30 seconds
    this.syncQueueInterval = setInterval(async () => {
      await this.processSyncQueue();
    }, 30 * 1000);
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
      
      // Test AI service if API is healthy
      if (this.serviceHealth.api && config.isFeatureEnabled('enableAI')) {
        const aiHealth = await this.apiClient.checkAIServiceHealth();
        this.serviceHealth.ai = aiHealth.success;
      }
      
      // Test sync service if API is healthy
      if (this.serviceHealth.api && config.isFeatureEnabled('enableSync')) {
        const syncStatus = await this.apiClient.getSyncStatus();
        this.serviceHealth.sync = syncStatus.success;
      }
      
      // Overall health
      this.serviceHealth.overall = this.serviceHealth.api && 
        (!config.isFeatureEnabled('enableAI') || this.serviceHealth.ai) &&
        (!config.isFeatureEnabled('enableSync') || this.serviceHealth.sync);
      
      this.serviceHealth.lastChecked = new Date().toISOString();
      
      performanceLog('Health Check', startTime);
      
      return this.serviceHealth;
      
    } catch (error) {
      debugLog('Health check failed:', error);
      
      this.serviceHealth = {
        ...this.initializeHealthStatus(),
        lastChecked: new Date().toISOString()
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

    if (!this.serviceHealth.ai && !this.serviceHealth.api) {
      throw new Error('AI service is not available');
    }

    const startTime = Date.now();
    
    try {
      debugLog('Analyzing email with backend AI service');
      
      const response = await this.apiClient.analyzeEmail(emailData);
      
      if (response.success) {
        // Store analysis result locally for caching
        await this.cacheAnalysisResult(emailData, response.data);
        performanceLog('Email Analysis with Backend', startTime);
        return response.data;
      } else {
        throw new Error(response.error || 'Email analysis failed');
      }
      
    } catch (error) {
      debugLog('Backend email analysis failed, checking for cached result');
      
      // Try to get cached result as fallback
      const cachedResult = await this.getCachedAnalysisResult(emailData);
      if (cachedResult) {
        debugLog('Using cached analysis result');
        return cachedResult;
      }
      
      throw error;
    }
  }

  async bulkAnalyzeEmails(emails: EmailData[]): Promise<any[]> {
    if (!config.isFeatureEnabled('enableAI')) {
      throw new Error('AI analysis is disabled in current environment');
    }

    const startTime = Date.now();
    
    try {
      debugLog(`Bulk analyzing ${emails.length} emails`);
      
      const response = await this.apiClient.bulkAnalyzeEmails(emails);
      
      if (response.success && response.data) {
        // Cache all results
        for (let i = 0; i < emails.length; i++) {
          if (response.data[i]) {
            await this.cacheAnalysisResult(emails[i], response.data[i]);
          }
        }
        
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

    const startTime = Date.now();
    
    try {
      debugLog('Syncing billing entry:', entry.id);
      
      const response = await this.apiClient.syncBillingEntry(entry);
      
      if (response.success) {
        // Update local entry with sync status
        await this.storageManager.updateBillingEntry(entry.id, {
          ...entry,
          lastModified: new Date().toISOString()
        });
        
        performanceLog('Billing Entry Sync', startTime);
      } else {
        throw new Error(response.error || 'Sync failed');
      }
      
    } catch (error) {
      debugLog('Billing entry sync failed:', error);
      
      // Add to sync queue for retry
      await this.addToSyncQueue(entry);
      throw error;
    }
  }

  async addToSyncQueue(entry: BillingEntry): Promise<void> {
    const syncQueue = await this.storageManager.getSyncQueue();
    
    // Avoid duplicates
    const existingIndex = syncQueue.findIndex(item => item.id === entry.id);
    if (existingIndex !== -1) {
      syncQueue[existingIndex] = { ...entry, queuedAt: new Date().toISOString() };
    } else {
      syncQueue.push({ ...entry, queuedAt: new Date().toISOString() });
    }
    
    await this.storageManager.setSyncQueue(syncQueue);
    debugLog(`Added entry ${entry.id} to sync queue`);
  }

  async processSyncQueue(): Promise<void> {
    if (this.syncInProgress || !this.serviceHealth.api) {
      return;
    }

    this.syncInProgress = true;
    
    try {
      const syncQueue = await this.storageManager.getSyncQueue();
      
      if (syncQueue.length === 0) {
        return;
      }

      debugLog(`Processing sync queue: ${syncQueue.length} items`);
      
      // Process items in batches of 5
      const batchSize = 5;
      const processedItems: string[] = [];
      
      for (let i = 0; i < syncQueue.length; i += batchSize) {
        const batch = syncQueue.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (entry) => {
          try {
            await this.syncBillingEntry(entry);
            processedItems.push(entry.id);
            return true;
          } catch (error) {
            debugLog(`Failed to sync entry ${entry.id}:`, error);
            return false;
          }
        });
        
        await Promise.allSettled(batchPromises);
        
        // Small delay between batches
        if (i + batchSize < syncQueue.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Remove successfully processed items from queue
      if (processedItems.length > 0) {
        const updatedQueue = syncQueue.filter(item => !processedItems.includes(item.id));
        await this.storageManager.setSyncQueue(updatedQueue);
        debugLog(`Processed ${processedItems.length} items from sync queue`);
      }
      
    } catch (error) {
      debugLog('Sync queue processing error:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  async getSyncStatus(): Promise<SyncStatus> {
    const syncQueue = await this.storageManager.getSyncQueue();
    const syncHistory = await this.storageManager.getSyncHistory();
    
    const lastSync = syncHistory.length > 0 ? 
      syncHistory[syncHistory.length - 1].timestamp : 
      'Never';
    
    return {
      isRunning: this.syncInProgress,
      lastSync,
      itemsInQueue: syncQueue.length,
      errors: syncHistory.filter(h => h.status === 'error').slice(-5).map(h => h.error || 'Unknown error')
    };
  }

  // Practice Management Integration
  async connectPracticeManagement(platform: string, credentials: any): Promise<void> {
    const startTime = Date.now();
    
    try {
      debugLog(`Connecting to practice management platform: ${platform}`);
      
      const response = await this.apiClient.connectPracticeManagement(platform, credentials);
      
      if (response.success) {
        // Update user settings with connection status
        const currentSettings = await this.storageManager.getUserSettings();
        await this.storageManager.updateUserSettings({
          practiceManagement: {
            platform: platform as 'cleo' | 'practice_panther' | 'mycase',
            credentials: credentials,
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

  // Cache Management
  private async cacheAnalysisResult(emailData: EmailData, result: any): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(emailData);
      const cacheData = {
        result,
        timestamp: new Date().toISOString(),
        emailHash: cacheKey
      };
      
      await this.storageManager.setAnalysisCache(cacheKey, cacheData);
    } catch (error) {
      debugLog('Failed to cache analysis result:', error);
    }
  }

  private async getCachedAnalysisResult(emailData: EmailData): Promise<any | null> {
    try {
      const cacheKey = this.generateCacheKey(emailData);
      const cachedData = await this.storageManager.getAnalysisCache(cacheKey);
      
      if (cachedData && this.isCacheValid(cachedData.timestamp)) {
        return cachedData.result;
      }
      
      return null;
    } catch (error) {
      debugLog('Failed to get cached analysis result:', error);
      return null;
    }
  }

  private generateCacheKey(emailData: EmailData): string {
    // Create a simple hash of the email content for caching
    const content = `${emailData.subject}${emailData.content}${emailData.sender}`;
    return btoa(content).slice(0, 32);
  }

  private isCacheValid(timestamp: string): boolean {
    const cacheAge = Date.now() - new Date(timestamp).getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    return cacheAge < maxAge;
  }

  // Cleanup
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.syncQueueInterval) {
      clearInterval(this.syncQueueInterval);
    }
    
    debugLog('Backend Integration Service destroyed');
  }
}

// Singleton instance
export const backendService = new BackendIntegrationService();

// Export for use in other components
export { BackendIntegrationService };
