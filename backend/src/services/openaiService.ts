import OpenAI from 'openai';
import { logger } from '../utils/logger';

export interface EmailAnalysisRequest {
  subject: string;
  content: string;
  sender: string;
  recipients?: string[];
  timestamp?: string;
  attachments?: string[];
}

export interface EmailAnalysisResult {
  estimatedTime: number;
  workType: string;
  confidence: number;
  isLegalEmail: boolean;
  suggestedClient?: string;
  suggestedMatter?: string;
  billableContent: string;
  reasoning: string;
  legalTopics: string[];
  urgency: 'low' | 'medium' | 'high';
}

class OpenAIService {
  private client: OpenAI | null = null;
  private isConfigured: boolean = false;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      logger.warn('OpenAI API key not configured. AI analysis will be disabled.');
      this.isConfigured = false;
      return;
    }

    this.client = new OpenAI({
      apiKey: apiKey,
    });
    this.isConfigured = true;
    logger.info('OpenAI service initialized successfully');
  }

  async analyzeEmail(emailData: EmailAnalysisRequest): Promise<EmailAnalysisResult> {
    // If OpenAI is not configured, use fallback analysis
    if (!this.isConfigured || !this.client) {
      logger.info('OpenAI not configured, using fallback rule-based analysis');
      return this.fallbackAnalysis(emailData);
    }

    try {
      const prompt = this.buildAnalysisPrompt(emailData);
      
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      });

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error('Empty response from OpenAI');
      }

      const analysis = JSON.parse(response);
      return this.validateAndNormalizeResponse(analysis);

    } catch (error) {
      logger.error('OpenAI analysis error:', error);
      
      // Fallback to rule-based analysis if AI fails
      return this.fallbackAnalysis(emailData);
    }
  }

  private getSystemPrompt(): string {
    return `You are an AI assistant specialized in analyzing legal emails for time tracking and billing purposes. 

Your role is to:
1. Determine if an email is billable legal work
2. Estimate time spent on the email (in hours, 0.1 to 8.0 range)
3. Classify the type of legal work
4. Identify legal topics and urgency
5. Suggest appropriate billing descriptions

Always respond with valid JSON in this exact format:
{
  "estimatedTime": number,
  "workType": string,
  "confidence": number,
  "isLegalEmail": boolean,
  "suggestedClient": string,
  "suggestedMatter": string,
  "billableContent": string,
  "reasoning": string,
  "legalTopics": string[],
  "urgency": "low" | "medium" | "high"
}

Guidelines:
- estimatedTime: 0.1-8.0 hours (0.1 for quick reads, 0.25-0.5 for responses, 1.0+ for complex analysis)
- workType: correspondence, research, drafting, review, consultation, court_filing, client_meeting, etc.
- confidence: 0-100 (how certain you are this is billable)
- isLegalEmail: true only if clearly legal work
- billableContent: Professional description suitable for client billing
- reasoning: Brief explanation of your analysis
- legalTopics: Relevant legal areas (contract, litigation, corporate, etc.)
- urgency: Based on content tone and deadlines`;
  }

  private buildAnalysisPrompt(emailData: EmailAnalysisRequest): string {
    return `Analyze this email for legal billing purposes:

SUBJECT: ${emailData.subject}
FROM: ${emailData.sender}
TO: ${emailData.recipients?.join(', ') || 'Not specified'}
CONTENT: ${emailData.content}

Please provide a detailed analysis following the JSON format specified in the system prompt.`;
  }

  private validateAndNormalizeResponse(analysis: any): EmailAnalysisResult {
    return {
      estimatedTime: Math.max(0.1, Math.min(8.0, Number(analysis.estimatedTime) || 0.25)),
      workType: analysis.workType || 'correspondence',
      confidence: Math.max(0, Math.min(100, Number(analysis.confidence) || 50)),
      isLegalEmail: Boolean(analysis.isLegalEmail),
      suggestedClient: analysis.suggestedClient || 'Unknown',
      suggestedMatter: analysis.suggestedMatter || 'General',
      billableContent: analysis.billableContent || 'Email correspondence',
      reasoning: analysis.reasoning || 'AI analysis completed',
      legalTopics: Array.isArray(analysis.legalTopics) ? analysis.legalTopics : ['general'],
      urgency: ['low', 'medium', 'high'].includes(analysis.urgency) ? analysis.urgency : 'medium'
    };
  }

  private fallbackAnalysis(emailData: EmailAnalysisRequest): EmailAnalysisResult {
    logger.info('Using fallback rule-based analysis');
    
    const subject = emailData.subject.toLowerCase();
    const content = emailData.content.toLowerCase();
    
    // Legal keywords for classification
    const legalKeywords = [
      'contract', 'agreement', 'legal', 'lawsuit', 'litigation', 'court', 'attorney',
      'counsel', 'settlement', 'deposition', 'discovery', 'motion', 'brief', 'filing',
      'jurisdiction', 'compliance', 'regulation', 'statute', 'law', 'client matter'
    ];
    
    const urgentKeywords = ['urgent', 'asap', 'immediate', 'deadline', 'emergency'];
    
    const hasLegalContent = legalKeywords.some(keyword => 
      subject.includes(keyword) || content.includes(keyword)
    );
    
    const hasUrgentContent = urgentKeywords.some(keyword =>
      subject.includes(keyword) || content.includes(keyword)
    );
    
    // Estimate time based on content length and type
    let estimatedTime = 0.25; // Default 15 minutes
    if (content.length > 1000) estimatedTime = 0.5;
    if (content.length > 2000) estimatedTime = 1.0;
    if (subject.includes('review') || subject.includes('draft')) estimatedTime += 0.5;
    
    return {
      estimatedTime: Math.min(estimatedTime, 8.0),
      workType: hasLegalContent ? 'correspondence' : 'administrative',
      confidence: hasLegalContent ? 75 : 25,
      isLegalEmail: hasLegalContent,
      suggestedClient: 'Auto-detected',
      suggestedMatter: 'General',
      billableContent: `Email correspondence: ${emailData.subject}`,
      reasoning: 'Rule-based analysis (AI unavailable)',
      legalTopics: hasLegalContent ? ['general'] : [],
      urgency: hasUrgentContent ? 'high' : 'medium'
    };
  }

  async batchAnalyzeEmails(emails: EmailAnalysisRequest[]): Promise<EmailAnalysisResult[]> {
    logger.info(`Starting batch analysis for ${emails.length} emails`);
    
    const results: EmailAnalysisResult[] = [];
    
    // Process emails in batches of 5 to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      const batchPromises = batch.map(email => this.analyzeEmail(email));
      const batchResults = await Promise.all(batchPromises);
      
      results.push(...batchResults);
      
      // Small delay between batches to respect rate limits
      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    logger.info(`Batch analysis completed for ${results.length} emails`);
    return results;
  }

  isServiceAvailable(): boolean {
    return this.isConfigured;
  }

  async testConnection(): Promise<boolean> {
    if (!this.isConfigured || !this.client) {
      return false;
    }

    try {
      const testResponse = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Test connection' }],
        max_tokens: 5
      });
      
      return !!testResponse.choices[0].message.content;
    } catch (error) {
      logger.error('OpenAI connection test failed:', error);
      return false;
    }
  }
}

export const openaiService = new OpenAIService();
