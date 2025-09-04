import { vi } from 'vitest';
import type { CertificationRequest, CertificationResponse } from '$lib/services/certification';

/**
 * VOTER Protocol API Mocks
 * 
 * Provides mock implementations for VOTER certification service
 * Used in integration tests when ENABLE_CERTIFICATION is true
 */

export const voterMocks = {
  certification: {
    certifyAction: vi.fn().mockImplementation(
      async (userAddress: string, request: CertificationRequest): Promise<CertificationResponse> => {
        // Default success response
        return {
          success: true,
          certificationHash: `cert-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          rewardAmount: 50, // 50 VOTER tokens default reward
          reputationChange: 5
        };
      }
    ),

    getStatus: vi.fn().mockImplementation(
      async (certificationHash: string) => {
        return {
          hash: certificationHash,
          status: 'verified',
          timestamp: new Date().toISOString(),
          rewardClaimed: true
        };
      }
    ),

    submitReceipt: vi.fn().mockImplementation(
      async (receipt: string, actionType: string, metadata?: any) => {
        return {
          verified: true,
          hash: `receipt-${Date.now()}-${Math.random().toString(36).substring(7)}`
        };
      }
    )
  },

  // Mock for the VOTER integration helper
  integration: {
    certifyEmailDelivery: vi.fn().mockImplementation(
      async (params: {
        user?: { address?: string };
        template: any;
        mailtoUrl: string;
        recipients: string[];
      }) => {
        if (!params.user?.address) {
          return; // Skip certification for unauthenticated users
        }

        // Simulate certification process
        return {
          success: true,
          certificationHash: `cert-${Date.now()}`,
          rewardAmount: 50
        };
      }
    )
  },

  // Mock for WebSocket events
  websocket: {
    onReputationUpdate: vi.fn(),
    onRewardEarned: vi.fn(),
    onChallengeCreated: vi.fn()
  },

  // Mock API proxy responses
  apiProxy: {
    post: vi.fn().mockImplementation(async (path: string, body: any) => {
      // Route-based responses
      if (path.includes('/certification/action')) {
        return {
          success: true,
          certification_hash: `cert-${Date.now()}`,
          reward_amount: 50,
          reputation_change: 5
        };
      }
      if (path.includes('/reputation')) {
        return {
          user_address: body.user_address,
          challenge_score: 100,
          civic_score: 250,
          discourse_score: 75,
          total_score: 425,
          tier: 'emerging'
        };
      }
      // Default response
      return { success: true };
    }),

    get: vi.fn().mockImplementation(async (path: string) => {
      if (path.includes('/reputation/')) {
        const address = path.split('/').pop();
        return {
          user_address: address,
          challenge_score: 100,
          civic_score: 250,
          discourse_score: 75,
          total_score: 425,
          tier: 'emerging',
          recent_actions: []
        };
      }
      if (path.includes('/tokens/stats')) {
        return {
          total_supply: 1000000,
          circulating_supply: 500000,
          staked_amount: 250000,
          daily_mint_remaining: 10000
        };
      }
      return { success: true };
    })
  }
};

/**
 * Helper to reset all VOTER mocks
 */
export function resetVoterMocks() {
  Object.values(voterMocks.certification).forEach(mock => {
    if (typeof mock === 'function' && 'mockClear' in mock) {
      mock.mockClear();
    }
  });
  Object.values(voterMocks.integration).forEach(mock => {
    if (typeof mock === 'function' && 'mockClear' in mock) {
      mock.mockClear();
    }
  });
  Object.values(voterMocks.websocket).forEach(mock => {
    if (typeof mock === 'function' && 'mockClear' in mock) {
      mock.mockClear();
    }
  });
  Object.values(voterMocks.apiProxy).forEach(mock => {
    if (typeof mock === 'function' && 'mockClear' in mock) {
      mock.mockClear();
    }
  });
}

/**
 * Helper to configure VOTER mock responses for specific test scenarios
 */
export function configureVoterMock(scenario: 'success' | 'failure' | 'network_error' | 'rate_limited') {
  switch (scenario) {
    case 'failure':
      voterMocks.certification.certifyAction.mockResolvedValue({
        success: false,
        error: 'Certification failed: Invalid action data'
      });
      break;
    
    case 'network_error':
      voterMocks.certification.certifyAction.mockRejectedValue(
        new Error('Network error: Unable to reach VOTER Protocol')
      );
      break;
    
    case 'rate_limited':
      voterMocks.certification.certifyAction.mockResolvedValue({
        success: false,
        error: 'Rate limited: Too many requests'
      });
      break;
    
    case 'success':
    default:
      // Reset to default success behavior
      voterMocks.certification.certifyAction.mockResolvedValue({
        success: true,
        certificationHash: `cert-${Date.now()}`,
        rewardAmount: 50,
        reputationChange: 5
      });
  }
}