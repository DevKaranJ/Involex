// Storage Manager for Involex Extension
// Handles local storage operations using Chrome Storage API

import { BillingEntry, UserSettings, DEFAULT_USER_SETTINGS } from './types';

export class StorageManager {
  private static instance: StorageManager;
  
  constructor() {
    if (StorageManager.instance) {
      return StorageManager.instance;
    }
    StorageManager.instance = this;
  }

  // User Settings Management
  async getUserSettings(): Promise<UserSettings> {
    try {
      const result = await chrome.storage.sync.get(['userSettings']);
      return result.userSettings || DEFAULT_USER_SETTINGS;
    } catch (error) {
      console.error('❌ Error getting user settings:', error);
      return DEFAULT_USER_SETTINGS;
    }
  }

  async setUserSettings(settings: Partial<UserSettings>): Promise<void> {
    try {
      const currentSettings = await this.getUserSettings();
      const updatedSettings = { ...currentSettings, ...settings };
      await chrome.storage.sync.set({ userSettings: updatedSettings });
      console.log('✅ User settings updated');
    } catch (error) {
      console.error('❌ Error setting user settings:', error);
      throw error;
    }
  }

  async updateUserSettings(updates: Partial<UserSettings>): Promise<UserSettings> {
    const settings = await this.getUserSettings();
    const updatedSettings = this.deepMerge(settings, updates);
    await this.setUserSettings(updatedSettings);
    return updatedSettings;
  }

  // Billing Entries Management
  async getBillingEntries(): Promise<BillingEntry[]> {
    try {
      const result = await chrome.storage.local.get(['billingEntries']);
      return result.billingEntries || [];
    } catch (error) {
      console.error('❌ Error getting billing entries:', error);
      return [];
    }
  }

  async storeBillingEntry(entry: BillingEntry): Promise<void> {
    try {
      const entries = await this.getBillingEntries();
      const existingIndex = entries.findIndex(e => e.id === entry.id);
      
      if (existingIndex >= 0) {
        entries[existingIndex] = entry;
      } else {
        entries.push(entry);
      }
      
      await chrome.storage.local.set({ billingEntries: entries });
      console.log('✅ Billing entry stored:', entry.id);
    } catch (error) {
      console.error('❌ Error storing billing entry:', error);
      throw error;
    }
  }

  async updateBillingEntry(entryId: string, updates: Partial<BillingEntry>): Promise<BillingEntry | null> {
    try {
      const entries = await this.getBillingEntries();
      const entryIndex = entries.findIndex(e => e.id === entryId);
      
      if (entryIndex >= 0) {
        entries[entryIndex] = { ...entries[entryIndex], ...updates };
        await chrome.storage.local.set({ billingEntries: entries });
        console.log('✅ Billing entry updated:', entryId);
        return entries[entryIndex];
      }
      
      console.warn('⚠️ Billing entry not found:', entryId);
      return null;
    } catch (error) {
      console.error('❌ Error updating billing entry:', error);
      throw error;
    }
  }

  async deleteBillingEntry(entryId: string): Promise<boolean> {
    try {
      const entries = await this.getBillingEntries();
      const initialLength = entries.length;
      const filteredEntries = entries.filter(e => e.id !== entryId);
      
      if (filteredEntries.length < initialLength) {
        await chrome.storage.local.set({ billingEntries: filteredEntries });
        console.log('✅ Billing entry deleted:', entryId);
        return true;
      }
      
      console.warn('⚠️ Billing entry not found for deletion:', entryId);
      return false;
    } catch (error) {
      console.error('❌ Error deleting billing entry:', error);
      throw error;
    }
  }

  async getBillingEntriesByStatus(status: BillingEntry['status']): Promise<BillingEntry[]> {
    const entries = await this.getBillingEntries();
    return entries.filter(entry => entry.status === status);
  }

  async getBillingEntriesByDateRange(startDate: Date, endDate: Date): Promise<BillingEntry[]> {
    const entries = await this.getBillingEntries();
    return entries.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      return entryDate >= startDate && entryDate <= endDate;
    });
  }

  // Email Processing Queue
  async getProcessingQueue(): Promise<any[]> {
    try {
      const result = await chrome.storage.local.get(['processingQueue']);
      return result.processingQueue || [];
    } catch (error) {
      console.error('❌ Error getting processing queue:', error);
      return [];
    }
  }

  async addToProcessingQueue(emailData: any): Promise<void> {
    try {
      const queue = await this.getProcessingQueue();
      queue.push({
        ...emailData,
        queuedAt: new Date().toISOString(),
        id: this.generateId()
      });
      await chrome.storage.local.set({ processingQueue: queue });
      console.log('✅ Email added to processing queue');
    } catch (error) {
      console.error('❌ Error adding to processing queue:', error);
      throw error;
    }
  }

  async removeFromProcessingQueue(queueId: string): Promise<void> {
    try {
      const queue = await this.getProcessingQueue();
      const filteredQueue = queue.filter(item => item.id !== queueId);
      await chrome.storage.local.set({ processingQueue: filteredQueue });
      console.log('✅ Item removed from processing queue:', queueId);
    } catch (error) {
      console.error('❌ Error removing from processing queue:', error);
      throw error;
    }
  }

  // Cache Management
  async getCache(key: string): Promise<any> {
    try {
      const result = await chrome.storage.local.get([`cache_${key}`]);
      const cached = result[`cache_${key}`];
      
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
      }
      
      // Remove expired cache
      if (cached) {
        await this.removeCache(key);
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error getting cache:', error);
      return null;
    }
  }

  async setCache(key: string, data: any, ttlMinutes: number = 60): Promise<void> {
    try {
      const cacheItem = {
        data,
        expiresAt: Date.now() + (ttlMinutes * 60 * 1000),
        createdAt: Date.now()
      };
      
      await chrome.storage.local.set({ [`cache_${key}`]: cacheItem });
      console.log(`✅ Cache set for key: ${key}`);
    } catch (error) {
      console.error('❌ Error setting cache:', error);
      throw error;
    }
  }

  async removeCache(key: string): Promise<void> {
    try {
      await chrome.storage.local.remove([`cache_${key}`]);
      console.log(`✅ Cache removed for key: ${key}`);
    } catch (error) {
      console.error('❌ Error removing cache:', error);
      throw error;
    }
  }

  async clearExpiredCache(): Promise<void> {
    try {
      const allData = await chrome.storage.local.get(null);
      const expiredKeys: string[] = [];
      
      Object.keys(allData).forEach(key => {
        if (key.startsWith('cache_')) {
          const cached = allData[key];
          if (cached && cached.expiresAt <= Date.now()) {
            expiredKeys.push(key);
          }
        }
      });
      
      if (expiredKeys.length > 0) {
        await chrome.storage.local.remove(expiredKeys);
        console.log(`✅ Cleared ${expiredKeys.length} expired cache items`);
      }
    } catch (error) {
      console.error('❌ Error clearing expired cache:', error);
    }
  }

  // Statistics and Analytics
  async getUsageStatistics(): Promise<any> {
    try {
      const entries = await this.getBillingEntries();
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const todayEntries = entries.filter(e => new Date(e.timestamp) >= today);
      const weekEntries = entries.filter(e => new Date(e.timestamp) >= thisWeek);
      const monthEntries = entries.filter(e => new Date(e.timestamp) >= thisMonth);

      return {
        total: {
          entries: entries.length,
          hours: entries.reduce((sum, e) => sum + (e.aiAnalysis?.estimatedTime || 0), 0),
          amount: entries.reduce((sum, e) => sum + (e.aiAnalysis?.estimatedAmount || 0), 0)
        },
        today: {
          entries: todayEntries.length,
          hours: todayEntries.reduce((sum, e) => sum + (e.aiAnalysis?.estimatedTime || 0), 0),
          amount: todayEntries.reduce((sum, e) => sum + (e.aiAnalysis?.estimatedAmount || 0), 0)
        },
        week: {
          entries: weekEntries.length,
          hours: weekEntries.reduce((sum, e) => sum + (e.aiAnalysis?.estimatedTime || 0), 0),
          amount: weekEntries.reduce((sum, e) => sum + (e.aiAnalysis?.estimatedAmount || 0), 0)
        },
        month: {
          entries: monthEntries.length,
          hours: monthEntries.reduce((sum, e) => sum + (e.aiAnalysis?.estimatedTime || 0), 0),
          amount: monthEntries.reduce((sum, e) => sum + (e.aiAnalysis?.estimatedAmount || 0), 0)
        }
      };
    } catch (error) {
      console.error('❌ Error getting usage statistics:', error);
      return null;
    }
  }

  // Utility Methods
  async clearAllData(): Promise<void> {
    try {
      await chrome.storage.local.clear();
      await chrome.storage.sync.clear();
      console.log('✅ All storage data cleared');
    } catch (error) {
      console.error('❌ Error clearing all data:', error);
      throw error;
    }
  }

  async exportData(): Promise<any> {
    try {
      const [localData, syncData] = await Promise.all([
        chrome.storage.local.get(null),
        chrome.storage.sync.get(null)
      ]);
      
      return {
        local: localData,
        sync: syncData,
        exportedAt: new Date().toISOString(),
        version: chrome.runtime.getManifest().version
      };
    } catch (error) {
      console.error('❌ Error exporting data:', error);
      throw error;
    }
  }

  async getStorageUsage(): Promise<any> {
    try {
      const usage = await chrome.storage.local.getBytesInUse();
      const syncUsage = await chrome.storage.sync.getBytesInUse();
      
      return {
        local: {
          used: usage,
          limit: chrome.storage.local.QUOTA_BYTES,
          percentage: (usage / chrome.storage.local.QUOTA_BYTES) * 100
        },
        sync: {
          used: syncUsage,
          limit: chrome.storage.sync.QUOTA_BYTES,
          percentage: (syncUsage / chrome.storage.sync.QUOTA_BYTES) * 100
        }
      };
    } catch (error) {
      console.error('❌ Error getting storage usage:', error);
      return null;
    }
  }

  // Private Helper Methods
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  private generateId(): string {
    return `involex_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
