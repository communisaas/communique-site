import type { PageServerLoad } from './$types';
import type { AIResolutionData, ArgumentAIScore } from '$lib/stores/debateState.svelte';
import { prisma } from '$lib/core/db';
import { getPositionCounts } from '$lib/services/positionService';
import { parseRecipientConfig } from '$lib/types/template';
import { getOfficials } from '$lib/core/shadow-atlas/client';
import type { DistrictOfficialInput } from '$lib/utils/landscapeMerge';

/**
 * Transform Prisma debate row into store-compatible AIResolutionData.
 */
function buildAIResolution(
	dbDebate: {
		ai_resolution: unknown;
		ai_signature_count: number | null;
		ai_panel_consensus: number | null;
		resolution_method: string | null;
		appeal_deadline: Date | null;
		governance_justification: string | null;
		arguments: Array<{
			argument_index: number;
			ai_scores: unknown;
			ai_weighted: number | null;
			final_score: number | null;
			model_agreement: number | null;
			weighted_score: unknown;
		}>;
	}
): AIResolutionData {
	const blob = (dbDebate.ai_resolution ?? {}) as Record<string, unknown>;
	const models = (blob.models ?? []) as Array<unknown>;

	const argumentScores: ArgumentAIScore[] = dbDebate.arguments
		.filter((a) => a.ai_scores != null)
		.map((a) => {
			const dims = (a.ai_scores ?? {}) as Record<string, number>;
			return {
				argumentIndex: a.argument_index,
				dimensions: {
					reasoning: dims.reasoning ?? 0,
					accuracy: dims.accuracy ?? 0,
					evidence: dims.evidence ?? 0,
					constructiveness: dims.constructiveness ?? 0,
					feasibility: dims.feasibility ?? 0
				},
				weightedAIScore: a.ai_weighted ?? 0,
				communityScore: Number(a.weighted_score ?? 0),
				finalScore: a.final_score ?? 0,
				modelAgreement: a.model_agreement ?? 0
			};
		});

	return {
		argumentScores,
		alphaWeight: 4000,
		modelCount: models.length || 5,
		signatureCount: dbDebate.ai_signature_count ?? 0,
		quorumRequired: 4,
		resolutionMethod: (dbDebate.resolution_method as AIResolutionData['resolutionMethod']) ?? 'ai_community',
		evaluatedAt: (blob.evaluatedAt as string) ?? undefined,
		appealDeadline: dbDebate.appeal_deadline?.toISOString(),
		hasAppeal: false,
		governanceJustification: dbDebate.governance_justification ?? undefined
	};
}

export const load: PageServerLoad = async ({ locals, parent }) => {
	// Get template and channel data from parent layout
	const parentData = await parent();

	// Load district-level aggregates for social proof (privacy-preserving)
	// NOTE: Messages are pseudonymous - we aggregate by district_hash (SHA-256), not user linkage
	let totalDistricts = 0;
	let totalStates = 0;
	let userDistrictCount = 0;
	let userDistrictCode: string | null = null;

	if (parentData.template?.id) {
		try {
			// Aggregate messages by district hash (privacy-preserving - no user tracking)
			const messages = await prisma.message.findMany({
				where: {
					template_id: parentData.template.id,
					delivery_status: 'delivered'
				},
				select: {
					district_hash: true
				}
			});

			// Count by district hash (privacy-preserving aggregate)
			const districtCounts = messages.reduce(
				(acc, msg) => {
					const districtHash = msg.district_hash;
					if (districtHash) {
						acc[districtHash] = (acc[districtHash] || 0) + 1;
					}
					return acc;
				},
				{} as Record<string, number>
			);

			totalDistricts = Object.keys(districtCounts).length;

			// Personalized "in YOUR district" — only for authenticated users with district_hash
			const userDistrictHash = locals.user?.district_hash;
			if (userDistrictHash && districtCounts[userDistrictHash]) {
				userDistrictCount = districtCounts[userDistrictHash];
			}
		} catch (error) {
			console.error('Error loading district aggregates:', error);
		}

		// Resolve user's district code for human-readable display
		if (locals.user?.id && locals.user?.district_hash) {
			try {
				const userRep = await prisma.user_representatives.findFirst({
					where: { user_id: locals.user.id, is_active: true },
					select: { representative_id: true }
				});
				if (userRep) {
					const rep = await prisma.representative.findUnique({
						where: { id: userRep.representative_id },
						select: { state: true, district: true }
					});
					if (rep?.state && rep?.district) {
						userDistrictCode = `${rep.state}-${rep.district}`;
					}
				}
			} catch {
				// Non-critical — proceed without district code
			}
		}

		// Estimate total states from representative data (one-time aggregate, not user-linked)
		try {
			const stateResult = await prisma.representative.findMany({
				where: { is_active: true },
				select: { state: true },
				distinct: ['state']
			});
			totalStates = stateResult.length;
		} catch {
			// Non-critical
		}
	}

	// Load active debate for this template (if any)
	let debate = null;
	if (parentData.template?.id) {
		try {
			const dbDebate = await prisma.debate.findFirst({
				where: { template_id: parentData.template.id },
				orderBy: [{ status: 'asc' }, { created_at: 'desc' }],
				include: {
					arguments: { orderBy: { weighted_score: 'desc' } }
				}
			});

			if (dbDebate) {
				const aiResolution = dbDebate.ai_resolution
					? buildAIResolution(dbDebate)
					: undefined;

				debate = {
					id: dbDebate.id,
					debateIdOnchain: dbDebate.debate_id_onchain,
					templateId: dbDebate.template_id,
					propositionText: dbDebate.proposition_text,
					propositionHash: dbDebate.proposition_hash,
					actionDomain: dbDebate.action_domain,
					deadline: dbDebate.deadline.toISOString(),
					jurisdictionSize: dbDebate.jurisdiction_size,
					status: dbDebate.status as
						| 'active'
						| 'resolving'
						| 'resolved'
						| 'awaiting_governance'
						| 'under_appeal',
					argumentCount: dbDebate.argument_count,
					uniqueParticipants: dbDebate.unique_participants,
					totalStake: dbDebate.total_stake.toString(),
					winningArgumentIndex: dbDebate.winning_argument_index,
					winningStance: dbDebate.winning_stance,
					resolvedAt: dbDebate.resolved_at?.toISOString(),
					aiResolution,
					arguments: dbDebate.arguments.map((arg) => ({
						id: arg.id,
						argumentIndex: arg.argument_index,
						stance: arg.stance,
						body: arg.body,
						amendmentText: arg.amendment_text,
						stakeAmount: arg.stake_amount.toString(),
						engagementTier: arg.engagement_tier,
						weightedScore: arg.weighted_score.toString(),
						totalStake: arg.total_stake.toString(),
						coSignCount: arg.co_sign_count,
						createdAt: arg.created_at.toISOString(),
						aiScore: arg.ai_scores as Record<string, number> | undefined,
						weightedAIScore: arg.ai_weighted ?? undefined,
						finalScore: arg.final_score ?? undefined,
						modelAgreement: arg.model_agreement ?? undefined
					}))
				};
			}
		} catch {
			// Non-critical — template page works without debate data
		}
	}

	// === Power Landscape: position counts, existing registration, district officials ===

	// Position counts (public, no auth needed)
	let positionCounts = { support: 0, oppose: 0, districts: 0 };
	if (parentData.template?.id) {
		try {
			positionCounts = await getPositionCounts(parentData.template.id);
		} catch {
			// Non-critical — page works without counts
		}
	}

	// Check if user already registered a position (state restoration for returning users)
	let existingPosition: { stance: string; registrationId: string } | null = null;
	if (parentData.template?.id && locals.user) {
		const ic = locals.user.identity_commitment ?? `demo-${locals.user.id}`;
		try {
			const reg = await prisma.positionRegistration.findUnique({
				where: {
					template_id_identity_commitment: {
						template_id: parentData.template.id,
						identity_commitment: ic
					}
				},
				select: { id: true, stance: true }
			});
			if (reg) {
				existingPosition = { stance: reg.stance, registrationId: reg.id };
			}
		} catch {
			// Non-critical
		}
	}

	// Restore sent recipients from delivery records
	let deliveredRecipients: string[] = [];
	if (existingPosition) {
		try {
			const deliveries = await prisma.positionDelivery.findMany({
				where: { registration_id: existingPosition.registrationId },
				select: { recipient_name: true }
			});
			deliveredRecipients = deliveries.map((d) => d.recipient_name);
		} catch {
			// Non-critical
		}
	}

	// District officials from Shadow Atlas — full data for delivery routing
	let districtOfficials: DistrictOfficialInput[] = [];
	if (userDistrictCode) {
		try {
			const data = await getOfficials(userDistrictCode);
			districtOfficials = (data.officials || []).map((o) => ({
				name: o.name || '',
				title: o.office || (o.chamber === 'senate' ? 'Senator' : 'Representative'),
				organization: o.party
					? `${o.chamber === 'senate' ? 'US Senate' : 'US House'} · ${o.party}`
					: '',
				bioguideId: o.bioguide_id ?? null,
				cwcCode: o.cwc_code ?? null,
				chamber: o.chamber ?? null,
				phone: o.phone ?? null,
				contactFormUrl: o.contact_form_url ?? null,
				websiteUrl: o.website_url ?? null
			}));
		} catch {
			// Non-critical — SA may not be running
		}
	}

	// Parse typed recipient_config from template JSON
	const recipientConfig = parentData.template
		? parseRecipientConfig(parentData.template.recipient_config)
		: {};

	return {
		user: locals.user,
		template: parentData.template,
		channel: parentData.channel,
		totalDistricts,
		totalStates: totalStates || 50, // Fallback
		userDistrictCount,
		userDistrictCode,
		debate,
		// Power Landscape data
		positionCounts,
		existingPosition,
		deliveredRecipients,
		districtOfficials,
		recipientConfig
	};
};
