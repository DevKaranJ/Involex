// Environment Configuration for Involex Extension
// Handles different environments (development, staging, production)

export interface EnvironmentConfig {
  apiBaseUrl: string;
  wsBaseUrl?: string;
  environment: 'development' | 'staging' | 'production';
  features: {
    enableAI: boolean;
    enableSync: boolean;
    enableAnalytics: boolean;
    enableDebugMode: boolean;
  };
  timeouts: {
    apiRequest: number;
    syncOperation: number;
    aiAnalysis: number;
  };
  retryConfig: {
    maxRetries: number;
    initialDelay: number;
    backoffMultiplier: number;
  };
}

const environments: Record<string, EnvironmentConfig> = {
  development: {
    apiBaseUrl: 'http://localhost:3001',
    wsBaseUrl: 'ws://localhost:3001',
    environment: 'development',
    features: {
      enableAI: true,
      enableSync: true,
      enableAnalytics: true,
      enableDebugMode: true,
    },
    timeouts: {
      apiRequest: 10000, // 10 seconds
      syncOperation: 30000, // 30 seconds
      aiAnalysis: 45000, // 45 seconds
    },
    retryConfig: {
      maxRetries: 3,
      initialDelay: 1000,
      backoffMultiplier: 2,
    },
  },
  
  staging: {
    apiBaseUrl: 'https://staging-api.involex.com',
    wsBaseUrl: 'wss://staging-api.involex.com',
    environment: 'staging',
    features: {
      enableAI: true,
      enableSync: true,
      enableAnalytics: true,
      enableDebugMode: false,
    },
    timeouts: {
      apiRequest: 15000, // 15 seconds
      syncOperation: 60000, // 60 seconds
      aiAnalysis: 60000, // 60 seconds
    },
    retryConfig: {
      maxRetries: 5,
      initialDelay: 1000,
      backoffMultiplier: 1.5,
    },
  },
  
  production: {
    apiBaseUrl: 'https://involex-api.onrender.com',
    wsBaseUrl: 'wss://involex-api.onrender.com',
    environment: 'production',
    features: {
      enableAI: true,
      enableSync: true,
      enableAnalytics: true,
      enableDebugMode: false,
    },
    timeouts: {
      apiRequest: 30000, // 30 seconds (Render free tier can be slow)
      syncOperation: 180000, // 3 minutes (account for cold starts)
      aiAnalysis: 120000, // 2 minutes
    },
    retryConfig: {
      maxRetries: 8, // More retries for free tier (cold starts)
      initialDelay: 3000, // Longer initial delay
      backoffMultiplier: 2,
    },
  },

  // FREE TIER DEPLOYMENT (Render.com)
  render_free: {
    apiBaseUrl: 'https://involex-api.onrender.com',
    wsBaseUrl: 'wss://involex-api.onrender.com',
    environment: 'production',
    features: {
      enableAI: true,
      enableSync: true,
      enableAnalytics: false, // Disabled to save resources
      enableDebugMode: false,
    },
    timeouts: {
      apiRequest: 45000, // 45 seconds (cold start + processing)
      syncOperation: 300000, // 5 minutes (free tier limitations)
      aiAnalysis: 180000, // 3 minutes (OpenAI + cold start)
    },
    retryConfig: {
      maxRetries: 10, // Maximum retries for free tier reliability
      initialDelay: 5000, // 5 second initial delay for cold starts
      backoffMultiplier: 1.5, // Gradual backoff
    },
  },
};

class ConfigManager {
  private currentConfig: EnvironmentConfig;
  private environmentOverride?: string;

  constructor() {
    // Detect environment from extension ID or manifest
    const environment = this.detectEnvironment();
    this.currentConfig = environments[environment];
    
    console.log(`🔧 Involex Extension initialized in ${environment} mode`);
    console.log(`🌐 API Base URL: ${this.currentConfig.apiBaseUrl}`);
  }

  private detectEnvironment(): string {
    // Check for environment override (useful for testing)
    if (this.environmentOverride) {
      return this.environmentOverride;
    }

    // Check Chrome extension ID patterns
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      const extensionId = chrome.runtime.id;
      
      // Production extension ID pattern (will be assigned by Chrome Web Store)
      if (extensionId && extensionId.match(/^[a-z]{32}$/)) {
        return 'render_free'; // Use free tier for production
      }
      
      // Development/unpacked extension
      if (extensionId && (extensionId.includes('unpacked') || extensionId.length < 32)) {
        return 'development';
      }
    }

    // Check hostname patterns for web extension detection
    if (typeof window !== 'undefined') {
      const hostname = window.location?.hostname;
      
      if (hostname?.includes('staging')) {
        return 'staging';
      }
      
      if (hostname?.includes('localhost') || hostname?.includes('127.0.0.1')) {
        return 'development';
      }
    }

    // Default to render_free for production deployment
    return 'render_free';
  }

  getConfig(): EnvironmentConfig {
    return { ...this.currentConfig };
  }

  getApiBaseUrl(): string {
    return this.currentConfig.apiBaseUrl;
  }

  getWebSocketUrl(): string | undefined {
    return this.currentConfig.wsBaseUrl;
  }

  isFeatureEnabled(feature: keyof EnvironmentConfig['features']): boolean {
    return this.currentConfig.features[feature];
  }

  getTimeout(type: keyof EnvironmentConfig['timeouts']): number {
    return this.currentConfig.timeouts[type];
  }

  getRetryConfig(): EnvironmentConfig['retryConfig'] {
    return { ...this.currentConfig.retryConfig };
  }

  isProduction(): boolean {
    return this.currentConfig.environment === 'production';
  }

  isDevelopment(): boolean {
    return this.currentConfig.environment === 'development';
  }

  isStaging(): boolean {
    return this.currentConfig.environment === 'staging';
  }

  // Allow environment override for testing
  setEnvironmentOverride(env: 'development' | 'staging' | 'production'): void {
    this.environmentOverride = env;
    this.currentConfig = environments[env];
    
    console.log(`🔄 Environment override set to: ${env}`);
  }

  // Update API URL dynamically (useful for user-configurable backends)
  setCustomApiUrl(url: string): void {
    this.currentConfig.apiBaseUrl = url;
    console.log(`🔗 Custom API URL set: ${url}`);
  }

  // Validation methods
  validateConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate API URL
    try {
      new URL(this.currentConfig.apiBaseUrl);
    } catch {
      errors.push('Invalid API base URL');
    }

    // Validate WebSocket URL if provided
    if (this.currentConfig.wsBaseUrl) {
      try {
        new URL(this.currentConfig.wsBaseUrl);
      } catch {
        errors.push('Invalid WebSocket URL');
      }
    }

    // Validate timeouts
    const timeouts = this.currentConfig.timeouts;
    if (timeouts.apiRequest <= 0 || timeouts.syncOperation <= 0 || timeouts.aiAnalysis <= 0) {
      errors.push('Invalid timeout configuration');
    }

    // Validate retry config
    const retry = this.currentConfig.retryConfig;
    if (retry.maxRetries < 0 || retry.initialDelay <= 0 || retry.backoffMultiplier <= 0) {
      errors.push('Invalid retry configuration');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Get configuration for logging/debugging
  getConfigSummary(): object {
    return {
      environment: this.currentConfig.environment,
      apiBaseUrl: this.currentConfig.apiBaseUrl,
      features: this.currentConfig.features,
      isValid: this.validateConfiguration().isValid
    };
  }
}

// Singleton instance
export const config = new ConfigManager();

// Export commonly used values
export const API_BASE_URL = config.getApiBaseUrl();
export const ENVIRONMENT = config.getConfig().environment;
export const IS_PRODUCTION = config.isProduction();
export const IS_DEVELOPMENT = config.isDevelopment();

// Development helpers
export const debugLog = (...args: any[]) => {
  if (config.isFeatureEnabled('enableDebugMode')) {
    console.log('[Involex Debug]', ...args);
  }
};

export const performanceLog = (operation: string, startTime: number) => {
  if (config.isFeatureEnabled('enableDebugMode')) {
    const duration = Date.now() - startTime;
    console.log(`[Involex Performance] ${operation}: ${duration}ms`);
  }
};
