import { 
  PracticeManagementAdapter, 
  PracticeManagementConfig, 
  ApiResponse, 
  TimeEntry, 
  Client, 
  Matter, 
  User,
  TimeEntryFilters,
  ClientFilters,
  MatterFilters,
  PracticeManagementError,
  AuthenticationError,
  RateLimitError
} from '../types/practiceManagement';
import { logger } from '../utils/logger';
import axios, { AxiosInstance, AxiosError } from 'axios';

export abstract class BasePracticeManagementAdapter implements PracticeManagementAdapter {
  protected config!: PracticeManagementConfig;
  protected httpClient: AxiosInstance;
  protected isConfigured = false;

  constructor(protected platform: string) {
    this.httpClient = axios.create({
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Involex/1.0'
      }
    });

    // Add request interceptor for logging
    this.httpClient.interceptors.request.use(
      (config) => {
        logger.debug(`${this.platform} API Request`, {
          method: config.method?.toUpperCase(),
          url: config.url,
          headers: config.headers
        });
        return config;
      },
      (error) => {
        logger.error(`${this.platform} API Request Error`, error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => {
        logger.debug(`${this.platform} API Response`, {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error: AxiosError<{ message?: string }>) => {
        return this.handleApiError(error);
      }
    );
  }

  async configure(config: PracticeManagementConfig): Promise<void> {
    this.config = config;
    
    // Set base URL
    if (config.baseUrl) {
      this.httpClient.defaults.baseURL = config.baseUrl;
    } else if (config.subdomain) {
      this.httpClient.defaults.baseURL = this.buildBaseUrl(config.subdomain);
    }

    // Set authentication headers
    await this.setAuthenticationHeaders();
    
    this.isConfigured = true;
    
    logger.info(`${this.platform} adapter configured`, {
      platform: this.platform,
      baseUrl: this.httpClient.defaults.baseURL
    });
  }

  protected abstract buildBaseUrl(subdomain: string): string;
  protected abstract setAuthenticationHeaders(): Promise<void>;

  async validateConnection(): Promise<boolean> {
    if (!this.isConfigured) {
      throw new PracticeManagementError(
        'Adapter not configured',
        'NOT_CONFIGURED',
        this.platform
      );
    }

    try {
      const user = await this.getCurrentUser();
      return user.success;
    } catch (error) {
      logger.error(`${this.platform} connection validation failed`, error);
      return false;
    }
  }

  protected async handleApiError(error: AxiosError<{ message?: string }>): Promise<never> {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;
    
    logger.error(`${this.platform} API Error`, {
      status,
      message,
      url: error.config?.url,
      method: error.config?.method
    });

    if (status === 401) {
      throw new AuthenticationError(this.platform, message, error);
    }

    if (status === 429) {
      const retryAfter = error.response?.headers['retry-after'];
      throw new RateLimitError(this.platform, retryAfter ? parseInt(retryAfter) : undefined);
    }

    throw new PracticeManagementError(
      message,
      `HTTP_${status}`,
      this.platform,
      status,
      error
    );
  }

  protected createResponse<T>(data?: T, error?: string): ApiResponse<T> {
    return {
      success: !error,
      data: error ? undefined : data,
      error
    };
  }

  protected async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    endpoint: string,
    data?: any,
    params?: any
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.httpClient.request({
        method,
        url: endpoint,
        data,
        params
      });

      return this.createResponse<T>(response.data);
    } catch (error) {
      if (error instanceof PracticeManagementError) {
        return this.createResponse<T>(undefined, error.message);
      }
      
      logger.error(`${this.platform} API request failed`, error);
      return this.createResponse<T>(undefined, 'API request failed');
    }
  }

  // Authentication methods - to be implemented by subclasses
  abstract authenticate(): Promise<ApiResponse<{ token: string; expiresAt: Date }>>;
  abstract refreshAuthentication(): Promise<ApiResponse<{ token: string; expiresAt: Date }>>;

  // Time Entry methods - to be implemented by subclasses
  abstract createTimeEntry(entry: TimeEntry): Promise<ApiResponse<TimeEntry>>;
  abstract updateTimeEntry(id: string, entry: Partial<TimeEntry>): Promise<ApiResponse<TimeEntry>>;
  abstract deleteTimeEntry(id: string): Promise<ApiResponse<void>>;
  abstract getTimeEntries(filters?: TimeEntryFilters): Promise<ApiResponse<TimeEntry[]>>;

  // Client methods - to be implemented by subclasses
  abstract getClients(filters?: ClientFilters): Promise<ApiResponse<Client[]>>;
  abstract getClient(id: string): Promise<ApiResponse<Client>>;
  abstract createClient(client: Omit<Client, 'id'>): Promise<ApiResponse<Client>>;

  // Matter methods - to be implemented by subclasses
  abstract getMatters(clientId?: string, filters?: MatterFilters): Promise<ApiResponse<Matter[]>>;
  abstract getMatter(id: string): Promise<ApiResponse<Matter>>;
  abstract createMatter(matter: Omit<Matter, 'id'>): Promise<ApiResponse<Matter>>;

  // User methods - to be implemented by subclasses
  abstract getUsers(): Promise<ApiResponse<User[]>>;
  abstract getCurrentUser(): Promise<ApiResponse<User>>;

  // Bulk operations with default implementations
  async bulkCreateTimeEntries(entries: TimeEntry[]): Promise<ApiResponse<TimeEntry[]>> {
    const results: TimeEntry[] = [];
    const errors: any[] = [];

    for (const entry of entries) {
      try {
        const result = await this.createTimeEntry(entry);
        if (result.success && result.data) {
          results.push(result.data);
        } else {
          errors.push({ entry, error: result.error });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ entry, error: errorMessage });
      }
    }

    if (errors.length > 0) {
      logger.warn(`${this.platform} bulk create had errors`, { 
        total: entries.length, 
        successful: results.length, 
        errors: errors.length 
      });
    }

    return this.createResponse(results);
  }

  async syncTimeEntries(entries: TimeEntry[]): Promise<ApiResponse<{ created: number; updated: number; errors: any[] }>> {
    let created = 0;
    let updated = 0;
    const errors: any[] = [];

    for (const entry of entries) {
      try {
        if (entry.id) {
          // Update existing entry
          const result = await this.updateTimeEntry(entry.id, entry);
          if (result.success) {
            updated++;
          } else {
            errors.push({ entry, error: result.error });
          }
        } else {
          // Create new entry
          const result = await this.createTimeEntry(entry);
          if (result.success) {
            created++;
          } else {
            errors.push({ entry, error: result.error });
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ entry, error: errorMessage });
      }
    }

    logger.info(`${this.platform} sync completed`, {
      total: entries.length,
      created,
      updated,
      errors: errors.length
    });

    return this.createResponse({ created, updated, errors });
  }

  // Utility methods for subclasses
  protected formatDate(date: string | Date): string {
    if (typeof date === 'string') {
      return date;
    }
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  protected parseDate(dateString: string): Date {
    return new Date(dateString);
  }

  protected validateTimeEntry(entry: TimeEntry): string | null {
    if (!entry.clientId) return 'Client ID is required';
    if (!entry.date) return 'Date is required';
    if (entry.hours <= 0) return 'Hours must be greater than 0';
    if (!entry.description || entry.description.trim().length === 0) return 'Description is required';
    
    return null;
  }

  protected validateClient(client: Omit<Client, 'id'>): string | null {
    if (!client.name || client.name.trim().length === 0) return 'Client name is required';
    
    return null;
  }

  protected validateMatter(matter: Omit<Matter, 'id'>): string | null {
    if (!matter.clientId) return 'Client ID is required';
    if (!matter.name || matter.name.trim().length === 0) return 'Matter name is required';
    if (!matter.openDate) return 'Open date is required';
    
    return null;
  }

  // Rate limiting helper
  protected async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Pagination helper
  protected buildPaginationParams(limit = 50, offset = 0): Record<string, any> {
    return {
      limit: Math.min(limit, 100), // Cap at 100
      offset: Math.max(offset, 0)
    };
  }
}
