// Outlook Web Content Script for Involex
// Detects and analyzes emails in Outlook Web interface

console.log('🚀 Involex Outlook Content Script Loading...');

interface OutlookEmail {
  id: string;
  subject: string;
  sender: string;
  recipients: string[];
  timestamp: string;
  content: string;
}

class OutlookIntegration {
  private isInitialized = false;
  private observer: MutationObserver | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    if (this.isInitialized) return;

    console.log('📧 Initializing Outlook integration...');
    
    // Wait for Outlook to load
    await this.waitForOutlookLoad();
    
    // Set up email detection
    this.setupEmailDetection();
    
    this.isInitialized = true;
    console.log('✅ Outlook integration initialized');
  }

  private async waitForOutlookLoad(): Promise<void> {
    return new Promise((resolve) => {
      const checkOutlookLoaded = () => {
        const outlookContainer = document.querySelector('[role="main"]') || 
                                document.querySelector('.wide-content-host') ||
                                document.querySelector('#app-mount');
        
        if (outlookContainer) {
          console.log('📧 Outlook interface detected');
          resolve();
        } else {
          setTimeout(checkOutlookLoaded, 500);
        }
      };
      
      checkOutlookLoaded();
    });
  }

  private setupEmailDetection(): void {
    // Monitor for email opens in Outlook
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            
            // Check for opened email
            if (this.isEmailMessage(element)) {
              this.handleEmailOpen(element);
            }
          }
        });
      });
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Check for currently visible emails
    this.scanForVisibleEmails();
  }

  private isEmailMessage(element: Element): boolean {
    return element.classList.contains('rps_') ||
           element.querySelector('[data-convid]') !== null ||
           element.classList.contains('wide-content-host');
  }

  private async handleEmailOpen(element: Element): Promise<void> {
    try {
      const emailData = this.extractEmailData(element);
      if (emailData && this.isLegalEmail(emailData)) {
        console.log('📧 Legal email detected in Outlook:', emailData.subject);
        
        // Send to background script for analysis
        chrome.runtime.sendMessage({
          type: 'EMAIL_DETECTED',
          data: emailData
        });

        // Inject billing UI
        this.injectBillingWidget(element as HTMLElement, emailData);
      }
    } catch (error) {
      console.warn('⚠️ Error handling Outlook email:', error);
    }
  }

  private extractEmailData(element: Element): OutlookEmail | null {
    try {
      // Extract email metadata from Outlook DOM
      const subjectElement = element.querySelector('[role="heading"]') ||
                            element.querySelector('.Subject') ||
                            element.querySelector('[data-testid="message-subject"]');
      const subject = subjectElement?.textContent?.trim() || 'No Subject';

      const senderElement = element.querySelector('[data-testid="message-from"]') ||
                           element.querySelector('.From');
      const sender = senderElement?.textContent?.trim() || 'Unknown Sender';

      const contentElement = element.querySelector('[data-testid="message-body"]') ||
                            element.querySelector('.rps_');
      const content = contentElement?.textContent?.trim() || '';

      const id = `outlook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date().toISOString();

      return {
        id,
        subject,
        sender,
        recipients: [],
        timestamp,
        content
      };
    } catch (error) {
      console.warn('⚠️ Error extracting Outlook email data:', error);
      return null;
    }
  }

  private isLegalEmail(email: OutlookEmail): boolean {
    // Same legal detection logic as Gmail
    const legalKeywords = [
      'contract', 'agreement', 'legal', 'litigation', 'court', 'case',
      'attorney', 'lawyer', 'counsel', 'client', 'matter', 'brief'
    ];

    const text = `${email.subject} ${email.content}`.toLowerCase();
    return legalKeywords.some(keyword => text.includes(keyword));
  }

  private injectBillingWidget(element: HTMLElement, emailData: OutlookEmail): void {
    if (element.querySelector('.involex-billing-widget')) return;

    const widget = document.createElement('div');
    widget.className = 'involex-billing-widget outlook-widget';
    widget.innerHTML = `
      <div class="involex-widget-header">
        <div class="involex-logo">💼 Involex</div>
        <div class="involex-status pending">Legal Email Detected</div>
      </div>
      <div class="involex-widget-content">
        <div class="involex-actions">
          <button class="involex-btn analyze">🤖 Analyze for Billing</button>
        </div>
      </div>
    `;

    // Add event listeners
    const analyzeBtn = widget.querySelector('.analyze') as HTMLButtonElement;
    analyzeBtn?.addEventListener('click', () => {
      this.analyzeEmail(emailData);
    });

    // Insert widget
    element.appendChild(widget);
  }

  private async analyzeEmail(emailData: OutlookEmail): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ANALYZE_EMAIL',
        data: emailData
      });

      if (response.success) {
        console.log('✅ Email analyzed successfully');
      } else {
        console.error('❌ Email analysis failed:', response.error);
      }
    } catch (error) {
      console.error('❌ Error analyzing email:', error);
    }
  }

  private scanForVisibleEmails(): void {
    // Scan for emails that are already visible
    const emailElements = document.querySelectorAll('[data-convid], .rps_');
    emailElements.forEach(element => {
      this.handleEmailOpen(element);
    });
  }

  public destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    document.querySelectorAll('.involex-billing-widget')
      .forEach(widget => widget.remove());
    
    this.isInitialized = false;
  }
}

// Initialize Outlook integration
const outlookIntegration = new OutlookIntegration();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  outlookIntegration.destroy();
});

console.log('✅ Involex Outlook Content Script Loaded');
