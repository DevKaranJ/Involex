// Jest Configuration for Involex Extension Testing
// Phase 6: Settings & Configuration - Complete Test Setup

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  
  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': 'jest-transform-stub'
  },
  
  // Test file patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{ts,tsx}'
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/build/'
  ],
  
  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: false,
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }]
  },
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/test/**/*',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/index.ts',
    '!src/content/**/*', // Content scripts are tested separately
    '!src/background/**/*' // Background scripts are tested separately
  ],
  
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json'
  ],
  
  coverageDirectory: 'coverage',
  
  // Coverage thresholds for Phase 6 components
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    },
    // Specific thresholds for critical Phase 6 components
    'src/options/OptionsApp.tsx': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    'src/shared/security.ts': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    'src/shared/storage.ts': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },
  
  // Clear mocks automatically
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true,
  
  // Verbose output for debugging
  verbose: process.env.CI || process.env.VERBOSE_TESTS,
  
  // Timeout for long-running tests (security validation)
  testTimeout: 10000,
  
  // Watch mode configuration
  watchman: false,
  
  // Test result processors
  reporters: [
    'default'
  ],
  
  // Error handling
  errorOnDeprecated: true,
  
  // Module directories
  moduleDirectories: ['node_modules', 'src']
};
