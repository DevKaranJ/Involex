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
 * MyCase Practice Management Adapter
 * 
 * Integrates with MyCase's REST API for time tracking and billing
 * API Documentation: https://www.mycase.com/api/
 */
export class MyCaseAdapter extends BasePracticeManagementAdapter {
  private static readonly API_VERSION = 'v1';

  constructor() {
    super('mycase');
  }

  protected buildBaseUrl(subdomain: string): string {
    return `https://${subdomain}.mycase.com/api/${MyCaseAdapter.API_VERSION}`;
  }

  protected async setAuthenticationHeaders(): Promise<void> {
    if (this.config.accessToken) {
      this.httpClient.defaults.headers.common['Authorization'] = `Bearer ${this.config.accessToken}`;
    } else if (this.config.apiKey) {
      this.httpClient.defaults.headers.common['Authorization'] = `Token ${this.config.apiKey}`;
    }
  }

  async authenticate(): Promise<ApiResponse<{ token: string; expiresAt: Date }>> {
    if (this.config.accessToken || this.config.apiKey) {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1); // Tokens don't expire
      
      return this.createResponse({
        token: this.config.accessToken || this.config.apiKey!,
        expiresAt
      });
    }

    return {
      success: false,
      error: 'No access token or API key provided'
    };
  }

  async refreshAuthentication(): Promise<ApiResponse<{ token: string; expiresAt: Date }>> {
    // MyCase tokens don't need refreshing for API keys
    return this.authenticate();
  }

  // Time Entry Methods
  async createTimeEntry(entry: TimeEntry): Promise<ApiResponse<TimeEntry>> {
    const validation = this.validateTimeEntry(entry);
    if (validation) {
      throw new ValidationError('mycase', 'timeEntry', validation);
    }

    const mycaseEntry = this.mapToMyCaseTimeEntry(entry);
    const response = await this.makeRequest<any>('POST', '/time_entries', { time_entry: mycaseEntry });

    if (response.success && response.data) {
      return this.createResponse(this.mapFromMyCaseTimeEntry(response.data.time_entry || response.data));
    }

    return response;
  }

  async updateTimeEntry(id: string, entry: Partial<TimeEntry>): Promise<ApiResponse<TimeEntry>> {
    const mycaseEntry = this.mapToMyCaseTimeEntry(entry as TimeEntry);
    const response = await this.makeRequest<any>('PUT', `/time_entries/${id}`, { time_entry: mycaseEntry });

    if (response.success && response.data) {
      return this.createResponse(this.mapFromMyCaseTimeEntry(response.data.time_entry || response.data));
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
      const entries = response.data.time_entries || response.data;
      const entriesArray = Array.isArray(entries) ? entries : [entries];
      return this.createResponse(entriesArray.map(this.mapFromMyCaseTimeEntry.bind(this)));
    }

    return response;
  }

  // Client Methods
  async getClients(filters?: ClientFilters): Promise<ApiResponse<Client[]>> {
    const params = this.buildClientFilters(filters);
    const response = await this.makeRequest<any>('GET', '/contacts', undefined, params);

    if (response.success && response.data) {
      const contacts = response.data.contacts || response.data;
      const contactsArray = Array.isArray(contacts) ? contacts : [contacts];
      // Filter only clients (not all contacts)
      const clients = contactsArray.filter(contact => contact.is_company || contact.contact_type === 'Client');
      return this.createResponse(clients.map(this.mapFromMyCaseClient.bind(this)));
    }

    return response;
  }

  async getClient(id: string): Promise<ApiResponse<Client>> {
    const response = await this.makeRequest<any>('GET', `/contacts/${id}`);

    if (response.success && response.data) {
      const contact = response.data.contact || response.data;
      return this.createResponse(this.mapFromMyCaseClient(contact));
    }

    return response;
  }

  async createClient(client: Omit<Client, 'id'>): Promise<ApiResponse<Client>> {
    const validation = this.validateClient(client);
    if (validation) {
      throw new ValidationError('mycase', 'client', validation);
    }

    const mycaseClient = this.mapToMyCaseClient(client);
    const response = await this.makeRequest<any>('POST', '/contacts', { contact: mycaseClient });

    if (response.success && response.data) {
      const contact = response.data.contact || response.data;
      return this.createResponse(this.mapFromMyCaseClient(contact));
    }

    return response;
  }

  // Matter Methods (Cases in MyCase terminology)
  async getMatters(clientId?: string, filters?: MatterFilters): Promise<ApiResponse<Matter[]>> {
    const params = this.buildMatterFilters(clientId, filters);
    const response = await this.makeRequest<any>('GET', '/cases', undefined, params);

    if (response.success && response.data) {
      const cases = response.data.cases || response.data;
      const casesArray = Array.isArray(cases) ? cases : [cases];
      return this.createResponse(casesArray.map(this.mapFromMyCaseMatter.bind(this)));
    }

    return response;
  }

  async getMatter(id: string): Promise<ApiResponse<Matter>> {
    const response = await this.makeRequest<any>('GET', `/cases/${id}`);

    if (response.success && response.data) {
      const caseData = response.data.case || response.data;
      return this.createResponse(this.mapFromMyCaseMatter(caseData));
    }

    return response;
  }

  async createMatter(matter: Omit<Matter, 'id'>): Promise<ApiResponse<Matter>> {
    const validation = this.validateMatter(matter);
    if (validation) {
      throw new ValidationError('mycase', 'matter', validation);
    }

    const mycaseMatter = this.mapToMyCaseMatter(matter);
    const response = await this.makeRequest<any>('POST', '/cases', { case: mycaseMatter });

    if (response.success && response.data) {
      const caseData = response.data.case || response.data;
      return this.createResponse(this.mapFromMyCaseMatter(caseData));
    }

    return response;
  }

  // User Methods
  async getUsers(): Promise<ApiResponse<User[]>> {
    const response = await this.makeRequest<any>('GET', '/users');

    if (response.success && response.data) {
      const users = response.data.users || response.data;
      const usersArray = Array.isArray(users) ? users : [users];
      return this.createResponse(usersArray.map(this.mapFromMyCaseUser.bind(this)));
    }

    return response;
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    const response = await this.makeRequest<any>('GET', '/users/me');

    if (response.success && response.data) {
      const user = response.data.user || response.data;
      return this.createResponse(this.mapFromMyCaseUser(user));
    }

    return response;
  }

  // Mapping Methods - Convert between Involex and MyCase formats
  private mapToMyCaseTimeEntry(entry: TimeEntry): any {
    return {
      contact_id: entry.clientId ? parseInt(entry.clientId) : null,
      case_id: entry.matterId ? parseInt(entry.matterId) : null,
      date_performed: this.formatDate(entry.date),
      quantity_in_hours: entry.hours,
      description: entry.description,
      rate: entry.billableRate,
      billable: entry.billable,
      activity_type_id: entry.activityCode ? parseInt(entry.activityCode) : null,
      user_id: entry.userId ? parseInt(entry.userId) : null,
      status: entry.status || 'unbilled'
    };
  }

  private mapFromMyCaseTimeEntry(mycaseEntry: any): TimeEntry {
    return {
      id: mycaseEntry.id?.toString(),
      clientId: mycaseEntry.contact_id?.toString(),
      matterId: mycaseEntry.case_id?.toString(),
      date: mycaseEntry.date_performed,
      hours: parseFloat(mycaseEntry.quantity_in_hours) || 0,
      description: mycaseEntry.description || '',
      billableRate: parseFloat(mycaseEntry.rate) || undefined,
      billable: mycaseEntry.billable !== false,
      activityCode: mycaseEntry.activity_type_id?.toString(),
      taskCode: undefined, // MyCase doesn't have task codes
      userId: mycaseEntry.user_id?.toString(),
      status: this.mapFromMyCaseStatus(mycaseEntry.status),
      metadata: {
        mycaseId: mycaseEntry.id,
        createdAt: mycaseEntry.created_at,
        updatedAt: mycaseEntry.updated_at
      }
    };
  }

  private mapToMyCaseClient(client: Omit<Client, 'id'>): any {
    return {
      name: client.name,
      email_address: client.email,
      phone_number: client.phone,
      address: client.address,
      is_company: true, // Treat all clients as companies for simplicity
      contact_type: 'Client',
      status: client.status === 'active' ? 'active' : 'inactive'
    };
  }

  private mapFromMyCaseClient(mycaseClient: any): Client {
    return {
      id: mycaseClient.id?.toString(),
      name: mycaseClient.name || mycaseClient.company_name || '',
      email: mycaseClient.email_address,
      phone: mycaseClient.phone_number,
      address: mycaseClient.address,
      status: mycaseClient.status === 'active' ? 'active' : 'inactive',
      defaultRate: undefined, // MyCase doesn't store default rates on contacts
      metadata: {
        mycaseId: mycaseClient.id,
        isCompany: mycaseClient.is_company,
        contactType: mycaseClient.contact_type,
        createdAt: mycaseClient.created_at,
        updatedAt: mycaseClient.updated_at
      }
    };
  }

  private mapToMyCaseMatter(matter: Omit<Matter, 'id'>): any {
    return {
      contact_id: parseInt(matter.clientId),
      name: matter.name,
      description: matter.description,
      case_stage: matter.status === 'active' ? 'active' : matter.status === 'closed' ? 'closed' : 'inactive',
      opened_date: this.formatDate(matter.openDate),
      closed_date: matter.closeDate ? this.formatDate(matter.closeDate) : null,
      practice_area: matter.practiceArea,
      lead_counsel_user_id: matter.responsibleAttorney ? parseInt(matter.responsibleAttorney) : null
    };
  }

  private mapFromMyCaseMatter(mycaseMatter: any): Matter {
    return {
      id: mycaseMatter.id?.toString(),
      clientId: mycaseMatter.contact_id?.toString(),
      name: mycaseMatter.name || '',
      description: mycaseMatter.description,
      status: this.mapFromMyCaseMatterStatus(mycaseMatter.case_stage),
      openDate: mycaseMatter.opened_date,
      closeDate: mycaseMatter.closed_date,
      practiceArea: mycaseMatter.practice_area,
      responsibleAttorney: mycaseMatter.lead_counsel_user_id?.toString(),
      metadata: {
        mycaseId: mycaseMatter.id,
        caseStage: mycaseMatter.case_stage,
        createdAt: mycaseMatter.created_at,
        updatedAt: mycaseMatter.updated_at
      }
    };
  }

  private mapFromMyCaseUser(mycaseUser: any): User {
    return {
      id: mycaseUser.id?.toString(),
      name: `${mycaseUser.first_name || ''} ${mycaseUser.last_name || ''}`.trim(),
      email: mycaseUser.email || '',
      role: mycaseUser.role || 'user',
      defaultRate: parseFloat(mycaseUser.hourly_rate) || undefined,
      isActive: mycaseUser.status === 'active',
      metadata: {
        mycaseId: mycaseUser.id,
        firstName: mycaseUser.first_name,
        lastName: mycaseUser.last_name,
        hourlyRate: mycaseUser.hourly_rate,
        createdAt: mycaseUser.created_at,
        updatedAt: mycaseUser.updated_at
      }
    };
  }

  // Status mapping helpers
  private mapFromMyCaseStatus(status: string): TimeEntry['status'] {
    switch (status?.toLowerCase()) {
      case 'unbilled': return 'draft';
      case 'pending': return 'pending';
      case 'approved': return 'approved';
      case 'billed': return 'billed';
      default: return 'draft';
    }
  }

  private mapFromMyCaseMatterStatus(status: string): Matter['status'] {
    switch (status?.toLowerCase()) {
      case 'active': return 'active';
      case 'closed': return 'closed';
      case 'inactive': return 'inactive';
      default: return 'active';
    }
  }

  // Filter builders
  private buildTimeEntryFilters(filters?: TimeEntryFilters): Record<string, any> {
    const params: Record<string, any> = this.buildPaginationParams(filters?.limit, filters?.offset);

    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    if (filters?.clientId) params.contact_id = filters.clientId;
    if (filters?.matterId) params.case_id = filters.matterId;
    if (filters?.userId) params.user_id = filters.userId;
    if (filters?.billable !== undefined) params.billable = filters.billable;
    if (filters?.status) params.status = filters.status === 'draft' ? 'unbilled' : filters.status;

    return params;
  }

  private buildClientFilters(filters?: ClientFilters): Record<string, any> {
    const params: Record<string, any> = this.buildPaginationParams(filters?.limit, filters?.offset);

    if (filters?.search) params.search = filters.search;
    if (filters?.status) params.status = filters.status;

    return params;
  }

  private buildMatterFilters(clientId?: string, filters?: MatterFilters): Record<string, any> {
    const params: Record<string, any> = this.buildPaginationParams(filters?.limit, filters?.offset);

    if (clientId) params.contact_id = clientId;
    if (filters?.search) params.search = filters.search;
    if (filters?.status) {
      params.case_stage = filters.status === 'active' ? 'active' : 
                         filters.status === 'closed' ? 'closed' : 'inactive';
    }
    if (filters?.practiceArea) params.practice_area = filters.practiceArea;

    return params;
  }
}
