import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { openaiService, EmailAnalysisRequest } from '../services/openaiService';

const router = Router();

// POST /api/analysis/email - Analyze email content with AI
router.post('/email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { emailData } = req.body;
    
    if (!emailData) {
      res.status(400).json({
        success: false,
        error: 'Email data is required'
      });
      return;
    }

    // Validate required fields
    if (!emailData.subject || !emailData.content) {
      res.status(400).json({
        success: false,
        error: 'Email subject and content are required'
      });
      return;
    }
    
    logger.info('Email analysis request received:', {
      subject: emailData.subject,
      sender: emailData.sender,
      contentLength: emailData.content?.length || 0
    });

    // Prepare analysis request
    const analysisRequest: EmailAnalysisRequest = {
      subject: emailData.subject,
      content: emailData.content,
      sender: emailData.sender || 'Unknown',
      recipients: emailData.recipients || [],
      timestamp: emailData.timestamp || new Date().toISOString(),
      attachments: emailData.attachments || []
    };

    // Perform AI analysis
    const analysis = await openaiService.analyzeEmail(analysisRequest);
    
    logger.info('Email analysis completed:', {
      workType: analysis.workType,
      estimatedTime: analysis.estimatedTime,
      confidence: analysis.confidence,
      isLegalEmail: analysis.isLegalEmail
    });
    
    res.json({
      success: true,
      analysis: {
        estimatedTime: analysis.estimatedTime.toString(),
        workType: analysis.workType,
        confidence: `${analysis.confidence}%`,
        isLegalEmail: analysis.isLegalEmail,
        suggestedClient: analysis.suggestedClient,
        suggestedMatter: analysis.suggestedMatter,
        billableContent: analysis.billableContent,
        reasoning: analysis.reasoning,
        legalTopics: analysis.legalTopics,
        urgency: analysis.urgency
      },
      metadata: {
        serviceAvailable: openaiService.isServiceAvailable(),
        processingTime: new Date().toISOString()
      },
      message: 'Email analysis completed successfully'
    });
    
  } catch (error) {
    logger.error('Email analysis error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Email analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/analysis/batch - Analyze multiple emails
router.post('/batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const { emails } = req.body;
    
    if (!emails || !Array.isArray(emails)) {
      res.status(400).json({
        success: false,
        error: 'Emails array is required'
      });
      return;
    }

    if (emails.length === 0) {
      res.json({
        success: true,
        results: [],
        message: 'No emails to analyze'
      });
      return;
    }

    if (emails.length > 50) {
      res.status(400).json({
        success: false,
        error: 'Maximum 50 emails allowed per batch'
      });
      return;
    }
    
    logger.info(`Batch analysis request for ${emails.length} emails`);

    // Validate email data structure
    const analysisRequests: EmailAnalysisRequest[] = emails.map((email: any, index: number) => {
      if (!email.subject || !email.content) {
        throw new Error(`Email at index ${index} is missing required fields (subject, content)`);
      }
      
      return {
        subject: email.subject,
        content: email.content,
        sender: email.sender || 'Unknown',
        recipients: email.recipients || [],
        timestamp: email.timestamp || new Date().toISOString(),
        attachments: email.attachments || []
      };
    });

    // Perform batch analysis
    const startTime = Date.now();
    const results = await openaiService.batchAnalyzeEmails(analysisRequests);
    const processingTime = Date.now() - startTime;
    
    logger.info(`Batch analysis completed for ${results.length} emails in ${processingTime}ms`);
    
    res.json({
      success: true,
      results: results.map(analysis => ({
        estimatedTime: analysis.estimatedTime.toString(),
        workType: analysis.workType,
        confidence: `${analysis.confidence}%`,
        isLegalEmail: analysis.isLegalEmail,
        suggestedClient: analysis.suggestedClient,
        suggestedMatter: analysis.suggestedMatter,
        billableContent: analysis.billableContent,
        reasoning: analysis.reasoning,
        legalTopics: analysis.legalTopics,
        urgency: analysis.urgency
      })),
      metadata: {
        totalEmails: emails.length,
        processingTimeMs: processingTime,
        serviceAvailable: openaiService.isServiceAvailable(),
        timestamp: new Date().toISOString()
      },
      message: `Batch analysis completed successfully for ${results.length} emails`
    });
    
  } catch (error) {
    logger.error('Batch analysis error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Batch analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/analysis/health - Check OpenAI service health
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  try {
    const isAvailable = openaiService.isServiceAvailable();
    const canConnect = isAvailable ? await openaiService.testConnection() : false;
    
    res.json({
      success: true,
      service: {
        configured: isAvailable,
        connected: canConnect,
        status: canConnect ? 'healthy' : (isAvailable ? 'configured_but_unreachable' : 'not_configured')
      },
      message: canConnect ? 'OpenAI service is healthy' : 'OpenAI service issues detected'
    });
    
  } catch (error) {
    logger.error('OpenAI health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/analysis/history - Get analysis history
router.get('/history', async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Implement analysis history retrieval from database
    logger.info('Analysis history request');
    
    res.status(501).json({
      success: false,
      message: 'Analysis history retrieval not yet implemented',
      status: 'pending',
      note: 'This will require database integration with EmailAnalysis model'
    });
    
  } catch (error) {
    logger.error('Analysis history error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to retrieve analysis history' 
    });
  }
});

export default router;
