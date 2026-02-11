import type {
	LegislativeAdapter,
	DeliveryRequest,
	DeliveryResult,
	Address as _Address,
	LegislativeUser,
	LegislativeTemplate
} from '../adapters/base';
import type { Representative as _Representative } from '../models';

type Representative = _Representative;
import { adapterRegistry } from '../adapters/registry';
import {
	trackTemplateAdoption,
	getUserContributionMetrics
} from '$lib/core/reputation/adoption-tracker';
import crypto from 'crypto';
// Note: Using internal variable resolution for now
// import { resolveVariables } from '$lib/services/personalization';

export interface DeliveryJob {
	id: string;
	template: LegislativeTemplate;
	user: LegislativeUser;
	target_country?: string;
	custom_message?: string;
	created_at: Date;
}

export interface DeliveryJobResult {
	job_id: string;
	total_recipients: number;
	successful_deliveries: number;
	failed_deliveries: number;
	results: DeliveryResult[];
	duration_ms: number;
}

export class LegislativeDeliveryPipeline {
	async deliverToRepresentatives(job: DeliveryJob): Promise<DeliveryJobResult> {
		const startTime = Date.now();
		const results: DeliveryResult[] = [];

		try {
			// 1. Determine target country
			const country_code = job.target_country || job.user.address?.country_code || 'US';

			// 2. Get appropriate adapter
			const adapter = await adapterRegistry.getAdapter(country_code);
			if (!adapter) {
				return {
					job_id: job.id,
					total_recipients: 0,
					successful_deliveries: 0,
					failed_deliveries: 1,
					results: [
						{
							success: false,
							error: `No legislative adapter available for country: ${country_code}`
						}
					],
					duration_ms: Date.now() - startTime
				};
			}

			// 3. Look up representatives
			const representatives = await this.lookupRepresentatives(adapter, job.user);
			if (representatives.length === 0) {
				return {
					job_id: job.id,
					total_recipients: 0,
					successful_deliveries: 0,
					failed_deliveries: 1,
					results: [
						{
							success: false,
							error: 'No representatives found for user address'
						}
					],
					duration_ms: Date.now() - startTime
				};
			}

			// 4. Deliver to each _representative
			for (const rep of representatives) {
				const office = this.createOfficeFromRepresentative(rep, country_code);
				const _personalizedMessage = this.personalizeMessage(
					job.template,
					job.user,
					rep,
					job.custom_message
				);

				const request: DeliveryRequest = {
					template: job.template,
					user: job.user,
					_representative: rep,
					office,
					personalized_message: _personalizedMessage
				};

				const result = await adapter.deliverMessage(request);
				results.push(result);

				// Track template adoption on successful delivery (Phase 1 reputation)
				if (result.success && job.user.id && job.template.id) {
					try {
						// Generate district hash from representative ID (privacy-preserving)
						const districtIdentifier = rep.id || 'unknown';
						const districtHash = crypto
							.createHash('sha256')
							.update(districtIdentifier)
							.digest('hex');

						// Get user's current reputation score
						const userMetrics = await getUserContributionMetrics(job.user.id);
						const reputationScore = this.calculateUserReputationScore(userMetrics);

						// Track adoption (updates template metrics and creator reputation)
						await trackTemplateAdoption({
							templateId: job.template.id,
							userId: job.user.id,
							districtHash,
							reputationScore,
							content: _personalizedMessage,
							subject: job.template.title,
							deliveryMethod: 'cwc'
						});
					} catch (trackingError) {
						// Don't fail delivery if tracking fails - just log
						console.error('Failed to track template adoption:', trackingError);
					}
				}
			}

			const successful = results.filter((r) => r.success).length;
			const failed = results.length - successful;

			return {
				job_id: job.id,
				total_recipients: representatives.length,
				successful_deliveries: successful,
				failed_deliveries: failed,
				results,
				duration_ms: Date.now() - startTime
			};
		} catch (error) {
			return {
				job_id: job.id,
				total_recipients: 0,
				successful_deliveries: 0,
				failed_deliveries: 1,
				results: [
					{
						success: false,
						error: error instanceof Error ? error.message : 'Pipeline delivery failed'
					}
				],
				duration_ms: Date.now() - startTime
			};
		}
	}

	private async lookupRepresentatives(
		adapter: LegislativeAdapter,
		user: LegislativeUser
	): Promise<_Representative[]> {
		if (!user.address) return [];

		const representatives = await adapter.lookupRepresentativesByAddress(user.address);

		// Validate representatives are current
		const validatedReps = [];
		for (const rep of representatives) {
			const isValid = await adapter.validateRepresentative(rep);
			if (isValid) {
				validatedReps.push(rep);
			}
		}

		return validatedReps;
	}

	private createOfficeFromRepresentative(rep: _Representative, country_code: string) {
		return {
			id: rep.office_id,
			jurisdiction_id: `${country_code.toLowerCase()}-federal`,
			role: rep.office_id.includes('senate') ? 'senator' : '_representative',
			title: rep.office_id.includes('senate') ? 'Senator' : 'Representative',
			chamber: rep.office_id.includes('senate') ? 'senate' : 'house',
			level: 'national' as const,
			contact_methods: [],
			is_active: rep.is_current
		};
	}

	private personalizeMessage(
		template: LegislativeTemplate,
		user: LegislativeUser,
		rep: _Representative,
		customMessage?: string
	): string {
		// Use custom message or template body
		const baseMessage = customMessage || template.message_body;

		// Replace [Personal Connection] placeholder if it exists
		const messageWithCustom = customMessage
			? baseMessage.replace(/\[Personal Connection\]/g, customMessage)
			: baseMessage;

		// Apply basic variable resolution (will be enhanced later)
		return this.basicVariableResolution(messageWithCustom, user, rep);
	}

	private basicVariableResolution(
		text: string,
		user: LegislativeUser,
		rep: Representative
	): string {
		return text
			.replace(/\[user\.name\]/g, user.name || 'Constituent')
			.replace(/\[user\.first_name\]/g, (user.name || '').split(' ')[0] || 'Constituent')
			.replace(/\[_representative\.name\]/g, rep.name)
			.replace(/\[_representative\.title\]/g, rep.name) // Will be enhanced
			.replace(/\[Name\]/g, user.name || 'Constituent') // Legacy support
			.replace(/\[Representative Name\]/g, rep.name); // Legacy support
	}

	/**
	 * Calculate user's reputation score from concrete signals (Phase 1)
	 *
	 * Formula per PHASE-1-REPUTATION-IMPLEMENTATION.md:
	 * - Template adoption: min(adoption_rate * 5, 25) [max 25 points]
	 * - Peer endorsements: min(endorsements * 2, 15) [max 15 points]
	 * - Civic velocity: min(active_months * 2, 10) [max 10 points]
	 * - Template creation: min(templates_contributed * 2, 10) [max 10 points]
	 */
	private calculateUserReputationScore(metrics: {
		template_adoption_rate: number;
		peer_endorsements: number;
		active_months: number;
		templates_contributed: number;
	}): number {
		const templateSignal = Math.min(metrics.template_adoption_rate * 5, 25);
		const endorsementSignal = Math.min(metrics.peer_endorsements * 2, 15);
		const velocitySignal = Math.min(metrics.active_months * 2, 10);
		const contributionSignal = Math.min(metrics.templates_contributed * 2, 10);

		return Math.round(templateSignal + endorsementSignal + velocitySignal + contributionSignal);
	}
}

export const deliveryPipeline = new LegislativeDeliveryPipeline();
