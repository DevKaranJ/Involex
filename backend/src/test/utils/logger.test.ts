import { logger } from '../../utils/logger';

describe('Logger Utility', () => {
  // Mock console methods to capture log output
  const consoleSpy = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Logger Configuration', () => {
    test('should be defined and have required methods', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    test('should handle info logging', () => {
      const testMessage = 'Test info message';
      const testMeta = { service: 'test', timestamp: new Date().toISOString() };
      
      // This should not throw an error
      expect(() => {
        logger.info(testMessage, testMeta);
      }).not.toThrow();
    });

    test('should handle error logging', () => {
      const testError = new Error('Test error');
      const testMeta = { service: 'test' };
      
      // This should not throw an error
      expect(() => {
        logger.error('Test error message', testError, testMeta);
      }).not.toThrow();
    });

    test('should handle warn logging', () => {
      const testMessage = 'Test warning message';
      
      expect(() => {
        logger.warn(testMessage);
      }).not.toThrow();
    });

    test('should handle debug logging', () => {
      const testMessage = 'Test debug message';
      const testData = { key: 'value', number: 123 };
      
      expect(() => {
        logger.debug(testMessage, testData);
      }).not.toThrow();
    });
  });

  describe('Logger in Test Environment', () => {
    test('should respect test environment settings', () => {
      // In test environment, logger should not actually output to console
      // This is controlled by our test setup
      expect(process.env.NODE_ENV).toBe('test');
      
      // Logger should still accept calls without throwing
      expect(() => {
        logger.info('Test message in test environment');
        logger.error('Test error in test environment');
        logger.warn('Test warning in test environment');
      }).not.toThrow();
    });

    test('should handle structured logging format', () => {
      const structuredData = {
        service: 'involex-api',
        operation: 'email-analysis',
        timestamp: new Date().toISOString(),
        metadata: {
          emailId: 'test-123',
          processingTime: 150
        }
      };

      expect(() => {
        logger.info('Structured log test', structuredData);
      }).not.toThrow();
    });

    test('should handle edge cases', () => {
      // Test with undefined/null values
      expect(() => {
        logger.info(undefined as any);
        logger.info(null as any);
        logger.info('');
      }).not.toThrow();

      // Test with complex objects
      const complexObject = {
        nested: {
          array: [1, 2, 3],
          object: { key: 'value' },
          function: () => 'test'
        },
        circular: {} as any
      };
      complexObject.circular.self = complexObject;

      expect(() => {
        logger.info('Complex object test', complexObject);
      }).not.toThrow();
    });
  });
});
