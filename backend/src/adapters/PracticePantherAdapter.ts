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
 * Practice Panther Practice Management Adapter
 * 
 * Integrates with Practice Panther's REST API for time tracking and billing
 * API Documentation: https://developers.practicepanther.com/
 */
export class PracticePantherAdapter extends BasePracticeManagementAdapter {
  private static readonly API_VERSION = 'v1';

  constructor() {
    super('practice-panther');
  }

  protected buildBaseUrl(subdomain: string): string {
    return `https://${subdomain}.practicepanther.com/api/${PracticePantherAdapter.API_VERSION}`;
  }

  protected async setAuthenticationHeaders(): Promise<void> {
    if (this.config.apiKey && this.config.apiSecret) {
      // Practice Panther uses Basic Auth with API key and secret
      const credentials = Buffer.from(`${this.config.apiKey}:${this.config.apiSecret}`).toString('base64');
      this.httpClient.defaults.headers.common['Authorization'] = `Basic ${credentials}`;
    } else if (this.config.accessToken) {
      this.httpClient.defaults.headers.common['Authorization'] = `Bearer ${this.config.accessToken}`;
    }
  }

  async authenticate(): Promise<ApiResponse<{ token: string; expiresAt: Date }>> {
    if (this.config.apiKey && this.config.apiSecret) {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1); // API keys don't expire
      
      return this.createResponse({
        token: this.config.apiKey,
        expiresAt
      });
    }

    return {
      success: false,
      error: 'No API key and secret provided'
    };
  }

  async refreshAuthentication(): Promise<ApiResponse<{ token: string; expiresAt: Date }>> {
    // Practice Panther API keys don't need refreshing
    return this.authenticate();
  }

  // Time Entry Methods
  async createTimeEntry(entry: TimeEntry): Promise<ApiResponse<TimeEntry>> {
    const validation = this.validateTimeEntry(entry);
    if (validation) {
      throw new ValidationError('practice-panther', 'timeEntry', validation);
    }

    const ppEntry = this.mapToPracticePantherTimeEntry(entry);
    const response = await this.makeRequest<any>('POST', '/TimeEntries', ppEntry);

    if (response.success && response.data) {
      return this.createResponse(this.mapFromPracticePantherTimeEntry(response.data));
    }

    return response;
  }

  async updateTimeEntry(id: string, entry: Partial<TimeEntry>): Promise<ApiResponse<TimeEntry>> {
    const ppEntry = this.mapToPracticePantherTimeEntry(entry as TimeEntry);
    const response = await this.makeRequest<any>('PUT', `/TimeEntries/${id}`, ppEntry);

    if (response.success && response.data) {
      return this.createResponse(this.mapFromPracticePantherTimeEntry(response.data));
    }

    return response;
  }

  async deleteTimeEntry(id: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('DELETE', `/TimeEntries/${id}`);
  }

  async getTimeEntries(filters?: TimeEntryFilters): Promise<ApiResponse<TimeEntry[]>> {
    const params = this.buildTimeEntryFilters(filters);
    const response = await this.makeRequest<any>('GET', '/TimeEntries', undefined, params);

    if (response.success && response.data) {
      const entries = Array.isArray(response.data) ? response.data : [response.data];
      return this.createResponse(entries.map(this.mapFromPracticePantherTimeEntry.bind(this)));
    }

    return response;
  }

  // Client Methods
  async getClients(filters?: ClientFilters): Promise<ApiResponse<Client[]>> {
    const params = this.buildClientFilters(filters);
    const response = await this.makeRequest<any>('GET', '/Contacts', undefined, params);

    if (response.success && response.data) {
      const contacts = Array.isArray(response.data) ? response.data : [response.data];
      return this.createResponse(contacts.map(this.mapFromPracticePantherClient.bind(this)));
    }

    return response;
  }

  async getClient(id: string): Promise<ApiResponse<Client>> {
    const response = await this.makeRequest<any>('GET', `/Contacts/${id}`);

    if (response.success && response.data) {
      return this.createResponse(this.mapFromPracticePantherClient(response.data));
    }

    return response;
  }

  async createClient(client: Omit<Client, 'id'>): Promise<ApiResponse<Client>> {
    const validation = this.validateClient(client);
    if (validation) {
      throw new ValidationError('practice-panther', 'client', validation);
    }

    const ppClient = this.mapToPracticePantherClient(client);
    const response = await this.makeRequest<any>('POST', '/Contacts', ppClient);

    if (response.success && response.data) {
      return this.createResponse(this.mapFromPracticePantherClient(response.data));
    }

    return response;
  }

  // Matter Methods
  async getMatters(clientId?: string, filters?: MatterFilters): Promise<ApiResponse<Matter[]>> {
    const params = this.buildMatterFilters(clientId, filters);
    const response = await this.makeRequest<any>('GET', '/Matters', undefined, params);

    if (response.success && response.data) {
      const matters = Array.isArray(response.data) ? response.data : [response.data];
      return this.createResponse(matters.map(this.mapFromPracticePantherMatter.bind(this)));
    }

    return response;
  }

  async getMatter(id: string): Promise<ApiResponse<Matter>> {
    const response = await this.makeRequest<any>('GET', `/Matters/${id}`);

    if (response.success && response.data) {
      return this.createResponse(this.mapFromPracticePantherMatter(response.data));
    }

    return response;
  }

  async createMatter(matter: Omit<Matter, 'id'>): Promise<ApiResponse<Matter>> {
    const validation = this.validateMatter(matter);
    if (validation) {
      throw new ValidationError('practice-panther', 'matter', validation);
    }

    const ppMatter = this.mapToPracticePantherMatter(matter);
    const response = await this.makeRequest<any>('POST', '/Matters', ppMatter);

    if (response.success && response.data) {
      return this.createResponse(this.mapFromPracticePantherMatter(response.data));
    }

    return response;
  }

  // User Methods
  async getUsers(): Promise<ApiResponse<User[]>> {
    const response = await this.makeRequest<any>('GET', '/Users');

    if (response.success && response.data) {
      const users = Array.isArray(response.data) ? response.data : [response.data];
      return this.createResponse(users.map(this.mapFromPracticePantherUser.bind(this)));
    }

    return response;
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    const response = await this.makeRequest<any>('GET', '/Users/current');

    if (response.success && response.data) {
      return this.createResponse(this.mapFromPracticePantherUser(response.data));
    }

    return response;
  }

  // Mapping Methods - Convert between Involex and Practice Panther formats
  private mapToPracticePantherTimeEntry(entry: TimeEntry): any {
    return {
      ContactId: entry.clientId,
      MatterId: entry.matterId,
      Date: this.formatDate(entry.date),
      Hours: entry.hours,
      Description: entry.description,
      Rate: entry.billableRate,
      IsBillable: entry.billable,
      ActivityId: entry.activityCode,
      TaskId: entry.taskCode,
      UserId: entry.userId,
      Status: this.mapToPracticePantherStatus(entry.status || 'draft')
    };
  }

  private mapFromPracticePantherTimeEntry(ppEntry: any): TimeEntry {
    return {
      id: ppEntry.Id?.toString(),
      clientId: ppEntry.ContactId?.toString(),
      matterId: ppEntry.MatterId?.toString(),
      date: ppEntry.Date,
      hours: parseFloat(ppEntry.Hours) || 0,
      description: ppEntry.Description || '',
      billableRate: parseFloat(ppEntry.Rate) || undefined,
      billable: ppEntry.IsBillable !== false,
      activityCode: ppEntry.ActivityId?.toString(),
      taskCode: ppEntry.TaskId?.toString(),
      userId: ppEntry.UserId?.toString(),
      status: this.mapFromPracticePantherStatus(ppEntry.Status),
      metadata: {
        practicePantherId: ppEntry.Id,
        createdDate: ppEntry.CreatedDate,
        modifiedDate: ppEntry.ModifiedDate
      }
    };
  }

  private mapToPracticePantherClient(client: Omit<Client, 'id'>): any {
    return {
      Name: client.name,
      Email: client.email,
      Phone: client.phone,
      Address: client.address,
      IsActive: client.status === 'active',
      DefaultRate: client.defaultRate,
      ContactType: 'Client'
    };
  }

  private mapFromPracticePantherClient(ppClient: any): Client {
    return {
      id: ppClient.Id?.toString(),
      name: ppClient.Name || '',
      email: ppClient.Email,
      phone: ppClient.Phone,
      address: ppClient.Address,
      status: ppClient.IsActive !== false ? 'active' : 'inactive',
      defaultRate: parseFloat(ppClient.DefaultRate) || undefined,
      metadata: {
        practicePantherId: ppClient.Id,
        contactType: ppClient.ContactType,
        createdDate: ppClient.CreatedDate,
        modifiedDate: ppClient.ModifiedDate
      }
    };
  }

  private mapToPracticePantherMatter(matter: Omit<Matter, 'id'>): any {
    return {
      ContactId: matter.clientId,
      Name: matter.name,
      Description: matter.description,
      Status: matter.status === 'active' ? 'Open' : matter.status === 'closed' ? 'Closed' : 'Inactive',
      OpenDate: this.formatDate(matter.openDate),
      CloseDate: matter.closeDate ? this.formatDate(matter.closeDate) : null,
      PracticeArea: matter.practiceArea,
      ResponsibleAttorney: matter.responsibleAttorney
    };
  }

  private mapFromPracticePantherMatter(ppMatter: any): Matter {
    return {
      id: ppMatter.Id?.toString(),
      clientId: ppMatter.ContactId?.toString(),
      name: ppMatter.Name || '',
      description: ppMatter.Description,
      status: this.mapFromPracticePantherMatterStatus(ppMatter.Status),
      openDate: ppMatter.OpenDate,
      closeDate: ppMatter.CloseDate,
      practiceArea: ppMatter.PracticeArea,
      responsibleAttorney: ppMatter.ResponsibleAttorney,
      metadata: {
        practicePantherId: ppMatter.Id,
        createdDate: ppMatter.CreatedDate,
        modifiedDate: ppMatter.ModifiedDate
      }
    };
  }

  private mapFromPracticePantherUser(ppUser: any): User {
    return {
      id: ppUser.Id?.toString(),
      name: `${ppUser.FirstName || ''} ${ppUser.LastName || ''}`.trim(),
      email: ppUser.Email || '',
      role: ppUser.Role || 'user',
      defaultRate: parseFloat(ppUser.DefaultRate) || undefined,
      isActive: ppUser.IsActive !== false,
      metadata: {
        practicePantherId: ppUser.Id,
        firstName: ppUser.FirstName,
        lastName: ppUser.LastName,
        createdDate: ppUser.CreatedDate,
        modifiedDate: ppUser.ModifiedDate
      }
    };
  }

  // Status mapping helpers
  private mapToPracticePantherStatus(status: string): string {
    switch (status) {
      case 'draft': return 'Draft';
      case 'pending': return 'Pending';
      case 'approved': return 'Approved';
      case 'billed': return 'Billed';
      default: return 'Draft';
    }
  }

  private mapFromPracticePantherStatus(status: string): TimeEntry['status'] {
    switch (status?.toLowerCase()) {
      case 'draft': return 'draft';
      case 'pending': return 'pending';
      case 'approved': return 'approved';
      case 'billed': return 'billed';
      default: return 'draft';
    }
  }

  private mapFromPracticePantherMatterStatus(status: string): Matter['status'] {
    switch (status?.toLowerCase()) {
      case 'open': return 'active';
      case 'closed': return 'closed';
      case 'inactive': return 'inactive';
      default: return 'active';
    }
  }

  // Filter builders
  private buildTimeEntryFilters(filters?: TimeEntryFilters): Record<string, any> {
    const params: Record<string, any> = this.buildPaginationParams(filters?.limit, filters?.offset);

    if (filters?.startDate) params.StartDate = filters.startDate;
    if (filters?.endDate) params.EndDate = filters.endDate;
    if (filters?.clientId) params.ContactId = filters.clientId;
    if (filters?.matterId) params.MatterId = filters.matterId;
    if (filters?.userId) params.UserId = filters.userId;
    if (filters?.billable !== undefined) params.IsBillable = filters.billable;
    if (filters?.status) params.Status = this.mapToPracticePantherStatus(filters.status);

    return params;
  }

  private buildClientFilters(filters?: ClientFilters): Record<string, any> {
    const params: Record<string, any> = this.buildPaginationParams(filters?.limit, filters?.offset);

    if (filters?.search) params.Search = filters.search;
    if (filters?.status) params.IsActive = filters.status === 'active';
    params.ContactType = 'Client'; // Only get clients, not all contacts

    return params;
  }

  private buildMatterFilters(clientId?: string, filters?: MatterFilters): Record<string, any> {
    const params: Record<string, any> = this.buildPaginationParams(filters?.limit, filters?.offset);

    if (clientId) params.ContactId = clientId;
    if (filters?.search) params.Search = filters.search;
    if (filters?.status) {
      params.Status = filters.status === 'active' ? 'Open' : 
                     filters.status === 'closed' ? 'Closed' : 'Inactive';
    }
    if (filters?.practiceArea) params.PracticeArea = filters.practiceArea;
    if (filters?.responsibleAttorney) params.ResponsibleAttorney = filters.responsibleAttorney;

    return params;
  }
}
