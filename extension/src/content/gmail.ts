// Enhanced Gmail Content Script for Involex
// Real-time email detection, content extraction, and billing UI injection

// Initial load message (keep for debugging)
console.log('🚀 Involex Gmail Integration v2.1 Loading...');

import { EmailData, BillingEntry } from '../shared/types';

interface GmailEmail {
  id: string;
  subject: string;
  sender: string;
  recipients: string[];
  timestamp: string;
  content: string;
  threadId?: string;
  isCompose?: boolean;
  direction: 'incoming' | 'outgoing';
}

class EnhancedGmailIntegration {
  private isInitialized = false; // Track initialization status
  private emailCache = new Map<string, GmailEmail>(); // Track email data
  private observer: MutationObserver | null = null; // Track DOM mutations
  private currentEmailId: string | null = null; // Track currently opened email ID
  private composeWidgets = new Set<HTMLElement>(); // Track compose email widgets
  private readWidgets = new Set<HTMLElement>(); // Track read email widgets
  private processedEmails = new Set<string>(); // Track processed emails
  private processedComposeWindows = new Set<HTMLElement>(); // Track processed compose windows
  private processedElements = new Set<Element>(); // Track processed DOM elements
  private widgetMap = new Map<string, HTMLElement>(); // Track widgets by email ID
  private lastLogTime = 0; // Throttle console logs
  private debugMode = false; // Control console logging

  constructor() {
    this.init();
  }

  // Controlled logging to reduce console spam
  private log(message: string, throttleMs: number = 1000): void {
    const now = Date.now();
    if (this.debugMode && (now - this.lastLogTime) > throttleMs) {
      console.log(`[Involex Gmail] ${message}`);
      this.lastLogTime = now;
    }
  }

  private async init(): Promise<void> {
    if (this.isInitialized) return;

    this.log('📧 Initializing Enhanced Gmail Integration...');
    
    // Wait for Gmail to fully load
    await this.waitForGmailLoad();
    
    // Set up real-time email detection
    this.setupAdvancedEmailDetection();
    
    // Set up UI injection system
    this.setupUIInjectionSystem();
    
    // Set up keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    this.isInitialized = true;
    this.log('✅ Enhanced Gmail Integration Ready');
  }

  private async waitForGmailLoad(): Promise<void> {
    return new Promise((resolve) => {
      const checkGmailLoaded = () => {
        // Check for multiple Gmail UI indicators
        const gmailIndicators = [
          document.querySelector('[role="main"]'),
          document.querySelector('.nH.bkL'),
          document.querySelector('#gb'),
          document.querySelector('.T-I.T-I-KE.L3')  // Gmail compose button
        ];
        
        if (gmailIndicators.some(indicator => indicator !== null)) {
          console.log('📧 Gmail interface fully loaded');
          setTimeout(resolve, 1000); // Give Gmail extra time to stabilize
        } else {
          setTimeout(checkGmailLoaded, 500);
        }
      };
      
      checkGmailLoaded();
    });
  }

  private setupAdvancedEmailDetection(): void {
    // Advanced DOM observer for all Gmail interactions
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              
              // Detect email composition
              this.detectEmailComposition(element);
              
              // Detect email reading/viewing
              this.detectEmailViewing(element);
              
              // Detect email list changes
              this.detectEmailListChanges(element);
              
              // Detect thread navigation
              this.detectThreadNavigation(element);
            }
          });
        }
        
        // Detect attribute changes (important for Gmail's dynamic updates)
        if (mutation.type === 'attributes') {
          this.handleAttributeChanges(mutation);
        }
      });
    });

    // Start comprehensive DOM observation
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-expanded', 'aria-selected', 'class', 'data-message-id']
    });

    // Scan for existing emails on page load
    this.scanExistingEmails();
  }

  private detectEmailComposition(element: Element): void {
    // Detect various compose scenarios
    const composeSelectors = [
      '[role="dialog"][aria-label*="compose" i]',  // Standard compose dialog
      '.nH .AD',                                   // Compose window
      '.M9',                                       // Another compose selector
      '.aoD',                                      // Compose area
      '[gh="cm"]'                                  // Compose identifier
    ];

    composeSelectors.forEach(selector => {
      const composeElement = element.querySelector ? element.querySelector(selector) : 
                            (element.matches && element.matches(selector) ? element : null);
      
      if (composeElement && 
          !this.processedComposeWindows.has(composeElement as HTMLElement) &&
          !composeElement.querySelector('.involex-compose-widget')) {
        this.log('✉️ Compose window detected');
        this.handleComposeDetection(composeElement as HTMLElement);
      }
    });
  }

  private detectEmailViewing(element: Element): void {
    // Skip if already processed this element
    if (this.processedElements.has(element)) {
      return;
    }

    // Detect email reading/viewing scenarios
    const viewSelectors = [
      '[data-message-id]',                         // Email with message ID
      '.ii.gt',                                    // Email content area
      '.a3s.aiL',                                  // Email body
      '[role="listitem"] .y6 span[email]',        // Email header
      '.h7'                                        // Email container
    ];

    viewSelectors.forEach(selector => {
      const viewElement = element.querySelector ? element.querySelector(selector) : 
                         (element.matches && element.matches(selector) ? element : null);
      
      if (viewElement && !this.processedElements.has(viewElement) && !viewElement.querySelector('.involex-read-widget')) {
        this.log('👁️ Email viewing detected');
        this.processedElements.add(viewElement);
        this.handleEmailViewing(viewElement as HTMLElement);
      }
    });
  }

  private detectEmailListChanges(element: Element): void {
    // Detect changes in email list (inbox, sent, etc.)
    if (element.classList?.contains('zA') || element.querySelector?.('.zA')) {
      console.log('📋 Email list updated');
      this.updateEmailListAnalysis();
    }
  }

  private detectThreadNavigation(element: Element): void {
    // Detect thread navigation and changes
    if (element.hasAttribute?.('data-thread-id') || 
        element.querySelector?.('[data-thread-id]')) {
      console.log('🧵 Thread navigation detected');
      this.handleThreadNavigation(element as HTMLElement);
    }
  }

  private handleAttributeChanges(mutation: MutationRecord): void {
    const target = mutation.target as Element;
    
    // Handle aria-expanded changes (compose/thread opening)
    if (mutation.attributeName === 'aria-expanded' && target.getAttribute('aria-expanded') === 'true') {
      this.detectEmailComposition(target);
      this.detectEmailViewing(target);
    }
    
    // Handle class changes that might indicate new emails
    if (mutation.attributeName === 'class') {
      this.detectEmailViewing(target);
    }
  }

  private async handleComposeDetection(composeElement: HTMLElement): Promise<void> {
    try {
      // Extract compose data
      const composeData = this.extractComposeData(composeElement);
      
      if (composeData) {
        // Inject compose widget
        this.injectComposeWidget(composeElement, composeData);
        
        // Set up compose event listeners
        this.setupComposeWidgetListeners(composeElement, composeData);
        
        console.log('📝 Compose widget injected for:', composeData.subject || 'New Email');
      }
    } catch (error) {
      console.warn('⚠️ Error handling compose detection:', error);
    }
  }

  private async handleEmailViewing(viewElement: HTMLElement): Promise<void> {
    try {
      // Extract email data
      const emailData = this.extractEmailData(viewElement);
      
      if (emailData) {
        // Check if we already processed this specific email
        if (this.processedEmails.has(emailData.id)) {
          return;
        }

        // Check if widget already exists for this email
        if (this.widgetMap.has(emailData.id)) {
          return;
        }

        if (this.isLegalEmail(emailData)) {
          // Cache the email
          this.emailCache.set(emailData.id, emailData);
          this.currentEmailId = emailData.id;
          this.processedEmails.add(emailData.id);
          
          // Inject read widget
          this.injectReadWidget(viewElement, emailData);
          
          // Notify background script
          this.notifyEmailDetected(emailData);
          
          this.log('📧 Legal email detected: ' + emailData.subject, 2000);
        }
      }
    } catch (error) {
      console.warn('⚠️ Error handling email viewing:', error);
    }
  }

  private extractComposeData(composeElement: HTMLElement): GmailEmail | null {
    try {
      const id = `compose_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Extract recipient
      const toField = composeElement.querySelector('[name="to"], [aria-label*="To" i]') as HTMLInputElement;
      const recipients = toField?.value ? [toField.value] : [];
      
      // Extract subject
      const subjectField = composeElement.querySelector('[name="subjectbox"], [aria-label*="Subject" i]') as HTMLInputElement;
      const subject = subjectField?.value || '';
      
      // Extract body content
      const bodyField = composeElement.querySelector('[role="textbox"], .Am.Al.editable') as HTMLElement;
      const content = bodyField?.textContent || bodyField?.innerHTML || '';
      
      return {
        id,
        subject,
        sender: this.getCurrentUserEmail(),
        recipients,
        timestamp: new Date().toISOString(),
        content,
        isCompose: true,
        direction: 'outgoing'
      };
    } catch (error) {
      console.warn('⚠️ Error extracting compose data:', error);
      return null;
    }
  }

  private extractEmailData(element: HTMLElement): GmailEmail | null {
    try {
      // Get message ID
      const messageIdElement = element.closest('[data-message-id]') || element.querySelector('[data-message-id]');
      const messageId = messageIdElement?.getAttribute('data-message-id');
      
      if (!messageId) {
        // Generate fallback ID
        const id = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log('📧 No message ID found, using fallback:', id);
      }
      
      const id = messageId || `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Extract subject from multiple possible locations
      const subjectSelectors = [
        '.hP',                    // Standard subject
        '.bog',                   // Alternative subject
        '[data-thread-perm-id] .hP',  // Thread subject
        '.y6 .hP'                 // Header subject
      ];
      
      let subject = '';
      for (const selector of subjectSelectors) {
        const subjectElement = document.querySelector(selector);
        if (subjectElement?.textContent?.trim()) {
          subject = subjectElement.textContent.trim();
          break;
        }
      }
      
      // Extract sender information
      const senderSelectors = [
        '.gD[email]',             // Sender with email attribute
        '.go span[email]',        // Alternative sender
        '.yW span[email]',        // Thread sender
        '.qu span'                // Fallback sender
      ];
      
      let sender = '';
      for (const selector of senderSelectors) {
        const senderElement = element.querySelector(selector) || document.querySelector(selector);
        if (senderElement) {
          sender = senderElement.getAttribute('email') || senderElement.textContent?.trim() || '';
          if (sender) break;
        }
      }
      
      // Extract recipients
      const recipients = this.extractRecipients(element);
      
      // Extract timestamp
      const timestampSelectors = ['.g3', '.g2', 'span[title]'];
      let timestamp = new Date().toISOString();
      
      for (const selector of timestampSelectors) {
        const timestampElement = element.querySelector(selector) || document.querySelector(selector);
        if (timestampElement) {
          const timeTitle = timestampElement.getAttribute('title');
          const timeText = timestampElement.textContent?.trim();
          
          if (timeTitle) {
            timestamp = new Date(timeTitle).toISOString();
            break;
          } else if (timeText) {
            // Try to parse relative time (e.g., "2 hours ago")
            const parsedTime = this.parseRelativeTime(timeText);
            if (parsedTime) {
              timestamp = parsedTime.toISOString();
              break;
            }
          }
        }
      }
      
      // Extract email content
      const contentSelectors = [
        '.ii.gt div[dir="ltr"]',  // Main content
        '.ii.gt .a3s.aiL',       // Email body
        '.ii.gt',                // Fallback content
        '.adn.ads'               // Message content
      ];
      
      let content = '';
      for (const selector of contentSelectors) {
        const contentElement = element.querySelector(selector);
        if (contentElement?.textContent?.trim()) {
          content = contentElement.textContent.trim();
          break;
        }
      }
      
      // Extract thread ID
      const threadElement = document.querySelector('[data-thread-id]');
      const threadId = threadElement?.getAttribute('data-thread-id');
      
      // Determine direction
      const currentUser = this.getCurrentUserEmail();
      const direction = sender.includes(currentUser) ? 'outgoing' : 'incoming';
      
      return {
        id,
        subject: subject || 'No Subject',
        sender: sender || 'Unknown Sender',
        recipients,
        timestamp,
        content,
        threadId: threadId || undefined,
        direction
      };
      
    } catch (error) {
      console.warn('⚠️ Error extracting email data:', error);
      return null;
    }
  }

  private extractRecipients(element: HTMLElement): string[] {
    const recipients: string[] = [];
    
    try {
      // Look for recipients in various locations
      const recipientSelectors = [
        '.hb span[email]',        // Standard recipients
        '.yW span[email]',        // Thread recipients
        '.gD span[email]'         // Alternative recipients
      ];
      
      recipientSelectors.forEach(selector => {
        const elements = element.querySelectorAll(selector);
        elements.forEach(el => {
          const email = el.getAttribute('email');
          if (email && !recipients.includes(email)) {
            recipients.push(email);
          }
        });
      });
    } catch (error) {
      console.warn('⚠️ Error extracting recipients:', error);
    }
    
    return recipients;
  }

  private parseRelativeTime(timeText: string): Date | null {
    try {
      const now = new Date();
      const lowerText = timeText.toLowerCase();
      
      // Parse patterns like "2 hours ago", "1 day ago", etc.
      const patterns = [
        { regex: /(\d+)\s*min/i, unit: 'minutes' },
        { regex: /(\d+)\s*hour/i, unit: 'hours' },
        { regex: /(\d+)\s*day/i, unit: 'days' },
        { regex: /(\d+)\s*week/i, unit: 'weeks' },
        { regex: /(\d+)\s*month/i, unit: 'months' }
      ];
      
      for (const pattern of patterns) {
        const match = lowerText.match(pattern.regex);
        if (match) {
          const value = parseInt(match[1]);
          const result = new Date(now);
          
          switch (pattern.unit) {
            case 'minutes':
              result.setMinutes(result.getMinutes() - value);
              break;
            case 'hours':
              result.setHours(result.getHours() - value);
              break;
            case 'days':
              result.setDate(result.getDate() - value);
              break;
            case 'weeks':
              result.setDate(result.getDate() - (value * 7));
              break;
            case 'months':
              result.setMonth(result.getMonth() - value);
              break;
          }
          
          return result;
        }
      }
    } catch (error) {
      console.warn('⚠️ Error parsing relative time:', error);
    }
    
    return null;
  }

  private getCurrentUserEmail(): string {
    try {
      // Try to get current user email from Gmail interface
      const userEmailElement = document.querySelector('[email]');
      if (userEmailElement) {
        return userEmailElement.getAttribute('email') || '';
      }
      
      // Fallback: try to extract from URL or other indicators
      const gmailUrl = window.location.href;
      const emailMatch = gmailUrl.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      
      return emailMatch ? emailMatch[0] : '';
    } catch (error) {
      console.warn('⚠️ Error getting current user email:', error);
      return '';
    }
  }

  private isLegalEmail(email: GmailEmail): boolean {
    // Enhanced legal email detection
    const legalKeywords = [
      // Legal terms
      'contract', 'agreement', 'legal', 'litigation', 'court', 'case',
      'attorney', 'lawyer', 'counsel', 'client', 'matter', 'brief',
      'discovery', 'deposition', 'hearing', 'trial', 'settlement',
      'lawsuit', 'complaint', 'motion', 'filing', 'docket',
      
      // Legal actions
      'draft', 'review', 'negotiate', 'analyze', 'research',
      'due diligence', 'compliance', 'regulatory', 'statute',
      'jurisdiction', 'precedent', 'appeal', 'injunction',
      
      // Business legal
      'merger', 'acquisition', 'incorporation', 'partnership',
      'trademark', 'copyright', 'patent', 'intellectual property',
      'employment law', 'real estate', 'estate planning'
    ];

    const text = `${email.subject} ${email.content}`.toLowerCase();
    
    // Check for legal keywords
    const hasLegalKeywords = legalKeywords.some(keyword => 
      text.includes(keyword.toLowerCase())
    );

    // Check sender domain patterns
    const legalDomains = [
      '.law', '.legal', '.court', '.gov', '.attorney', '.esq'
    ];
    const hasLegalDomain = legalDomains.some(domain => 
      email.sender.toLowerCase().includes(domain)
    );

    // Check for law firm patterns in sender
    const lawFirmPatterns = [
      /law\s+firm/i, /legal\s+services/i, /attorneys?\s+at\s+law/i,
      /\bllp\b/i, /\bllc\b/i, /\bp\.?c\.?\b/i, /\besq\.?\b/i
    ];
    const hasLawFirmPattern = lawFirmPatterns.some(pattern => 
      pattern.test(email.sender)
    );

    // Check for legal document patterns
    const legalDocPatterns = [
      /exhibit\s+[a-z0-9]/i, /schedule\s+[a-z0-9]/i, /section\s+\d+/i,
      /paragraph\s+\d+/i, /clause\s+\d+/i, /amendment\s+\d+/i
    ];
    const hasLegalDocPattern = legalDocPatterns.some(pattern => 
      pattern.test(text)
    );

    return hasLegalKeywords || hasLegalDomain || hasLawFirmPattern || hasLegalDocPattern;
  }

  // Continue with UI injection methods in the next part...

  private injectComposeWidget(composeElement: HTMLElement, composeData: GmailEmail): void {
    // Check if widget already exists for this compose
    if (this.widgetMap.has(composeData.id)) return;
    
    // Check if element already has a widget
    if (composeElement.querySelector('.involex-compose-widget')) return;

    // Check if we already processed this compose window
    if (this.processedComposeWindows.has(composeElement)) return;
    
    this.processedComposeWindows.add(composeElement);

    const widget = document.createElement('div');
    widget.className = 'involex-compose-widget';
    widget.setAttribute('data-compose-id', composeData.id);
    
    widget.innerHTML = `
      <div class="involex-compose-header">
        <div class="involex-logo">💼 Involex</div>
        <div class="involex-compose-title">Track Billing Time</div>
      </div>
      <div class="involex-compose-content">
        <div class="involex-time-input-group">
          <label for="billing-time">Estimated Time:</label>
          <input type="number" id="billing-time" step="0.1" min="0.1" max="10" value="0.2" class="time-input">
          <span class="time-unit">hours</span>
        </div>
        <div class="involex-client-input-group">
          <label for="client-matter">Client/Matter:</label>
          <input type="text" id="client-matter" placeholder="Enter client or matter" class="client-input">
        </div>
        <div class="involex-compose-actions">
          <button class="involex-btn track-time" title="Track time for this email">
            ⏱️ Track Time
          </button>
          <button class="involex-btn auto-analyze" title="Auto-analyze when sent">
            🤖 Auto-Analyze
          </button>
          <button class="involex-btn minimize" title="Minimize widget">
            ➖
          </button>
        </div>
      </div>
    `;

    // Find optimal insertion point in compose window
    const insertionPoints = [
      composeElement.querySelector('.aoD'),
      composeElement.querySelector('.M9'),
      composeElement.querySelector('[role="dialog"] .AD'),
      composeElement.querySelector('.nH .AD')
    ];
    
    const insertionPoint = insertionPoints.find(point => point !== null);
    
    if (insertionPoint) {
      insertionPoint.appendChild(widget);
      this.composeWidgets.add(widget);
      
      // Track widget in map to prevent duplicates
      this.widgetMap.set(composeData.id, widget);
      
      // Set up compose widget event listeners
      this.setupComposeWidgetListeners(widget, composeData);
      
      console.log('✉️ Compose widget injected');
    }
  }

  private injectReadWidget(viewElement: HTMLElement, emailData: GmailEmail): void {
    // Check if widget already exists for this email
    if (this.widgetMap.has(emailData.id)) return;
    
    // Check if element already has a widget
    if (viewElement.querySelector('.involex-read-widget')) return;

    const widget = document.createElement('div');
    widget.className = 'involex-read-widget';
    widget.setAttribute('data-email-id', emailData.id);
    
    widget.innerHTML = `
      <div class="involex-widget-header">
        <div class="involex-logo">💼 Involex</div>
        <div class="involex-status ${emailData.direction}">
          ${emailData.direction === 'incoming' ? '📥' : '📤'} Legal Email Detected
        </div>
        <button class="involex-close" title="Close widget">✕</button>
      </div>
      <div class="involex-widget-content">
        <div class="involex-email-info">
          <div class="email-subject" title="${emailData.subject}">
            ${this.truncateText(emailData.subject, 40)}
          </div>
          <div class="email-meta">
            <span class="sender">${this.truncateText(emailData.sender, 25)}</span>
            <span class="timestamp">${this.formatTimestamp(emailData.timestamp)}</span>
          </div>
        </div>
        <div class="involex-analysis-section">
          <div class="analysis-status">
            <span class="status-indicator analyzing">🤖 Analyzing...</span>
            <div class="analysis-progress">
              <div class="progress-bar"></div>
            </div>
          </div>
          <div class="analysis-results" style="display: none;">
            <div class="time-estimate">
              <span class="label">Est. Time:</span>
              <span class="value">--</span>
            </div>
            <div class="work-type">
              <span class="label">Type:</span>
              <span class="value">--</span>
            </div>
            <div class="confidence">
              <span class="label">Confidence:</span>
              <span class="value">--</span>
            </div>
          </div>
        </div>
        <div class="involex-actions">
          <button class="involex-btn analyze-email" title="Analyze with AI">
            🤖 Analyze
          </button>
          <button class="involex-btn quick-bill" title="Quick bill entry">
            ⚡ Quick Bill
          </button>
          <button class="involex-btn add-to-billing" title="Add to billing entries">
            ➕ Add to Billing
          </button>
          <button class="involex-btn more-options" title="More options">
            ⚙️
          </button>
        </div>
      </div>
    `;

    // Find optimal insertion point
    const insertionPoints = [
      viewElement.querySelector('.adn.ads'),
      viewElement.querySelector('.ar.as'),
      viewElement.querySelector('.h7'),
      viewElement.closest('.ii.gt'),
      viewElement.parentElement
    ];
    
    const insertionPoint = insertionPoints.find(point => point !== null);
    
    if (insertionPoint) {
      insertionPoint.appendChild(widget);
      this.readWidgets.add(widget);
      
      // Track widget in map to prevent duplicates
      this.widgetMap.set(emailData.id, widget);
      
      // Set up read widget event listeners
      this.setupReadWidgetListeners(widget, emailData);
      
      // Auto-analyze if enabled
      this.autoAnalyzeEmail(emailData);
      
      console.log('👁️ Read widget injected for:', emailData.subject);
    }
  }

  private setupComposeWidgetListeners(widget: HTMLElement, composeData: GmailEmail): void {
    const trackTimeBtn = widget.querySelector('.track-time') as HTMLButtonElement;
    const autoAnalyzeBtn = widget.querySelector('.auto-analyze') as HTMLButtonElement;
    const minimizeBtn = widget.querySelector('.minimize') as HTMLButtonElement;
    const timeInput = widget.querySelector('.time-input') as HTMLInputElement;
    const clientInput = widget.querySelector('.client-input') as HTMLInputElement;

    trackTimeBtn?.addEventListener('click', () => {
      const hours = parseFloat(timeInput.value) || 0.2;
      const client = clientInput.value.trim();
      this.trackComposeTime(composeData, hours, client);
    });

    autoAnalyzeBtn?.addEventListener('click', () => {
      this.toggleAutoAnalyze(widget, composeData);
    });

    minimizeBtn?.addEventListener('click', () => {
      this.minimizeWidget(widget);
    });

    // Auto-save time and client inputs
    timeInput?.addEventListener('change', () => {
      this.saveComposeData(composeData.id, { estimatedTime: parseFloat(timeInput.value) });
    });

    clientInput?.addEventListener('input', () => {
      this.saveComposeData(composeData.id, { client: clientInput.value });
    });
  }

  private setupReadWidgetListeners(widget: HTMLElement, emailData: GmailEmail): void {
    const analyzeBtn = widget.querySelector('.analyze-email') as HTMLButtonElement;
    const quickBillBtn = widget.querySelector('.quick-bill') as HTMLButtonElement;
    const addToBillingBtn = widget.querySelector('.add-to-billing') as HTMLButtonElement;
    const moreOptionsBtn = widget.querySelector('.more-options') as HTMLButtonElement;
    const closeBtn = widget.querySelector('.involex-close') as HTMLButtonElement;

    analyzeBtn?.addEventListener('click', () => {
      this.analyzeEmail(emailData, widget);
    });

    quickBillBtn?.addEventListener('click', () => {
      this.openQuickBill(emailData);
    });

    addToBillingBtn?.addEventListener('click', () => {
      this.addToBilling(emailData);
    });

    moreOptionsBtn?.addEventListener('click', () => {
      this.showMoreOptions(widget, emailData);
    });

    closeBtn?.addEventListener('click', () => {
      this.closeWidget(widget);
    });
  }

  private setupEmailEventListeners(): void {
    // Listen for email send events
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      
      // Detect send button clicks
      if (this.isSendButton(target)) {
        this.handleEmailSend(target);
      }
      
      // Detect reply/forward button clicks
      if (this.isReplyForwardButton(target)) {
        this.handleReplyForward(target);
      }
    });

    // Listen for keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      // Ctrl+Enter or Cmd+Enter (send email)
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        this.handleKeyboardSend(event);
      }
      
      // Tab key for quick billing
      if (event.key === 'Tab' && event.altKey) {
        event.preventDefault();
        this.openQuickBillForCurrentEmail();
      }
    });
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (event) => {
      // Alt+I: Toggle Involex widget
      if (event.altKey && event.key === 'i') {
        event.preventDefault();
        this.toggleInvolexWidgets();
      }
      
      // Alt+A: Auto-analyze current email
      if (event.altKey && event.key === 'a') {
        event.preventDefault();
        this.analyzeCurrentEmail();
      }
      
      // Alt+B: Quick bill current email
      if (event.altKey && event.key === 'b') {
        event.preventDefault();
        this.quickBillCurrentEmail();
      }
    });
  }

  private setupUIInjectionSystem(): void {
    // Continuous monitoring for UI injection opportunities
    setInterval(() => {
      this.scanForNewEmails();
      this.scanForNewComposeWindows();
      this.cleanupOrphanedWidgets();
    }, 2000);

    // Handle Gmail navigation
    this.setupNavigationHandlers();
  }

  private scanExistingEmails(): void {
    console.log('🔍 Scanning for existing emails...');
    
    // Scan for email conversations
    const emailElements = document.querySelectorAll([
      '[data-message-id]',
      '.ii.gt',
      '.h7'
    ].join(', '));

    emailElements.forEach(element => {
      if (!element.querySelector('.involex-read-widget')) {
        this.handleEmailViewing(element as HTMLElement);
      }
    });

    // Scan for compose windows
    const composeElements = document.querySelectorAll([
      '[role="dialog"][aria-label*="compose" i]',
      '.M9',
      '.nH .AD'
    ].join(', '));

    composeElements.forEach(element => {
      if (!element.querySelector('.involex-compose-widget')) {
        this.handleComposeDetection(element as HTMLElement);
      }
    });

    console.log(`📊 Found ${emailElements.length} emails and ${composeElements.length} compose windows`);
  }

  // Helper methods
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  private formatTimestamp(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      const diffDays = diffHours / 24;

      if (diffHours < 1) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return `${diffMinutes}m ago`;
      } else if (diffHours < 24) {
        return `${Math.floor(diffHours)}h ago`;
      } else if (diffDays < 7) {
        return `${Math.floor(diffDays)}d ago`;
      } else {
        return date.toLocaleDateString();
      }
    } catch (error) {
      return 'Unknown';
    }
  }

  private async autoAnalyzeEmail(emailData: GmailEmail): Promise<void> {
    // Check if auto-analysis is enabled
    const settings = await this.getUserSettings();
    if (!settings?.aiSettings?.analysisEnabled) return;

    setTimeout(() => {
      this.analyzeEmail(emailData);
    }, 1000); // Small delay to let UI settle
  }

  private async analyzeEmail(emailData: GmailEmail, widget?: HTMLElement): Promise<void> {
    try {
      if (widget) {
        this.updateAnalysisStatus(widget, 'analyzing');
      }

      const response = await chrome.runtime.sendMessage({
        type: 'ANALYZE_EMAIL',
        data: emailData
      });

      if (response.success) {
        if (widget) {
          this.updateAnalysisResults(widget, response.data);
        }
        console.log('✅ Email analysis complete:', response.data);
      } else {
        console.error('❌ Email analysis failed:', response.error);
        if (widget) {
          this.updateAnalysisStatus(widget, 'error');
        }
      }
    } catch (error) {
      console.error('❌ Error analyzing email:', error);
      if (widget) {
        this.updateAnalysisStatus(widget, 'error');
      }
    }
  }

  private updateAnalysisStatus(widget: HTMLElement, status: 'analyzing' | 'complete' | 'error'): void {
    const statusElement = widget.querySelector('.status-indicator');
    const progressBar = widget.querySelector('.progress-bar');
    
    if (statusElement) {
      switch (status) {
        case 'analyzing':
          statusElement.textContent = '🤖 Analyzing...';
          statusElement.className = 'status-indicator analyzing';
          break;
        case 'complete':
          statusElement.textContent = '✅ Analysis Complete';
          statusElement.className = 'status-indicator complete';
          break;
        case 'error':
          statusElement.textContent = '❌ Analysis Failed';
          statusElement.className = 'status-indicator error';
          break;
      }
    }

    if (progressBar && status === 'analyzing') {
      (progressBar as HTMLElement).style.animation = 'progress 2s linear infinite';
    } else if (progressBar) {
      (progressBar as HTMLElement).style.animation = 'none';
    }
  }

  private updateAnalysisResults(widget: HTMLElement, analysis: any): void {
    const resultsSection = widget.querySelector('.analysis-results') as HTMLElement;
    const statusSection = widget.querySelector('.analysis-status') as HTMLElement;
    
    if (resultsSection && statusSection) {
      // Hide status, show results
      statusSection.style.display = 'none';
      resultsSection.style.display = 'block';
      
      // Update values
      const timeValue = resultsSection.querySelector('.time-estimate .value');
      const typeValue = resultsSection.querySelector('.work-type .value');
      const confidenceValue = resultsSection.querySelector('.confidence .value');
      
      if (timeValue) timeValue.textContent = `${analysis.estimatedTime}h`;
      if (typeValue) typeValue.textContent = analysis.workType || 'General';
      if (confidenceValue) confidenceValue.textContent = `${Math.round(analysis.confidence * 100)}%`;
    }
  }

  private async notifyEmailDetected(emailData: GmailEmail): Promise<void> {
    try {
      await chrome.runtime.sendMessage({
        type: 'EMAIL_DETECTED',
        data: emailData
      });
    } catch (error) {
      console.warn('⚠️ Failed to notify background script:', error);
    }
  }

  // Continue with additional methods...
  private async getUserSettings(): Promise<any> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_USER_SETTINGS'
      });
      return response.success ? response.data : null;
    } catch (error) {
      console.warn('⚠️ Failed to get user settings:', error);
      return null;
    }
  }

  // Missing method implementations
  private trackComposeTime(composeData: GmailEmail, hours: number, client: string): void {
    console.log(`⏱️ Tracking ${hours}h for compose to ${composeData.recipients.join(', ')}`);
    
    // Create billing entry for compose
    chrome.runtime.sendMessage({
      type: 'CREATE_BILLING_ENTRY',
      data: {
        ...composeData,
        estimatedTime: hours,
        client: client,
        workType: 'correspondence'
      }
    });
  }

  private toggleAutoAnalyze(widget: HTMLElement, composeData: GmailEmail): void {
    const button = widget.querySelector('.auto-analyze') as HTMLButtonElement;
    const isEnabled = button.classList.toggle('enabled');
    
    button.textContent = isEnabled ? '🤖 Auto-Analyze (ON)' : '🤖 Auto-Analyze';
    
    // Store preference
    this.saveComposeData(composeData.id, { autoAnalyze: isEnabled });
  }

  private minimizeWidget(widget: HTMLElement): void {
    const content = widget.querySelector('.involex-compose-content') as HTMLElement;
    const minimizeBtn = widget.querySelector('.minimize') as HTMLButtonElement;
    
    if (content.style.display === 'none') {
      content.style.display = 'block';
      minimizeBtn.textContent = '➖';
      minimizeBtn.title = 'Minimize widget';
    } else {
      content.style.display = 'none';
      minimizeBtn.textContent = '➕';
      minimizeBtn.title = 'Expand widget';
    }
  }

  private saveComposeData(composeId: string, data: any): void {
    const existing = localStorage.getItem(`involex_compose_${composeId}`);
    const composeData = existing ? JSON.parse(existing) : {};
    
    Object.assign(composeData, data);
    localStorage.setItem(`involex_compose_${composeId}`, JSON.stringify(composeData));
  }

  private openQuickBill(emailData: GmailEmail): void {
    // Open quick billing modal
    chrome.runtime.sendMessage({
      type: 'OPEN_QUICK_BILL',
      data: emailData
    });
  }

  private addToBilling(emailData: GmailEmail): void {
    // Add to billing entries
    chrome.runtime.sendMessage({
      type: 'ADD_TO_BILLING',
      data: emailData
    });
  }

  private showMoreOptions(widget: HTMLElement, emailData: GmailEmail): void {
    // Show context menu with more options
    const menu = document.createElement('div');
    menu.className = 'involex-context-menu';
    menu.innerHTML = `
      <div class="menu-item" data-action="export">📤 Export Email</div>
      <div class="menu-item" data-action="settings">⚙️ Settings</div>
      <div class="menu-item" data-action="feedback">💬 Feedback</div>
      <div class="menu-item" data-action="help">❓ Help</div>
    `;
    
    document.body.appendChild(menu);
    
    // Position near button
    const button = widget.querySelector('.more-options') as HTMLElement;
    const rect = button.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.zIndex = '10000';
    
    // Handle menu clicks
    menu.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.dataset.action;
      
      switch (action) {
        case 'export':
          this.exportEmail(emailData);
          break;
        case 'settings':
          chrome.runtime.openOptionsPage();
          break;
        case 'feedback':
          window.open('https://involex.com/feedback', '_blank');
          break;
        case 'help':
          window.open('https://involex.com/help', '_blank');
          break;
      }
      
      menu.remove();
    });
    
    // Close menu on outside click
    setTimeout(() => {
      document.addEventListener('click', () => menu.remove(), { once: true });
    }, 100);
  }

  private closeWidget(widget: HTMLElement): void {
    widget.remove();
    this.readWidgets.delete(widget);
  }

  private isSendButton(element: HTMLElement): boolean {
    const sendSelectors = [
      '[data-tooltip*="Send" i]',
      '.T-I.J-J5-Ji.aoO.v7.T-I-atl.L3',
      '[aria-label*="Send" i]',
      '.T-I.J-J5-Ji.aoO.T-I-atl.L3'
    ];
    
    return sendSelectors.some(selector => 
      element.matches(selector) || element.closest(selector)
    );
  }

  private handleEmailSend(element: HTMLElement): void {
    console.log('📤 Email send detected');
    
    // Find associated compose widget
    const composeWindow = element.closest('[role="dialog"], .M9, .nH .AD');
    const widget = composeWindow?.querySelector('.involex-compose-widget');
    
    if (widget) {
      const composeId = widget.getAttribute('data-compose-id');
      if (composeId) {
        // Process the sent email
        this.processSentEmail(composeId);
      }
    }
  }

  private isReplyForwardButton(element: HTMLElement): boolean {
    const replyForwardSelectors = [
      '[data-tooltip*="Reply" i]',
      '[data-tooltip*="Forward" i]',
      '[aria-label*="Reply" i]',
      '[aria-label*="Forward" i]'
    ];
    
    return replyForwardSelectors.some(selector => 
      element.matches(selector) || element.closest(selector)
    );
  }

  private handleReplyForward(element: HTMLElement): void {
    console.log('↩️ Reply/Forward detected');
    // Handle reply/forward composition
  }

  private handleKeyboardSend(event: KeyboardEvent): void {
    console.log('⌨️ Keyboard send detected');
    // Handle keyboard send
  }

  private openQuickBillForCurrentEmail(): void {
    if (this.currentEmailId) {
      const emailData = this.emailCache.get(this.currentEmailId);
      if (emailData) {
        this.openQuickBill(emailData);
      }
    }
  }

  private toggleInvolexWidgets(): void {
    const widgets = document.querySelectorAll('.involex-read-widget, .involex-compose-widget');
    widgets.forEach(widget => {
      const element = widget as HTMLElement;
      element.style.display = element.style.display === 'none' ? 'block' : 'none';
    });
  }

  private analyzeCurrentEmail(): void {
    if (this.currentEmailId) {
      const emailData = this.emailCache.get(this.currentEmailId);
      if (emailData) {
        this.analyzeEmail(emailData);
      }
    }
  }

  private quickBillCurrentEmail(): void {
    if (this.currentEmailId) {
      const emailData = this.emailCache.get(this.currentEmailId);
      if (emailData) {
        this.openQuickBill(emailData);
      }
    }
  }

  private scanForNewEmails(): void {
    // Continuous scanning for new emails
    const newEmails = document.querySelectorAll('[data-message-id]:not([data-involex-processed])');
    newEmails.forEach(email => {
      email.setAttribute('data-involex-processed', 'true');
      this.handleEmailViewing(email as HTMLElement);
    });
  }

  private scanForNewComposeWindows(): void {
    // Continuous scanning for new compose windows
    const newComposeWindows = document.querySelectorAll('[role="dialog"][aria-label*="compose" i]:not([data-involex-processed]), .M9:not([data-involex-processed])');
    newComposeWindows.forEach(compose => {
      compose.setAttribute('data-involex-processed', 'true');
      this.handleComposeDetection(compose as HTMLElement);
    });
  }

  private cleanupOrphanedWidgets(): void {
    // Remove widgets that are no longer attached to valid elements
    this.readWidgets.forEach(widget => {
      if (!document.contains(widget)) {
        this.readWidgets.delete(widget);
      }
    });
    
    this.composeWidgets.forEach(widget => {
      if (!document.contains(widget)) {
        this.composeWidgets.delete(widget);
      }
    });
  }

  private setupNavigationHandlers(): void {
    // Handle Gmail navigation changes
    let lastUrl = window.location.href;
    
    const checkUrlChange = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        console.log('🧭 Gmail navigation detected');
        lastUrl = currentUrl;
        
        // Re-scan for emails after navigation
        setTimeout(() => {
          this.scanExistingEmails();
        }, 1000);
      }
    };
    
    setInterval(checkUrlChange, 1000);
  }

  private updateEmailListAnalysis(): void {
    // Analyze visible emails in the list for legal content
    const emailListItems = document.querySelectorAll('.zA');
    let legalEmailCount = 0;
    
    emailListItems.forEach(item => {
      const subject = item.querySelector('.bog')?.textContent || '';
      const sender = item.querySelector('.yW span')?.textContent || '';
      
      if (this.isLegalEmail({ subject, sender } as any)) {
        legalEmailCount++;
        item.classList.add('involex-legal-email');
      }
    });
    
    if (legalEmailCount > 0) {
      console.log(`📊 Found ${legalEmailCount} legal emails in current view`);
    }
  }

  private handleThreadNavigation(element: HTMLElement): void {
    const threadId = element.getAttribute('data-thread-id') || 
                    element.querySelector('[data-thread-id]')?.getAttribute('data-thread-id');
    
    if (threadId) {
      console.log('🧵 Thread navigation:', threadId);
      // Handle thread-specific logic
    }
  }

  private processEmailThread(threadElement: HTMLElement): void {
    // Process entire email thread for legal content
    const messages = threadElement.querySelectorAll('[data-message-id]');
    console.log(`🧵 Processing thread with ${messages.length} messages`);
    
    messages.forEach(message => {
      this.handleEmailViewing(message as HTMLElement);
    });
  }

  private processSentEmail(composeId: string): void {
    // Process sent email for billing
    const composeData = localStorage.getItem(`involex_compose_${composeId}`);
    if (composeData) {
      const data = JSON.parse(composeData);
      
      chrome.runtime.sendMessage({
        type: 'EMAIL_SENT',
        data: {
          composeId,
          ...data,
          sentAt: new Date().toISOString()
        }
      });
      
      // Cleanup
      localStorage.removeItem(`involex_compose_${composeId}`);
    }
  }

  private exportEmail(emailData: GmailEmail): void {
    // Export email data
    const exportData = {
      subject: emailData.subject,
      sender: emailData.sender,
      recipients: emailData.recipients,
      timestamp: emailData.timestamp,
      content: emailData.content
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-${emailData.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Cleanup method
  public destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    // Remove all injected widgets
    this.composeWidgets.forEach(widget => widget.remove());
    this.readWidgets.forEach(widget => widget.remove());
    
    this.composeWidgets.clear();
    this.readWidgets.clear();
    
    this.isInitialized = false;
    console.log('🧹 Gmail integration destroyed');
  }
}

// Initialize Enhanced Gmail Integration
const enhancedGmailIntegration = new EnhancedGmailIntegration();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  enhancedGmailIntegration.destroy();
});

console.log('✅ Enhanced Gmail Integration v2.0 Loaded');
