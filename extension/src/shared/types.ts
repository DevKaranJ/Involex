// Shared Types for Involex Extension

export interface BillingEntry {
  id: string;
  emailId: string;
  subject: string;
  sender: string;
  recipients: string[];
  timestamp: string;
  content?: string;
  threadId?: string;
  
  // AI Analysis Results
  aiAnalysis?: {
    isLegalWork: boolean;
    confidence: number;
    estimatedTime: number;
    estimatedAmount: number;
    description: string;
    workType: string;
    client?: string;
    matter?: string;
    keywords: string[];
  };
  
  // User Adjustments
  adjustedTime?: number;
  adjustedAmount?: number;
  adjustedDescription?: string;
  assignedClient?: string;
  assignedMatter?: string;
  
  // Status Tracking
  status: 'pending' | 'approved' | 'synced' | 'rejected';
  createdAt: string;
  approvedAt?: string;
  syncedAt?: string;
  rejectedAt?: string;
  lastModified?: string;
  
  // Privacy & Security
  isPrivileged?: boolean;
  requiresEncryption?: boolean;
  
  // Practice Management Integration
  practiceMgmtId?: string;
  platform?: string;
}

export interface UserSettings {
  // Authentication
  isAuthenticated: boolean;
  apiToken?: string;
  userId?: string;
  
  // Billing Configuration
  billingRates: {
    default: number;
    minimum: number;
    increment: number;
    clientSpecific?: Record<string, number>;
  };
  
  // AI Settings
  aiSettings: {
    analysisEnabled: boolean;
    autoTimeEstimation: boolean;
    autoClientDetection: boolean;
    confidenceThreshold: number;
    keywords: string[];
  };
  
  // Notification Preferences
  notifications: {
    enabled: boolean;
    emailDetection: boolean;
    billingReminders: boolean;
    syncStatus: boolean;
  };
  
  // Practice Management Integration
  practiceManagement: {
    platform: 'cleo' | 'practice_panther' | 'mycase';
    credentials: any;
    lastSync?: string;
  };
  
  // UI Preferences
  uiPreferences: {
    theme: 'light' | 'dark' | 'auto';
    compactView: boolean;
    autoApprove: boolean;
  };
  
  // Security & Privacy Settings
  security: {
    encryptionEnabled: boolean;
    auditLoggingEnabled: boolean;
    privilegeProtection: boolean;
    dataRetentionYears: number;
    autoLogoutMinutes: number;
    requireDataEncryption: boolean;
  };
  
  // Onboarding
  isFirstTime: boolean;
  onboardingCompleted: boolean;
  
  // Advanced Settings
  debug?: boolean;
  processingInterval?: number;
  apiTimeout?: number;
}

export interface EmailData {
  id: string;
  subject: string;
  sender: string;
  recipients: string[];
  timestamp: string;
  content: string;
  threadId?: string;
  platform: 'gmail' | 'outlook';
}

export interface AnalysisResult {
  isLegalWork: boolean;
  confidence: number;
  estimatedTime: number;
  estimatedAmount: number;
  description: string;
  workType: 'correspondence' | 'research' | 'drafting' | 'review' | 'meeting' | 'call' | 'other';
  client?: string;
  matter?: string;
  keywords: string[];
  reasoning?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface MessageType {
  EMAIL_DETECTED: {
    data: EmailData;
  };
  ANALYZE_EMAIL: {
    data: EmailData;
  };
  GET_BILLING_ENTRIES: {};
  APPROVE_BILLING_ENTRY: {
    data: BillingEntry;
  };
  GET_USER_SETTINGS: {};
  UPDATE_USER_SETTINGS: {
    data: Partial<UserSettings>;
  };
  OPEN_BILLING_ENTRY: {
    data: EmailData;
  };
  SYNC_ENTRIES: {};
}

export type MessageTypes = keyof MessageType;

// Utility Types
export type WorkType = AnalysisResult['workType'];
export type BillingStatus = BillingEntry['status'];
export type Platform = EmailData['platform'];

// Constants
export const WORK_TYPES: Record<WorkType, string> = {
  correspondence: 'Email Correspondence',
  research: 'Legal Research',
  drafting: 'Document Drafting',
  review: 'Document Review',
  meeting: 'Client Meeting',
  call: 'Phone Call',
  other: 'Other Legal Work'
};

export const BILLING_STATUSES: Record<BillingStatus, string> = {
  pending: 'Pending Review',
  approved: 'Approved',
  synced: 'Synced to PMS',
  rejected: 'Rejected'
};

export const PLATFORMS: Record<Platform, string> = {
  gmail: 'Gmail',
  outlook: 'Microsoft Outlook'
};

// Default Settings
export const DEFAULT_USER_SETTINGS: UserSettings = {
  isAuthenticated: false,
  billingRates: {
    default: 300.00,
    minimum: 0.1,
    increment: 0.1
  },
  aiSettings: {
    analysisEnabled: true,
    autoTimeEstimation: true,
    autoClientDetection: true,
    confidenceThreshold: 0.7,
    keywords: []
  },
  notifications: {
    enabled: true,
    emailDetection: true,
    billingReminders: true,
    syncStatus: true
  },
  practiceManagement: {
    platform: 'mycase',
    credentials: {}
  },
  uiPreferences: {
    theme: 'auto',
    compactView: false,
    autoApprove: false
  },
  security: {
    encryptionEnabled: true,
    auditLoggingEnabled: true,
    privilegeProtection: true,
    dataRetentionYears: 7,
    autoLogoutMinutes: 60,
    requireDataEncryption: true
  },
  isFirstTime: true,
  onboardingCompleted: false
};
