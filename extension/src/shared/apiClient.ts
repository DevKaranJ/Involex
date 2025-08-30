// API Client for Involex Extension
// Handles communication with backend services

import { BillingEntry, UserSettings, ApiResponse } from './types';
import { StorageManager } from './storage';
import { config, debugLog, performanceLog } from './config';

export class ApiClient {
  private baseUrl: string;
  private authToken?: string;
  private storageManager: StorageManager;
  private isOnline: boolean = true;
  private retryCount: number = 0;
  private maxRetries: number;
  private retryConfig = config.getRetryConfig();

  constructor(baseUrl?: string) {
    // Use configuration-based URL with optional override
    this.baseUrl = baseUrl || config.getApiBaseUrl();
    this.maxRetries = this.retryConfig.maxRetries;
    this.storageManager = new StorageManager();
    this.initializeAuth();
    this.setupNetworkMonitoring();
    
    debugLog('ApiClient initialized with base URL:', this.baseUrl);
  }

  private async initializeAuth(): Promise<void> {
    const settings = await this.storageManager.getUserSettings();
    if (settings.apiToken) {
      this.authToken = settings.apiToken;
    }
  }

  private setupNetworkMonitoring(): void {
    // Monitor online/offline status
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        console.log('🌐 Connection restored');
      });
      
      window.addEventListener('offline', () => {
        this.isOnline = false;
        console.log('📡 Connection lost');
      });
    }
  }

  private async waitForConnection(): Promise<void> {
    if (!this.isOnline) {
      throw new Error('No internet connection available');
    }
  }

  setAuthToken(token: string): void {
    this.authToken = token;
  }

  isAuthenticated(): boolean {
    return !!this.authToken;
  }

  // Authentication endpoints
  async authenticate(credentials: any): Promise<ApiResponse<{ token: string; user: any }>> {
    try {
      const response = await this.makeRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
      });

      if (response.success && response.data.token) {
        this.authToken = response.data.token;
        await this.storageManager.updateUserSettings({
          isAuthenticated: true,
          apiToken: response.data.token,
          userId: response.data.user.id
        });
      }

      return response;
    } catch (error) {
      console.error('❌ Authentication failed:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }

  async refreshToken(): Promise<ApiResponse<{ token: string }>> {
    try {
      const response = await this.makeRequest('/auth/refresh', {
        method: 'POST'
      });

      if (response.success && response.data.token) {
        this.authToken = response.data.token;
        await this.storageManager.updateUserSettings({
          apiToken: response.data.token
        });
      }

      return response;
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      return { success: false, error: 'Token refresh failed' };
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.authToken) {
        await this.makeRequest('/auth/logout', { method: 'POST' });
      }
    } catch (error) {
      console.warn('⚠️ Logout request failed:', error);
    } finally {
      this.authToken = undefined;
      await this.storageManager.updateUserSettings({
        isAuthenticated: false,
        apiToken: undefined,
        userId: undefined
      });
    }
  }

  // Email analysis endpoints (matching backend routes)
  async analyzeEmail(emailData: any): Promise<ApiResponse<any>> {
    const startTime = Date.now();
    await this.waitForConnection();
    
    debugLog('Analyzing email with backend AI service');
    
    const response = await this.makeRequest('/api/analysis/email', {
      method: 'POST',
      body: JSON.stringify({ emailData })
    });

    performanceLog('Email Analysis', startTime);
    return response;
  }

  async bulkAnalyzeEmails(emailDataArray: any[]): Promise<ApiResponse<any[]>> {
    await this.waitForConnection();
    
    console.log(`🔍 Bulk analyzing ${emailDataArray.length} emails`);
    
    return this.makeRequest('/api/analysis/batch', {
      method: 'POST',
      body: JSON.stringify({ emails: emailDataArray })
    });
  }

  async checkAIServiceHealth(): Promise<ApiResponse<any>> {
    return this.makeRequest('/api/analysis/health', { method: 'GET' });
  }

  // Billing entry endpoints (matching backend routes)
  async syncBillingEntry(entry: BillingEntry): Promise<ApiResponse<any>> {
    try {
      await this.waitForConnection();
      console.log('🔄 Syncing billing entry to backend:', entry.id);
      
      const response = await this.makeRequest('/api/billing/entries', {
        method: 'POST',
        body: JSON.stringify(entry)
      });

      if (response.success) {
        console.log('✅ Billing entry synced successfully');
      }

      return response;
    } catch (error) {
      console.error('❌ Failed to sync billing entry:', error);
      throw error;
    }
  }

  async getBillingEntries(params?: { 
    startDate?: string; 
    endDate?: string; 
    status?: string; 
  }): Promise<ApiResponse<BillingEntry[]>> {
    await this.waitForConnection();
    
    const queryParams = new URLSearchParams(params).toString();
    const url = `/api/billing/entries${queryParams ? `?${queryParams}` : ''}`;
    
    return this.makeRequest(url, { method: 'GET' });
  }

  async updateBillingEntry(entryId: string, updates: Partial<BillingEntry>): Promise<ApiResponse<BillingEntry>> {
    await this.waitForConnection();
    
    return this.makeRequest(`/api/billing/entries/${entryId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async deleteBillingEntry(entryId: string): Promise<ApiResponse<void>> {
    await this.waitForConnection();
    
    return this.makeRequest(`/api/billing/entries/${entryId}`, {
      method: 'DELETE'
    });
  }

  // Practice management integration endpoints (matching backend routes)
  async getPracticeManagementPlatforms(): Promise<ApiResponse<any[]>> {
    await this.waitForConnection();
    return this.makeRequest('/api/practice-management/platforms', { method: 'GET' });
  }

  async connectPracticeManagement(platform: string, credentials: any): Promise<ApiResponse<any>> {
    await this.waitForConnection();
    return this.makeRequest('/api/practice-management/connect', {
      method: 'POST',
      body: JSON.stringify({ platform, credentials })
    });
  }

  async disconnectPracticeManagement(platform: string): Promise<ApiResponse<void>> {
    await this.waitForConnection();
    return this.makeRequest(`/api/practice-management/disconnect/${platform}`, {
      method: 'DELETE'
    });
  }

  async syncWithPracticeManagement(): Promise<ApiResponse<any>> {
    await this.waitForConnection();
    return this.makeRequest('/api/sync/trigger', { method: 'POST' });
  }

  async getSyncHistory(): Promise<ApiResponse<any[]>> {
    await this.waitForConnection();
    return this.makeRequest('/api/sync/history', { method: 'GET' });
  }

  async getSyncStatus(): Promise<ApiResponse<any>> {
    await this.waitForConnection();
    return this.makeRequest('/api/sync/status', { method: 'GET' });
  }

  async getClients(): Promise<ApiResponse<any[]>> {
    await this.waitForConnection();
    return this.makeRequest('/api/practice-management/clients', { method: 'GET' });
  }

  async getMatters(clientId?: string): Promise<ApiResponse<any[]>> {
    await this.waitForConnection();
    const url = `/api/practice-management/matters${clientId ? `?clientId=${clientId}` : ''}`;
    return this.makeRequest(url, { method: 'GET' });
  }

  // Analytics endpoints (backend will need these routes)
  async getAnalytics(params?: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<ApiResponse<any>> {
    await this.waitForConnection();
    
    const queryParams = new URLSearchParams(params).toString();
    const url = `/api/billing/analytics${queryParams ? `?${queryParams}` : ''}`;
    
    return this.makeRequest(url, { method: 'GET' });
  }

  // User settings endpoints (backend will need these routes)
  async syncUserSettings(settings: UserSettings): Promise<ApiResponse<UserSettings>> {
    await this.waitForConnection();
    
    return this.makeRequest('/api/auth/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  }

  async getUserProfile(): Promise<ApiResponse<any>> {
    await this.waitForConnection();
    return this.makeRequest('/api/auth/profile', { method: 'GET' });
  }

  // Private helper methods
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<ApiResponse> {
    try {
      await this.waitForConnection();
      
      const url = `${this.baseUrl}${endpoint}`;
      
      const defaultHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Extension-Version': '0.6.0',
        'X-Client-Type': 'chrome-extension'
      };

      if (this.authToken) {
        defaultHeaders['Authorization'] = `Bearer ${this.authToken}`;
      }

      const requestOptions: RequestInit = {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers
        }
        // Note: AbortSignal.timeout not available in all environments
        // For production, consider using a polyfill or manual timeout
      };

      console.log(`🌐 Making API request: ${options.method || 'GET'} ${endpoint}`);
      
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        // Handle specific HTTP status codes
        switch (response.status) {
          case 401:
            await this.handleAuthError();
            throw new Error('Authentication required');
          case 403:
            throw new Error('Access forbidden');
          case 404:
            throw new Error('Resource not found');
          case 429:
            const retryAfter = response.headers.get('Retry-After');
            if (retryAfter && this.retryCount < this.maxRetries) {
              await this.waitForRateLimit(parseInt(retryAfter));
              this.retryCount++;
              return this.makeRequest(endpoint, options); // Retry
            }
            throw new Error('Rate limit exceeded');
          case 500:
            throw new Error('Server error - please try again later');
          default:
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }

      const data = await response.json();
      
      // Reset retry count on successful request
      this.retryCount = 0;
      
      console.log(`✅ API request successful: ${endpoint}`);
      
      return {
        success: true,
        data
      };

    } catch (error) {
      console.error(`❌ API request failed: ${endpoint}`, error);
      
      // Handle network errors with retry logic using config
      if (error instanceof TypeError && error.message.includes('fetch') && this.retryCount < this.maxRetries) {
        this.retryCount++;
        debugLog(`Retrying request (${this.retryCount}/${this.maxRetries})`);
        const delay = this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, this.retryCount - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(endpoint, options);
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown API error'
      };
    }
  }

  private async handleAuthError(): Promise<void> {
    console.log('🔄 Handling authentication error');
    
    // Try to refresh token first
    const refreshResult = await this.refreshToken();
    
    if (!refreshResult.success) {
      // If refresh fails, clear authentication
      await this.logout();
    }
  }

  // Health check (matching backend endpoint)
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/health', { method: 'GET' });
      return response.success && response.data?.status === 'healthy';
    } catch (error) {
      console.warn('⚠️ Health check failed:', error);
      return false;
    }
  }

  // Configuration methods for production deployment
  setBaseUrl(url: string): void {
    this.baseUrl = url;
    console.log(`🔗 API base URL updated to: ${url}`);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  // Production environment detection
  isProduction(): boolean {
    return !this.baseUrl.includes('localhost') && !this.baseUrl.includes('127.0.0.1');
  }

  // Rate limiting helper
  private async waitForRateLimit(retryAfter: number): Promise<void> {
    const delay = Math.min(retryAfter * 1000, 30000); // Max 30 seconds
    console.log(`⏳ Rate limited, waiting ${delay}ms`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Connection testing for development
  async testConnection(): Promise<{ success: boolean; latency?: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      const isHealthy = await this.healthCheck();
      const latency = Date.now() - startTime;
      
      return {
        success: isHealthy,
        latency,
        error: isHealthy ? undefined : 'Backend health check failed'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }
}
