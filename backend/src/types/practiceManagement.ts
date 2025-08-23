// Practice Management API Types
// This file defines the common interfaces for all practice management integrations

export interface TimeEntry {
  id?: string;
  clientId: string;
  matterId?: string;
  date: string;
  hours: number;
  description: string;
  billableRate?: number;
  billable: boolean;
  activityCode?: string;
  taskCode?: string;
  userId?: string;
  status?: 'draft' | 'pending' | 'approved' | 'billed';
  metadata?: Record<string, any>;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  status: 'active' | 'inactive';
  defaultRate?: number;
  metadata?: Record<string, any>;
}

export interface Matter {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'closed';
  openDate: string;
  closeDate?: string;
  practiceArea?: string;
  responsibleAttorney?: string;
  metadata?: Record<string, any>;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  defaultRate?: number;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface BillingEntry {
  timeEntry: TimeEntry;
  client: Client;
  matter?: Matter;
  user?: User;
}

export interface PracticeManagementConfig {
  platform: 'cleo' | 'practice-panther' | 'mycase';
  apiKey?: string;
  apiSecret?: string;
  subdomain?: string;
  baseUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export interface PracticeManagementAdapter {
  // Configuration
  configure(config: PracticeManagementConfig): Promise<void>;
  validateConnection(): Promise<boolean>;
  
  // Authentication
  authenticate(): Promise<ApiResponse<{ token: string; expiresAt: Date }>>;
  refreshAuthentication(): Promise<ApiResponse<{ token: string; expiresAt: Date }>>;
  
  // Time Entries
  createTimeEntry(entry: TimeEntry): Promise<ApiResponse<TimeEntry>>;
  updateTimeEntry(id: string, entry: Partial<TimeEntry>): Promise<ApiResponse<TimeEntry>>;
  deleteTimeEntry(id: string): Promise<ApiResponse<void>>;
  getTimeEntries(filters?: TimeEntryFilters): Promise<ApiResponse<TimeEntry[]>>;
  
  // Clients
  getClients(filters?: ClientFilters): Promise<ApiResponse<Client[]>>;
  getClient(id: string): Promise<ApiResponse<Client>>;
  createClient(client: Omit<Client, 'id'>): Promise<ApiResponse<Client>>;
  
  // Matters
  getMatters(clientId?: string, filters?: MatterFilters): Promise<ApiResponse<Matter[]>>;
  getMatter(id: string): Promise<ApiResponse<Matter>>;
  createMatter(matter: Omit<Matter, 'id'>): Promise<ApiResponse<Matter>>;
  
  // Users
  getUsers(): Promise<ApiResponse<User[]>>;
  getCurrentUser(): Promise<ApiResponse<User>>;
  
  // Sync and bulk operations
  bulkCreateTimeEntries(entries: TimeEntry[]): Promise<ApiResponse<TimeEntry[]>>;
  syncTimeEntries(entries: TimeEntry[]): Promise<ApiResponse<{ created: number; updated: number; errors: any[] }>>;
}

export interface TimeEntryFilters {
  startDate?: string;
  endDate?: string;
  clientId?: string;
  matterId?: string;
  userId?: string;
  billable?: boolean;
  status?: TimeEntry['status'];
  limit?: number;
  offset?: number;
}

export interface ClientFilters {
  search?: string;
  status?: Client['status'];
  limit?: number;
  offset?: number;
}

export interface MatterFilters {
  search?: string;
  status?: Matter['status'];
  practiceArea?: string;
  responsibleAttorney?: string;
  limit?: number;
  offset?: number;
}

export interface WebhookEvent {
  type: 'time_entry.created' | 'time_entry.updated' | 'time_entry.deleted' | 
        'client.created' | 'client.updated' | 'matter.created' | 'matter.updated';
  data: any;
  timestamp: string;
  signature?: string;
}

export interface SyncResult {
  success: boolean;
  processed: number;
  created: number;
  updated: number;
  errors: Array<{
    entry: TimeEntry;
    error: string;
  }>;
  summary: {
    totalTime: number;
    billableTime: number;
    clients: string[];
    matters: string[];
  };
}

// Error types for practice management operations
export class PracticeManagementError extends Error {
  constructor(
    message: string,
    public code: string,
    public platform: string,
    public statusCode?: number,
    public originalError?: any
  ) {
    super(message);
    this.name = 'PracticeManagementError';
  }
}

export class AuthenticationError extends PracticeManagementError {
  constructor(platform: string, message = 'Authentication failed', originalError?: any) {
    super(message, 'AUTH_ERROR', platform, 401, originalError);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends PracticeManagementError {
  constructor(platform: string, retryAfter?: number) {
    super('Rate limit exceeded', 'RATE_LIMIT', platform, 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
  
  retryAfter?: number;
}

export class ValidationError extends PracticeManagementError {
  constructor(platform: string, field: string, message: string) {
    super(`Validation failed for ${field}: ${message}`, 'VALIDATION_ERROR', platform, 400);
    this.name = 'ValidationError';
    this.field = field;
  }
  
  field: string;
}
