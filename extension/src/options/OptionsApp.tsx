import React, { useState, useEffect } from 'react';
import { Settings, Save, User, Bell, Brain, Shield, ExternalLink } from 'lucide-react';

interface UserSettings {
  billingRates: {
    default: number;
    minimum: number;
    increment: number;
  };
  aiSettings: {
    analysisEnabled: boolean;
    autoTimeEstimation: boolean;
    autoClientDetection: boolean;
    confidenceThreshold: number;
  };
  notifications: {
    enabled: boolean;
    emailDetection: boolean;
    billingReminders: boolean;
    syncStatus: boolean;
  };
  practiceManagement?: {
    platform: string;
    connected: boolean;
  };
}

const OptionsApp: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>({
    billingRates: {
      default: 300,
      minimum: 0.1,
      increment: 0.1
    },
    aiSettings: {
      analysisEnabled: true,
      autoTimeEstimation: true,
      autoClientDetection: true,
      confidenceThreshold: 0.7
    },
    notifications: {
      enabled: true,
      emailDetection: true,
      billingReminders: true,
      syncStatus: true
    }
  });
  
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_USER_SETTINGS'
      });
      
      if (response.success) {
        setSettings(response.data);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_USER_SETTINGS',
        data: settings
      });
      
      if (response.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateBillingRates = (updates: Partial<UserSettings['billingRates']>) => {
    setSettings(prev => ({
      ...prev,
      billingRates: { ...prev.billingRates, ...updates }
    }));
  };

  const updateAISettings = (updates: Partial<UserSettings['aiSettings']>) => {
    setSettings(prev => ({
      ...prev,
      aiSettings: { ...prev.aiSettings, ...updates }
    }));
  };

  const updateNotifications = (updates: Partial<UserSettings['notifications']>) => {
    setSettings(prev => ({
      ...prev,
      notifications: { ...prev.notifications, ...updates }
    }));
  };

  return (
    <div className="options-container">
      {/* Header */}
      <div className="options-header">
        <div className="header-content">
          <div className="logo">
            <Settings size={32} />
            <h1>Involex Settings</h1>
          </div>
          <button 
            onClick={saveSettings}
            disabled={saving}
            className={`save-btn ${saved ? 'saved' : ''}`}
          >
            <Save size={16} />
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="options-content">
        {/* Billing Rates Section */}
        <div className="settings-section">
          <div className="section-header">
            <User size={20} />
            <h2>Billing Rates</h2>
          </div>
          
          <div className="setting-group">
            <label className="setting-label">
              Default Hourly Rate
              <input
                type="number"
                value={settings.billingRates.default}
                onChange={(e) => updateBillingRates({ default: parseFloat(e.target.value) })}
                className="setting-input"
                step="25"
                min="0"
              />
              <span className="input-suffix">$/hour</span>
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              Minimum Billing Increment
              <select
                value={settings.billingRates.increment}
                onChange={(e) => updateBillingRates({ increment: parseFloat(e.target.value) })}
                className="setting-select"
              >
                <option value={0.1}>6 minutes (0.1 hours)</option>
                <option value={0.25}>15 minutes (0.25 hours)</option>
                <option value={0.5}>30 minutes (0.5 hours)</option>
              </select>
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              Minimum Billable Time
              <input
                type="number"
                value={settings.billingRates.minimum}
                onChange={(e) => updateBillingRates({ minimum: parseFloat(e.target.value) })}
                className="setting-input"
                step="0.1"
                min="0.1"
                max="1"
              />
              <span className="input-suffix">hours</span>
            </label>
          </div>
        </div>

        {/* AI Settings Section */}
        <div className="settings-section">
          <div className="section-header">
            <Brain size={20} />
            <h2>AI Analysis</h2>
          </div>
          
          <div className="setting-group">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={settings.aiSettings.analysisEnabled}
                onChange={(e) => updateAISettings({ analysisEnabled: e.target.checked })}
              />
              <span className="checkbox-text">
                Enable AI email analysis
                <small>Automatically analyze emails for legal work</small>
              </span>
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={settings.aiSettings.autoTimeEstimation}
                onChange={(e) => updateAISettings({ autoTimeEstimation: e.target.checked })}
                disabled={!settings.aiSettings.analysisEnabled}
              />
              <span className="checkbox-text">
                Automatic time estimation
                <small>Let AI estimate billable time based on email content</small>
              </span>
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={settings.aiSettings.autoClientDetection}
                onChange={(e) => updateAISettings({ autoClientDetection: e.target.checked })}
                disabled={!settings.aiSettings.analysisEnabled}
              />
              <span className="checkbox-text">
                Auto-detect clients and matters
                <small>Automatically identify client and matter from email content</small>
              </span>
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              AI Confidence Threshold
              <input
                type="range"
                value={settings.aiSettings.confidenceThreshold}
                onChange={(e) => updateAISettings({ confidenceThreshold: parseFloat(e.target.value) })}
                min="0.3"
                max="1"
                step="0.1"
                className="setting-range"
                disabled={!settings.aiSettings.analysisEnabled}
              />
              <span className="range-value">
                {Math.round(settings.aiSettings.confidenceThreshold * 100)}%
              </span>
            </label>
            <small className="setting-help">
              Higher values require more confidence before suggesting billing entries
            </small>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="settings-section">
          <div className="section-header">
            <Bell size={20} />
            <h2>Notifications</h2>
          </div>
          
          <div className="setting-group">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={settings.notifications.enabled}
                onChange={(e) => updateNotifications({ enabled: e.target.checked })}
              />
              <span className="checkbox-text">
                Enable notifications
                <small>Show browser notifications for important events</small>
              </span>
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={settings.notifications.emailDetection}
                onChange={(e) => updateNotifications({ emailDetection: e.target.checked })}
                disabled={!settings.notifications.enabled}
              />
              <span className="checkbox-text">
                Email detection alerts
                <small>Notify when legal emails are detected</small>
              </span>
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={settings.notifications.billingReminders}
                onChange={(e) => updateNotifications({ billingReminders: e.target.checked })}
                disabled={!settings.notifications.enabled}
              />
              <span className="checkbox-text">
                Billing reminders
                <small>Remind to review and approve pending entries</small>
              </span>
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={settings.notifications.syncStatus}
                onChange={(e) => updateNotifications({ syncStatus: e.target.checked })}
                disabled={!settings.notifications.enabled}
              />
              <span className="checkbox-text">
                Sync status updates
                <small>Notify when billing entries are synced to practice management</small>
              </span>
            </label>
          </div>
        </div>

        {/* Practice Management Section */}
        <div className="settings-section">
          <div className="section-header">
            <Shield size={20} />
            <h2>Practice Management Integration</h2>
          </div>
          
          <div className="integration-status">
            {settings.practiceManagement?.connected ? (
              <div className="status-connected">
                <div className="status-indicator connected"></div>
                <span>Connected to {settings.practiceManagement.platform}</span>
                <button className="btn-secondary">Disconnect</button>
              </div>
            ) : (
              <div className="status-disconnected">
                <div className="status-indicator disconnected"></div>
                <span>No practice management system connected</span>
                <button className="btn-primary">
                  <ExternalLink size={14} />
                  Connect Platform
                </button>
              </div>
            )}
          </div>

          <div className="platform-options">
            <h3>Supported Platforms</h3>
            <div className="platform-grid">
              <div className="platform-card">
                <h4>Cleo</h4>
                <p>Automated billing entry creation and client sync</p>
              </div>
              <div className="platform-card">
                <h4>Practice Panther</h4>
                <p>Real-time time tracking and matter management</p>
              </div>
              <div className="platform-card">
                <h4>MyCase</h4>
                <p>Seamless billing integration and client portal</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OptionsApp;
