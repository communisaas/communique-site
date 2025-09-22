import { vi } from 'vitest';
import type { MockedFunction as _MockedFunction } from 'vitest';
import type {
	CertificationRequest,
	CertificationResponse
} from '../../src/lib/services/certification.js';

// Define types for VOTER API mock responses
interface VoterUser {
	address?: string;
}

interface VoterTemplate {
	id: string;
	subject: string;
	message_body: string;
	send_count?: number;
}

interface VoterCertificationParams {
	user?: VoterUser;
	template: VoterTemplate;
	mailtoUrl: string;
	recipients: string[];
}

interface VoterVerificationResult {
	verified: boolean;
	severity_level: number;
	security_alert?: boolean;
	reason: string;
	corrections?: {
		message_body?: string;
		tone_adjustments?: string[];
	};
	bias_check?: {
		passed: boolean;
		demographic_neutral: boolean;
	};
	threat_indicators?: string[];
}

interface VoterConsensusResult {
	consensus_score: number;
	approved: boolean;
	agent_votes: {
		verification: { approved: boolean; confidence: number };
		impact: { approved: boolean; confidence: number };
		reputation: { approved: boolean; confidence: number };
	};
	diversity_score: number;
	recommendation: string;
}

interface VoterReputationResult {
	reputation_delta: number;
	total_reputation: number;
	tier_change: string | null;
	explanation: string;
}

interface VoterImpactResult {
	impact_score: number;
	effectiveness: number;
	reach?: number;
	engagement_rate?: number;
	policy_influence?: number;
	manipulation_detected?: boolean;
	reason?: string;
	flagged_patterns?: string[];
}

interface VoterMarketResult {
	base_reward: number;
	reputation_multiplier: number;
	quality_multiplier: number;
	impact_multiplier: number;
	final_reward: number;
	cap_applied: boolean;
	cap_reason: string | null;
	token_allocation: {
		immediate: number;
		vested: number;
	};
}

interface VoterAPIResponse {
	success: boolean;
	certification_hash?: string;
	reward_amount?: number;
	reputation_change?: number;
	user_address?: string;
	challenge_score?: number;
	civic_score?: number;
	discourse_score?: number;
	total_score?: number;
	tier?: string;
	recent_actions?: unknown[];
	total_supply?: number;
	circulating_supply?: number;
	staked_amount?: number;
	daily_mint_remaining?: number;
}

type VoterMockFunction = ReturnType<typeof vi.fn>;

/**
 * VOTER Protocol API Mocks - Enhanced
 *
 * Comprehensive mock implementations for all VOTER Protocol agents and services.
 * Supports testing of certification, consensus, reputation, impact, and market agents.
 */

export const voterMocks = {
	certification: {
		certifyAction: vi
			.fn()
			.mockImplementation(
				async (
					_userAddress: string,
					_request: CertificationRequest
				): Promise<CertificationResponse> => {
					// Default success response
					return {
						success: true,
						certificationHash: `cert-${Date.now()}-${Math.random().toString(36).substring(7)}`,
						rewardAmount: 50, // 50 VOTER tokens default reward
						reputationChange: 5
					};
				}
			),

		getStatus: vi.fn().mockImplementation(async (certificationHash: string) => {
			return {
				hash: certificationHash,
				status: 'verified',
				timestamp: new Date().toISOString(),
				rewardClaimed: true
			};
		}),

		submitReceipt: vi
			.fn()
			.mockImplementation(
				async (_receipt: string, _actionType: string, _metadata?: Record<string, unknown>) => {
					return {
						verified: true,
						hash: `receipt-${Date.now()}-${Math.random().toString(36).substring(7)}`
					};
				}
			)
	},

	// Mock for the VOTER integration helper
	integration: {
		certifyEmailDelivery: vi.fn().mockImplementation(async (params: VoterCertificationParams) => {
			if (!params.user?.address) {
				return; // Skip certification for unauthenticated users
			}

			// Simulate certification process
			return {
				success: true,
				certificationHash: `cert-${Date.now()}`,
				rewardAmount: 50
			};
		})
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
			verify: vi
				.fn()
				.mockImplementation(
					async (templateData: VoterTemplate): Promise<VoterVerificationResult> => {
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
									message_body: content.replace(
										/idiot|stupid/gi,
										'[inappropriate language removed]'
									),
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
					}
				)
		},

		consensus: {
			build: vi
				.fn()
				.mockImplementation(
					async (
						templateData: VoterTemplate,
						severityLevel: number
					): Promise<VoterConsensusResult> => {
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
					}
				)
		},

		reputation: {
			calculate: vi
				.fn()
				.mockImplementation(
					async (
						userAddress: string,
						action: { approved: boolean }
					): Promise<VoterReputationResult> => {
						const baseRep = parseInt(userAddress.slice(-2), 16) || 100;
						const delta = action.approved ? 5 : -10;

						return {
							reputation_delta: delta,
							total_reputation: baseRep + delta,
							tier_change: delta < 0 && baseRep < 100 ? 'demotion' : null,
							explanation: delta > 0 ? 'Successful action' : 'Failed verification'
						};
					}
				)
		},

		impact: {
			measure: vi
				.fn()
				.mockImplementation(
					async (actionData: {
						delivery_count?: number;
						metadata?: { unique_senders?: number };
					}): Promise<VoterImpactResult> => {
						// Detect manipulation
						if (
							actionData.delivery_count &&
							actionData.delivery_count > 1000 &&
							actionData.metadata?.unique_senders &&
							actionData.metadata.unique_senders < 10
						) {
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
					}
				)
		},

		market: {
			calculateReward: vi
				.fn()
				.mockImplementation(
					async (factors: {
						user_reputation?: number;
						template_quality?: number;
						impact_score?: number;
					}): Promise<VoterMarketResult> => {
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
					}
				)
		}
	},

	// Mock API proxy responses
	apiProxy: {
		post: vi
			.fn()
			.mockImplementation(
				async (path: string, body: Record<string, unknown>): Promise<VoterAPIResponse> => {
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
							success: true,
							user_address: body.user_address as string,
							challenge_score: 100,
							civic_score: 250,
							discourse_score: 75,
							total_score: 425,
							tier: 'emerging'
						};
					}
					// Default response
					return { success: true };
				}
			),

		get: vi.fn().mockImplementation(async (path: string): Promise<VoterAPIResponse> => {
			if (path.includes('/reputation/')) {
				const address = path.split('/').pop();
				return {
					success: true,
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
					success: true,
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
	Object.values(voterMocks.certification).forEach((mock) => {
		if (typeof mock === 'function' && 'mockClear' in mock) {
			(mock as VoterMockFunction).mockClear();
		}
	});
	Object.values(voterMocks.integration).forEach((mock) => {
		if (typeof mock === 'function' && 'mockClear' in mock) {
			(mock as VoterMockFunction).mockClear();
		}
	});
	Object.values(voterMocks.websocket).forEach((mock) => {
		if (typeof mock === 'function' && 'mockClear' in mock) {
			(mock as VoterMockFunction).mockClear();
		}
	});
	Object.values(voterMocks.apiProxy).forEach((mock) => {
		if (typeof mock === 'function' && 'mockClear' in mock) {
			(mock as VoterMockFunction).mockClear();
		}
	});
}

/**
 * Helper to configure VOTER mock responses for specific test scenarios
 */
export function configureVoterMock(
	scenario:
		| 'success'
		| 'failure'
		| 'network_error'
		| 'rate_limited'
		| 'consensus_split'
		| 'high_severity'
		| 'manipulation_detected'
		| 'bias_test'
		| 'prompt_injection'
) {
	switch (scenario) {
		case 'failure':
			voterMocks.certification.certifyAction.mockResolvedValue({
				success: false,
				error: 'Certification failed: Invalid action data'
			} as CertificationResponse);
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
			} as CertificationResponse);
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
				bias_check: { passed: true, demographic_neutral: true },
				reason: 'Content approved'
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
				() => new Promise((resolve) => setTimeout(resolve, 10000))
			);
			break;

		case 'byzantine_agent':
			// Simulate an agent giving random responses
			voterMocks.agents.verification.verify.mockImplementation(
				(): VoterVerificationResult => ({
					verified: Math.random() > 0.5,
					severity_level: Math.floor(Math.random() * 10),
					reason: 'Random behavior'
				})
			);
			break;

		case 'coordinated_manipulation': {
			// Simulate coordinated attack detection
			let callCount = 0;
			voterMocks.agents.impact.measure.mockImplementation((): VoterImpactResult => {
				callCount++;
				if (callCount > 5) {
					return {
						impact_score: 0,
						effectiveness: 0,
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
}
