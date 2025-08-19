// Email Processor for Involex Extension
// Handles AI-powered email analysis and processing

import { EmailData, AnalysisResult, BillingEntry } from './types';
import { StorageManager } from './storage';

export class EmailProcessor {
  private storageManager: StorageManager;
  private processingQueue: Map<string, EmailData> = new Map();

  constructor() {
    this.storageManager = new StorageManager();
  }

  async queueEmailForAnalysis(emailData: EmailData, tabId?: number): Promise<void> {
    try {
      console.log('📝 Queuing email for analysis:', emailData.subject);
      
      // Add to processing queue
      this.processingQueue.set(emailData.id, emailData);
      
      // Store in persistent queue
      await this.storageManager.addToProcessingQueue({
        ...emailData,
        tabId,
        status: 'queued'
      });
      
      // Start processing if not already running
      this.processQueue();
      
    } catch (error) {
      console.error('❌ Error queuing email for analysis:', error);
      throw error;
    }
  }

  async analyzeEmail(emailData: EmailData): Promise<AnalysisResult> {
    try {
      console.log('🤖 Analyzing email with AI:', emailData.subject);
      
      // Check cache first
      const cacheKey = `analysis_${this.hashEmail(emailData)}`;
      const cached = await this.storageManager.getCache(cacheKey);
      
      if (cached) {
        console.log('✅ Using cached analysis result');
        return cached;
      }
      
      // Perform AI analysis
      const analysis = await this.performAIAnalysis(emailData);
      
      // Cache the result
      await this.storageManager.setCache(cacheKey, analysis, 60); // Cache for 1 hour
      
      return analysis;
      
    } catch (error) {
      console.error('❌ Error analyzing email:', error);
      throw error;
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processingQueue.size === 0) return;
    
    console.log(`📊 Processing queue with ${this.processingQueue.size} emails`);
    
    for (const [emailId, emailData] of this.processingQueue) {
      try {
        const analysis = await this.analyzeEmail(emailData);
        
        // Create billing entry
        const billingEntry: BillingEntry = {
          id: this.generateId(),
          emailId: emailData.id,
          subject: emailData.subject,
          sender: emailData.sender,
          recipients: emailData.recipients,
          timestamp: emailData.timestamp,
          content: emailData.content,
          threadId: emailData.threadId,
          aiAnalysis: analysis,
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        
        // Store billing entry
        await this.storageManager.storeBillingEntry(billingEntry);
        
        // Remove from processing queue
        this.processingQueue.delete(emailId);
        await this.storageManager.removeFromProcessingQueue(emailId);
        
        console.log('✅ Email processed successfully:', emailData.subject);
        
      } catch (error) {
        console.error('❌ Error processing email:', emailId, error);
        // Keep in queue for retry
      }
    }
  }

  private async performAIAnalysis(emailData: EmailData): Promise<AnalysisResult> {
    // This would integrate with OpenAI API or other AI services
    // For now, return mock analysis based on heuristics
    
    const text = `${emailData.subject} ${emailData.content}`.toLowerCase();
    
    // Legal work detection
    const legalKeywords = [
      'contract', 'agreement', 'legal', 'litigation', 'court', 'case',
      'attorney', 'lawyer', 'counsel', 'client', 'matter', 'brief',
      'discovery', 'deposition', 'hearing', 'trial', 'settlement',
      'draft', 'review', 'negotiate', 'lawsuit', 'complaint'
    ];
    
    const foundKeywords = legalKeywords.filter(keyword => text.includes(keyword));
    const isLegalWork = foundKeywords.length > 0;
    const confidence = Math.min(foundKeywords.length * 0.2, 1.0);
    
    // Time estimation based on content length and complexity
    const wordCount = emailData.content.split(' ').length;
    const estimatedTime = this.estimateTimeFromContent(wordCount, foundKeywords.length);
    
    // Work type classification
    const workType = this.classifyWorkType(text, foundKeywords);
    
    // Description generation
    const description = this.generateBillingDescription(emailData, workType, foundKeywords);
    
    // Get user settings for billing rate
    const userSettings = await this.storageManager.getUserSettings();
    const billingRate = userSettings.billingRates.default;
    const estimatedAmount = estimatedTime * billingRate;
    
    return {
      isLegalWork,
      confidence,
      estimatedTime,
      estimatedAmount,
      description,
      workType,
      keywords: foundKeywords,
      reasoning: `Detected ${foundKeywords.length} legal keywords, estimated ${estimatedTime} hours based on content analysis`
    };
  }

  private estimateTimeFromContent(wordCount: number, keywordCount: number): number {
    // Base time estimation logic
    let baseTime = 0.1; // Minimum 6 minutes
    
    // Add time based on word count
    if (wordCount > 100) baseTime += 0.1;
    if (wordCount > 300) baseTime += 0.2;
    if (wordCount > 500) baseTime += 0.3;
    
    // Add time based on legal complexity
    baseTime += keywordCount * 0.05;
    
    // Round to nearest 0.1 hour (6 minutes)
    return Math.round(baseTime * 10) / 10;
  }

  private classifyWorkType(text: string, keywords: string[]): AnalysisResult['workType'] {
    if (text.includes('draft') || text.includes('drafting')) return 'drafting';
    if (text.includes('review') || text.includes('reviewing')) return 'review';
    if (text.includes('research') || text.includes('researching')) return 'research';
    if (text.includes('meeting') || text.includes('call')) return 'meeting';
    if (keywords.length > 0) return 'correspondence';
    return 'other';
  }

  private generateBillingDescription(emailData: EmailData, workType: AnalysisResult['workType'], keywords: string[]): string {
    const sender = emailData.sender.split('@')[0].replace(/[._]/g, ' ');
    const workTypeText = {
      correspondence: 'Email correspondence',
      research: 'Legal research',
      drafting: 'Document drafting',
      review: 'Document review',
      meeting: 'Client meeting',
      call: 'Phone call',
      other: 'Legal work'
    }[workType];
    
    let description = `${workTypeText} with ${sender}`;
    
    if (emailData.subject && emailData.subject !== 'No Subject') {
      description += ` regarding ${emailData.subject.toLowerCase()}`;
    }
    
    if (keywords.length > 0) {
      description += ` (${keywords.slice(0, 3).join(', ')})`;
    }
    
    return description.charAt(0).toUpperCase() + description.slice(1);
  }

  private hashEmail(emailData: EmailData): string {
    const content = `${emailData.subject}${emailData.sender}${emailData.timestamp}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private generateId(): string {
    return `involex_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
