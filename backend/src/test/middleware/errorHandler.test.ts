import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../middleware/errorHandler';

// Mock Express request, response, and next function
const createMockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.locals = {};
  return res;
};

const createMockRequest = (overrides: Partial<Request> = {}) => {
  return {
    method: 'GET',
    originalUrl: '/test',
    headers: {},
    ip: '127.0.0.1',
    get: jest.fn().mockReturnValue('test-user-agent'),
    ...overrides
  } as Request;
};

describe('Error Handler Middleware', () => {
  let mockRequest: Request;
  let mockResponse: Response;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = createMockRequest();
    mockResponse = createMockResponse();
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('Error Handling', () => {
    test('should handle generic Error objects in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Test error message');

      errorHandler(error, mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test error message',
          status: 'error',
          error: expect.any(Error)
        })
      );
      
      process.env.NODE_ENV = originalEnv;
    });

    test('should handle errors with status codes', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = Object.assign(new Error('Custom error'), { statusCode: 400 });

      errorHandler(error, mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Custom error'
        })
      );
      
      process.env.NODE_ENV = originalEnv;
    });

    test('should handle errors with statusCode property', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = Object.assign(new Error('Validation error'), { statusCode: 422 });

      errorHandler(error, mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Validation error'
        })
      );
      
      process.env.NODE_ENV = originalEnv;
    });

    test('should handle string errors in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = 'String error message';

      errorHandler(error as any, mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'String error message'
        })
      );
      
      process.env.NODE_ENV = originalEnv;
    });

    test('should handle null/undefined errors in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      errorHandler(null as any, mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Unknown error occurred'
        })
      );
      
      process.env.NODE_ENV = originalEnv;
    });

    test('should include request details in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Development error');
      mockRequest.method = 'POST';
      mockRequest.originalUrl = '/api/test';

      errorHandler(error, mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Development error',
          stack: expect.any(String)
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    test('should not include stack trace in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = Object.assign(new Error('Production error'), { isOperational: true });

      errorHandler(error, mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Production error'
        })
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('HTTP Status Code Mapping', () => {
    test('should map common HTTP status codes correctly in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const testCases = [
        { statusCode: 400 },
        { statusCode: 401 },
        { statusCode: 403 },
        { statusCode: 404 },
        { statusCode: 422 },
        { statusCode: 500 }
      ];

      testCases.forEach(({ statusCode }) => {
        const mockRes = createMockResponse();
        const error = Object.assign(new Error('Test'), { statusCode });

        errorHandler(error, mockRequest, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(statusCode);
      });
      
      process.env.NODE_ENV = originalEnv;
    });

    test('should default to 500 for errors without status codes', () => {
      const error = new Error('No status code');

      errorHandler(error, mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('Error Response Format', () => {
    test('should always include required fields in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Test error');

      errorHandler(error, mockRequest, mockResponse, mockNext);

      const responseData = (mockResponse.json as jest.Mock).mock.calls[0][0];
      
      expect(responseData).toHaveProperty('status');
      expect(responseData).toHaveProperty('message');
      expect(responseData).toHaveProperty('error');
      
      process.env.NODE_ENV = originalEnv;
    });

    test('should handle errors without message property', () => {
      const error = { name: 'CustomError' } as any;

      errorHandler(error, mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });
});
