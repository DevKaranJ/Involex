import request from 'supertest';
import express from 'express';
import analysisRoutes from '../../routes/analysis';

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/analysis', analysisRoutes);
  return app;
};

describe('Analysis API Endpoints', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('POST /api/analysis/email', () => {
    const validEmailData = {
      emailData: {
        subject: 'Contract Review Request',
        content: 'Please review the attached NDA for legal compliance.',
        sender: 'client@lawfirm.com',
        recipients: ['lawyer@firm.com']
      }
    };

    test('should analyze email successfully', async () => {
      const response = await request(app)
        .post('/api/analysis/email')
        .send(validEmailData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('analysis');
      expect(response.body.analysis).toHaveProperty('estimatedTime');
      expect(response.body.analysis).toHaveProperty('workType');
      expect(response.body.analysis).toHaveProperty('confidence');
      expect(response.body.analysis).toHaveProperty('isLegalEmail');
      expect(response.body.analysis).toHaveProperty('billableContent');
      expect(response.body).toHaveProperty('metadata');
      expect(response.body).toHaveProperty('message');
    });

    test('should return 400 for missing email data', async () => {
      const response = await request(app)
        .post('/api/analysis/email')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Email data is required');
    });

    test('should return 400 for missing subject', async () => {
      const invalidData = {
        emailData: {
          content: 'Email content without subject',
          sender: 'test@example.com'
        }
      };

      const response = await request(app)
        .post('/api/analysis/email')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Email subject and content are required');
    });

    test('should return 400 for missing content', async () => {
      const invalidData = {
        emailData: {
          subject: 'Test Subject',
          sender: 'test@example.com'
        }
      };

      const response = await request(app)
        .post('/api/analysis/email')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Email subject and content are required');
    });

    test('should handle legal email correctly', async () => {
      const legalEmailData = {
        emailData: {
          subject: 'Contract Review - Legal Agreement',
          content: 'Please review this legal contract for intellectual property clauses and compliance issues.',
          sender: 'client@lawfirm.com',
          recipients: ['lawyer@firm.com']
        }
      };

      const response = await request(app)
        .post('/api/analysis/email')
        .send(legalEmailData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.analysis.isLegalEmail).toBe(true);
      expect(parseInt(response.body.analysis.confidence)).toBeGreaterThan(50);
    });

    test('should handle non-legal email correctly', async () => {
      const nonLegalEmailData = {
        emailData: {
          subject: 'Team lunch meeting',
          content: 'Hey everyone, let\'s grab lunch tomorrow at the new restaurant downtown.',
          sender: 'colleague@company.com',
          recipients: ['team@company.com']
        }
      };

      const response = await request(app)
        .post('/api/analysis/email')
        .send(nonLegalEmailData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.analysis.isLegalEmail).toBe(false);
    });

    test('should include metadata in response', async () => {
      const response = await request(app)
        .post('/api/analysis/email')
        .send(validEmailData)
        .expect(200);

      expect(response.body.metadata).toHaveProperty('serviceAvailable');
      expect(response.body.metadata).toHaveProperty('processingTime');
      expect(typeof response.body.metadata.serviceAvailable).toBe('boolean');
    });
  });

  describe('POST /api/analysis/batch', () => {
    const validBatchData = {
      emails: [
        {
          subject: 'Contract Review',
          content: 'Please review this legal contract.',
          sender: 'client1@firm.com'
        },
        {
          subject: 'Document Analysis',
          content: 'Analyze this legal document for compliance.',
          sender: 'client2@firm.com'
        }
      ]
    };

    test('should process batch emails successfully', async () => {
      const response = await request(app)
        .post('/api/analysis/batch')
        .send(validBatchData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('results');
      expect(response.body.results).toHaveLength(2);
      expect(response.body).toHaveProperty('metadata');
      expect(response.body.metadata).toHaveProperty('totalEmails', 2);
    });

    test('should return 400 for missing emails array', async () => {
      const response = await request(app)
        .post('/api/analysis/batch')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Emails array is required');
    });

    test('should return 400 for invalid emails array', async () => {
      const response = await request(app)
        .post('/api/analysis/batch')
        .send({ emails: 'not-an-array' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Emails array is required');
    });

    test('should handle empty emails array', async () => {
      const response = await request(app)
        .post('/api/analysis/batch')
        .send({ emails: [] })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('results', []);
      expect(response.body).toHaveProperty('message', 'No emails to analyze');
    });

    test('should return 400 for too many emails', async () => {
      const tooManyEmails = Array(51).fill({
        subject: 'Test',
        content: 'Test content',
        sender: 'test@example.com'
      });

      const response = await request(app)
        .post('/api/analysis/batch')
        .send({ emails: tooManyEmails })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Maximum 50 emails allowed per batch');
    });

    test('should return 500 for emails with missing required fields', async () => {
      const invalidBatchData = {
        emails: [
          {
            subject: 'Test',
            // Missing content
            sender: 'test@example.com'
          }
        ]
      };

      const response = await request(app)
        .post('/api/analysis/batch')
        .send(invalidBatchData)
        .expect(500);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Batch analysis failed');
      expect(response.body.details).toContain('missing required fields');
    });
  });

  describe('GET /api/analysis/health', () => {
    test('should return OpenAI service health status', async () => {
      const response = await request(app)
        .get('/api/analysis/health')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('service');
      expect(response.body.service).toHaveProperty('configured');
      expect(response.body.service).toHaveProperty('connected');
      expect(response.body.service).toHaveProperty('status');
      expect(response.body).toHaveProperty('message');

      // Status should be one of the expected values
      const validStatuses = ['healthy', 'configured_but_unreachable', 'not_configured'];
      expect(validStatuses).toContain(response.body.service.status);
    });
  });

  describe('GET /api/analysis/history', () => {
    test('should return 501 for not implemented endpoint', async () => {
      const response = await request(app)
        .get('/api/analysis/history')
        .expect(501);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('not yet implemented');
    });
  });
});
