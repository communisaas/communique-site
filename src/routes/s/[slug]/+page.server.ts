import type { PageServerLoad } from './$types';
import { prisma } from '$lib/core/db';

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
				debate = {
					id: dbDebate.id,
					debateIdOnchain: dbDebate.debate_id_onchain,
					templateId: dbDebate.template_id,
					propositionText: dbDebate.proposition_text,
					propositionHash: dbDebate.proposition_hash,
					actionDomain: dbDebate.action_domain,
					deadline: dbDebate.deadline.toISOString(),
					jurisdictionSize: dbDebate.jurisdiction_size,
					status: dbDebate.status as 'active' | 'resolved',
					argumentCount: dbDebate.argument_count,
					uniqueParticipants: dbDebate.unique_participants,
					totalStake: dbDebate.total_stake.toString(),
					winningArgumentIndex: dbDebate.winning_argument_index,
					winningStance: dbDebate.winning_stance,
					resolvedAt: dbDebate.resolved_at?.toISOString(),
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
						createdAt: arg.created_at.toISOString()
					}))
				};
			}
		} catch {
			// Non-critical — template page works without debate data
		}
	}

	return {
		user: locals.user,
		template: parentData.template,
		channel: parentData.channel,
		totalDistricts,
		totalStates: totalStates || 50, // Fallback
		userDistrictCount,
		userDistrictCode,
		debate
	};
};
