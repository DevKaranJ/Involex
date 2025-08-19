// API Client for Involex Extension
// Handles communication with backend services

import { BillingEntry, UserSettings, ApiResponse } from './types';
import { StorageManager } from './storage';

export class ApiClient {
  private baseUrl: string;
  private authToken?: string;
  private storageManager: StorageManager;

  constructor(baseUrl: string = 'https://api.involex.com') {
    this.baseUrl = baseUrl;
    this.storageManager = new StorageManager();
    this.initializeAuth();
  }

  private async initializeAuth(): Promise<void> {
    const settings = await this.storageManager.getUserSettings();
    if (settings.apiToken) {
      this.authToken = settings.apiToken;
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

  // Email analysis endpoints
  async analyzeEmail(emailData: any): Promise<ApiResponse<any>> {
    return this.makeRequest('/emails/analyze', {
      method: 'POST',
      body: JSON.stringify(emailData)
    });
  }

  async bulkAnalyzeEmails(emailDataArray: any[]): Promise<ApiResponse<any[]>> {
    return this.makeRequest('/emails/bulk-analyze', {
      method: 'POST',
      body: JSON.stringify({ emails: emailDataArray })
    });
  }

  // Billing entry endpoints
  async syncBillingEntry(entry: BillingEntry): Promise<ApiResponse<any>> {
    try {
      console.log('🔄 Syncing billing entry to backend:', entry.id);
      
      const response = await this.makeRequest('/billing/entries', {
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
    const queryParams = new URLSearchParams(params).toString();
    const url = `/billing/entries${queryParams ? `?${queryParams}` : ''}`;
    
    return this.makeRequest(url, { method: 'GET' });
  }

  async updateBillingEntry(entryId: string, updates: Partial<BillingEntry>): Promise<ApiResponse<BillingEntry>> {
    return this.makeRequest(`/billing/entries/${entryId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async deleteBillingEntry(entryId: string): Promise<ApiResponse<void>> {
    return this.makeRequest(`/billing/entries/${entryId}`, {
      method: 'DELETE'
    });
  }

  // Practice management integration endpoints
  async getPracticeManagementPlatforms(): Promise<ApiResponse<any[]>> {
    return this.makeRequest('/integrations/platforms', { method: 'GET' });
  }

  async connectPracticeManagement(platform: string, credentials: any): Promise<ApiResponse<any>> {
    return this.makeRequest('/integrations/connect', {
      method: 'POST',
      body: JSON.stringify({ platform, credentials })
    });
  }

  async disconnectPracticeManagement(platform: string): Promise<ApiResponse<void>> {
    return this.makeRequest(`/integrations/${platform}`, {
      method: 'DELETE'
    });
  }

  async syncWithPracticeManagement(): Promise<ApiResponse<any>> {
    return this.makeRequest('/integrations/sync', { method: 'POST' });
  }

  async getClients(): Promise<ApiResponse<any[]>> {
    return this.makeRequest('/integrations/clients', { method: 'GET' });
  }

  async getMatters(clientId?: string): Promise<ApiResponse<any[]>> {
    const url = `/integrations/matters${clientId ? `?clientId=${clientId}` : ''}`;
    return this.makeRequest(url, { method: 'GET' });
  }

  // Analytics endpoints
  async getAnalytics(params?: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams(params).toString();
    const url = `/analytics${queryParams ? `?${queryParams}` : ''}`;
    
    return this.makeRequest(url, { method: 'GET' });
  }

  // User settings endpoints
  async syncUserSettings(settings: UserSettings): Promise<ApiResponse<UserSettings>> {
    return this.makeRequest('/user/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  }

  async getUserProfile(): Promise<ApiResponse<any>> {
    return this.makeRequest('/user/profile', { method: 'GET' });
  }

  // Private helper methods
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<ApiResponse> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      
      const defaultHeaders: Record<string, string> = {
        'Content-Type': 'application/json'
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
      };

      console.log(`🌐 Making API request: ${options.method || 'GET'} ${endpoint}`);
      
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401) {
          await this.handleAuthError();
          throw new Error('Authentication required');
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log(`✅ API request successful: ${endpoint}`);
      
      return {
        success: true,
        data
      };

    } catch (error) {
      console.error(`❌ API request failed: ${endpoint}`, error);
      
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

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/health', { method: 'GET' });
      return response.success;
    } catch (error) {
      console.warn('⚠️ Health check failed:', error);
      return false;
    }
  }

  // Rate limiting helper
  private async waitForRateLimit(retryAfter: number): Promise<void> {
    const delay = Math.min(retryAfter * 1000, 30000); // Max 30 seconds
    console.log(`⏳ Rate limited, waiting ${delay}ms`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
