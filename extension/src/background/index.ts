// Service Worker for Involex Chrome Extension
// Handles background processing, API communication, and notifications

import { EmailProcessor } from '../shared/emailProcessor';
import { StorageManager } from '../shared/storage';
import { ApiClient } from '../shared/apiClient';

console.log('🚀 Involex Background Service Worker Starting...');

// Initialize core services
const emailProcessor = new EmailProcessor();
const storageManager = new StorageManager();
const apiClient = new ApiClient();

// Service Worker Installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('📦 Involex Extension Installed:', details.reason);
  
  if (details.reason === 'install') {
    // First-time installation
    initializeExtension();
  } else if (details.reason === 'update') {
    // Extension updated
    handleExtensionUpdate(details.previousVersion);
  }
});

// Service Worker Startup
chrome.runtime.onStartup.addListener(() => {
  console.log('🔄 Involex Service Worker Started');
  initializeServices();
});

// Message handling from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Message received:', message.type, sender.tab?.url);
  
  switch (message.type) {
    case 'EMAIL_DETECTED':
      handleEmailDetected(message.data, sender.tab);
      break;
    
    case 'ANALYZE_EMAIL':
      handleEmailAnalysis(message.data)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep message channel open for async response
    
    case 'GET_BILLING_ENTRIES':
      getBillingEntries()
        .then(entries => sendResponse({ success: true, data: entries }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    
    case 'APPROVE_BILLING_ENTRY':
      approveBillingEntry(message.data)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    
    case 'REJECT_BILLING_ENTRY':
      rejectBillingEntry(message.data)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    
    case 'UPDATE_BILLING_ENTRY':
      updateBillingEntry(message.data.entryId, message.data.updates)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    
    case 'SYNC_ALL_ENTRIES':
      syncAllApprovedEntries()
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    
    case 'GET_USER_SETTINGS':
      getUserSettings()
        .then(settings => sendResponse({ success: true, data: settings }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    
    default:
      console.warn('❌ Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

// Tab updates for Gmail/Outlook detection
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isEmailPlatform = isEmailPlatformUrl(tab.url);
    
    if (isEmailPlatform) {
      console.log('📧 Email platform detected:', tab.url);
      injectContentScript(tabId, tab.url);
    }
  }
});

// Notification click handling
chrome.notifications.onClicked.addListener((notificationId) => {
  console.log('🔔 Notification clicked:', notificationId);
  handleNotificationClick(notificationId);
});

// Initialize extension on first install
async function initializeExtension(): Promise<void> {
  try {
    console.log('🎯 Initializing Involex Extension...');
    
    // Set default settings
    await storageManager.setUserSettings({
      isFirstTime: true,
      billingRates: {
        default: 300.00,
        minimum: 0.1,
        increment: 0.1
      },
      notifications: {
        enabled: true,
        emailDetection: true,
        billingReminders: true,
        syncStatus: true
      },
      aiSettings: {
        analysisEnabled: true,
        autoTimeEstimation: true,
        autoClientDetection: true,
        confidenceThreshold: 0.7,
        keywords: []
      }
    });
    
    // Show welcome notification
    chrome.notifications.create('welcome', {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Welcome to Involex!',
      message: 'Click here to set up your billing automation.'
    });
    
    console.log('✅ Extension initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize extension:', error);
  }
}

// Handle extension updates
async function handleExtensionUpdate(previousVersion?: string): Promise<void> {
  console.log(`🔄 Extension updated from ${previousVersion} to ${chrome.runtime.getManifest().version}`);
  
  // Migration logic for future updates
  // if (previousVersion && semver.lt(previousVersion, '2.0.0')) {
  //   await migrateToV2();
  // }
}

// Initialize background services
async function initializeServices(): Promise<void> {
  try {
    // Initialize API client with stored credentials
    const userSettings = await storageManager.getUserSettings();
    if (userSettings.apiToken) {
      apiClient.setAuthToken(userSettings.apiToken);
    }
    
    // Start periodic sync if user is authenticated
    if (userSettings.isAuthenticated) {
      startPeriodicSync();
    }
    
    console.log('✅ Background services initialized');
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
  }
}

// Handle email detected by content script
async function handleEmailDetected(emailData: any, tab?: chrome.tabs.Tab): Promise<void> {
  try {
    console.log('📧 Processing detected email:', emailData.subject);
    
    const userSettings = await storageManager.getUserSettings();
    
    if (!userSettings.aiSettings?.analysisEnabled) {
      console.log('🔇 Email analysis disabled by user');
      return;
    }
    
    // Add to processing queue
    await emailProcessor.queueEmailForAnalysis(emailData, tab?.id);
    
    // Show notification if enabled
    if (userSettings.notifications?.emailDetection) {
      chrome.notifications.create(`email-${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Email Detected',
        message: `Legal email detected: "${emailData.subject.substring(0, 50)}..."`
      });
    }
    
  } catch (error) {
    console.error('❌ Error handling detected email:', error);
  }
}

// Handle email analysis request
async function handleEmailAnalysis(emailData: any): Promise<any> {
  try {
    console.log('🤖 Analyzing email with AI:', emailData.subject);
    
    // Call AI processing service
    const analysisResult = await emailProcessor.analyzeEmail(emailData);
    
    // Store the result
    await storageManager.storeBillingEntry({
      id: generateId(),
      emailId: emailData.id,
      subject: emailData.subject,
      sender: emailData.sender,
      recipients: emailData.recipients || [],
      timestamp: emailData.timestamp,
      aiAnalysis: analysisResult,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    
    return analysisResult;
    
  } catch (error) {
    console.error('❌ Error analyzing email:', error);
    throw error;
  }
}

// Get billing entries
async function getBillingEntries(): Promise<any[]> {
  try {
    const entries = await storageManager.getBillingEntries();
    // Return all entries sorted by creation date (newest first)
    return entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('❌ Error getting billing entries:', error);
    throw error;
  }
}

// Approve billing entry
async function approveBillingEntry(entryData: any): Promise<any> {
  try {
    console.log('✅ Approving billing entry:', entryData.id);
    
    // Update local storage
    await storageManager.updateBillingEntry(entryData.id, {
      ...entryData,
      status: 'approved',
      approvedAt: new Date().toISOString()
    });
    
    // Sync with practice management system
    if (apiClient.isAuthenticated()) {
      try {
        await apiClient.syncBillingEntry(entryData);
        await storageManager.updateBillingEntry(entryData.id, {
          status: 'synced',
          syncedAt: new Date().toISOString()
        });
      } catch (syncError) {
        console.warn('⚠️ Failed to sync billing entry:', syncError);
        // Entry remains approved but not synced
      }
    }
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error approving billing entry:', error);
    throw error;
  }
}

// Reject billing entry
async function rejectBillingEntry(entryData: any): Promise<any> {
  try {
    console.log('❌ Rejecting billing entry:', entryData.id);
    
    // Update local storage
    await storageManager.updateBillingEntry(entryData.id, {
      ...entryData,
      status: 'rejected',
      rejectedAt: new Date().toISOString()
    });
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error rejecting billing entry:', error);
    throw error;
  }
}

// Update billing entry
async function updateBillingEntry(entryId: string, updates: any): Promise<any> {
  try {
    console.log('📝 Updating billing entry:', entryId, updates);
    
    // Update local storage
    await storageManager.updateBillingEntry(entryId, updates);
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error updating billing entry:', error);
    throw error;
  }
}

// Sync all approved entries
async function syncAllApprovedEntries(): Promise<any> {
  try {
    console.log('🔄 Syncing all approved entries');
    
    if (!apiClient.isAuthenticated()) {
      throw new Error('Not authenticated with practice management system');
    }
    
    const entries = await storageManager.getBillingEntries();
    const approvedEntries = entries.filter(entry => 
      entry.status === 'approved' && !entry.syncedAt
    );
    
    let syncedCount = 0;
    let errorCount = 0;
    
    for (const entry of approvedEntries) {
      try {
        await apiClient.syncBillingEntry(entry);
        await storageManager.updateBillingEntry(entry.id, {
          status: 'synced',
          syncedAt: new Date().toISOString()
        });
        syncedCount++;
      } catch (error) {
        console.warn(`⚠️ Failed to sync entry ${entry.id}:`, error);
        errorCount++;
      }
    }
    
    return { 
      success: true, 
      syncedCount, 
      errorCount,
      totalProcessed: approvedEntries.length
    };
    
  } catch (error) {
    console.error('❌ Error syncing approved entries:', error);
    throw error;
  }
}

// Get user settings
async function getUserSettings(): Promise<any> {
  try {
    return await storageManager.getUserSettings();
  } catch (error) {
    console.error('❌ Error getting user settings:', error);
    throw error;
  }
}

// Check if URL is an email platform
function isEmailPlatformUrl(url: string): boolean {
  const emailPlatforms = [
    'mail.google.com',
    'outlook.live.com',
    'outlook.office.com',
    'outlook.office365.com'
  ];
  
  return emailPlatforms.some(platform => url.includes(platform));
}

// Inject content script into email platform
async function injectContentScript(tabId: number, url: string): Promise<void> {
  try {
    if (url.includes('mail.google.com')) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/gmail.js']
      });
    } else if (url.includes('outlook')) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/outlook.js']
      });
    }
  } catch (error) {
    console.warn('⚠️ Failed to inject content script:', error);
  }
}

// Handle notification clicks
function handleNotificationClick(notificationId: string): void {
  if (notificationId === 'welcome') {
    // Open options page for setup
    chrome.runtime.openOptionsPage();
  } else if (notificationId.startsWith('email-')) {
    // Open popup to show detected email
    chrome.action.openPopup();
  }
  
  // Clear the notification
  chrome.notifications.clear(notificationId);
}

// Start periodic sync with backend
function startPeriodicSync(): void {
  // Sync every 5 minutes
  setInterval(async () => {
    try {
      await syncPendingEntries();
    } catch (error) {
      console.warn('⚠️ Periodic sync failed:', error);
    }
  }, 5 * 60 * 1000);
}

// Sync pending entries with backend
async function syncPendingEntries(): Promise<void> {
  const pendingEntries = await storageManager.getBillingEntries();
  const approvedEntries = pendingEntries.filter(entry => 
    entry.status === 'approved' && !entry.syncedAt
  );
  
  for (const entry of approvedEntries) {
    try {
      await apiClient.syncBillingEntry(entry);
      await storageManager.updateBillingEntry(entry.id, {
        status: 'synced',
        syncedAt: new Date().toISOString()
      });
    } catch (error) {
      console.warn(`⚠️ Failed to sync entry ${entry.id}:`, error);
    }
  }
}

// Utility function to generate unique IDs
function generateId(): string {
  return `involex_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

console.log('✅ Involex Background Service Worker Loaded');
