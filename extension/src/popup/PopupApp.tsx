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
  Loader2
} from 'lucide-react';

interface BillingEntry {
  id: string;
  subject: string;
  sender: string;
  estimatedTime: number;
  estimatedAmount: number;
  description: string;
  client?: string;
  matter?: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'synced';
}

interface UserStats {
  todayEntries: number;
  todayHours: number;
  todayAmount: number;
  weeklyHours: number;
}

const PopupApp: React.FC = () => {
  const [billingEntries, setBillingEntries] = useState<BillingEntry[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({
    todayEntries: 0,
    todayHours: 0,
    todayAmount: 0,
    weeklyHours: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'entries' | 'stats'>('entries');

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
    // Calculate stats from billing entries
    const today = new Date().toDateString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const todayEntries = billingEntries.filter(entry => 
      new Date(entry.timestamp).toDateString() === today
    );

    const weeklyEntries = billingEntries.filter(entry => 
      new Date(entry.timestamp) >= weekAgo
    );

    setUserStats({
      todayEntries: todayEntries.length,
      todayHours: todayEntries.reduce((sum, entry) => sum + entry.estimatedTime, 0),
      todayAmount: todayEntries.reduce((sum, entry) => sum + entry.estimatedAmount, 0),
      weeklyHours: weeklyEntries.reduce((sum, entry) => sum + entry.estimatedTime, 0)
    });
  };

  const approveBillingEntry = async (entry: BillingEntry) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'APPROVE_BILLING_ENTRY',
        data: { ...entry, status: 'approved' }
      });
      
      if (response.success) {
        setBillingEntries(prev => prev.map(e => 
          e.id === entry.id ? { ...e, status: 'approved' } : e
        ));
      } else {
        console.error('Failed to approve entry:', response.error);
      }
    } catch (error) {
      console.error('Error approving entry:', error);
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
          <button onClick={openOptionsPage} className="settings-btn">
            <Settings size={16} />
          </button>
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
                      {entry.client && (
                        <div className="entry-meta">
                          <span>Client: {entry.client}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="entry-billing">
                      <div className="billing-time">
                        <Clock size={14} />
                        <span>{formatTime(entry.estimatedTime)}</span>
                      </div>
                      <div className="billing-amount">
                        <DollarSign size={14} />
                        <span>{formatCurrency(entry.estimatedAmount)}</span>
                      </div>
                    </div>
                    
                    <div className="entry-description">
                      {entry.description}
                    </div>
                    
                    {entry.status === 'pending' && (
                      <div className="entry-actions">
                        <button 
                          onClick={() => approveBillingEntry(entry)}
                          className="approve-btn"
                        >
                          <CheckCircle size={14} />
                          Approve & Sync
                        </button>
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PopupApp;
