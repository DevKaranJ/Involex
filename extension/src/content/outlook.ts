// Enhanced Outlook Web Content Script for Involex
// Real-time email detection, content extraction, and billing UI injection

// Initial load message (keep for debugging)
console.log('🚀 Involex Outlook Integration v2.2 Loading...');

import { EmailData, BillingEntry } from '../shared/types';

interface OutlookEmail {
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

class EnhancedOutlookIntegration {
  private isInitialized = false;
  private emailCache = new Map<string, OutlookEmail>();
  private observer: MutationObserver | null = null;
  private currentEmailId: string | null = null;
  private composeWidgets = new Set<HTMLElement>();
  private readWidgets = new Set<HTMLElement>();
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
      console.log(`[Involex Outlook] ${message}`);
      this.lastLogTime = now;
    }
  }

  private async init(): Promise<void> {
    if (this.isInitialized) return;

    this.log('📧 Initializing Enhanced Outlook Integration...');
    
    // Wait for Outlook to fully load
    await this.waitForOutlookLoad();
    
    // Set up real-time email detection
    this.setupAdvancedEmailDetection();
    
    // Set up UI injection system
    this.setupUIInjectionSystem();
    
    // Set up email event listeners
    this.setupEmailEventListeners();
    
    // Set up keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    this.isInitialized = true;
    this.log('✅ Enhanced Outlook Integration Ready');
  }

  private async waitForOutlookLoad(): Promise<void> {
    return new Promise((resolve) => {
      const outlookLoadCheck = () => {
        return document.querySelector('[role="main"]') ||
               document.querySelector('.wide-content-host') ||
               document.querySelector('#app-mount') ||
               document.querySelector('[data-app-section="ConversationContainer"]') ||
               document.querySelector('.allowTextSelection') ||
               document.querySelector('[data-testid="app-container"]');
      };

      const checkOutlookLoaded = () => {
        if (outlookLoadCheck()) {
          this.log('📧 Outlook interface fully loaded');
          setTimeout(resolve, 1000); // Give Outlook extra time to stabilize
        } else {
          setTimeout(checkOutlookLoaded, 500);
        }
      };
      
      checkOutlookLoaded();
    });
  }

  private setupAdvancedEmailDetection(): void {
    // Advanced DOM observer for all Outlook interactions
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
        
        // Detect attribute changes (important for Outlook's dynamic updates)
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
      attributeFilter: ['aria-expanded', 'aria-selected', 'class', 'data-convid', 'data-testid']
    });

    // Scan for existing emails on page load
    setTimeout(() => this.scanExistingEmails(), 2000);
  }

  private detectEmailComposition(element: Element): void {
    // Detect various Outlook compose scenarios
    const composeSelectors = [
      '[data-testid="compose-container"]',        // Outlook compose container
      '.ms-FocusZone[role="region"]',             // Compose region
      '[aria-label*="compose" i]',               // Compose dialog
      '.allowTextSelection[role="region"]',      // Text area
      '[data-app-section="ComposeContainer"]',   // App compose section
      '[role="dialog"][aria-label*="Message"]',  // Message dialog
      '.compose-surface'                         // Compose surface
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

    // Detect email reading/viewing scenarios in Outlook
    const viewSelectors = [
      '[data-convid]',                            // Email with conversation ID
      '[data-testid="message-body"]',             // Message body
      '.allowTextSelection',                      // Email content area
      '[role="document"][aria-label*="Message"]', // Message document
      '.wide-content-host',                       // Wide content container
      '[data-testid="message-header"]',           // Message header
      '.message-content',                         // Message content
      '[data-testid="email-container"]'           // Email container
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
    if (element.classList?.contains('ms-List') || 
        element.querySelector?.('[data-testid="message-list"]') ||
        element.classList?.contains('_3L8MDN7YkC2WS7Kx0bYhLN') ||
        element.querySelector?.('[role="listbox"]')) {
      this.log('📋 Email list updated');
      this.updateEmailListAnalysis();
    }
  }

  private detectThreadNavigation(element: Element): void {
    // Detect thread navigation and changes in Outlook
    if (element.hasAttribute?.('data-convid') || 
        element.querySelector?.('[data-convid]') ||
        element.classList?.contains('_3kFP6Yr7fz6oCWPM0X7baS') ||
        element.querySelector?.('[data-testid="thread-container"]')) {
      this.log('🧵 Thread navigation detected');
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
        
        this.log('📝 Compose widget injected for: ' + (composeData.subject || 'New Email'), 2000);
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

  private updateEmailListAnalysis(): void {
    // Update analysis when email list changes
    this.log('📊 Updating email list analysis', 5000);
  }

  private handleThreadNavigation(element: HTMLElement): void {
    // Handle thread navigation in Outlook
    this.log('🧵 Handling thread navigation', 3000);
  }

  private extractComposeData(composeElement: HTMLElement): OutlookEmail | null {
    try {
      const id = `compose_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Extract recipient (Outlook specific selectors)
      const toField = composeElement.querySelector('[data-testid="To-Box"] input, [aria-label*="To" i], .ms-BasePicker-input') as HTMLInputElement;
      const recipients = toField?.value ? [toField.value] : [];
      
      // Extract subject (Outlook specific selectors)
      const subjectField = composeElement.querySelector('[data-testid="Subject"] input, [aria-label*="Subject" i], [placeholder*="Subject" i]') as HTMLInputElement;
      const subject = subjectField?.value || '';
      
      // Extract body content (Outlook specific selectors)
      const bodyField = composeElement.querySelector('[data-testid="mail-compose-body"], [role="textbox"], .ms-RichText-editor') as HTMLElement;
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

  private extractEmailData(element: HTMLElement): OutlookEmail | null {
    try {
      // Get conversation ID or generate fallback
      const convElement = element.closest('[data-convid]') || element.querySelector('[data-convid]');
      const convId = convElement?.getAttribute('data-convid');
      
      const id = convId || `outlook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Extract subject from multiple possible locations in Outlook
      const subjectSelectors = [
        '[data-testid="message-subject"]',
        '[role="heading"]',
        '.Subject',
        '[aria-label*="Subject" i]',
        '.ms-MessageHeader-subject'
      ];
      
      let subject = '';
      for (const selector of subjectSelectors) {
        const subjectElement = element.querySelector(selector);
        if (subjectElement?.textContent?.trim()) {
          subject = subjectElement.textContent.trim();
          break;
        }
      }
      
      // Extract sender information
      const senderSelectors = [
        '[data-testid="message-from"]',
        '.From',
        '[data-testid="sender-name"]',
        '[aria-label*="From" i]',
        '.ms-Persona-primaryText'
      ];
      
      let sender = '';
      for (const selector of senderSelectors) {
        const senderElement = element.querySelector(selector);
        if (senderElement?.textContent?.trim()) {
          sender = senderElement.textContent.trim();
          break;
        }
      }
      
      // Extract email content
      const contentSelectors = [
        '[data-testid="message-body"]',
        '.allowTextSelection',
        '.rps_',
        '[role="document"]',
        '.ms-MessageContent'
      ];
      
      let content = '';
      for (const selector of contentSelectors) {
        const contentElement = element.querySelector(selector);
        if (contentElement?.textContent?.trim()) {
          content = contentElement.textContent.trim();
          break;
        }
      }

      // Extract recipients
      const recipients = this.extractRecipients(element);
      
      // Extract timestamp
      const timestampSelectors = [
        '[data-testid="message-date"]',
        '[aria-label*="time" i]',
        '.Time',
        '.ms-MessageHeader-date'
      ];
      
      let timestamp = new Date().toISOString();
      for (const selector of timestampSelectors) {
        const timestampElement = element.querySelector(selector);
        if (timestampElement?.textContent?.trim()) {
          const dateStr = timestampElement.textContent.trim();
          const parsedDate = this.parseRelativeTime(dateStr) || new Date(dateStr);
          if (!isNaN(parsedDate.getTime())) {
            timestamp = parsedDate.toISOString();
            break;
          }
        }
      }
      
      // Determine direction based on sender
      const currentUser = this.getCurrentUserEmail();
      const direction = sender.includes(currentUser) ? 'outgoing' : 'incoming';
      
      return {
        id,
        subject: subject || 'No Subject',
        sender: sender || 'Unknown Sender',
        recipients: recipients,
        timestamp,
        content: content || '',
        threadId: convId || undefined,
        direction
      };
    } catch (error) {
      console.warn('⚠️ Error extracting email data:', error);
      return null;
    }
  }

  private getCurrentUserEmail(): string {
    // Try to extract current user email from Outlook interface
    const userSelectors = [
      '[data-testid="user-email"]',
      '[aria-label*="account" i]',
      '.ms-Persona-primaryText',
      '[data-testid="current-user"]'
    ];
    
    for (const selector of userSelectors) {
      const userElement = document.querySelector(selector);
      if (userElement?.textContent?.includes('@')) {
        return userElement.textContent.trim();
      }
    }
    
    return 'user@company.com'; // Fallback
  }

  private isLegalEmail(email: OutlookEmail): boolean {
    const legalKeywords = [
      'contract', 'agreement', 'legal', 'litigation', 'court', 'case',
      'attorney', 'lawyer', 'counsel', 'client', 'matter', 'brief',
      'deposition', 'discovery', 'motion', 'hearing', 'trial', 'settlement',
      'compliance', 'regulatory', 'statute', 'law', 'jurisdiction'
    ];

    const legalDomains = [
      'law.', '.legal', 'attorney', 'lawyer', 'counsel', 'legal-'
    ];

    const text = `${email.subject} ${email.content} ${email.sender}`.toLowerCase();
    
    return legalKeywords.some(keyword => text.includes(keyword)) ||
           legalDomains.some(domain => email.sender.toLowerCase().includes(domain));
  }

  private injectComposeWidget(composeElement: HTMLElement, composeData: OutlookEmail): void {
    // Check if widget already exists for this compose
    if (this.widgetMap.has(composeData.id)) return;
    
    // Check if element already has a widget
    if (composeElement.querySelector('.involex-compose-widget')) return;

    // Check if we already processed this compose window
    if (this.processedComposeWindows.has(composeElement)) return;
    
    this.processedComposeWindows.add(composeElement);

    const widget = document.createElement('div');
    widget.className = 'involex-compose-widget outlook-compose';
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

    // Find optimal insertion point in Outlook compose window
    const insertionPoints = [
      composeElement.querySelector('[data-testid="compose-toolbar"]'),
      composeElement.querySelector('.ms-CommandBar'),
      composeElement.querySelector('[role="toolbar"]'),
      composeElement.querySelector('.compose-header'),
      composeElement.parentElement
    ];
    
    const insertionPoint = insertionPoints.find(point => point !== null);
    
    if (insertionPoint) {
      insertionPoint.appendChild(widget);
      this.composeWidgets.add(widget);
      
      // Track widget in map to prevent duplicates
      this.widgetMap.set(composeData.id, widget);
      
      // Set up compose widget event listeners
      this.setupComposeWidgetListeners(composeElement, composeData);
      
      this.log('✉️ Compose widget injected');
    }
  }

  private injectReadWidget(viewElement: HTMLElement, emailData: OutlookEmail): void {
    // Check if widget already exists for this email
    if (this.widgetMap.has(emailData.id)) return;
    
    // Check if element already has a widget
    if (viewElement.querySelector('.involex-read-widget')) return;

    const widget = document.createElement('div');
    widget.className = 'involex-read-widget outlook-read';
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

    // Find optimal insertion point in Outlook email view
    const insertionPoints = [
      viewElement.querySelector('[data-testid="message-header"]'),
      viewElement.querySelector('.allowTextSelection'),
      viewElement.closest('[data-convid]'),
      viewElement.querySelector('.ms-MessageHeader'),
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
      
      // Start auto-analysis if enabled
      this.autoAnalyzeEmail(emailData);
      
      this.log('👁️ Read widget injected for: ' + emailData.subject);
    }
  }

  private setupUIInjectionSystem(): void {
    // Set up the UI injection system for Outlook
    this.log('🎨 Setting up UI injection system');
    
    // Continuous monitoring for UI injection opportunities
    setInterval(() => {
      this.scanForNewEmails();
      this.scanForNewComposeWindows();
      this.cleanupOrphanedWidgets();
    }, 2000);

    // Handle Outlook navigation
    this.setupNavigationHandlers();
  }

  private setupKeyboardShortcuts(): void {
    // Set up keyboard shortcuts for Outlook
    document.addEventListener('keydown', (event) => {
      if (event.altKey) {
        switch (event.key) {
          case 'a':
            event.preventDefault();
            this.triggerAnalysis();
            break;
          case 'b':
            event.preventDefault();
            this.quickBill();
            break;
          case 'i':
            event.preventDefault();
            this.showInvolex();
            break;
        }
      }
    });
  }

  private setupComposeWidgetListeners(composeElement: HTMLElement, composeData: OutlookEmail): void {
    // Set up event listeners for compose widget
    const widget = this.widgetMap.get(composeData.id);
    if (!widget) return;

    const trackBtn = widget.querySelector('.track-time') as HTMLButtonElement;
    const autoAnalyzeBtn = widget.querySelector('.auto-analyze') as HTMLButtonElement;
    const minimizeBtn = widget.querySelector('.minimize') as HTMLButtonElement;
    const timeInput = widget.querySelector('.time-input') as HTMLInputElement;
    const clientInput = widget.querySelector('.client-input') as HTMLInputElement;

    trackBtn?.addEventListener('click', () => {
      const hours = parseFloat(timeInput?.value || '0.2');
      const client = clientInput?.value || '';
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

  private setupReadWidgetListeners(widget: HTMLElement, emailData: OutlookEmail): void {
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
      
      if (this.isSendButton(target)) {
        this.handleEmailSend(target);
      }
      
      if (this.isReplyForwardButton(target)) {
        this.handleReplyForward(target);
      }
    });

    // Listen for keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.key === 'Enter') {
        this.handleKeyboardSend(event);
      }
    });
  }

  private notifyEmailDetected(emailData: OutlookEmail): void {
    // Notify background script
    chrome.runtime.sendMessage({
      type: 'EMAIL_DETECTED',
      data: emailData
    });
  }

  private scanExistingEmails(): void {
    this.log('🔍 Scanning for existing emails...');
    
    const emailElements = document.querySelectorAll([
      '[data-convid]',
      '[data-testid="message-body"]',
      '.allowTextSelection',
      '.message-content'
    ].join(', '));
    
    const composeElements = document.querySelectorAll([
      '[data-testid="compose-container"]',
      '[data-app-section="ComposeContainer"]',
      '.compose-surface'
    ].join(', '));

    this.log(`📊 Found ${emailElements.length} emails and ${composeElements.length} compose windows`);

    emailElements.forEach(element => {
      this.handleEmailViewing(element as HTMLElement);
    });

    composeElements.forEach(element => {
      this.handleComposeDetection(element as HTMLElement);
    });
  }

  // Helper methods
  private truncateText(text: string, maxLength: number): string {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  private formatTimestamp(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  }

  // Action methods
  private triggerAnalysis(): void {
    if (this.currentEmailId) {
      const emailData = this.emailCache.get(this.currentEmailId);
      if (emailData) {
        this.analyzeEmail(emailData);
      }
    }
  }

  private quickBill(): void {
    if (this.currentEmailId) {
      const emailData = this.emailCache.get(this.currentEmailId);
      if (emailData) {
        this.quickBillEmail(emailData);
      }
    }
  }

  private showInvolex(): void {
    chrome.runtime.sendMessage({ type: 'SHOW_POPUP' });
  }

  private trackComposeTime(composeData: OutlookEmail, hours: number, client: string): void {
    this.log(`⏱️ Tracking ${hours}h for compose to ${composeData.recipients.join(', ')}`);
    
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

  private enableAutoAnalyze(composeData: OutlookEmail): void {
    this.log('🤖 Auto-analyze enabled for compose email');
  }

  private minimizeWidget(widget: HTMLElement): void {
    widget.style.display = 'none';
  }

  private analyzeEmail(emailData: OutlookEmail, widget?: HTMLElement): void {
    this.log('🤖 Analyzing email: ' + emailData.subject);
    
    if (widget) {
      this.updateAnalysisStatus(widget, 'analyzing');
    }
    
    chrome.runtime.sendMessage({
      type: 'ANALYZE_EMAIL',
      data: emailData
    }).then((response) => {
      if (widget && response) {
        this.updateAnalysisResults(widget, response);
      }
    }).catch((error) => {
      console.warn('⚠️ Analysis failed:', error);
      if (widget) {
        this.updateAnalysisStatus(widget, 'error');
      }
    });
  }

  private quickBillEmail(emailData: OutlookEmail): void {
    this.log('⚡ Quick billing email: ' + emailData.subject);
  }

  private addToBilling(emailData: OutlookEmail): void {
    this.log('➕ Adding to billing: ' + emailData.subject);
  }

  private closeWidget(widget: HTMLElement): void {
    const emailId = widget.getAttribute('data-email-id');
    if (emailId) {
      this.widgetMap.delete(emailId);
    }
    widget.remove();
    this.readWidgets.delete(widget);
  }

  // Additional missing methods from Gmail integration
  private toggleAutoAnalyze(widget: HTMLElement, composeData: OutlookEmail): void {
    const button = widget.querySelector('.auto-analyze') as HTMLButtonElement;
    const isEnabled = button.classList.toggle('enabled');
    
    button.textContent = isEnabled ? '🤖 Auto-Analyze (ON)' : '🤖 Auto-Analyze';
    
    // Store preference
    this.saveComposeData(composeData.id, { autoAnalyze: isEnabled });
  }

  private saveComposeData(composeId: string, data: any): void {
    const existing = localStorage.getItem(`involex_compose_${composeId}`);
    const composeData = existing ? JSON.parse(existing) : {};
    
    Object.assign(composeData, data);
    localStorage.setItem(`involex_compose_${composeId}`, JSON.stringify(composeData));
  }

  private openQuickBill(emailData: OutlookEmail): void {
    // Open quick billing modal
    chrome.runtime.sendMessage({
      type: 'OPEN_QUICK_BILL',
      data: emailData
    });
  }

  private showMoreOptions(widget: HTMLElement, emailData: OutlookEmail): void {
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
      const action = target.getAttribute('data-action');
      
      switch (action) {
        case 'export':
          this.exportEmail(emailData);
          break;
        case 'settings':
          chrome.runtime.sendMessage({ type: 'OPEN_SETTINGS' });
          break;
        case 'feedback':
          chrome.runtime.sendMessage({ type: 'OPEN_FEEDBACK' });
          break;
        case 'help':
          chrome.runtime.sendMessage({ type: 'OPEN_HELP' });
          break;
      }
      
      menu.remove();
    });
    
    // Close menu on outside click
    setTimeout(() => {
      document.addEventListener('click', () => menu.remove(), { once: true });
    }, 100);
  }

  private isSendButton(element: HTMLElement): boolean {
    const sendSelectors = [
      '[data-testid="send-button"]',
      '[aria-label*="Send" i]',
      '.ms-Button--primary[aria-label*="Send" i]',
      '[title*="Send" i]'
    ];
    
    return sendSelectors.some(selector => 
      element.matches(selector) || element.closest(selector)
    );
  }

  private handleEmailSend(element: HTMLElement): void {
    this.log('📤 Email send detected');
    
    // Find associated compose widget
    const composeWindow = element.closest('[data-testid="compose-container"], [role="dialog"]');
    const widget = composeWindow?.querySelector('.involex-compose-widget');
    
    if (widget) {
      const composeId = widget.getAttribute('data-compose-id');
      if (composeId) {
        this.processSentEmail(composeId);
      }
    }
  }

  private isReplyForwardButton(element: HTMLElement): boolean {
    const replyForwardSelectors = [
      '[data-testid="reply-button"]',
      '[data-testid="forward-button"]',
      '[aria-label*="Reply" i]',
      '[aria-label*="Forward" i]',
      '[title*="Reply" i]',
      '[title*="Forward" i]'
    ];
    
    return replyForwardSelectors.some(selector => 
      element.matches(selector) || element.closest(selector)
    );
  }

  private handleReplyForward(element: HTMLElement): void {
    this.log('↩️ Reply/Forward detected');
    // Handle reply/forward composition
  }

  private handleKeyboardSend(event: KeyboardEvent): void {
    this.log('⌨️ Keyboard send detected');
    // Handle keyboard send
  }

  private updateAnalysisStatus(widget: HTMLElement, status: 'analyzing' | 'complete' | 'error'): void {
    const statusElement = widget.querySelector('.status-indicator');
    const progressBar = widget.querySelector('.progress-bar') as HTMLElement;
    
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
      progressBar.style.animation = 'indeterminate 2s infinite linear';
    } else if (progressBar) {
      progressBar.style.animation = 'none';
    }
  }

  private updateAnalysisResults(widget: HTMLElement, analysis: any): void {
    const resultsSection = widget.querySelector('.analysis-results') as HTMLElement;
    const statusSection = widget.querySelector('.analysis-status') as HTMLElement;
    
    if (resultsSection && statusSection) {
      // Hide status, show results
      statusSection.style.display = 'none';
      resultsSection.style.display = 'block';
      
      // Update result values
      const timeValue = resultsSection.querySelector('.time-estimate .value');
      const typeValue = resultsSection.querySelector('.work-type .value');
      const confidenceValue = resultsSection.querySelector('.confidence .value');
      
      if (timeValue) timeValue.textContent = analysis.estimatedTime || '--';
      if (typeValue) typeValue.textContent = analysis.workType || '--';
      if (confidenceValue) confidenceValue.textContent = analysis.confidence || '--';
    }
  }

  private processSentEmail(composeId: string): void {
    // Process sent email for billing
    const composeData = localStorage.getItem(`involex_compose_${composeId}`);
    if (composeData) {
      const data = JSON.parse(composeData);
      chrome.runtime.sendMessage({
        type: 'PROCESS_SENT_EMAIL',
        data: { composeId, ...data }
      });
      
      // Clean up
      localStorage.removeItem(`involex_compose_${composeId}`);
    }
  }

  private exportEmail(emailData: OutlookEmail): void {
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
    a.download = `outlook-email-${emailData.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private extractRecipients(element: HTMLElement): string[] {
    const recipients: string[] = [];
    
    try {
      // Look for recipient information in Outlook
      const recipientSelectors = [
        '[data-testid="message-to"]',
        '[data-testid="recipients"]',
        '.ms-Persona-primaryText',
        '[aria-label*="To:" i]'
      ];
      
      for (const selector of recipientSelectors) {
        const recipientElements = element.querySelectorAll(selector);
        recipientElements.forEach(el => {
          const text = el.textContent?.trim();
          if (text && text.includes('@')) {
            recipients.push(text);
          }
        });
        
        if (recipients.length > 0) break;
      }
    } catch (error) {
      console.warn('⚠️ Error extracting recipients:', error);
    }
    
    return recipients;
  }

  private parseRelativeTime(timeText: string): Date | null {
    try {
      const now = new Date();
      const text = timeText.toLowerCase();
      
      // Handle various relative time formats
      if (text.includes('minute') || text.includes('min')) {
        const minutes = parseInt(text.match(/\d+/)?.[0] || '0');
        return new Date(now.getTime() - minutes * 60 * 1000);
      }
      
      if (text.includes('hour') || text.includes('hr')) {
        const hours = parseInt(text.match(/\d+/)?.[0] || '0');
        return new Date(now.getTime() - hours * 60 * 60 * 1000);
      }
      
      if (text.includes('day')) {
        const days = parseInt(text.match(/\d+/)?.[0] || '0');
        return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      }
      
      if (text.includes('week')) {
        const weeks = parseInt(text.match(/\d+/)?.[0] || '0');
        return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
      }
      
      // Try to parse as direct date
      const parsed = new Date(timeText);
      return isNaN(parsed.getTime()) ? null : parsed;
    } catch (error) {
      console.warn('⚠️ Error parsing relative time:', error);
      return null;
    }
  }

  private async autoAnalyzeEmail(emailData: OutlookEmail): Promise<void> {
    // Check if auto-analysis is enabled
    const settings = await this.getUserSettings();
    if (!settings?.aiSettings?.analysisEnabled) return;

    setTimeout(() => {
      this.analyzeEmail(emailData);
    }, 1000); // Small delay to let UI settle
  }

  private async getUserSettings(): Promise<any> {
    try {
      return new Promise((resolve) => {
        chrome.storage.sync.get(['userSettings'], (result) => {
          resolve(result.userSettings || {
            aiSettings: { analysisEnabled: true }
          });
        });
      });
    } catch (error) {
      console.warn('⚠️ Error getting user settings:', error);
      return { aiSettings: { analysisEnabled: true } };
    }
  }

  private scanForNewEmails(): void {
    // Continuous scanning for new emails
    const newEmails = document.querySelectorAll('[data-convid]:not([data-involex-processed]), [data-testid="message-body"]:not([data-involex-processed])');
    newEmails.forEach(email => {
      email.setAttribute('data-involex-processed', 'true');
      this.handleEmailViewing(email as HTMLElement);
    });
  }

  private scanForNewComposeWindows(): void {
    // Continuous scanning for new compose windows
    const newComposeWindows = document.querySelectorAll('[data-testid="compose-container"]:not([data-involex-processed]), [data-app-section="ComposeContainer"]:not([data-involex-processed])');
    newComposeWindows.forEach(compose => {
      compose.setAttribute('data-involex-processed', 'true');
      this.handleComposeDetection(compose as HTMLElement);
    });
  }

  private cleanupOrphanedWidgets(): void {
    // Remove widgets that are no longer attached to valid elements
    this.readWidgets.forEach(widget => {
      if (!document.body.contains(widget)) {
        this.readWidgets.delete(widget);
        const emailId = widget.getAttribute('data-email-id');
        if (emailId) {
          this.widgetMap.delete(emailId);
        }
      }
    });
    
    this.composeWidgets.forEach(widget => {
      if (!document.body.contains(widget)) {
        this.composeWidgets.delete(widget);
        const composeId = widget.getAttribute('data-compose-id');
        if (composeId) {
          this.widgetMap.delete(composeId);
        }
      }
    });
  }

  private setupNavigationHandlers(): void {
    // Handle Outlook navigation changes
    let lastUrl = window.location.href;
    
    const checkUrlChange = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        this.log('🧭 Outlook navigation detected');
        lastUrl = currentUrl;
        
        // Clear processed elements on navigation
        this.processedElements.clear();
        this.processedEmails.clear();
        this.processedComposeWindows.clear();
        
        // Re-scan after navigation
        setTimeout(() => this.scanExistingEmails(), 1000);
      }
    };
    
    setInterval(checkUrlChange, 1000);
  }

  // Cleanup method
  public destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    // Remove all widgets
    document.querySelectorAll('.involex-read-widget, .involex-compose-widget')
      .forEach(widget => widget.remove());
    
    // Clear caches
    this.emailCache.clear();
    this.processedEmails.clear();
    this.processedElements.clear();
    this.widgetMap.clear();
    this.composeWidgets.clear();
    this.readWidgets.clear();
    this.processedComposeWindows.clear();
    
    this.isInitialized = false;
  }
}

// Initialize Enhanced Outlook Integration
const enhancedOutlookIntegration = new EnhancedOutlookIntegration();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  enhancedOutlookIntegration.destroy();
});

console.log('✅ Enhanced Outlook Integration v2.2 Loaded');
