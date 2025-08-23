import {
  PracticeManagementAdapter,
  PracticeManagementConfig,
  TimeEntry,
  Client,
  Matter,
  User,
  ApiResponse,
  SyncResult,
  BillingEntry,
  TimeEntryFilters,
  ClientFilters,
  MatterFilters,
  PracticeManagementError
} from '../types/practiceManagement';
import { CleoAdapter } from '../adapters/CleoAdapter';
import { PracticePantherAdapter } from '../adapters/PracticePantherAdapter';
import { MyCaseAdapter } from '../adapters/MyCaseAdapter';
import { logger } from '../utils/logger';

/**
 * Practice Management Service
 * 
 * Manages multiple practice management platform integrations
 * Provides a unified interface for all practice management operations
 */
export class PracticeManagementService {
  private adapters: Map<string, PracticeManagementAdapter> = new Map();
  private configurations: Map<string, PracticeManagementConfig> = new Map();

  constructor() {
    // Register all available adapters
    this.registerAdapter('cleo', new CleoAdapter());
    this.registerAdapter('practice-panther', new PracticePantherAdapter());
    this.registerAdapter('mycase', new MyCaseAdapter());
  }

  /**
   * Register a practice management adapter
   */
  private registerAdapter(platform: string, adapter: PracticeManagementAdapter): void {
    this.adapters.set(platform, adapter);
    logger.info(`Registered practice management adapter: ${platform}`);
  }

  /**
   * Configure a practice management platform
   */
  async configurePlatform(config: PracticeManagementConfig): Promise<void> {
    const adapter = this.adapters.get(config.platform);
    if (!adapter) {
      throw new PracticeManagementError(
        `Unknown practice management platform: ${config.platform}`,
        'PLATFORM_NOT_FOUND',
        config.platform
      );
    }

    await adapter.configure(config);
    this.configurations.set(config.platform, config);
    
    logger.info(`Configured practice management platform: ${config.platform}`);
  }

  /**
   * Get configured platforms
   */
  getConfiguredPlatforms(): string[] {
    return Array.from(this.configurations.keys());
  }

  /**
   * Get adapter for a specific platform
   */
  private getAdapter(platform: string): PracticeManagementAdapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new PracticeManagementError(
        `Unknown practice management platform: ${platform}`,
        'PLATFORM_NOT_FOUND',
        platform
      );
    }

    if (!this.configurations.has(platform)) {
      throw new PracticeManagementError(
        `Platform not configured: ${platform}`,
        'PLATFORM_NOT_CONFIGURED',
        platform
      );
    }

    return adapter;
  }

  /**
   * Validate connection to a platform
   */
  async validateConnection(platform: string): Promise<boolean> {
    try {
      const adapter = this.getAdapter(platform);
      return await adapter.validateConnection();
    } catch (error) {
      logger.error(`Failed to validate connection to ${platform}`, error);
      return false;
    }
  }

  /**
   * Validate connections to all configured platforms
   */
  async validateAllConnections(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const platform of this.getConfiguredPlatforms()) {
      results[platform] = await this.validateConnection(platform);
    }

    return results;
  }

  // Time Entry Operations
  async createTimeEntry(platform: string, entry: TimeEntry): Promise<ApiResponse<TimeEntry>> {
    const adapter = this.getAdapter(platform);
    return adapter.createTimeEntry(entry);
  }

  async updateTimeEntry(platform: string, id: string, entry: Partial<TimeEntry>): Promise<ApiResponse<TimeEntry>> {
    const adapter = this.getAdapter(platform);
    return adapter.updateTimeEntry(id, entry);
  }

  async deleteTimeEntry(platform: string, id: string): Promise<ApiResponse<void>> {
    const adapter = this.getAdapter(platform);
    return adapter.deleteTimeEntry(id);
  }

  async getTimeEntries(platform: string, filters?: TimeEntryFilters): Promise<ApiResponse<TimeEntry[]>> {
    const adapter = this.getAdapter(platform);
    return adapter.getTimeEntries(filters);
  }

  // Client Operations
  async getClients(platform: string, filters?: ClientFilters): Promise<ApiResponse<Client[]>> {
    const adapter = this.getAdapter(platform);
    return adapter.getClients(filters);
  }

  async getClient(platform: string, id: string): Promise<ApiResponse<Client>> {
    const adapter = this.getAdapter(platform);
    return adapter.getClient(id);
  }

  async createClient(platform: string, client: Omit<Client, 'id'>): Promise<ApiResponse<Client>> {
    const adapter = this.getAdapter(platform);
    return adapter.createClient(client);
  }

  // Matter Operations
  async getMatters(platform: string, clientId?: string, filters?: MatterFilters): Promise<ApiResponse<Matter[]>> {
    const adapter = this.getAdapter(platform);
    return adapter.getMatters(clientId, filters);
  }

  async getMatter(platform: string, id: string): Promise<ApiResponse<Matter>> {
    const adapter = this.getAdapter(platform);
    return adapter.getMatter(id);
  }

  async createMatter(platform: string, matter: Omit<Matter, 'id'>): Promise<ApiResponse<Matter>> {
    const adapter = this.getAdapter(platform);
    return adapter.createMatter(matter);
  }

  // User Operations
  async getUsers(platform: string): Promise<ApiResponse<User[]>> {
    const adapter = this.getAdapter(platform);
    return adapter.getUsers();
  }

  async getCurrentUser(platform: string): Promise<ApiResponse<User>> {
    const adapter = this.getAdapter(platform);
    return adapter.getCurrentUser();
  }

  // Bulk Operations
  async bulkCreateTimeEntries(platform: string, entries: TimeEntry[]): Promise<ApiResponse<TimeEntry[]>> {
    const adapter = this.getAdapter(platform);
    return adapter.bulkCreateTimeEntries(entries);
  }

  async syncTimeEntries(platform: string, entries: TimeEntry[]): Promise<ApiResponse<{ created: number; updated: number; errors: any[] }>> {
    const adapter = this.getAdapter(platform);
    return adapter.syncTimeEntries(entries);
  }

  // Multi-platform Operations
  async syncToAllPlatforms(entries: TimeEntry[]): Promise<Record<string, SyncResult>> {
    const results: Record<string, SyncResult> = {};
    
    for (const platform of this.getConfiguredPlatforms()) {
      try {
        const syncResponse = await this.syncTimeEntries(platform, entries);
        
        if (syncResponse.success && syncResponse.data) {
          results[platform] = {
            success: true,
            processed: entries.length,
            created: syncResponse.data.created,
            updated: syncResponse.data.updated,
            errors: syncResponse.data.errors,
            summary: this.calculateSyncSummary(entries)
          };
        } else {
          results[platform] = {
            success: false,
            processed: 0,
            created: 0,
            updated: 0,
            errors: [{ entry: entries[0], error: syncResponse.error || 'Unknown error' }],
            summary: { totalTime: 0, billableTime: 0, clients: [], matters: [] }
          };
        }
      } catch (error) {
        logger.error(`Failed to sync to ${platform}`, error);
        results[platform] = {
          success: false,
          processed: 0,
          created: 0,
          updated: 0,
          errors: [{ entry: entries[0], error: error instanceof Error ? error.message : 'Unknown error' }],
          summary: { totalTime: 0, billableTime: 0, clients: [], matters: [] }
        };
      }
    }

    return results;
  }

  /**
   * Create billing entries across all platforms
   */
  async createBillingEntries(entries: BillingEntry[]): Promise<Record<string, SyncResult>> {
    const timeEntries = entries.map(entry => entry.timeEntry);
    return this.syncToAllPlatforms(timeEntries);
  }

  /**
   * Search clients across all platforms
   */
  async searchClientsAcrossPlatforms(search: string): Promise<Record<string, Client[]>> {
    const results: Record<string, Client[]> = {};
    
    for (const platform of this.getConfiguredPlatforms()) {
      try {
        const response = await this.getClients(platform, { search, limit: 20 });
        results[platform] = response.success && response.data ? response.data : [];
      } catch (error) {
        logger.error(`Failed to search clients on ${platform}`, error);
        results[platform] = [];
      }
    }

    return results;
  }

  /**
   * Search matters across all platforms
   */
  async searchMattersAcrossPlatforms(search: string, clientId?: string): Promise<Record<string, Matter[]>> {
    const results: Record<string, Matter[]> = {};
    
    for (const platform of this.getConfiguredPlatforms()) {
      try {
        const response = await this.getMatters(platform, clientId, { search, limit: 20 });
        results[platform] = response.success && response.data ? response.data : [];
      } catch (error) {
        logger.error(`Failed to search matters on ${platform}`, error);
        results[platform] = [];
      }
    }

    return results;
  }

  /**
   * Get platform health status
   */
  async getPlatformHealth(): Promise<Record<string, { connected: boolean; lastSync?: Date; error?: string }>> {
    const health: Record<string, { connected: boolean; lastSync?: Date; error?: string }> = {};
    
    for (const platform of this.getConfiguredPlatforms()) {
      try {
        const connected = await this.validateConnection(platform);
        health[platform] = { 
          connected,
          lastSync: new Date() // In a real implementation, this would be stored
        };
      } catch (error) {
        health[platform] = { 
          connected: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return health;
  }

  /**
   * Calculate sync summary statistics
   */
  private calculateSyncSummary(entries: TimeEntry[]): SyncResult['summary'] {
    const totalTime = entries.reduce((sum, entry) => sum + entry.hours, 0);
    const billableTime = entries.filter(entry => entry.billable).reduce((sum, entry) => sum + entry.hours, 0);
    const clients = Array.from(new Set(entries.map(entry => entry.clientId).filter((id): id is string => Boolean(id))));
    const matters = Array.from(new Set(entries.map(entry => entry.matterId).filter((id): id is string => Boolean(id))));

    return {
      totalTime,
      billableTime,
      clients,
      matters
    };
  }

  /**
   * Get available platforms
   */
  getAvailablePlatforms(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Remove platform configuration
   */
  removePlatformConfiguration(platform: string): void {
    this.configurations.delete(platform);
    logger.info(`Removed configuration for platform: ${platform}`);
  }

  /**
   * Get platform configuration (without sensitive data)
   */
  getPlatformConfiguration(platform: string): Partial<PracticeManagementConfig> | null {
    const config = this.configurations.get(platform);
    if (!config) {
      return null;
    }

    // Return configuration without sensitive data
    return {
      platform: config.platform,
      subdomain: config.subdomain,
      baseUrl: config.baseUrl,
      userId: config.userId,
      metadata: config.metadata
    };
  }
}

// Singleton instance
export const practiceManagementService = new PracticeManagementService();
