import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  User, 
  Bell, 
  Brain, 
  Shield, 
  ExternalLink,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  CheckCircle,
  AlertCircle,
  Info,
  Key,
  Database,
  Activity,
  HelpCircle,
  Lock,
  Eye,
  FileText,
  Clock
} from 'lucide-react';
import { UserSettings, DEFAULT_USER_SETTINGS } from '../shared/types';
import { SecurityManager, PrivacyManager } from '../shared/security';

interface ConnectedPlatform {
  platform: string;
  connected: boolean;
  lastSync?: string;
  syncStatus?: 'active' | 'error' | 'pending';
}

interface OptionsState {
  activeTab: 'billing' | 'ai' | 'notifications' | 'integration' | 'data' | 'security' | 'advanced';
  loading: boolean;
  saving: boolean;
  saved: boolean;
  error: string | null;
  connectedPlatform: ConnectedPlatform | null;
  stats: {
    totalEntries: number;
    syncedEntries: number;
    storageUsed: string;
    lastBackup?: string;
  };
  security: {
    encryptionEnabled: boolean;
    auditLogsCount: number;
    lastSecurityCheck?: string;
    privilegedEntries: number;
  };
}

const OptionsApp: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [state, setState] = useState<OptionsState>({
    activeTab: 'billing',
    loading: true,
    saving: false,
    saved: false,
    error: null,
    connectedPlatform: null,
    stats: {
      totalEntries: 0,
      syncedEntries: 0,
      storageUsed: '0 KB'
    },
    security: {
      encryptionEnabled: false,
      auditLogsCount: 0,
      privilegedEntries: 0
    }
  });

  useEffect(() => {
    loadSettings();
    loadStats();
  }, []);

  const updateState = (updates: Partial<OptionsState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const loadSettings = async () => {
    try {
      updateState({ loading: true, error: null });
      
      const response = await chrome.runtime.sendMessage({
        type: 'GET_USER_SETTINGS'
      });
      
      if (response.success) {
        setSettings(response.data || DEFAULT_USER_SETTINGS);
        
        // Check practice management connection
        if (response.data?.practiceManagement) {
          updateState({
            connectedPlatform: {
              platform: response.data.practiceManagement.platform,
              connected: true,
              lastSync: response.data.practiceManagement.lastSync,
              syncStatus: 'active'
            }
          });
        }
      } else {
        updateState({ error: 'Failed to load settings' });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      updateState({ error: 'Failed to load settings' });
    } finally {
      updateState({ loading: false });
    }
  };

  const loadStats = async () => {
    try {
      const [entriesResponse, storageResponse, securityResponse] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_BILLING_ENTRIES' }),
        chrome.runtime.sendMessage({ type: 'GET_STORAGE_USAGE' }),
        chrome.runtime.sendMessage({ type: 'GET_SECURITY_STATUS' })
      ]);

      const stats = {
        totalEntries: entriesResponse.success ? entriesResponse.data.length : 0,
        syncedEntries: entriesResponse.success ? 
          entriesResponse.data.filter((e: any) => e.status === 'synced').length : 0,
        storageUsed: storageResponse.success ? 
          `${Math.round(storageResponse.data.local.used / 1024)}KB` : '0 KB'
      };

      const security = {
        encryptionEnabled: securityResponse.success ? securityResponse.data.encryptionEnabled : false,
        auditLogsCount: securityResponse.success ? securityResponse.data.auditLogsCount : 0,
        lastSecurityCheck: securityResponse.success ? securityResponse.data.lastCheck : undefined,
        privilegedEntries: entriesResponse.success ? 
          entriesResponse.data.filter((e: any) => e.isPrivileged).length : 0
      };

      updateState({ stats, security });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const saveSettings = async () => {
    updateState({ saving: true, error: null });
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_USER_SETTINGS',
        data: settings
      });
      
      if (response.success) {
        updateState({ saved: true });
        setTimeout(() => updateState({ saved: false }), 2000);
      } else {
        updateState({ error: 'Failed to save settings' });
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      updateState({ error: 'Failed to save settings' });
    } finally {
      updateState({ saving: false });
    }
  };

  const connectPlatform = async (platform: string) => {
    try {
      updateState({ saving: true });
      
      const response = await chrome.runtime.sendMessage({
        type: 'CONNECT_PRACTICE_MANAGEMENT',
        data: { platform }
      });
      
      if (response.success) {
        updateState({
          connectedPlatform: {
            platform,
            connected: true,
            syncStatus: 'active'
          }
        });
        await loadSettings(); // Reload to get updated settings
      } else {
        updateState({ error: `Failed to connect to ${platform}` });
      }
    } catch (error) {
      updateState({ error: `Failed to connect to ${platform}` });
    } finally {
      updateState({ saving: false });
    }
  };

  const disconnectPlatform = async () => {
    try {
      updateState({ saving: true });
      
      const response = await chrome.runtime.sendMessage({
        type: 'DISCONNECT_PRACTICE_MANAGEMENT'
      });
      
      if (response.success) {
        updateState({ connectedPlatform: null });
        await loadSettings();
      } else {
        updateState({ error: 'Failed to disconnect platform' });
      }
    } catch (error) {
      updateState({ error: 'Failed to disconnect platform' });
    } finally {
      updateState({ saving: false });
    }
  };

  const exportData = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXPORT_DATA'
      });
      
      if (response.success) {
        const blob = new Blob([JSON.stringify(response.data, null, 2)], 
          { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `involex-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      updateState({ error: 'Failed to export data' });
    }
  };

  const syncAllEntries = async () => {
    try {
      updateState({ saving: true });
      
      const response = await chrome.runtime.sendMessage({
        type: 'SYNC_ALL_ENTRIES'
      });
      
      if (response.success) {
        updateState({ saved: true });
        setTimeout(() => updateState({ saved: false }), 2000);
        await loadStats(); // Refresh stats
      } else {
        updateState({ error: 'Failed to sync entries' });
      }
    } catch (error) {
      updateState({ error: 'Failed to sync entries' });
    } finally {
      updateState({ saving: false });
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

  const clearAllData = async () => {
    if (!confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
      return;
    }
    
    try {
      updateState({ saving: true });
      
      const response = await chrome.runtime.sendMessage({
        type: 'CLEAR_ALL_DATA'
      });
      
      if (response.success) {
        setSettings(DEFAULT_USER_SETTINGS);
        updateState({ 
          connectedPlatform: null,
          stats: { totalEntries: 0, syncedEntries: 0, storageUsed: '0 KB' }
        });
      } else {
        updateState({ error: 'Failed to clear data' });
      }
    } catch (error) {
      updateState({ error: 'Failed to clear data' });
    } finally {
      updateState({ saving: false });
    }
  };

  if (state.loading) {
    return (
      <div className="options-container">
        <div className="loading-container">
          <RefreshCw className="animate-spin" size={32} />
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

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
            disabled={state.saving}
            className={`save-btn ${state.saved ? 'saved' : ''}`}
          >
            <Save size={16} />
            {state.saving ? 'Saving...' : state.saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="options-content">
        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button 
            className={`tab-btn ${state.activeTab === 'billing' ? 'active' : ''}`}
            onClick={() => updateState({ activeTab: 'billing' })}
          >
            <User size={16} />
            Billing
          </button>
          <button 
            className={`tab-btn ${state.activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => updateState({ activeTab: 'ai' })}
          >
            <Brain size={16} />
            AI Settings
          </button>
          <button 
            className={`tab-btn ${state.activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => updateState({ activeTab: 'notifications' })}
          >
            <Bell size={16} />
            Notifications
          </button>
          <button 
            className={`tab-btn ${state.activeTab === 'integration' ? 'active' : ''}`}
            onClick={() => updateState({ activeTab: 'integration' })}
          >
            <Shield size={16} />
            Integration
          </button>
          <button 
            className={`tab-btn ${state.activeTab === 'data' ? 'active' : ''}`}
            onClick={() => updateState({ activeTab: 'data' })}
          >
            <Database size={16} />
            Data
          </button>
          <button 
            className={`tab-btn ${state.activeTab === 'security' ? 'active' : ''}`}
            onClick={() => updateState({ activeTab: 'security' })}
          >
            <Lock size={16} />
            Security
          </button>
          <button 
            className={`tab-btn ${state.activeTab === 'advanced' ? 'active' : ''}`}
            onClick={() => updateState({ activeTab: 'advanced' })}
          >
            <Settings size={16} />
            Advanced
          </button>
        </div>

        {/* Billing Rates Section */}
        {state.activeTab === 'billing' && (
        <div className="settings-section">
          <div className="section-header">
            <User size={20} />
            <h2>Billing Rates & Time Tracking</h2>
          </div>

          <div className="info-card">
            <h4>
              <Info size={16} />
              Billing Configuration
            </h4>
            <p>Configure your default billing rates and time tracking preferences. These settings will be used for AI time estimation and billing entry creation.</p>
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
        )}

        {/* AI Settings Section */}
        {state.activeTab === 'ai' && (
        <div className="settings-section">
          <div className="section-header">
            <Brain size={20} />
            <h2>AI Analysis Settings</h2>
          </div>

          <div className="info-card">
            <h4>
              <Info size={16} />
              Artificial Intelligence
            </h4>
            <p>Configure how AI analyzes your emails for legal work. Higher confidence thresholds reduce false positives but may miss some billable communications.</p>
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
        )}

        {/* Notifications Section */}
        {state.activeTab === 'notifications' && (
        <div className="settings-section">
          <div className="section-header">
            <Bell size={20} />
            <h2>Notification Preferences</h2>
          </div>

          <div className="info-card">
            <h4>
              <Info size={16} />
              Browser Notifications
            </h4>
            <p>Control when and how Involex sends you notifications. These help you stay informed about detected emails and sync status.</p>
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
        )}

        {/* Practice Management Section */}
        {state.activeTab === 'integration' && (
        <div className="settings-section">
          <div className="section-header">
            <Shield size={20} />
            <h2>Practice Management Integration</h2>
          </div>

          <div className="info-card">
            <h4>
              <Info size={16} />
              Practice Management Systems
            </h4>
            <p>Connect Involex to your practice management system to automatically sync billing entries, clients, and matters.</p>
          </div>
          
          {state.error && (
            <div className="error-banner">
              <AlertCircle size={16} />
              <span>{state.error}</span>
              <button 
                className="error-close"
                onClick={() => updateState({ error: null })}
              >
                ×
              </button>
            </div>
          )}
          
          <div className="integration-status">
            {state.connectedPlatform?.connected ? (
              <div className="status-connected">
                <div className="status-indicator connected"></div>
                <span>Connected to {state.connectedPlatform.platform}</span>
                <button 
                  className="btn-secondary"
                  onClick={disconnectPlatform}
                  disabled={state.saving}
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="status-disconnected">
                <div className="status-indicator disconnected"></div>
                <span>No practice management system connected</span>
                <button 
                  className="btn-primary"
                  onClick={() => connectPlatform('cleo')}
                  disabled={state.saving}
                >
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
                <button 
                  className="platform-connect-btn"
                  onClick={() => connectPlatform('cleo')}
                  disabled={state.saving || state.connectedPlatform?.platform === 'cleo'}
                >
                  {state.connectedPlatform?.platform === 'cleo' ? 'Connected' : 'Connect'}
                </button>
              </div>
              <div className="platform-card">
                <h4>Practice Panther</h4>
                <p>Real-time time tracking and matter management</p>
                <button 
                  className="platform-connect-btn"
                  onClick={() => connectPlatform('practice_panther')}
                  disabled={state.saving || state.connectedPlatform?.platform === 'practice_panther'}
                >
                  {state.connectedPlatform?.platform === 'practice_panther' ? 'Connected' : 'Connect'}
                </button>
              </div>
              <div className="platform-card">
                <h4>MyCase</h4>
                <p>Seamless billing integration and client portal</p>
                <button 
                  className="platform-connect-btn"
                  onClick={() => connectPlatform('mycase')}
                  disabled={state.saving || state.connectedPlatform?.platform === 'mycase'}
                >
                  {state.connectedPlatform?.platform === 'mycase' ? 'Connected' : 'Connect'}
                </button>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Data Management Section */}
        {state.activeTab === 'data' && (
        <div className="settings-section">
          <div className="section-header">
            <Database size={20} />
            <h2>Data Management & Backup</h2>
          </div>

          <div className="info-card">
            <h4>
              <Info size={16} />
              Data Storage & Export
            </h4>
            <p>Manage your Involex data, view storage statistics, and create backups. Export data for external analysis or backup purposes.</p>
          </div>

          <div className="stats-grid">
            <div className="stat-item">
              <Activity size={16} />
              <div className="stat-content">
                <span className="stat-value">{state.stats.totalEntries}</span>
                <span className="stat-label">Total Entries</span>
              </div>
            </div>
            <div className="stat-item">
              <CheckCircle size={16} />
              <div className="stat-content">
                <span className="stat-value">{state.stats.syncedEntries}</span>
                <span className="stat-label">Synced Entries</span>
              </div>
            </div>
            <div className="stat-item">
              <Database size={16} />
              <div className="stat-content">
                <span className="stat-value">{state.stats.storageUsed}</span>
                <span className="stat-label">Storage Used</span>
              </div>
            </div>
          </div>

          <div className="data-actions">
            <button className="btn-primary" onClick={exportData}>
              <Download size={16} />
              Export Data
            </button>
            <button className="btn-primary" onClick={syncAllEntries} disabled={state.saving}>
              <RefreshCw size={16} />
              Sync All Entries
            </button>
            <button className="btn-danger" onClick={clearAllData} disabled={state.saving}>
              <Trash2 size={16} />
              Clear All Data
            </button>
          </div>
        </div>
        )}

        {/* Security & Privacy Section */}
        {state.activeTab === 'security' && (
        <div className="settings-section">
          <div className="section-header">
            <Lock size={20} />
            <h2>Security & Privacy</h2>
          </div>

          <div className="info-card">
            <h4>
              <Shield size={16} />
              Data Protection & Compliance
            </h4>
            <p>Configure security features to protect sensitive legal data and ensure compliance with attorney-client privilege and legal industry standards.</p>
          </div>

          {/* Security Status */}
          <div className="security-status">
            <h3>Security Status</h3>
            <div className="security-grid">
              <div className="security-item">
                <Lock size={16} />
                <div className="security-content">
                  <span className="security-label">Encryption</span>
                  <span className={`security-value ${state.security.encryptionEnabled ? 'enabled' : 'disabled'}`}>
                    {state.security.encryptionEnabled ? 'Enabled (AES-256)' : 'Disabled'}
                  </span>
                </div>
              </div>
              <div className="security-item">
                <FileText size={16} />
                <div className="security-content">
                  <span className="security-label">Audit Logs</span>
                  <span className="security-value">{state.security.auditLogsCount} entries</span>
                </div>
              </div>
              <div className="security-item">
                <Eye size={16} />
                <div className="security-content">
                  <span className="security-label">Privileged Communications</span>
                  <span className="security-value">{state.security.privilegedEntries} protected</span>
                </div>
              </div>
              <div className="security-item">
                <Clock size={16} />
                <div className="security-content">
                  <span className="security-label">Last Security Check</span>
                  <span className="security-value">
                    {state.security.lastSecurityCheck ? 
                      new Date(state.security.lastSecurityCheck).toLocaleDateString() : 
                      'Never'
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Data Encryption */}
          <div className="setting-group">
            <label className="setting-label">
              Data Encryption
              <div className="setting-description">
                Enable end-to-end encryption for all sensitive billing and client data stored locally.
              </div>
            </label>
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={settings.security?.encryptionEnabled || false}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  security: { ...prev.security, encryptionEnabled: e.target.checked }
                }))}
              />
              <span className="checkbox-text">
                Enable data encryption (AES-256-GCM)
                <small>Encrypts billing entries, client data, and practice management credentials</small>
              </span>
            </label>
          </div>

          {/* Audit Logging */}
          <div className="setting-group">
            <label className="setting-label">
              Security Audit Logging
              <div className="setting-description">
                Maintain detailed logs of all security-relevant events for compliance and monitoring.
              </div>
            </label>
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={settings.security?.auditLoggingEnabled || false}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  security: { ...prev.security, auditLoggingEnabled: e.target.checked }
                }))}
              />
              <span className="checkbox-text">
                Enable audit logging
                <small>Log login attempts, data exports, settings changes, and security events</small>
              </span>
            </label>
          </div>

          {/* Attorney-Client Privilege Protection */}
          <div className="setting-group">
            <label className="setting-label">
              Attorney-Client Privilege Protection
              <div className="setting-description">
                Automatically detect and apply enhanced protection for privileged communications.
              </div>
            </label>
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={settings.security?.privilegeProtection || false}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  security: { ...prev.security, privilegeProtection: e.target.checked }
                }))}
              />
              <span className="checkbox-text">
                Enable privilege protection
                <small>Detect privileged communications and apply enhanced security measures</small>
              </span>
            </label>
          </div>

          {/* Data Retention */}
          <div className="setting-group">
            <label className="setting-label">
              Data Retention Policy
              <div className="setting-description">
                Automatically manage data retention for compliance with legal requirements.
              </div>
            </label>
            <select
              value={settings.security?.dataRetentionYears || 7}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                security: { ...prev.security, dataRetentionYears: parseInt(e.target.value) }
              }))}
              className="setting-select"
            >
              <option value={1}>1 Year</option>
              <option value={3}>3 Years</option>
              <option value={5}>5 Years</option>
              <option value={7}>7 Years (Default)</option>
              <option value={10}>10 Years</option>
              <option value={-1}>Indefinite (Privileged Only)</option>
            </select>
          </div>

          {/* Auto-logout */}
          <div className="setting-group">
            <label className="setting-label">
              Automatic Session Timeout
              <div className="setting-description">
                Automatically lock the extension after a period of inactivity for security.
              </div>
            </label>
            <select
              value={settings.security?.autoLogoutMinutes || 60}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                security: { ...prev.security, autoLogoutMinutes: parseInt(e.target.value) }
              }))}
              className="setting-select"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour (Default)</option>
              <option value={120}>2 hours</option>
              <option value={480}>8 hours</option>
              <option value={-1}>Never</option>
            </select>
          </div>

          {/* Privacy Actions */}
          <div className="privacy-actions">
            <h3>Privacy & Compliance</h3>
            <div className="action-buttons">
              <button className="btn-primary" onClick={async () => {
                try {
                  const report = await PrivacyManager.generatePrivacyReport();
                  const blob = new Blob([JSON.stringify(report, null, 2)], 
                    { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `involex-privacy-report-${new Date().toISOString().split('T')[0]}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (error) {
                  updateState({ error: 'Failed to generate privacy report' });
                }
              }}>
                <Download size={16} />
                Generate Privacy Report
              </button>
              
              <button className="btn-primary" onClick={async () => {
                try {
                  const securityManager = SecurityManager.getInstance();
                  const logs = await securityManager.getAuditLogs({ limit: 100 });
                  const blob = new Blob([JSON.stringify(logs, null, 2)], 
                    { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `involex-audit-logs-${new Date().toISOString().split('T')[0]}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (error) {
                  updateState({ error: 'Failed to export audit logs' });
                }
              }}>
                <FileText size={16} />
                Export Audit Logs
              </button>

              <button className="btn-primary" onClick={async () => {
                try {
                  const securityManager = SecurityManager.getInstance();
                  await securityManager.enforceDataRetention(
                    (settings.security?.dataRetentionYears || 7) * 365
                  );
                  updateState({ saved: true });
                  setTimeout(() => updateState({ saved: false }), 2000);
                  await loadStats(); // Refresh stats
                } catch (error) {
                  updateState({ error: 'Failed to enforce data retention' });
                }
              }}>
                <Clock size={16} />
                Enforce Data Retention
              </button>

              <button className="btn-danger" onClick={async () => {
                if (!confirm('Are you sure you want to permanently delete all data? This action cannot be undone and is required for GDPR compliance upon request.')) {
                  return;
                }
                
                try {
                  const securityManager = SecurityManager.getInstance();
                  await securityManager.clearAllSensitiveData();
                  setSettings(DEFAULT_USER_SETTINGS);
                  updateState({ 
                    connectedPlatform: null,
                    stats: { totalEntries: 0, syncedEntries: 0, storageUsed: '0 KB' },
                    security: { encryptionEnabled: false, auditLogsCount: 0, privilegedEntries: 0 }
                  });
                } catch (error) {
                  updateState({ error: 'Failed to clear data' });
                }
              }}>
                <Trash2 size={16} />
                Delete All Data (GDPR)
              </button>
            </div>
          </div>
        </div>
        )}

        {/* Advanced Settings Section */}
        {state.activeTab === 'advanced' && (
        <div className="settings-section">
          <div className="section-header">
            <Settings size={20} />
            <h2>Advanced Settings</h2>
          </div>

          <div className="advanced-warning">
            <AlertCircle size={16} />
            <span>Advanced settings - modify with caution. These settings can affect extension performance and functionality.</span>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              Extension Debug Mode
              <div className="setting-description">
                Enable detailed logging for troubleshooting. This may impact performance.
              </div>
            </label>
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={settings.debug || false}
                onChange={(e) => setSettings(prev => ({ ...prev, debug: e.target.checked }))}
              />
              <span className="checkbox-text">
                Enable debug logging
                <small>Logs detailed information to browser console</small>
              </span>
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              Email Processing Interval
              <div className="setting-description">
                How often to check for new emails (in seconds). Lower values provide faster detection but use more resources.
              </div>
            </label>
            <select
              value={settings.processingInterval || 30}
              onChange={(e) => setSettings(prev => ({ ...prev, processingInterval: parseInt(e.target.value) }))}
              className="setting-select"
            >
              <option value={10}>10 seconds (High frequency)</option>
              <option value={30}>30 seconds (Default)</option>
              <option value={60}>1 minute (Low frequency)</option>
              <option value={300}>5 minutes (Very low frequency)</option>
            </select>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              API Request Timeout
              <div className="setting-description">
                Maximum time to wait for API responses (in milliseconds).
              </div>
            </label>
            <input
              type="number"
              value={settings.apiTimeout || 30000}
              onChange={(e) => setSettings(prev => ({ ...prev, apiTimeout: parseInt(e.target.value) }))}
              className="setting-input"
              min="5000"
              max="120000"
              step="5000"
            />
            <span className="input-suffix">ms</span>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default OptionsApp;
