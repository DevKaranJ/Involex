// Gmail Content Script for Involex
// Detects and analyzes emails in Gmail interface

console.log('🚀 Involex Gmail Content Script Loading...');

interface GmailEmail {
  id: string;
  subject: string;
  sender: string;
  recipients: string[];
  timestamp: string;
  content: string;
  threadId?: string;
}

class GmailIntegration {
  private isInitialized = false;
  private emailCache = new Map<string, GmailEmail>();
  private observer: MutationObserver | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    if (this.isInitialized) return;

    console.log('📧 Initializing Gmail integration...');
    
    // Wait for Gmail to load
    await this.waitForGmailLoad();
    
    // Set up email detection
    this.setupEmailDetection();
    
    // Set up UI injection
    this.setupUIInjection();
    
    this.isInitialized = true;
    console.log('✅ Gmail integration initialized');
  }

  private async waitForGmailLoad(): Promise<void> {
    return new Promise((resolve) => {
      const checkGmailLoaded = () => {
        const gmailContainer = document.querySelector('[role="main"]') || 
                              document.querySelector('.nH.bkL') ||
                              document.querySelector('#\\:2');
        
        if (gmailContainer) {
          console.log('📧 Gmail interface detected');
          resolve();
        } else {
          setTimeout(checkGmailLoaded, 500);
        }
      };
      
      checkGmailLoaded();
    });
  }

  private setupEmailDetection(): void {
    // Monitor for email opens and compositions
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            
            // Check for opened email
            if (this.isEmailConversation(element)) {
              this.handleEmailOpen(element);
            }
            
            // Check for compose window
            if (this.isComposeWindow(element)) {
              this.handleComposeWindow(element);
            }
          }
        });
      });
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also check for currently visible emails
    this.scanForVisibleEmails();
  }

  private setupUIInjection(): void {
    // Inject billing widgets into email interface
    const injectBillingUI = () => {
      const emailElements = document.querySelectorAll('[data-message-id]');
      emailElements.forEach(element => {
        if (!element.querySelector('.involex-billing-widget')) {
          this.injectBillingWidget(element as HTMLElement);
        }
      });
    };

    // Initial injection
    injectBillingUI();
    
    // Re-inject on navigation
    setInterval(injectBillingUI, 2000);
  }

  private isEmailConversation(element: Element): boolean {
    return element.classList.contains('h7') ||
           element.querySelector('[data-message-id]') !== null ||
           element.querySelector('.ii.gt') !== null;
  }

  private isComposeWindow(element: Element): boolean {
    return element.classList.contains('M9') ||
           element.querySelector('.aoD.hl') !== null;
  }

  private async handleEmailOpen(element: Element): Promise<void> {
    try {
      const emailData = this.extractEmailData(element);
      if (emailData && this.isLegalEmail(emailData)) {
        console.log('📧 Legal email detected:', emailData.subject);
        
        // Cache the email
        this.emailCache.set(emailData.id, emailData);
        
        // Send to background script for analysis
        chrome.runtime.sendMessage({
          type: 'EMAIL_DETECTED',
          data: emailData
        });

        // Inject billing UI
        this.injectBillingWidget(element as HTMLElement, emailData);
      }
    } catch (error) {
      console.warn('⚠️ Error handling email open:', error);
    }
  }

  private handleComposeWindow(element: Element): void {
    // Add billing tracking to compose window
    this.injectComposeWidget(element as HTMLElement);
  }

  private extractEmailData(element: Element): GmailEmail | null {
    try {
      // Extract email metadata from Gmail DOM
      const messageId = element.getAttribute('data-message-id') ||
                       element.querySelector('[data-message-id]')?.getAttribute('data-message-id');
      
      if (!messageId) return null;

      const subjectElement = element.querySelector('.hP, .bog') ||
                            document.querySelector('.hP, .bog');
      const subject = subjectElement?.textContent?.trim() || 'No Subject';

      const senderElement = element.querySelector('.gD, .go span[email]') ||
                           element.querySelector('.gD');
      const sender = senderElement?.getAttribute('email') ||
                    senderElement?.textContent?.trim() ||
                    'Unknown Sender';

      const timestampElement = element.querySelector('.g3, .g2');
      const timestamp = timestampElement?.getAttribute('title') ||
                       new Date().toISOString();

      const contentElement = element.querySelector('.ii.gt div[dir="ltr"]') ||
                            element.querySelector('.ii.gt');
      const content = contentElement?.textContent?.trim() || '';

      const threadIdElement = document.querySelector('[data-thread-id]');
      const threadId = threadIdElement?.getAttribute('data-thread-id');

      return {
        id: messageId,
        subject,
        sender,
        recipients: this.extractRecipients(element),
        timestamp,
        content,
        threadId: threadId || undefined
      };
    } catch (error) {
      console.warn('⚠️ Error extracting email data:', error);
      return null;
    }
  }

  private extractRecipients(element: Element): string[] {
    const recipients: string[] = [];
    
    try {
      const recipientElements = element.querySelectorAll('.hb span[email]');
      recipientElements.forEach(el => {
        const email = el.getAttribute('email');
        if (email) recipients.push(email);
      });
    } catch (error) {
      console.warn('⚠️ Error extracting recipients:', error);
    }
    
    return recipients;
  }

  private isLegalEmail(email: GmailEmail): boolean {
    // Basic heuristics to determine if email contains legal work
    const legalKeywords = [
      'contract', 'agreement', 'legal', 'litigation', 'court', 'case',
      'attorney', 'lawyer', 'counsel', 'client', 'matter', 'brief',
      'discovery', 'deposition', 'hearing', 'trial', 'settlement',
      'draft', 'review', 'negotiate', 'lawsuit', 'complaint'
    ];

    const text = `${email.subject} ${email.content}`.toLowerCase();
    
    // Check for legal keywords
    const hasLegalKeywords = legalKeywords.some(keyword => 
      text.includes(keyword)
    );

    // Check email domain patterns (law firms, courts, etc.)
    const legalDomains = ['.law', '.legal', '.court', '.gov'];
    const hasLegalDomain = legalDomains.some(domain => 
      email.sender.includes(domain)
    );

    return hasLegalKeywords || hasLegalDomain;
  }

  private injectBillingWidget(element: HTMLElement, emailData?: GmailEmail): void {
    if (element.querySelector('.involex-billing-widget')) return;

    const widget = document.createElement('div');
    widget.className = 'involex-billing-widget';
    widget.innerHTML = `
      <div class="involex-widget-header">
        <div class="involex-logo">💼 Involex</div>
        <div class="involex-status pending">Analyzing...</div>
      </div>
      <div class="involex-widget-content">
        <div class="involex-time-estimate">
          <span class="label">Estimated Time:</span>
          <span class="value">Calculating...</span>
        </div>
        <div class="involex-actions">
          <button class="involex-btn analyze">🤖 Analyze</button>
          <button class="involex-btn add-billing">➕ Add to Billing</button>
        </div>
      </div>
    `;

    // Add event listeners
    const analyzeBtn = widget.querySelector('.analyze') as HTMLButtonElement;
    const addBillingBtn = widget.querySelector('.add-billing') as HTMLButtonElement;

    analyzeBtn?.addEventListener('click', () => {
      this.analyzeEmail(emailData || this.extractEmailData(element));
    });

    addBillingBtn?.addEventListener('click', () => {
      this.addToBilling(emailData || this.extractEmailData(element));
    });

    // Find insertion point
    const insertionPoint = element.querySelector('.adn.ads') ||
                          element.querySelector('.ar.as') ||
                          element.querySelector('.h7') ||
                          element;

    if (insertionPoint) {
      insertionPoint.appendChild(widget);
    }
  }

  private injectComposeWidget(element: HTMLElement): void {
    if (element.querySelector('.involex-compose-widget')) return;

    const widget = document.createElement('div');
    widget.className = 'involex-compose-widget';
    widget.innerHTML = `
      <div class="involex-compose-header">
        💼 Track billing time for this email
      </div>
      <div class="involex-compose-controls">
        <input type="number" step="0.1" min="0.1" max="10" value="0.2" class="time-input">
        <span>hours</span>
        <button class="involex-btn track">Track Time</button>
      </div>
    `;

    // Add to compose window
    const composeArea = element.querySelector('.aoD') ||
                       element.querySelector('.M9');
    
    if (composeArea) {
      composeArea.appendChild(widget);
    }
  }

  private async analyzeEmail(emailData: GmailEmail | null): Promise<void> {
    if (!emailData) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ANALYZE_EMAIL',
        data: emailData
      });

      if (response.success) {
        this.updateWidgetWithAnalysis(emailData.id, response.data);
      } else {
        console.error('❌ Email analysis failed:', response.error);
      }
    } catch (error) {
      console.error('❌ Error analyzing email:', error);
    }
  }

  private async addToBilling(emailData: GmailEmail | null): Promise<void> {
    if (!emailData) return;

    // Open Involex popup for manual entry
    chrome.runtime.sendMessage({
      type: 'OPEN_BILLING_ENTRY',
      data: emailData
    });
  }

  private updateWidgetWithAnalysis(emailId: string, analysis: any): void {
    const widget = document.querySelector(`[data-email-id="${emailId}"] .involex-billing-widget`);
    if (!widget) return;

    const timeElement = widget.querySelector('.involex-time-estimate .value');
    const statusElement = widget.querySelector('.involex-status');

    if (timeElement) {
      timeElement.textContent = `${analysis.estimatedTime} hours`;
    }

    if (statusElement) {
      statusElement.textContent = 'Ready to Bill';
      statusElement.className = 'involex-status ready';
    }
  }

  private scanForVisibleEmails(): void {
    // Scan for emails that are already visible when script loads
    const emailElements = document.querySelectorAll('[data-message-id]');
    emailElements.forEach(element => {
      this.handleEmailOpen(element);
    });
  }

  public destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    // Remove all injected widgets
    document.querySelectorAll('.involex-billing-widget, .involex-compose-widget')
      .forEach(widget => widget.remove());
    
    this.isInitialized = false;
  }
}

// Initialize Gmail integration
const gmailIntegration = new GmailIntegration();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  gmailIntegration.destroy();
});

console.log('✅ Involex Gmail Content Script Loaded');
