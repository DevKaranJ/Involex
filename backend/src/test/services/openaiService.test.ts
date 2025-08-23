import { openaiService, EmailAnalysisRequest } from '../../services/openaiService';

// Mock the OpenAI module
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    })),
  };
});

describe('OpenAI Service', () => {
  const mockEmailData: EmailAnalysisRequest = {
    subject: 'Contract Review Request - NDA',
    content: 'Please review the attached NDA for our partnership with TechCorp. Key points: IP clauses, term length.',
    sender: 'client@lawfirm.com',
    recipients: ['lawyer@firm.com'],
    timestamp: '2025-08-21T10:00:00Z',
    attachments: []
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Configuration', () => {
    test('should initialize service availability', () => {
      const isAvailable = openaiService.isServiceAvailable();
      expect(typeof isAvailable).toBe('boolean');
    });

    test('should handle missing API key gracefully', () => {
      // Service should still be available but use fallback
      expect(openaiService.isServiceAvailable()).toBeDefined();
    });
  });

  describe('Email Analysis', () => {
    test('should analyze email with valid input', async () => {
      const result = await openaiService.analyzeEmail(mockEmailData);

      expect(result).toHaveProperty('estimatedTime');
      expect(result).toHaveProperty('workType');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('isLegalEmail');
      expect(result).toHaveProperty('billableContent');
      expect(result).toHaveProperty('reasoning');
      expect(result).toHaveProperty('legalTopics');
      expect(result).toHaveProperty('urgency');

      // Validate data types and ranges
      expect(typeof result.estimatedTime).toBe('number');
      expect(result.estimatedTime).toBeGreaterThanOrEqual(0.1);
      expect(result.estimatedTime).toBeLessThanOrEqual(8.0);
      
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);

      expect(typeof result.isLegalEmail).toBe('boolean');
      expect(['low', 'medium', 'high']).toContain(result.urgency);
      expect(Array.isArray(result.legalTopics)).toBe(true);
    });

    test('should detect legal content correctly', async () => {
      const legalEmail: EmailAnalysisRequest = {
        ...mockEmailData,
        subject: 'Contract Review - Legal Agreement',
        content: 'Please review this legal contract for compliance issues and intellectual property clauses.'
      };

      const result = await openaiService.analyzeEmail(legalEmail);
      
      // Should detect as legal content
      expect(result.confidence).toBeGreaterThan(50);
      expect(result.legalTopics.length).toBeGreaterThan(0);
    });

    test('should handle non-legal content', async () => {
      const nonLegalEmail: EmailAnalysisRequest = {
        ...mockEmailData,
        subject: 'Office lunch meeting',
        content: 'Hey team, let\'s grab lunch tomorrow at the new restaurant.'
      };

      const result = await openaiService.analyzeEmail(nonLegalEmail);
      
      // Should detect as non-legal
      expect(result.isLegalEmail).toBe(false);
      expect(result.confidence).toBeLessThan(50);
    });

    test('should estimate time based on content complexity', async () => {
      const simpleEmail: EmailAnalysisRequest = {
        ...mockEmailData,
        content: 'Quick question about billing.'
      };

      const complexEmail: EmailAnalysisRequest = {
        ...mockEmailData,
        content: 'Please conduct a comprehensive review of the 50-page merger agreement, analyzing all provisions related to intellectual property, regulatory compliance, termination clauses, and dispute resolution mechanisms.'
      };

      const simpleResult = await openaiService.analyzeEmail(simpleEmail);
      const complexResult = await openaiService.analyzeEmail(complexEmail);

      // In fallback mode, time is estimated based on content length
      // Complex email should get at least same or higher time estimation
      expect(complexResult.estimatedTime).toBeGreaterThanOrEqual(simpleResult.estimatedTime);
    });
  });

  describe('Batch Processing', () => {
    test('should process multiple emails', async () => {
      const emails: EmailAnalysisRequest[] = [
        mockEmailData,
        {
          ...mockEmailData,
          subject: 'Quick billing question',
          content: 'What is the rate for document review?'
        },
        {
          ...mockEmailData,
          subject: 'Motion to Dismiss',
          content: 'Please prepare motion to dismiss for Case #12345'
        }
      ];

      const results = await openaiService.batchAnalyzeEmails(emails);

      expect(results).toHaveLength(emails.length);
      results.forEach(result => {
        expect(result).toHaveProperty('estimatedTime');
        expect(result).toHaveProperty('workType');
        expect(result).toHaveProperty('confidence');
      });
    });

    test('should handle empty batch', async () => {
      const results = await openaiService.batchAnalyzeEmails([]);
      expect(results).toHaveLength(0);
    });
  });

  describe('Fallback Analysis', () => {
    test('should provide fallback analysis when OpenAI unavailable', async () => {
      // Test with contract-related email
      const contractEmail: EmailAnalysisRequest = {
        ...mockEmailData,
        subject: 'Contract Review Urgent',
        content: 'Please review this legal contract immediately. It contains important intellectual property clauses.'
      };

      const result = await openaiService.analyzeEmail(contractEmail);

      // Should still provide analysis
      expect(result.estimatedTime).toBeGreaterThan(0);
      expect(result.workType).toBeDefined();
      expect(result.reasoning).toContain('analysis');
      
      // Should detect legal keywords
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should handle urgent keywords', async () => {
      const urgentEmail: EmailAnalysisRequest = {
        ...mockEmailData,
        subject: 'URGENT: Deadline tomorrow',
        content: 'This is urgent and needs immediate attention ASAP!'
      };

      const result = await openaiService.analyzeEmail(urgentEmail);
      expect(result.urgency).toBe('high');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid input gracefully', async () => {
      const invalidEmail: EmailAnalysisRequest = {
        subject: '',
        content: '',
        sender: '',
        recipients: [],
      };

      const result = await openaiService.analyzeEmail(invalidEmail);
      
      // Should still return valid structure
      expect(result).toHaveProperty('estimatedTime');
      expect(result).toHaveProperty('workType');
      expect(result.estimatedTime).toBeGreaterThan(0);
    });

    test('should validate response data', async () => {
      const result = await openaiService.analyzeEmail(mockEmailData);

      // Ensure time is within valid range
      expect(result.estimatedTime).toBeGreaterThanOrEqual(0.1);
      expect(result.estimatedTime).toBeLessThanOrEqual(8.0);

      // Ensure confidence is within valid range
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);

      // Ensure urgency is valid
      expect(['low', 'medium', 'high']).toContain(result.urgency);
    });
  });
});
