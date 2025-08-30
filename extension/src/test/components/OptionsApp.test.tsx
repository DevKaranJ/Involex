// Options App Component Tests
// Comprehensive test suite for Phase 6 Settings & Configuration

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OptionsApp from '../../options/OptionsApp';
import { SecurityManager, PrivacyManager } from '../../shared/security';

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    getManifest: jest.fn(() => ({ version: '1.0.0' }))
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn()
    },
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

// @ts-ignore
global.chrome = mockChrome;

describe('OptionsApp Phase 6 Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful responses
    mockChrome.runtime.sendMessage.mockResolvedValue({
      success: true,
      data: {
        billingRates: { default: 300, minimum: 0.1, increment: 0.1 },
        aiSettings: { analysisEnabled: true, confidenceThreshold: 0.7 },
        notifications: { enabled: true, emailDetection: true },
        security: { encryptionEnabled: true, auditLoggingEnabled: true }
      }
    });
  });

  describe('Initial Loading and Setup', () => {
    test('should render loading state initially', () => {
      render(<OptionsApp />);
      expect(screen.getByText('Loading settings...')).toBeInTheDocument();
    });

    test('should load user settings on mount', async () => {
      render(<OptionsApp />);
      
      await waitFor(() => {
        expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
          type: 'GET_USER_SETTINGS'
        });
      });
    });

    test('should display error if settings fail to load', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValueOnce(new Error('Load failed'));
      
      render(<OptionsApp />);
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to load settings/)).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    test('should switch between tabs correctly', async () => {
      render(<OptionsApp />);
      
      await waitFor(() => {
        expect(screen.getByText('Billing Rates & Time Tracking')).toBeInTheDocument();
      });

      // Switch to AI Settings tab
      fireEvent.click(screen.getByText('AI Settings'));
      expect(screen.getByText('AI Analysis Settings')).toBeInTheDocument();

      // Switch to Security tab
      fireEvent.click(screen.getByText('Security'));
      expect(screen.getByText('Security & Privacy')).toBeInTheDocument();
    });

    test('should maintain active tab state', async () => {
      render(<OptionsApp />);
      
      await waitFor(() => {
        const billingTab = screen.getByText('Billing');
        expect(billingTab.closest('button')).toHaveClass('active');
      });
    });
  });

  describe('Billing Settings Tab', () => {
    test('should display and update billing rates', async () => {
      const user = userEvent.setup();
      render(<OptionsApp />);

      await waitFor(() => {
        const rateInput = screen.getByDisplayValue('300');
        expect(rateInput).toBeInTheDocument();
      });

      const rateInput = screen.getByDisplayValue('300');
      await user.clear(rateInput);
      await user.type(rateInput, '350');

      expect(rateInput).toHaveValue(350);
    });

    test('should update minimum billing increment', async () => {
      const user = userEvent.setup();
      render(<OptionsApp />);

      await waitFor(() => {
        const incrementSelect = screen.getByDisplayValue('6 minutes (0.1 hours)');
        expect(incrementSelect).toBeInTheDocument();
      });

      const incrementSelect = screen.getByDisplayValue('6 minutes (0.1 hours)');
      await user.selectOptions(incrementSelect, '0.25');

      expect(incrementSelect).toHaveValue('0.25');
    });
  });

  describe('AI Settings Tab', () => {
    test('should toggle AI analysis settings', async () => {
      const user = userEvent.setup();
      render(<OptionsApp />);

      fireEvent.click(screen.getByText('AI Settings'));

      await waitFor(() => {
        const analysisToggle = screen.getByLabelText(/Enable AI email analysis/);
        expect(analysisToggle).toBeChecked();
      });

      const analysisToggle = screen.getByLabelText(/Enable AI email analysis/);
      await user.click(analysisToggle);

      expect(analysisToggle).not.toBeChecked();
    });

    test('should update confidence threshold', async () => {
      const user = userEvent.setup();
      render(<OptionsApp />);

      fireEvent.click(screen.getByText('AI Settings'));

      await waitFor(() => {
        const confidenceSlider = screen.getByDisplayValue('0.7');
        expect(confidenceSlider).toBeInTheDocument();
      });

      const confidenceSlider = screen.getByDisplayValue('0.7');
      await user.clear(confidenceSlider);
      await user.type(confidenceSlider, '0.8');

      expect(confidenceSlider).toHaveValue(0.8);
    });

    test('should disable dependent settings when AI is disabled', async () => {
      const user = userEvent.setup();
      render(<OptionsApp />);

      fireEvent.click(screen.getByText('AI Settings'));

      const analysisToggle = screen.getByLabelText(/Enable AI email analysis/);
      await user.click(analysisToggle);

      await waitFor(() => {
        const timeEstimationToggle = screen.getByLabelText(/Automatic time estimation/);
        expect(timeEstimationToggle).toBeDisabled();
      });
    });
  });

  describe('Security Settings Tab', () => {
    test('should display security status', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((message) => {
        if (message.type === 'GET_SECURITY_STATUS') {
          return Promise.resolve({
            success: true,
            data: {
              encryptionEnabled: true,
              auditLogsCount: 15,
              privilegedEntries: 5
            }
          });
        }
        return Promise.resolve({ success: true, data: {} });
      });

      render(<OptionsApp />);
      fireEvent.click(screen.getByText('Security'));

      await waitFor(() => {
        expect(screen.getByText('Enabled (AES-256)')).toBeInTheDocument();
        expect(screen.getByText('15 entries')).toBeInTheDocument();
        expect(screen.getByText('5 protected')).toBeInTheDocument();
      });
    });

    test('should toggle encryption settings', async () => {
      const user = userEvent.setup();
      render(<OptionsApp />);

      fireEvent.click(screen.getByText('Security'));

      await waitFor(() => {
        const encryptionToggle = screen.getByLabelText(/Enable data encryption/);
        expect(encryptionToggle).toBeInTheDocument();
      });

      const encryptionToggle = screen.getByLabelText(/Enable data encryption/);
      await user.click(encryptionToggle);

      // Should update the settings
      expect(encryptionToggle).toBeChecked();
    });

    test('should configure data retention policy', async () => {
      const user = userEvent.setup();
      render(<OptionsApp />);

      fireEvent.click(screen.getByText('Security'));

      await waitFor(() => {
        const retentionSelect = screen.getByDisplayValue('7');
        expect(retentionSelect).toBeInTheDocument();
      });

      const retentionSelect = screen.getByDisplayValue('7');
      await user.selectOptions(retentionSelect, '5');

      expect(retentionSelect).toHaveValue('5');
    });

    test('should export privacy report', async () => {
      // Mock URL.createObjectURL
      global.URL.createObjectURL = jest.fn(() => 'mock-url');
      global.URL.revokeObjectURL = jest.fn();

      const mockClick = jest.fn();
      const mockAppendChild = jest.fn();
      const mockRemoveChild = jest.fn();

      // Mock document.createElement
      const mockAnchor = {
        href: '',
        download: '',
        click: mockClick
      };
      
      jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
      jest.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
      jest.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);

      render(<OptionsApp />);
      fireEvent.click(screen.getByText('Security'));

      await waitFor(() => {
        const exportButton = screen.getByText('Generate Privacy Report');
        fireEvent.click(exportButton);
      });

      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe('Practice Management Integration Tab', () => {
    test('should display connection status', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((message) => {
        if (message.type === 'GET_USER_SETTINGS') {
          return Promise.resolve({
            success: true,
            data: {
              practiceManagement: {
                platform: 'cleo',
                lastSync: new Date().toISOString()
              }
            }
          });
        }
        return Promise.resolve({ success: true, data: {} });
      });

      render(<OptionsApp />);
      fireEvent.click(screen.getByText('Integration'));

      await waitFor(() => {
        expect(screen.getByText('Connected to cleo')).toBeInTheDocument();
      });
    });

    test('should connect to practice management platform', async () => {
      render(<OptionsApp />);
      fireEvent.click(screen.getByText('Integration'));

      await waitFor(() => {
        const cleoConnectButton = screen.getByText('Connect');
        fireEvent.click(cleoConnectButton);
      });

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'CONNECT_PRACTICE_MANAGEMENT',
        data: { platform: 'cleo' }
      });
    });

    test('should disconnect from practice management platform', async () => {
      // Setup connected state
      mockChrome.runtime.sendMessage.mockImplementation((message) => {
        if (message.type === 'GET_USER_SETTINGS') {
          return Promise.resolve({
            success: true,
            data: {
              practiceManagement: { platform: 'cleo' }
            }
          });
        }
        return Promise.resolve({ success: true, data: {} });
      });

      render(<OptionsApp />);
      fireEvent.click(screen.getByText('Integration'));

      await waitFor(() => {
        const disconnectButton = screen.getByText('Disconnect');
        fireEvent.click(disconnectButton);
      });

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'DISCONNECT_PRACTICE_MANAGEMENT'
      });
    });
  });

  describe('Data Management Tab', () => {
    test('should display storage statistics', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((message) => {
        if (message.type === 'GET_BILLING_ENTRIES') {
          return Promise.resolve({
            success: true,
            data: Array(25).fill({}).map((_, i) => ({
              id: `entry-${i}`,
              status: i < 20 ? 'synced' : 'pending',
              createdAt: new Date().toISOString()
            }))
          });
        }
        if (message.type === 'GET_STORAGE_USAGE') {
          return Promise.resolve({
            success: true,
            data: { local: { used: 1024 * 50 } } // 50KB
          });
        }
        return Promise.resolve({ success: true, data: {} });
      });

      render(<OptionsApp />);
      fireEvent.click(screen.getByText('Data'));

      await waitFor(() => {
        expect(screen.getByText('25')).toBeInTheDocument(); // Total entries
        expect(screen.getByText('20')).toBeInTheDocument(); // Synced entries
        expect(screen.getByText('50KB')).toBeInTheDocument(); // Storage used
      });
    });

    test('should export data', async () => {
      global.URL.createObjectURL = jest.fn(() => 'mock-url');
      global.URL.revokeObjectURL = jest.fn();

      const mockClick = jest.fn();
      const mockAnchor = {
        href: '',
        download: '',
        click: mockClick
      };
      
      jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);

      mockChrome.runtime.sendMessage.mockImplementation((message) => {
        if (message.type === 'EXPORT_DATA') {
          return Promise.resolve({
            success: true,
            data: { exportedAt: new Date().toISOString() }
          });
        }
        return Promise.resolve({ success: true, data: {} });
      });

      render(<OptionsApp />);
      fireEvent.click(screen.getByText('Data'));

      await waitFor(() => {
        const exportButton = screen.getByText('Export Data');
        fireEvent.click(exportButton);
      });

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'EXPORT_DATA'
      });
      expect(mockClick).toHaveBeenCalled();
    });

    test('should sync all entries', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((message) => {
        if (message.type === 'SYNC_ALL_ENTRIES') {
          return Promise.resolve({
            success: true,
            data: { syncedCount: 5, errorCount: 0 }
          });
        }
        return Promise.resolve({ success: true, data: {} });
      });

      render(<OptionsApp />);
      fireEvent.click(screen.getByText('Data'));

      await waitFor(() => {
        const syncButton = screen.getByText('Sync All Entries');
        fireEvent.click(syncButton);
      });

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'SYNC_ALL_ENTRIES'
      });
    });

    test('should clear all data with confirmation', async () => {
      // Mock window.confirm
      global.confirm = jest.fn(() => true);

      mockChrome.runtime.sendMessage.mockImplementation((message) => {
        if (message.type === 'CLEAR_ALL_DATA') {
          return Promise.resolve({ success: true });
        }
        return Promise.resolve({ success: true, data: {} });
      });

      render(<OptionsApp />);
      fireEvent.click(screen.getByText('Data'));

      await waitFor(() => {
        const clearButton = screen.getByText('Clear All Data');
        fireEvent.click(clearButton);
      });

      expect(global.confirm).toHaveBeenCalled();
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'CLEAR_ALL_DATA'
      });
    });
  });

  describe('Advanced Settings Tab', () => {
    test('should toggle debug mode', async () => {
      const user = userEvent.setup();
      render(<OptionsApp />);

      fireEvent.click(screen.getByText('Advanced'));

      await waitFor(() => {
        const debugToggle = screen.getByLabelText(/Enable debug logging/);
        expect(debugToggle).toBeInTheDocument();
      });

      const debugToggle = screen.getByLabelText(/Enable debug logging/);
      await user.click(debugToggle);

      expect(debugToggle).toBeChecked();
    });

    test('should configure processing interval', async () => {
      const user = userEvent.setup();
      render(<OptionsApp />);

      fireEvent.click(screen.getByText('Advanced'));

      await waitFor(() => {
        const intervalSelect = screen.getByDisplayValue('30');
        expect(intervalSelect).toBeInTheDocument();
      });

      const intervalSelect = screen.getByDisplayValue('30');
      await user.selectOptions(intervalSelect, '60');

      expect(intervalSelect).toHaveValue('60');
    });

    test('should update API timeout', async () => {
      const user = userEvent.setup();
      render(<OptionsApp />);

      fireEvent.click(screen.getByText('Advanced'));

      await waitFor(() => {
        const timeoutInput = screen.getByDisplayValue('30000');
        expect(timeoutInput).toBeInTheDocument();
      });

      const timeoutInput = screen.getByDisplayValue('30000');
      await user.clear(timeoutInput);
      await user.type(timeoutInput, '45000');

      expect(timeoutInput).toHaveValue(45000);
    });
  });

  describe('Settings Persistence', () => {
    test('should save settings when save button is clicked', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((message) => {
        if (message.type === 'UPDATE_USER_SETTINGS') {
          return Promise.resolve({ success: true });
        }
        return Promise.resolve({ success: true, data: {} });
      });

      render(<OptionsApp />);

      await waitFor(() => {
        const saveButton = screen.getByText('Save Settings');
        fireEvent.click(saveButton);
      });

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'UPDATE_USER_SETTINGS',
        data: expect.any(Object)
      });
    });

    test('should show success message after saving', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((message) => {
        if (message.type === 'UPDATE_USER_SETTINGS') {
          return Promise.resolve({ success: true });
        }
        return Promise.resolve({ success: true, data: {} });
      });

      render(<OptionsApp />);

      await waitFor(() => {
        const saveButton = screen.getByText('Save Settings');
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Saved!')).toBeInTheDocument();
      });
    });

    test('should handle save errors gracefully', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((message) => {
        if (message.type === 'UPDATE_USER_SETTINGS') {
          return Promise.resolve({ success: false, error: 'Save failed' });
        }
        return Promise.resolve({ success: true, data: {} });
      });

      render(<OptionsApp />);

      await waitFor(() => {
        const saveButton = screen.getByText('Save Settings');
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Failed to save settings/)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA labels', async () => {
      render(<OptionsApp />);

      await waitFor(() => {
        expect(screen.getByLabelText('Default Hourly Rate')).toBeInTheDocument();
        expect(screen.getByLabelText('Minimum Billing Increment')).toBeInTheDocument();
      });
    });

    test('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<OptionsApp />);

      await waitFor(() => {
        const firstTab = screen.getByText('Billing');
        firstTab.focus();
      });

      // Test tab navigation
      await user.keyboard('{Tab}');
      expect(screen.getByText('AI Settings')).toHaveFocus();
    });
  });

  describe('Error Handling', () => {
    test('should display error banner for API failures', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValueOnce(new Error('API Error'));

      render(<OptionsApp />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load settings/)).toBeInTheDocument();
      });
    });

    test('should allow error dismissal', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValueOnce(new Error('API Error'));

      render(<OptionsApp />);

      await waitFor(() => {
        const errorBanner = screen.getByText(/Failed to load settings/);
        expect(errorBanner).toBeInTheDocument();
      });

      const closeButton = screen.getByText('×');
      fireEvent.click(closeButton);

      expect(screen.queryByText(/Failed to load settings/)).not.toBeInTheDocument();
    });
  });
});

describe('Security Integration Tests', () => {
  test('should integrate with SecurityManager for audit logging', async () => {
    const securityManager = SecurityManager.getInstance();
    const logSpy = jest.spyOn(securityManager, 'logSecurityEvent');

    render(<OptionsApp />);

    // Simulate a security-related action
    fireEvent.click(screen.getByText('Security'));

    await waitFor(() => {
      expect(logSpy).toHaveBeenCalledWith({
        type: 'SETTINGS_CHANGE',
        details: expect.any(String)
      });
    });
  });

  test('should handle privilege protection settings', async () => {
    render(<OptionsApp />);
    fireEvent.click(screen.getByText('Security'));

    await waitFor(() => {
      const privilegeToggle = screen.getByLabelText(/Enable privilege protection/);
      expect(privilegeToggle).toBeInTheDocument();
    });
  });
});

describe('Performance Tests', () => {
  test('should debounce save operations', async () => {
    const user = userEvent.setup();
    render(<OptionsApp />);

    await waitFor(() => {
      const rateInput = screen.getByDisplayValue('300');
      expect(rateInput).toBeInTheDocument();
    });

    const rateInput = screen.getByDisplayValue('300');
    
    // Rapid changes should be debounced
    await user.clear(rateInput);
    await user.type(rateInput, '350');
    await user.clear(rateInput);
    await user.type(rateInput, '400');

    // Should not call save for each keystroke
    expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalledWith({
      type: 'UPDATE_USER_SETTINGS',
      data: expect.any(Object)
    });
  });

  test('should handle large data sets efficiently', async () => {
    // Mock large dataset
    const largeDataSet = Array(1000).fill({}).map((_, i) => ({
      id: `entry-${i}`,
      status: 'pending',
      createdAt: new Date().toISOString()
    }));

    mockChrome.runtime.sendMessage.mockImplementation((message) => {
      if (message.type === 'GET_BILLING_ENTRIES') {
        return Promise.resolve({
          success: true,
          data: largeDataSet
        });
      }
      return Promise.resolve({ success: true, data: {} });
    });

    const startTime = performance.now();
    render(<OptionsApp />);
    
    await waitFor(() => {
      expect(screen.getByText('1000')).toBeInTheDocument();
    });
    
    const endTime = performance.now();
    
    // Should render within reasonable time (< 1 second)
    expect(endTime - startTime).toBeLessThan(1000);
  });
});
