/**
 * VOTER Protocol Integration
 */

import axios, { type AxiosInstance } from 'axios';
import type { VOTERCertificationRequest, VOTERCertificationResult, VOTERActionType } from '../types/index.js';
import { getConfig } from '../utils/config.js';

export class VOTERClient {
	private client: AxiosInstance | null = null;
	private config = getConfig();
	private enabled: boolean;

	constructor() {
		this.enabled =
			this.config.features.enableVoterCertification &&
			!!this.config.api.voterUrl &&
			!!this.config.api.voterApiKey;

		if (this.enabled) {
			this.client = axios.create({
				baseURL: this.config.api.voterUrl,
				timeout: 30000,
				headers: {
					Authorization: `Bearer ${this.config.api.voterApiKey}`,
					'Content-Type': 'application/json',
					'User-Agent': 'Delivery-Platform/2.0'
				}
			});
		}
	}

	/**
	 * Certify email delivery through VOTER Protocol
	 */
	public async certifyDelivery(
		request: VOTERCertificationRequest
	): Promise<VOTERCertificationResult | null> {
		if (!this.isEnabled()) {
			console.log('[VOTER] Certification disabled, skipping');
			return null;
		}

		try {
			console.log(`[VOTER] Certifying delivery for template ${request.templateData.id}`);

			const actionType = this.determineActionType(request.templateData);

			const payload = {
				user_address: request.userProfile.id, // Using user ID as address proxy
				action_type: actionType,
				action_data: {
					message: request.templateData.message_body,
					subject: request.templateData.subject || request.templateData.title,
					representative: request.templateData.deliveryMethod,
					template_id: request.templateData.id,
					user_email: request.userProfile.email,
					user_name: request.userProfile.name,
					zip_code: request.userProfile.zip,
					cwc_submission_id: request.cwcResult.submissionId,
					cwc_receipt_hash: request.cwcResult.receiptHash,
					recipients: request.recipients
				}
			};

			const response = await this.client!.post<{
				certification_hash: string;
				reward_amount: number;
				user_address?: string;
				action_type: string;
				timestamp: string;
			}>('/api/certify', payload);

			return {
				certificationHash: response.data.certification_hash,
				rewardAmount: response.data.reward_amount,
				userAddress: response.data.user_address,
				actionType: response.data.action_type,
				timestamp: new Date(response.data.timestamp)
			};
		} catch (error) {
			console.error('[VOTER] Certification failed:', error);
			return null;
		}
	}

	/**
	 * Get advanced consensus for high-severity templates
	 */
	public async getAdvancedConsensus(
		verificationId: string,
		templateData: Record<string, unknown>,
		severityLevel: number,
		existingVotes?: Record<string, Record<string, unknown>>
	): Promise<{
		consensusScore: number;
		approved: boolean;
		agentVotes: Record<
			string,
			{
				approved: boolean;
				confidence: number;
				reasoning?: string;
			}
		>;
		diversityScore: number;
		recommendation: string;
	} | null> {
		if (!this.isEnabled()) {
			return null;
		}

		try {
			const response = await this.client!.post<{
				consensus_score: number;
				approved: boolean;
				agent_votes: Record<
					string,
					{
						approved: boolean;
						confidence: number;
						reasoning?: string;
					}
				>;
				diversity_score: number;
				recommendation: string;
			}>('/api/consensus', {
				verification_id: verificationId,
				template_data: templateData,
				severity_level: severityLevel,
				existing_votes: existingVotes || {}
			});

			return {
				consensusScore: response.data.consensus_score,
				approved: response.data.approved,
				agentVotes: response.data.agent_votes,
				diversityScore: response.data.diversity_score,
				recommendation: response.data.recommendation
			};
		} catch (error) {
			console.error('[VOTER] Advanced consensus failed:', error);
			return null;
		}
	}

	/**
	 * Calculate quadratic reputation
	 */
	public async calculateReputation(
		userAddress: string,
		verificationId: string,
		consensusResult: Record<string, unknown>,
		templateQuality: number
	): Promise<{
		reputationDelta: number;
		totalReputation: number;
		tierChange?: string;
		explanation: string;
	} | null> {
		if (!this.isEnabled()) {
			return null;
		}

		try {
			const response = await this.client!.post<{
				reputation_delta: number;
				total_reputation: number;
				tier_change?: string;
				explanation: string;
			}>('/api/reputation', {
				user_address: userAddress,
				verification_id: verificationId,
				consensus_result: consensusResult,
				template_quality: templateQuality
			});

			return {
				reputationDelta: response.data.reputation_delta,
				totalReputation: response.data.total_reputation,
				tierChange: response.data.tier_change,
				explanation: response.data.explanation
			};
		} catch (error) {
			console.error('[VOTER] Reputation calculation failed:', error);
			return null;
		}
	}

	/**
	 * Get VOTER Protocol services status
	 */
	public async getServicesStatus(): Promise<{
		consensus: boolean;
		reputation: boolean;
		certification: boolean;
	}> {
		if (!this.isEnabled()) {
			return {
				consensus: false,
				reputation: false,
				certification: false
			};
		}

		try {
			const response = await this.client!.get<{
				services: {
					consensus: { available: boolean };
					reputation: { available: boolean };
					certification: { available: boolean };
				};
			}>('/api/services');

			return {
				consensus: response.data.services.consensus.available,
				reputation: response.data.services.reputation.available,
				certification: response.data.services.certification.available
			};
		} catch (error) {
			console.error('[VOTER] Failed to get services status:', error);
			return {
				consensus: false,
				reputation: false,
				certification: false
			};
		}
	}

	/**
	 * Health check
	 */
	public async healthCheck(): Promise<boolean> {
		if (!this.isEnabled()) {
			return false;
		}

		try {
			const response = await this.client!.get<{ status: string }>('/health');
			return response.data.status === 'ok';
		} catch (error) {
			console.error('[VOTER] Health check failed:', error);
			return false;
		}
	}

	/**
	 * Check if VOTER Protocol is enabled and configured
	 */
	public isEnabled(): boolean {
		return this.enabled && this.client !== null;
	}

	/**
	 * Determine VOTER action type based on template data
	 */
	private determineActionType(templateData: {
		title?: string;
		id: string;
		deliveryMethod: string;
	}): VOTERActionType {
		const title = (templateData.title || '').toLowerCase();
		const id = (templateData.id || '').toLowerCase();
		const method = (templateData.deliveryMethod || '').toLowerCase();

		// Check for congressional messaging
		if (
			method === 'certified' ||
			title.includes('congress') ||
			title.includes('representative') ||
			title.includes('senator')
		) {
			return 'cwc_message';
		}

		// Check for community outreach
		if (title.includes('community') || title.includes('outreach') || title.includes('advocacy')) {
			return 'community_outreach';
		}

		// Check for civic engagement
		if (title.includes('civic') || title.includes('democracy') || title.includes('voting')) {
			return 'civic_engagement';
		}

		// Default to template creation
		return 'template_creation';
	}
}
