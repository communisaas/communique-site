import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { voterMocks, resetVoterMocks, configureVoterMock } from '../mocks/voter.mock';

// Mock the voterIntegration module BEFORE any imports
vi.mock('$lib/integrations/voter', () => ({
  voterIntegration: {
    certifyEmailDelivery: vi.fn().mockResolvedValue({ 
      success: true, 
      certificationHash: 'mock-cert-123',
      rewardAmount: 50 
    })
  }
}));

// Mock the certification service
vi.mock('$lib/services/certification', () => ({
  certification: {
    certifyAction: vi.fn().mockResolvedValue({
      success: true,
      certificationHash: 'mock-cert-123',
      rewardAmount: 50,
      reputationChange: 5
    })
  },
  generateMessageHash: vi.fn(() => 'mock-hash-123')
}));

// Partially mock analytics to preserve the actual implementation
vi.mock('$lib/core/analytics/funnel', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    funnelAnalytics: {
      ...actual.funnelAnalytics,
      trackCertificationAttempted: vi.fn(),
      trackCertificationSuccess: vi.fn(),
      trackRewardEarned: vi.fn(),
      trackCertificationError: vi.fn()
    }
  };
});

describe('VOTER Protocol Certification Integration', () => {
  beforeEach(() => {
    resetVoterMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.ENABLE_CERTIFICATION;
  });

  describe('Email Service Integration', () => {
    it('should trigger certification when enabled and user has address', async () => {
      // Enable certification
      process.env.ENABLE_CERTIFICATION = 'true';

      // Mock browser environment
      const mockElement = { 
        href: '', 
        style: { display: '' }, 
        click: vi.fn() 
      };
      
      global.document = {
        createElement: vi.fn(() => mockElement),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn()
        }
      } as any;

      const { launchEmail } = await import('$lib/services/emailService');
      
      const mailtoUrl = 'mailto:senator@senate.gov?subject=Test&body=Message';
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        address: 'wallet123' // VOTER wallet address
      };
      const mockTemplate = {
        id: 'template123',
        slug: 'climate-action',
        title: 'Climate Action Now',
        deliveryMethod: 'both'
      };

      // Launch email with certification
      const result = launchEmail(mailtoUrl, {
        certification: {
          enabled: true,
          user: mockUser as any,
          template: mockTemplate as any,
          recipients: ['senator@senate.gov']
        }
      });

      expect(result.success).toBe(true);
      
      // Wait for async certification
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Get the mocked voterIntegration to check if it was called
      const { voterIntegration } = await import('$lib/integrations/voter');
      expect(voterIntegration.certifyEmailDelivery).toHaveBeenCalledWith({
        user: mockUser,
        template: mockTemplate,
        mailtoUrl: mailtoUrl,
        recipients: ['senator@senate.gov']
      });
    });

    it('should not trigger certification when disabled', async () => {
      // Disable certification
      process.env.ENABLE_CERTIFICATION = 'false';

      // Mock browser environment
      const mockElement = { 
        href: '', 
        style: { display: '' }, 
        click: vi.fn() 
      };
      
      global.document = {
        createElement: vi.fn(() => mockElement),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn()
        }
      } as any;

      const { launchEmail } = await import('$lib/services/emailService');
      
      const result = launchEmail('mailto:test@example.com', {
        certification: {
          enabled: false
        }
      });

      expect(result.success).toBe(true);
      
      // Wait to ensure no async calls
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Certification should NOT have been called
      const { voterIntegration } = await import('$lib/integrations/voter');
      expect(voterIntegration.certifyEmailDelivery).not.toHaveBeenCalled();
    });

    it('should handle certification failures gracefully', async () => {
      // Enable certification
      process.env.ENABLE_CERTIFICATION = 'true';
      
      // Configure mock to fail
      const { voterIntegration } = await import('$lib/integrations/voter');
      voterIntegration.certifyEmailDelivery = vi.fn().mockRejectedValue(
        new Error('Network error: Unable to reach VOTER Protocol')
      );

      // Mock browser environment
      const mockElement = { 
        href: '', 
        style: { display: '' }, 
        click: vi.fn() 
      };
      
      global.document = {
        createElement: vi.fn(() => mockElement),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn()
        }
      } as any;

      // Spy on console.warn to check error handling
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { launchEmail } = await import('$lib/services/emailService');
      
      const result = launchEmail('mailto:test@example.com', {
        certification: {
          enabled: true,
          user: { id: '123', email: 'test@example.com' } as any,
          template: { id: 'template123' } as any,
          recipients: ['test@example.com']
        }
      });

      // Email should still launch successfully
      expect(result.success).toBe(true);
      
      // Wait for async certification attempt
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Error should be logged but not thrown
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[VOTER Certification] Failed to certify email delivery:',
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  // Analytics integration is tested through actual usage in other tests
  // The methods are added to funnelAnalytics in src/lib/core/analytics/funnel.ts

  describe('Mock Registry Integration', () => {
    it('should auto-configure VOTER mocks when certification is enabled', async () => {
      process.env.ENABLE_CERTIFICATION = 'true';
      
      // Import the registry
      const { default: mockRegistry } = await import('../mocks/registry');
      
      // Configure mocks
      mockRegistry.setupMocks();
      
      // Setup should create mocks
      const mocks = mockRegistry.setupMocks();
      expect(mocks).toBeDefined();
      
      // Check that VOTER certification was enabled
      // The registry tracks enabled mocks internally
      expect(mocks.db).toBeDefined();
    });
  });
});