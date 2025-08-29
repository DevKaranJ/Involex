// Jest Test Setup for Involex Extension
// Configures testing environment for Phase 6 Settings & Configuration

import '@testing-library/jest-dom';

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    getManifest: jest.fn(() => ({ version: '1.0.0' })),
    openOptionsPage: jest.fn(),
    onInstalled: {
      addListener: jest.fn()
    },
    onStartup: {
      addListener: jest.fn()
    }
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
      remove: jest.fn(),
      getBytesInUse: jest.fn(() => Promise.resolve(1024))
    },
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
      remove: jest.fn(),
      getBytesInUse: jest.fn(() => Promise.resolve(512)),
      QUOTA_BYTES: 102400
    }
  },
  tabs: {
    onUpdated: {
      addListener: jest.fn()
    },
    query: jest.fn(),
    executeScript: jest.fn()
  },
  scripting: {
    executeScript: jest.fn()
  },
  action: {
    openPopup: jest.fn(),
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn()
  },
  notifications: {
    create: jest.fn(),
    clear: jest.fn(),
    onClicked: {
      addListener: jest.fn()
    }
  },
  identity: {
    getAuthToken: jest.fn(),
    removeCachedAuthToken: jest.fn()
  }
};

// @ts-ignore
global.chrome = mockChrome;

// Mock Web APIs
global.fetch = jest.fn();
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock Web Crypto API for security tests
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: jest.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
    subtle: {
      generateKey: jest.fn(),
      importKey: jest.fn(),
      exportKey: jest.fn(),
      encrypt: jest.fn(),
      decrypt: jest.fn(),
      sign: jest.fn(),
      verify: jest.fn()
    }
  }
});

// Mock TextEncoder/TextDecoder
(global as any).TextEncoder = class TextEncoder {
  encode(input: string): Uint8Array {
    return new Uint8Array(Array.from(input).map(char => char.charCodeAt(0)));
  }
  get encoding() { return 'utf-8'; }
  encodeInto() { throw new Error('Not implemented in mock'); }
};

(global as any).TextDecoder = class TextDecoder {
  decode(input: Uint8Array): string {
    return String.fromCharCode(...input);
  }
  get encoding() { return 'utf-8'; }
  get fatal() { return false; }
  get ignoreBOM() { return false; }
};

// Mock localStorage for settings persistence
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

// Mock window.confirm and window.alert
global.confirm = jest.fn(() => true);
global.alert = jest.fn();

// Mock console methods for cleaner test output
const originalConsole = { ...console };
beforeEach(() => {
  // Reset mocks before each test
  jest.clearAllMocks();
  
  // Reset Chrome API mocks to default behavior
  mockChrome.runtime.sendMessage.mockResolvedValue({ success: true, data: {} });
  mockChrome.storage.local.get.mockResolvedValue({});
  mockChrome.storage.sync.get.mockResolvedValue({});
  mockChrome.storage.local.set.mockResolvedValue(undefined);
  mockChrome.storage.sync.set.mockResolvedValue(undefined);
  
  // Mock crypto operations
  mockChrome.runtime.sendMessage.mockImplementation((message) => {
    // Default mock responses for common message types
    switch (message.type) {
      case 'GET_USER_SETTINGS':
        return Promise.resolve({
          success: true,
          data: {
            billingRates: { default: 300, minimum: 0.1, increment: 0.1 },
            aiSettings: { analysisEnabled: true, confidenceThreshold: 0.7 },
            notifications: { enabled: true, emailDetection: true },
            security: { encryptionEnabled: true, auditLoggingEnabled: true }
          }
        });
      case 'GET_BILLING_ENTRIES':
        return Promise.resolve({
          success: true,
          data: []
        });
      case 'GET_STORAGE_USAGE':
        return Promise.resolve({
          success: true,
          data: { local: { used: 1024 }, sync: { used: 512 } }
        });
      case 'GET_SECURITY_STATUS':
        return Promise.resolve({
          success: true,
          data: {
            encryptionEnabled: true,
            auditLogsCount: 10,
            privilegedEntries: 2,
            lastCheck: new Date().toISOString()
          }
        });
      default:
        return Promise.resolve({ success: true, data: {} });
    }
  });
});

afterEach(() => {
  // Restore original console
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
});

// Global test utilities
(global as any).testUtils = {
  // Create mock billing entry
  createMockBillingEntry: (overrides = {}) => ({
    id: 'test-entry-1',
    emailId: 'email-123',
    subject: 'Legal consultation email',
    sender: 'client@example.com',
    recipients: ['lawyer@lawfirm.com'],
    timestamp: new Date().toISOString(),
    content: 'This is a legal consultation email requiring billing.',
    aiAnalysis: {
      isLegalWork: true,
      confidence: 0.85,
      estimatedTime: 0.3,
      estimatedAmount: 90,
      description: 'Email correspondence: Legal consultation email',
      workType: 'correspondence' as const,
      keywords: ['legal', 'consultation']
    },
    status: 'pending' as const,
    createdAt: new Date().toISOString(),
    isPrivileged: false,
    ...overrides
  }),

  // Create mock user settings
  createMockUserSettings: (overrides = {}) => ({
    isAuthenticated: false,
    billingRates: {
      default: 300,
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
    uiPreferences: {
      theme: 'auto' as const,
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
    onboardingCompleted: false,
    ...overrides
  }),

  // Mock Chrome runtime message
  mockChromeMessage: (type: string, data?: any) => {
    mockChrome.runtime.sendMessage.mockImplementation((message) => {
      if (message.type === type) {
        return Promise.resolve({ success: true, data });
      }
      return Promise.resolve({ success: true, data: {} });
    });
  },

  // Simulate user interaction delay
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock security manager
  mockSecurityManager: {
    logSecurityEvent: jest.fn(),
    initializeEncryption: jest.fn(),
    encryptData: jest.fn(),
    decryptData: jest.fn(),
    getAuditLogs: jest.fn(() => Promise.resolve([])),
    clearAllSensitiveData: jest.fn(),
    enforceDataRetention: jest.fn()
  }
};

// Configure Jest timeouts for async operations
jest.setTimeout(10000);

// Suppress console warnings in tests unless debugging
if (!process.env.DEBUG_TESTS) {
  console.warn = jest.fn();
  console.log = jest.fn();
}

console.log('🧪 Jest test environment configured for Involex Extension Phase 6');
