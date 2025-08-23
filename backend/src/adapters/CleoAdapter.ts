import { BasePracticeManagementAdapter } from './BasePracticeManagementAdapter';
import {
  TimeEntry,
  Client,
  Matter,
  User,
  ApiResponse,
  TimeEntryFilters,
  ClientFilters,
  MatterFilters,
  ValidationError
} from '../types/practiceManagement';
import { logger } from '../utils/logger';

/**
 * Cleo Practice Management Adapter
 * 
 * Integrates with Cleo's REST API for time tracking and billing
 * API Documentation: https://api.gocleo.com/docs
 */
export class CleoAdapter extends BasePracticeManagementAdapter {
  private static readonly API_VERSION = 'v1';

  constructor() {
    super('cleo');
  }

  protected buildBaseUrl(subdomain: string): string {
    return `https://${subdomain}.gocleo.com/api/${CleoAdapter.API_VERSION}`;
  }

  protected async setAuthenticationHeaders(): Promise<void> {
    if (this.config.apiKey) {
      this.httpClient.defaults.headers.common['Authorization'] = `Bearer ${this.config.apiKey}`;
    } else if (this.config.accessToken) {
      this.httpClient.defaults.headers.common['Authorization'] = `Bearer ${this.config.accessToken}`;
    }
  }

  async authenticate(): Promise<ApiResponse<{ token: string; expiresAt: Date }>> {
    // Cleo uses API keys or OAuth tokens, no separate authentication endpoint needed
    if (this.config.apiKey || this.config.accessToken) {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1); // API keys don't expire
      
      return this.createResponse({
        token: this.config.apiKey || this.config.accessToken!,
        expiresAt
      });
    }

    return {
      success: false,
      error: 'No API key or access token provided'
    };
  }

  async refreshAuthentication(): Promise<ApiResponse<{ token: string; expiresAt: Date }>> {
    // Cleo API keys don't need refreshing
    return this.authenticate();
  }

  // Time Entry Methods
  async createTimeEntry(entry: TimeEntry): Promise<ApiResponse<TimeEntry>> {
    const validation = this.validateTimeEntry(entry);
    if (validation) {
      throw new ValidationError('cleo', 'timeEntry', validation);
    }

    const cleoEntry = this.mapToCleoTimeEntry(entry);
    const response = await this.makeRequest<any>('POST', '/time_entries', cleoEntry);

    if (response.success && response.data) {
      return this.createResponse(this.mapFromCleoTimeEntry(response.data));
    }

    return response;
  }

  async updateTimeEntry(id: string, entry: Partial<TimeEntry>): Promise<ApiResponse<TimeEntry>> {
    const cleoEntry = this.mapToCleoTimeEntry(entry as TimeEntry);
    const response = await this.makeRequest<any>('PUT', `/time_entries/${id}`, cleoEntry);

    if (response.success && response.data) {
      return this.createResponse(this.mapFromCleoTimeEntry(response.data));
    }

    return response;
  }

  async deleteTimeEntry(id: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('DELETE', `/time_entries/${id}`);
  }

  async getTimeEntries(filters?: TimeEntryFilters): Promise<ApiResponse<TimeEntry[]>> {
    const params = this.buildTimeEntryFilters(filters);
    const response = await this.makeRequest<any>('GET', '/time_entries', undefined, params);

    if (response.success && response.data) {
      const entries = Array.isArray(response.data.time_entries) 
        ? response.data.time_entries 
        : response.data;
      
      return this.createResponse(entries.map(this.mapFromCleoTimeEntry.bind(this)));
    }

    return response;
  }

  // Client Methods
  async getClients(filters?: ClientFilters): Promise<ApiResponse<Client[]>> {
    const params = this.buildClientFilters(filters);
    const response = await this.makeRequest<any>('GET', '/contacts', undefined, params);

    if (response.success && response.data) {
      const contacts = Array.isArray(response.data.contacts) 
        ? response.data.contacts 
        : response.data;
      
      return this.createResponse(contacts.map(this.mapFromCleoClient.bind(this)));
    }

    return response;
  }

  async getClient(id: string): Promise<ApiResponse<Client>> {
    const response = await this.makeRequest<any>('GET', `/contacts/${id}`);

    if (response.success && response.data) {
      return this.createResponse(this.mapFromCleoClient(response.data));
    }

    return response;
  }

  async createClient(client: Omit<Client, 'id'>): Promise<ApiResponse<Client>> {
    const validation = this.validateClient(client);
    if (validation) {
      throw new ValidationError('cleo', 'client', validation);
    }

    const cleoClient = this.mapToCleoClient(client);
    const response = await this.makeRequest<any>('POST', '/contacts', cleoClient);

    if (response.success && response.data) {
      return this.createResponse(this.mapFromCleoClient(response.data));
    }

    return response;
  }

  // Matter Methods
  async getMatters(clientId?: string, filters?: MatterFilters): Promise<ApiResponse<Matter[]>> {
    const params = this.buildMatterFilters(clientId, filters);
    const response = await this.makeRequest<any>('GET', '/matters', undefined, params);

    if (response.success && response.data) {
      const matters = Array.isArray(response.data.matters) 
        ? response.data.matters 
        : response.data;
      
      return this.createResponse(matters.map(this.mapFromCleoMatter.bind(this)));
    }

    return response;
  }

  async getMatter(id: string): Promise<ApiResponse<Matter>> {
    const response = await this.makeRequest<any>('GET', `/matters/${id}`);

    if (response.success && response.data) {
      return this.createResponse(this.mapFromCleoMatter(response.data));
    }

    return response;
  }

  async createMatter(matter: Omit<Matter, 'id'>): Promise<ApiResponse<Matter>> {
    const validation = this.validateMatter(matter);
    if (validation) {
      throw new ValidationError('cleo', 'matter', validation);
    }

    const cleoMatter = this.mapToCleoMatter(matter);
    const response = await this.makeRequest<any>('POST', '/matters', cleoMatter);

    if (response.success && response.data) {
      return this.createResponse(this.mapFromCleoMatter(response.data));
    }

    return response;
  }

  // User Methods
  async getUsers(): Promise<ApiResponse<User[]>> {
    const response = await this.makeRequest<any>('GET', '/users');

    if (response.success && response.data) {
      const users = Array.isArray(response.data.users) 
        ? response.data.users 
        : response.data;
      
      return this.createResponse(users.map(this.mapFromCleoUser.bind(this)));
    }

    return response;
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    const response = await this.makeRequest<any>('GET', '/user');

    if (response.success && response.data) {
      return this.createResponse(this.mapFromCleoUser(response.data));
    }

    return response;
  }

  // Mapping Methods - Convert between Involex and Cleo formats
  private mapToCleoTimeEntry(entry: TimeEntry): any {
    return {
      contact_id: entry.clientId,
      matter_id: entry.matterId,
      date: this.formatDate(entry.date),
      hours: entry.hours,
      description: entry.description,
      rate: entry.billableRate,
      billable: entry.billable,
      activity_id: entry.activityCode,
      task_id: entry.taskCode,
      user_id: entry.userId,
      status: entry.status || 'draft'
    };
  }

  private mapFromCleoTimeEntry(cleoEntry: any): TimeEntry {
    return {
      id: cleoEntry.id?.toString(),
      clientId: cleoEntry.contact_id?.toString(),
      matterId: cleoEntry.matter_id?.toString(),
      date: cleoEntry.date,
      hours: parseFloat(cleoEntry.hours) || 0,
      description: cleoEntry.description || '',
      billableRate: parseFloat(cleoEntry.rate) || undefined,
      billable: cleoEntry.billable !== false,
      activityCode: cleoEntry.activity_id?.toString(),
      taskCode: cleoEntry.task_id?.toString(),
      userId: cleoEntry.user_id?.toString(),
      status: cleoEntry.status || 'draft',
      metadata: {
        cleoId: cleoEntry.id,
        createdAt: cleoEntry.created_at,
        updatedAt: cleoEntry.updated_at
      }
    };
  }

  private mapToCleoClient(client: Omit<Client, 'id'>): any {
    return {
      name: client.name,
      email: client.email,
      phone: client.phone,
      address: client.address,
      is_active: client.status === 'active',
      default_rate: client.defaultRate
    };
  }

  private mapFromCleoClient(cleoClient: any): Client {
    return {
      id: cleoClient.id?.toString(),
      name: cleoClient.name || '',
      email: cleoClient.email,
      phone: cleoClient.phone,
      address: cleoClient.address,
      status: cleoClient.is_active !== false ? 'active' : 'inactive',
      defaultRate: parseFloat(cleoClient.default_rate) || undefined,
      metadata: {
        cleoId: cleoClient.id,
        createdAt: cleoClient.created_at,
        updatedAt: cleoClient.updated_at
      }
    };
  }

  private mapToCleoMatter(matter: Omit<Matter, 'id'>): any {
    return {
      contact_id: matter.clientId,
      name: matter.name,
      description: matter.description,
      is_active: matter.status === 'active',
      open_date: this.formatDate(matter.openDate),
      close_date: matter.closeDate ? this.formatDate(matter.closeDate) : null,
      practice_area: matter.practiceArea,
      responsible_attorney: matter.responsibleAttorney
    };
  }

  private mapFromCleoMatter(cleoMatter: any): Matter {
    return {
      id: cleoMatter.id?.toString(),
      clientId: cleoMatter.contact_id?.toString(),
      name: cleoMatter.name || '',
      description: cleoMatter.description,
      status: cleoMatter.is_active !== false ? 'active' : 'inactive',
      openDate: cleoMatter.open_date,
      closeDate: cleoMatter.close_date,
      practiceArea: cleoMatter.practice_area,
      responsibleAttorney: cleoMatter.responsible_attorney,
      metadata: {
        cleoId: cleoMatter.id,
        createdAt: cleoMatter.created_at,
        updatedAt: cleoMatter.updated_at
      }
    };
  }

  private mapFromCleoUser(cleoUser: any): User {
    return {
      id: cleoUser.id?.toString(),
      name: `${cleoUser.first_name || ''} ${cleoUser.last_name || ''}`.trim(),
      email: cleoUser.email || '',
      role: cleoUser.role || 'user',
      defaultRate: parseFloat(cleoUser.default_rate) || undefined,
      isActive: cleoUser.is_active !== false,
      metadata: {
        cleoId: cleoUser.id,
        firstName: cleoUser.first_name,
        lastName: cleoUser.last_name,
        createdAt: cleoUser.created_at,
        updatedAt: cleoUser.updated_at
      }
    };
  }

  // Filter builders
  private buildTimeEntryFilters(filters?: TimeEntryFilters): Record<string, any> {
    const params: Record<string, any> = this.buildPaginationParams(filters?.limit, filters?.offset);

    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    if (filters?.clientId) params.contact_id = filters.clientId;
    if (filters?.matterId) params.matter_id = filters.matterId;
    if (filters?.userId) params.user_id = filters.userId;
    if (filters?.billable !== undefined) params.billable = filters.billable;
    if (filters?.status) params.status = filters.status;

    return params;
  }

  private buildClientFilters(filters?: ClientFilters): Record<string, any> {
    const params: Record<string, any> = this.buildPaginationParams(filters?.limit, filters?.offset);

    if (filters?.search) params.search = filters.search;
    if (filters?.status) params.is_active = filters.status === 'active';

    return params;
  }

  private buildMatterFilters(clientId?: string, filters?: MatterFilters): Record<string, any> {
    const params: Record<string, any> = this.buildPaginationParams(filters?.limit, filters?.offset);

    if (clientId) params.contact_id = clientId;
    if (filters?.search) params.search = filters.search;
    if (filters?.status) params.is_active = filters.status === 'active';
    if (filters?.practiceArea) params.practice_area = filters.practiceArea;
    if (filters?.responsibleAttorney) params.responsible_attorney = filters.responsibleAttorney;

    return params;
  }
}
