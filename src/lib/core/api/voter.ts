/**
 * VOTER Protocol Integration (Deprecated - Use blockchain client)
 *
 * This file now redirects to the direct blockchain client
 * Keeping for backward compatibility during transition
 */

// Re-export from the new blockchain client
export {
	certifyEmailDelivery,
	voterBlockchainClient,
	type VOTERAction,
	type VOTERActionResult
} from '../blockchain/voter-client.js';

export interface VOTERAction {
	actionType: string;
	userAddress: string;
	actionData: Record<string, unknown>;
	signature?: string;
}

export interface VOTERActionResult {
	success: boolean;
	actionHash: string;
	rewardAmount: number;
	reputationUpdate: {
		challengeScore: number;
		civicScore: number;
		discourseScore: number;
		totalScore: number;
		tier: string;
	};
	txHash?: string;
	error?: string;
}

export interface VOTERReputation {
	userAddress: string;
	challengeScore: number;
	civicScore: number;
	discourseScore: number;
	totalScore: number;
	tier: 'trusted' | 'established' | 'emerging' | 'novice' | 'untrusted';
	recentActions: unknown[];
}

export interface VOTERTokenStats {
	totalSupply: string;
	circulatingSupply: string;
	stakedAmount: string;
	dailyMintRemaining: string;
}

class VOTERProtocolAPI {
	private baseURL: string;
	private apiKey: string;

	constructor() {
		// Use different URLs for server vs client
		if (browser) {
			this.baseURL = '/api/voter-proxy'; // Proxy through SvelteKit
		} else {
			this.baseURL = env.VOTER_API_URL || 'http://localhost:8000';
		}
		this.apiKey = env.VOTER_API_KEY || '';
	}

	/**
	 * Process a civic action through VOTER Protocol
	 */
	async processAction(action: VOTERAction): Promise<ApiResponse<VOTERActionResult>> {
		try {
			const response = await fetch(`${this.baseURL}/api/v1/action`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-API-Key': this.apiKey
				},
				body: JSON.stringify({
					action_type: action.actionType,
					user_address: action.userAddress,
					action_data: action.actionData,
					signature: action.signature
				})
			});

			if (!response.ok) {
				return {
					success: false,
					error: `VOTER API error: ${response.status}`,
					status: response.status
				};
			}

			const data = await response.json();
			return {
				success: true,
				data,
				status: response.status
			};
		} catch (_error) {
			console.error('[VOTER API] Process action error:', error);
			return {
				success: false,
				error: _error instanceof Error ? _error.message : 'Network error'
			};
		}
	}

	/**
	 * Get user reputation from VOTER Protocol
	 */
	async getReputation(userAddress: string): Promise<ApiResponse<VOTERReputation>> {
		try {
			const response = await fetch(`${this.baseURL}/api/v1/reputation/${userAddress}`, {
				headers: {
					'X-API-Key': this.apiKey
				}
			});

			if (!response.ok) {
				return {
					success: false,
					error: `Failed to fetch reputation: ${response.status}`,
					status: response.status
				};
			}

			const data = await response.json();
			return {
				success: true,
				data,
				status: response.status
			};
		} catch (_error) {
			console.error('[VOTER API] Get reputation error:', error);
			return {
				success: false,
				error: _error instanceof Error ? _error.message : 'Network error'
			};
		}
	}

	/**
	 * Get VOTER token statistics
	 */
	async getTokenStats(): Promise<ApiResponse<VOTERTokenStats>> {
		try {
			const response = await fetch(`${this.baseURL}/api/v1/tokens/stats`, {
				headers: {
					'X-API-Key': this.apiKey
				}
			});

			if (!response.ok) {
				return {
					success: false,
					error: `Failed to fetch token stats: ${response.status}`,
					status: response.status
				};
			}

			const data = await response.json();
			return {
				success: true,
				data,
				status: response.status
			};
		} catch (_error) {
			console.error('[VOTER API] Get token stats error:', error);
			return {
				success: false,
				error: _error instanceof Error ? _error.message : 'Network error'
			};
		}
	}

	/**
	 * Submit congressional message for certification
	 */
	async certifyCongressMessage(
		userAddress: string,
		representative: string,
		message: string,
		district: string
	): Promise<ApiResponse<any>> {
		try {
			const response = await fetch(`${this.baseURL}/api/v1/congress/message`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-API-Key': this.apiKey,
					'X-User-Address': userAddress
				},
				body: JSON.stringify({
					representative,
					message,
					district
				})
			});

			if (!response.ok) {
				return {
					success: false,
					error: `Certification failed: ${response.status}`,
					status: response.status
				};
			}

			const data = await response.json();
			return {
				success: true,
				data,
				status: response.status
			};
		} catch (_error) {
			console.error('[VOTER API] Certify message error:', error);
			return {
				success: false,
				error: _error instanceof Error ? _error.message : 'Network error'
			};
		}
	}
}

// Export singleton instance
export const voterAPI = new VOTERProtocolAPI();

// Re-export types
export type { ApiResponse } from './client';
