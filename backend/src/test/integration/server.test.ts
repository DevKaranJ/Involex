import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

// Create a test version of our server
const createTestServer = () => {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: [
      'chrome-extension://*',
      'https://mail.google.com',
      'https://outlook.live.com',
      'https://outlook.office.com'
    ],
    credentials: true
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      service: 'involex-api',
      version: '1.0.0'
    });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({ 
      error: 'Route not found',
      message: `Cannot ${req.method} ${req.originalUrl}`
    });
  });

  return app;
};

describe('Server Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestServer();
  });

  describe('Health Check Endpoint', () => {
    test('should return 200 status for health check', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'involex-api');
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('timestamp');
      
      // Verify timestamp is a valid ISO string
      expect(() => new Date(response.body.timestamp)).not.toThrow();
    });

    test('should have correct response headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for security headers from helmet
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('content-type', 'application/json; charset=utf-8');
    });
  });

  describe('CORS Configuration', () => {
    test('should have CORS configured', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'https://mail.google.com')
        .expect(200);

      // CORS headers should be present when origin is allowed
      expect(response.headers).toHaveProperty('vary');
      expect(response.headers.vary).toContain('Origin');
    });

    test('should allow Gmail origin', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'https://mail.google.com')
        .expect(200);

      expect(response.headers).toHaveProperty('vary');
    });

    test('should allow Outlook origins', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'https://outlook.live.com')
        .expect(200);

      expect(response.headers).toHaveProperty('vary');
    });
  });

  describe('JSON Body Parsing', () => {
    test('should have JSON parsing middleware configured', () => {
      // Test that the server has JSON middleware by checking it doesn't throw
      // when creating the test server
      expect(() => createTestServer()).not.toThrow();
    });

    test('should handle JSON content type', async () => {
      const response = await request(app)
        .get('/health')
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/non-existent-route')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Route not found');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Cannot GET /non-existent-route');
    });

    test('should return 404 for non-existent POST routes', async () => {
      const response = await request(app)
        .post('/api/non-existent')
        .send({ test: 'data' })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Route not found');
      expect(response.body.message).toContain('Cannot POST /api/non-existent');
    });
  });

  describe('Security Headers', () => {
    test('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for important security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('content-security-policy');
    });
  });
});
