import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Mail, 
  CheckCircle, 
  Settings, 
  DollarSign,
  User,
  Calendar,
  BarChart3,
  AlertCircle,
  Loader2,
  RefreshCw,
  X,
  Edit3,
  Plus,
  Minus
} from 'lucide-react';
import { BillingEntry, UserSettings } from '../shared/types';

interface UserStats {
  todayEntries: number;
  todayHours: number;
  todayAmount: number;
  weeklyHours: number;
  monthlyTotal: number;
  pendingEntries: number;
  syncedEntries: number;
  rejectedEntries: number;
  syncStatus: 'connected' | 'disconnected' | 'syncing' | 'error';
  lastSyncTime?: string;
}

interface EditingEntry {
  id: string;
  field: 'time' | 'amount' | 'description';
  value: string;
}

const PopupApp: React.FC = () => {
  const [billingEntries, setBillingEntries] = useState<BillingEntry[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({
    todayEntries: 0,
    todayHours: 0,
    todayAmount: 0,
    weeklyHours: 0,
    monthlyTotal: 0,
    pendingEntries: 0,
    syncedEntries: 0,
    rejectedEntries: 0,
    syncStatus: 'disconnected'
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'entries' | 'stats'>('entries');
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);

  useEffect(() => {
    loadBillingEntries();
    loadUserStats();
  }, []);

  const loadBillingEntries = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_BILLING_ENTRIES'
      });
      
      if (response.success) {
        setBillingEntries(response.data || []);
      } else {
        console.error('Failed to load billing entries:', response.error);
      }
    } catch (error) {
      console.error('Error loading billing entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserStats = async () => {
    try {
      // Get user settings for sync status
      const settingsResponse = await chrome.runtime.sendMessage({
        type: 'GET_USER_SETTINGS'
      });
      
      // Calculate stats from billing entries
      const today = new Date().toDateString();
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const todayEntries = billingEntries.filter(entry => 
        new Date(entry.timestamp).toDateString() === today
      );

      const weeklyEntries = billingEntries.filter(entry => 
        new Date(entry.timestamp) >= weekAgo
      );

      const monthlyEntries = billingEntries.filter(entry => 
        new Date(entry.timestamp) >= monthAgo
      );

      // Helper function to get time and amount from entry
      const getTimeAndAmount = (entry: BillingEntry) => {
        const time = entry.adjustedTime || entry.aiAnalysis?.estimatedTime || 0;
        const amount = entry.adjustedAmount || entry.aiAnalysis?.estimatedAmount || 0;
        return { time, amount };
      };

      const todayStats = todayEntries.reduce((acc, entry) => {
        const { time, amount } = getTimeAndAmount(entry);
        return { time: acc.time + time, amount: acc.amount + amount };
      }, { time: 0, amount: 0 });

      const weeklyStats = weeklyEntries.reduce((acc, entry) => {
        const { time } = getTimeAndAmount(entry);
        return { time: acc.time + time };
      }, { time: 0 });

      const monthlyStats = monthlyEntries.reduce((acc, entry) => {
        const { amount } = getTimeAndAmount(entry);
        return { amount: acc.amount + amount };
      }, { amount: 0 });

      setUserStats({
        todayEntries: todayEntries.length,
        todayHours: todayStats.time,
        todayAmount: todayStats.amount,
        weeklyHours: weeklyStats.time,
        monthlyTotal: monthlyStats.amount,
        pendingEntries: billingEntries.filter(e => e.status === 'pending').length,
        syncedEntries: billingEntries.filter(e => e.status === 'synced').length,
        rejectedEntries: billingEntries.filter(e => e.status === 'rejected').length,
        syncStatus: settingsResponse?.success && settingsResponse.data?.isAuthenticated ? 'connected' : 'disconnected',
        lastSyncTime: settingsResponse?.data?.practiceManagement?.lastSync
      });
    } catch (error) {
      console.error('Error loading user stats:', error);
      setError('Failed to load statistics');
    }
  };

  const approveBillingEntry = async (entry: BillingEntry) => {
    try {
      setSyncing(true);
      setError(null);
      
      const response = await chrome.runtime.sendMessage({
        type: 'APPROVE_BILLING_ENTRY',
        data: { ...entry, status: 'approved' }
      });
      
      if (response.success) {
        setBillingEntries(prev => prev.map(e => 
          e.id === entry.id ? { ...e, status: 'approved', approvedAt: new Date().toISOString() } : e
        ));
        await loadUserStats(); // Refresh stats
      } else {
        setError('Failed to approve entry: ' + response.error);
      }
    } catch (error) {
      console.error('Error approving entry:', error);
      setError('Failed to approve entry');
    } finally {
      setSyncing(false);
    }
  };

  const rejectBillingEntry = async (entry: BillingEntry) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'REJECT_BILLING_ENTRY',
        data: { ...entry, status: 'rejected' }
      });
      
      if (response.success) {
        setBillingEntries(prev => prev.map(e => 
          e.id === entry.id ? { ...e, status: 'rejected', rejectedAt: new Date().toISOString() } : e
        ));
        await loadUserStats(); // Refresh stats
      } else {
        setError('Failed to reject entry: ' + response.error);
      }
    } catch (error) {
      console.error('Error rejecting entry:', error);
      setError('Failed to reject entry');
    }
  };

  const adjustEntryTime = async (entry: BillingEntry, adjustment: number) => {
    const currentTime = entry.adjustedTime || entry.aiAnalysis?.estimatedTime || 0;
    const newTime = Math.max(0.1, currentTime + adjustment); // Minimum 0.1 hours
    
    await updateBillingEntry(entry.id, { adjustedTime: newTime });
  };

  const adjustEntryAmount = async (entry: BillingEntry, adjustment: number) => {
    const currentAmount = entry.adjustedAmount || entry.aiAnalysis?.estimatedAmount || 0;
    const newAmount = Math.max(0, currentAmount + adjustment);
    
    await updateBillingEntry(entry.id, { adjustedAmount: newAmount });
  };

  const updateBillingEntry = async (entryId: string, updates: Partial<BillingEntry>) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_BILLING_ENTRY',
        data: { entryId, updates }
      });
      
      if (response.success) {
        setBillingEntries(prev => prev.map(e => 
          e.id === entryId ? { ...e, ...updates } : e
        ));
      } else {
        setError('Failed to update entry: ' + response.error);
      }
    } catch (error) {
      console.error('Error updating entry:', error);
      setError('Failed to update entry');
    }
  };

  const saveEditingField = async () => {
    if (!editingEntry) return;
    
    const entry = billingEntries.find(e => e.id === editingEntry.id);
    if (!entry) return;

    let updates: Partial<BillingEntry> = {};
    
    switch (editingEntry.field) {
      case 'time':
        const timeValue = parseFloat(editingEntry.value);
        if (!isNaN(timeValue) && timeValue >= 0.1) {
          updates.adjustedTime = timeValue;
        }
        break;
      case 'amount':
        const amountValue = parseFloat(editingEntry.value);
        if (!isNaN(amountValue) && amountValue >= 0) {
          updates.adjustedAmount = amountValue;
        }
        break;
      case 'description':
        updates.adjustedDescription = editingEntry.value;
        break;
    }
    
    if (Object.keys(updates).length > 0) {
      await updateBillingEntry(editingEntry.id, updates);
    }
    
    setEditingEntry(null);
  };

  const cancelEditing = () => {
    setEditingEntry(null);
  };

  const syncAllEntries = async () => {
    try {
      setSyncing(true);
      setError(null);
      
      const response = await chrome.runtime.sendMessage({
        type: 'SYNC_ALL_ENTRIES'
      });
      
      if (response.success) {
        await loadBillingEntries();
        await loadUserStats();
      } else {
        setError('Sync failed: ' + response.error);
      }
    } catch (error) {
      console.error('Error syncing entries:', error);
      setError('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const openOptionsPage = () => {
    chrome.runtime.openOptionsPage();
  };

  const formatTime = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="popup-container">
        <div className="loading-container">
          <Loader2 className="animate-spin" size={32} />
          <p>Loading Involex...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="popup-container">
      {/* Header */}
      <div className="popup-header">
        <div className="logo-section">
          <div className="logo">
            <DollarSign size={24} className="logo-icon" />
            <span className="logo-text">Involex</span>
          </div>
          <div className="header-actions">
            {syncing && <Loader2 className="animate-spin" size={16} />}
            <button 
              onClick={syncAllEntries} 
              disabled={syncing || userStats.syncStatus !== 'connected'}
              className="sync-btn"
              title="Sync all approved entries"
            >
              <RefreshCw size={16} />
            </button>
            <button onClick={openOptionsPage} className="settings-btn">
              <Settings size={16} />
            </button>
          </div>
        </div>
        
        {/* Sync Status */}
        <div className="sync-status">
          <div className={`status-indicator status-${userStats.syncStatus}`}>
            <div className="status-dot"></div>
            <span>{userStats.syncStatus}</span>
          </div>
          {userStats.lastSyncTime && (
            <span className="last-sync">
              Last sync: {new Date(userStats.lastSyncTime).toLocaleTimeString()}
            </span>
          )}
        </div>
        
        {/* Quick Stats */}
        <div className="quick-stats">
          <div className="stat-item">
            <Clock size={14} />
            <span>{formatTime(userStats.todayHours)} today</span>
          </div>
          <div className="stat-item">
            <DollarSign size={14} />
            <span>{formatCurrency(userStats.todayAmount)}</span>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="error-close">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'entries' ? 'active' : ''}`}
          onClick={() => setActiveTab('entries')}
        >
          <Mail size={16} />
          Entries ({billingEntries.filter(e => e.status === 'pending').length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          <BarChart3 size={16} />
          Stats
        </button>
      </div>

      {/* Content */}
      <div className="tab-content">
        {activeTab === 'entries' ? (
          <div className="entries-tab">
            {billingEntries.length === 0 ? (
              <div className="empty-state">
                <Mail size={48} className="empty-icon" />
                <h3>No billing entries</h3>
                <p>Open Gmail or Outlook to start tracking your legal work automatically.</p>
              </div>
            ) : (
              <div className="entries-list">
                {billingEntries.map(entry => (
                  <div key={entry.id} className="entry-item">
                    <div className="entry-header">
                      <div className="entry-subject">
                        {entry.subject.length > 40 
                          ? `${entry.subject.substring(0, 40)}...` 
                          : entry.subject
                        }
                      </div>
                      <div className={`entry-status status-${entry.status}`}>
                        {entry.status === 'pending' && <AlertCircle size={14} />}
                        {entry.status === 'approved' && <Clock size={14} />}
                        {entry.status === 'synced' && <CheckCircle size={14} />}
                        {entry.status}
                      </div>
                    </div>
                    
                    <div className="entry-details">
                      <div className="entry-meta">
                        <User size={12} />
                        <span>{entry.sender}</span>
                      </div>
                      {(entry.assignedClient || entry.aiAnalysis?.client) && (
                        <div className="entry-meta">
                          <span>Client: {entry.assignedClient || entry.aiAnalysis?.client}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="entry-billing">
                      <div className="billing-time">
                        <Clock size={14} />
                        {editingEntry?.id === entry.id && editingEntry.field === 'time' ? (
                          <div className="inline-edit">
                            <input
                              type="number"
                              step="0.1"
                              min="0.1"
                              value={editingEntry.value}
                              onChange={(e) => setEditingEntry({...editingEntry, value: e.target.value})}
                              onBlur={saveEditingField}
                              onKeyPress={(e) => e.key === 'Enter' && saveEditingField()}
                              autoFocus
                              className="time-input"
                            />
                            <span>hrs</span>
                          </div>
                        ) : (
                          <div className="time-controls">
                            <button 
                              onClick={() => adjustEntryTime(entry, -0.1)}
                              className="adjust-btn"
                              disabled={entry.status !== 'pending'}
                            >
                              <Minus size={12} />
                            </button>
                            <span 
                              onClick={() => entry.status === 'pending' && setEditingEntry({
                                id: entry.id, 
                                field: 'time', 
                                value: (entry.adjustedTime || entry.aiAnalysis?.estimatedTime || 0).toString()
                              })}
                              className={entry.status === 'pending' ? 'editable-field' : ''}
                            >
                              {formatTime(entry.adjustedTime || entry.aiAnalysis?.estimatedTime || 0)}
                            </span>
                            <button 
                              onClick={() => adjustEntryTime(entry, 0.1)}
                              className="adjust-btn"
                              disabled={entry.status !== 'pending'}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="billing-amount">
                        <DollarSign size={14} />
                        {editingEntry?.id === entry.id && editingEntry.field === 'amount' ? (
                          <div className="inline-edit">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editingEntry.value}
                              onChange={(e) => setEditingEntry({...editingEntry, value: e.target.value})}
                              onBlur={saveEditingField}
                              onKeyPress={(e) => e.key === 'Enter' && saveEditingField()}
                              autoFocus
                              className="amount-input"
                            />
                          </div>
                        ) : (
                          <div className="amount-controls">
                            <button 
                              onClick={() => adjustEntryAmount(entry, -10)}
                              className="adjust-btn"
                              disabled={entry.status !== 'pending'}
                            >
                              <Minus size={12} />
                            </button>
                            <span 
                              onClick={() => entry.status === 'pending' && setEditingEntry({
                                id: entry.id, 
                                field: 'amount', 
                                value: (entry.adjustedAmount || entry.aiAnalysis?.estimatedAmount || 0).toString()
                              })}
                              className={entry.status === 'pending' ? 'editable-field' : ''}
                            >
                              {formatCurrency(entry.adjustedAmount || entry.aiAnalysis?.estimatedAmount || 0)}
                            </span>
                            <button 
                              onClick={() => adjustEntryAmount(entry, 10)}
                              className="adjust-btn"
                              disabled={entry.status !== 'pending'}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="entry-description">
                      {editingEntry?.id === entry.id && editingEntry.field === 'description' ? (
                        <div className="inline-edit">
                          <textarea
                            value={editingEntry.value}
                            onChange={(e) => setEditingEntry({...editingEntry, value: e.target.value})}
                            onBlur={saveEditingField}
                            onKeyPress={(e) => e.key === 'Enter' && e.ctrlKey && saveEditingField()}
                            autoFocus
                            className="description-input"
                            rows={2}
                          />
                          <div className="edit-hint">Press Ctrl+Enter to save</div>
                        </div>
                      ) : (
                        <div 
                          onClick={() => entry.status === 'pending' && setEditingEntry({
                            id: entry.id, 
                            field: 'description', 
                            value: entry.adjustedDescription || entry.aiAnalysis?.description || ''
                          })}
                          className={entry.status === 'pending' ? 'editable-field' : ''}
                        >
                          {entry.adjustedDescription || entry.aiAnalysis?.description || 'No description available'}
                          {entry.status === 'pending' && <Edit3 size={12} className="edit-icon" />}
                        </div>
                      )}
                    </div>
                    
                    {entry.status === 'pending' && (
                      <div className="entry-actions">
                        <button 
                          onClick={() => approveBillingEntry(entry)}
                          disabled={syncing}
                          className="approve-btn"
                        >
                          <CheckCircle size={14} />
                          Approve & Sync
                        </button>
                        <button 
                          onClick={() => rejectBillingEntry(entry)}
                          className="reject-btn"
                        >
                          <X size={14} />
                          Reject
                        </button>
                      </div>
                    )}
                    
                    {entry.status === 'approved' && (
                      <div className="entry-status-info">
                        <Clock size={12} />
                        <span>Waiting to sync to practice management system...</span>
                      </div>
                    )}
                    
                    {entry.status === 'synced' && entry.syncedAt && (
                      <div className="entry-status-info">
                        <CheckCircle size={12} />
                        <span>Synced {new Date(entry.syncedAt).toLocaleDateString()}</span>
                      </div>
                    )}
                    
                    {entry.status === 'rejected' && entry.rejectedAt && (
                      <div className="entry-status-info rejected">
                        <X size={12} />
                        <span>Rejected {new Date(entry.rejectedAt).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="stats-tab">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">
                  <Calendar size={20} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{userStats.todayEntries}</div>
                  <div className="stat-label">Today's Entries</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">
                  <Clock size={20} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{formatTime(userStats.todayHours)}</div>
                  <div className="stat-label">Today's Hours</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">
                  <DollarSign size={20} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{formatCurrency(userStats.todayAmount)}</div>
                  <div className="stat-label">Today's Value</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">
                  <BarChart3 size={20} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{formatTime(userStats.weeklyHours)}</div>
                  <div className="stat-label">This Week</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon pending">
                  <AlertCircle size={20} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{userStats.pendingEntries}</div>
                  <div className="stat-label">Pending</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon synced">
                  <CheckCircle size={20} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{userStats.syncedEntries}</div>
                  <div className="stat-label">Synced</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PopupApp;
