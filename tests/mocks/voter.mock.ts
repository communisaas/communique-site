import { vi } from 'vitest';
import type { CertificationRequest, CertificationResponse } from '$lib/services/certification';

/**
 * VOTER Protocol API Mocks - Enhanced
 * 
 * Comprehensive mock implementations for all VOTER Protocol agents and services.
 * Supports testing of certification, consensus, reputation, impact, and market agents.
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

  // Enhanced agent mocks
  agents: {
    verification: {
      verify: vi.fn().mockImplementation(async (templateData: any) => {
        // Detect problematic content
        const content = templateData.message_body?.toLowerCase() || '';
        
        if (content.includes('ignore') && content.includes('instructions')) {
          return {
            verified: false,
            severity_level: 10,
            security_alert: true,
            reason: 'Prompt injection detected'
          };
        }
        
        if (content.includes('idiot') || content.includes('stupid')) {
          return {
            verified: false,
            severity_level: 9,
            corrections: {
              message_body: content.replace(/idiot|stupid/gi, '[inappropriate language removed]'),
              tone_adjustments: ['Removed hostile language']
            },
            reason: 'Inappropriate language detected'
          };
        }
        
        return {
          verified: true,
          severity_level: 3,
          corrections: {},
          reason: 'Content meets standards'
        };
      })
    },
    
    consensus: {
      build: vi.fn().mockImplementation(async (templateData: any, severityLevel: number) => {
        if (severityLevel < 7) {
          return {
            consensus_score: 0.9,
            approved: true,
            agent_votes: {
              verification: { approved: true, confidence: 0.9 },
              impact: { approved: true, confidence: 0.85 },
              reputation: { approved: true, confidence: 0.95 }
            },
            diversity_score: 0.8,
            recommendation: 'Approve'
          };
        }
        
        // High severity - more careful consensus
        return {
          consensus_score: 0.55,
          approved: true,
          agent_votes: {
            verification: { approved: true, confidence: 0.6 },
            impact: { approved: false, confidence: 0.7 },
            reputation: { approved: true, confidence: 0.55 }
          },
          diversity_score: 0.9,
          recommendation: 'Approve with caution'
        };
      })
    },
    
    reputation: {
      calculate: vi.fn().mockImplementation(async (userAddress: string, action: any) => {
        const baseRep = parseInt(userAddress.slice(-2), 16) || 100;
        const delta = action.approved ? 5 : -10;
        
        return {
          reputation_delta: delta,
          total_reputation: baseRep + delta,
          tier_change: delta < 0 && baseRep < 100 ? 'demotion' : null,
          explanation: delta > 0 ? 'Successful action' : 'Failed verification'
        };
      })
    },
    
    impact: {
      measure: vi.fn().mockImplementation(async (actionData: any) => {
        // Detect manipulation
        if (actionData.delivery_count > 1000 && actionData.metadata?.unique_senders < 10) {
          return {
            impact_score: 0,
            effectiveness: 0,
            manipulation_detected: true,
            reason: 'Coordinated inauthentic behavior',
            flagged_patterns: ['Burst activity', 'Low sender diversity']
          };
        }
        
        return {
          impact_score: 0.7,
          effectiveness: 0.75,
          reach: actionData.delivery_count || 100,
          engagement_rate: 0.65,
          policy_influence: 0.6
        };
      })
    },
    
    market: {
      calculateReward: vi.fn().mockImplementation(async (factors: any) => {
        const base = 10;
        const repMultiplier = Math.min(2, 1 + (factors.user_reputation || 100) / 200);
        const qualityMultiplier = 1 + (factors.template_quality || 5) / 10;
        const impactMultiplier = 1 + (factors.impact_score || 0.5);
        
        let finalReward = base * repMultiplier * qualityMultiplier * impactMultiplier;
        const capApplied = finalReward > 500;
        if (capApplied) finalReward = 500;
        
        return {
          base_reward: base,
          reputation_multiplier: repMultiplier,
          quality_multiplier: qualityMultiplier,
          impact_multiplier: impactMultiplier,
          final_reward: finalReward,
          cap_applied: capApplied,
          cap_reason: capApplied ? 'Daily limit reached' : null,
          token_allocation: {
            immediate: finalReward * 0.5,
            vested: finalReward * 0.5
          }
        };
      })
    }
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
export function configureVoterMock(
  scenario: 'success' | 'failure' | 'network_error' | 'rate_limited' | 
            'consensus_split' | 'high_severity' | 'manipulation_detected' | 
            'bias_test' | 'prompt_injection'
) {
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
    
    case 'consensus_split':
      voterMocks.agents.consensus.build.mockResolvedValue({
        consensus_score: 0.4,
        approved: false,
        agent_votes: {
          verification: { approved: false, confidence: 0.8 },
          impact: { approved: true, confidence: 0.6 },
          reputation: { approved: false, confidence: 0.7 }
        },
        diversity_score: 0.95,
        recommendation: 'Reject - no consensus'
      });
      break;
    
    case 'high_severity':
      voterMocks.agents.verification.verify.mockResolvedValue({
        verified: false,
        severity_level: 9,
        corrections: { message_body: 'Corrected content' },
        reason: 'High severity content detected'
      });
      break;
    
    case 'manipulation_detected':
      voterMocks.agents.impact.measure.mockResolvedValue({
        impact_score: 0,
        effectiveness: 0,
        manipulation_detected: true,
        reason: 'Bot network detected',
        flagged_patterns: ['IP clustering', 'Identical messages']
      });
      break;
    
    case 'bias_test':
      // Return consistent results regardless of input
      voterMocks.agents.verification.verify.mockResolvedValue({
        verified: true,
        severity_level: 3,
        bias_check: { passed: true, demographic_neutral: true }
      });
      break;
    
    case 'prompt_injection':
      voterMocks.agents.verification.verify.mockResolvedValue({
        verified: false,
        severity_level: 10,
        security_alert: true,
        reason: 'Security threat detected',
        threat_indicators: ['Command injection', 'Override attempt']
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
      voterMocks.agents.verification.verify.mockResolvedValue({
        verified: true,
        severity_level: 3,
        corrections: {},
        reason: 'Content approved'
      });
  }
}

/**
 * Helper to simulate agent grilling scenarios
 */
export function simulateAgentGrilling(attackType: string) {
  switch (attackType) {
    case 'resource_exhaustion':
      // Simulate agents taking too long
      voterMocks.agents.consensus.build.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 10000))
      );
      break;
    
    case 'byzantine_agent':
      // Simulate an agent giving random responses
      voterMocks.agents.verification.verify.mockImplementation(() => ({
        verified: Math.random() > 0.5,
        severity_level: Math.floor(Math.random() * 10),
        reason: 'Random behavior'
      }));
      break;
    
    case 'coordinated_manipulation':
      // Simulate coordinated attack detection
      let callCount = 0;
      voterMocks.agents.impact.measure.mockImplementation(() => {
        callCount++;
        if (callCount > 5) {
          return {
            impact_score: 0,
            manipulation_detected: true,
            reason: 'Coordinated attack pattern detected',
            flagged_patterns: ['Rapid succession', 'Same origin']
          };
        }
        return { impact_score: 0.5, effectiveness: 0.5 };
      });
      break;
  }
}