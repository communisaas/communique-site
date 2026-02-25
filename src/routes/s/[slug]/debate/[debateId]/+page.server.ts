import type { PageServerLoad } from './$types';
import { prisma } from '$lib/core/db';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals, parent }) => {
	const { debateId } = params;
	const parentData = await parent();

	// Load specific debate by ID
	const dbDebate = await prisma.debate.findUnique({
		where: { id: debateId },
		include: {
			arguments: { orderBy: { weighted_score: 'desc' } }
		}
	});

	if (!dbDebate) {
		throw error(404, 'Debate not found');
	}

	// Verify this debate belongs to this template
	if (parentData.template && dbDebate.template_id !== parentData.template.id) {
		throw error(404, 'Debate not found for this template');
	}

	const debate = {
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

	return {
		user: locals.user,
		template: parentData.template,
		channel: parentData.channel,
		debate
	};
};
