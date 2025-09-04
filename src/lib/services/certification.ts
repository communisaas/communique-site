/**
 * Certification Service - VOTER Protocol Integration
 * 
 * Handles certification of civic actions through VOTER Protocol
 * Called AFTER successful delivery to certify and earn rewards
 */

import { env } from '$env/dynamic/private';

export interface CertificationRequest {
	actionType: 'direct_email' | 'cwc_message' | 'local_action';
	deliveryReceipt: string;
	recipientEmail?: string;
	recipientName?: string;
	subject?: string;
	messageHash: string;
	timestamp: string;
	metadata?: Record<string, any>;
}

export interface CertificationResponse {
	success: boolean;
	certificationHash?: string;
	rewardAmount?: number;
	reputationChange?: number;
	error?: string;
}

class CertificationService {
	private apiUrl: string;
	private apiKey: string;
	private enabled: boolean;

	constructor() {
		this.apiUrl = env.VOTER_API_URL || 'http://localhost:8000';
		this.apiKey = env.VOTER_API_KEY || '';
		this.enabled = env.ENABLE_CERTIFICATION === 'true';
	}

	/**
	 * Certify a civic action after successful delivery
	 */
	async certifyAction(
		userAddress: string,
		request: CertificationRequest
	): Promise<CertificationResponse> {
		if (!this.enabled) {
			console.log('[Certification] Service disabled, skipping certification');
			return { success: true };
		}

		try {
			const response = await fetch(`${this.apiUrl}/api/v1/certification/action`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-API-Key': this.apiKey,
					'X-User-Address': userAddress
				},
				body: JSON.stringify({
					action_type: request.actionType,
					delivery_receipt: request.deliveryReceipt,
					message_hash: request.messageHash,
					timestamp: request.timestamp,
					metadata: {
						recipient_email: request.recipientEmail,
						recipient_name: request.recipientName,
						subject: request.subject,
						...request.metadata
					}
				})
			});

			if (!response.ok) {
				const error = await response.text();
				console.error('[Certification] API error:', error);
				return {
					success: false,
					error: `Certification failed: ${response.status}`
				};
			}

			const data = await response.json();
			
			return {
				success: true,
				certificationHash: data.certification_hash,
				rewardAmount: data.reward_amount,
				reputationChange: data.reputation_change
			};

		} catch (error) {
			console.error('[Certification] Network error:', error);
			// Don't block delivery on certification failure
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Certification network error'
			};
		}
	}

	/**
	 * Check certification status
	 */
	async getStatus(certificationHash: string): Promise<any> {
		if (!this.enabled) {
			return null;
		}

		try {
			const response = await fetch(
				`${this.apiUrl}/api/v1/certification/status/${certificationHash}`,
				{
					headers: {
						'X-API-Key': this.apiKey
					}
				}
			);

			if (!response.ok) {
				return null;
			}

			return await response.json();
		} catch (error) {
			console.error('[Certification] Status check error:', error);
			return null;
		}
	}

	/**
	 * Submit delivery receipt for verification
	 */
	async submitReceipt(
		receipt: string,
		actionType: string,
		metadata?: any
	): Promise<{ verified: boolean; hash?: string }> {
		if (!this.enabled) {
			return { verified: false };
		}

		try {
			const response = await fetch(`${this.apiUrl}/api/v1/certification/receipt`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-API-Key': this.apiKey
				},
				body: JSON.stringify({
					receipt,
					action_type: actionType,
					metadata
				})
			});

			if (!response.ok) {
				return { verified: false };
			}

			const data = await response.json();
			return {
				verified: data.verified,
				hash: data.receipt_hash
			};

		} catch (error) {
			console.error('[Certification] Receipt submission error:', error);
			return { verified: false };
		}
	}
}

// Export singleton instance
export const certification = new CertificationService();

/**
 * Helper to generate message hash
 */
export function generateMessageHash(
	recipient: string,
	subject: string,
	body: string
): string {
	const content = `${recipient}:${subject}:${body}`;
	// Simple hash for now - in production use crypto
	let hash = 0;
	for (let i = 0; i < content.length; i++) {
		const char = content.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash;
	}
	return Math.abs(hash).toString(16).padStart(16, '0');
}