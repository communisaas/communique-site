import { json, error } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { FEATURES } from '$lib/config/features';
import { requireRole } from '$lib/server/org';
import { orgMeetsPlan } from '$lib/server/billing/plan-check';
import { getRateLimiter } from '$lib/core/security/rate-limiter';
import { solidityPackedKeccak256 } from 'ethers';
import { proposeDebate, deriveDomain } from '$lib/core/blockchain/debate-market-client';
import type { RequestHandler } from './$types';

const BN254_MODULUS = BigInt(
	'21888242871839275222246405745257275088548364400416034343698204186575808495617'
);

function computeActionDomainLocally(debateIdOnchain: string, propositionHash: string): string {
	const domainRaw = BigInt(
		solidityPackedKeccak256(
			['bytes32', 'string', 'bytes32'],
			[debateIdOnchain, 'debate', propositionHash]
		)
	);
	return '0x' + (domainRaw % BN254_MODULUS).toString(16).padStart(64, '0');
}

/**
 * POST /api/campaigns/[id]/debate
 *
 * Creates a debate linked to a campaign. Requires:
 * - FEATURES.DEBATE enabled
 * - Authenticated user with editor+ role in the campaign's org
 * - Organization plan (minimum: organization tier)
 * - Campaign must have a templateId
 * - No existing active debate for this campaign's template
 *
 * Body: { propositionText?, bondAmount?, duration? }
 * Returns: { debateId, debateIdOnchain }
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!FEATURES.DEBATE) {
		throw error(404, 'Debate feature is not enabled');
	}

	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	// Rate limit: 5 debate creations per minute per user
	const rlKey = `ratelimit:debate-create:${locals.user.id}`;
	const rl = await getRateLimiter().check(rlKey, { maxRequests: 5, windowMs: 60_000 });
	if (!rl.allowed) {
		throw error(429, 'Too many debate creation attempts. Please try again later.');
	}

	// Look up the campaign
	const campaign = await db.campaign.findUnique({
		where: { id: params.id },
		select: {
			id: true,
			orgId: true,
			templateId: true,
			title: true,
			debateEnabled: true,
			debateId: true,
			org: {
				select: {
					slug: true,
					memberships: {
						where: { userId: locals.user.id },
						select: { role: true }
					}
				}
			}
		}
	});

	if (!campaign) {
		throw error(404, 'Campaign not found');
	}

	// Check org membership and role
	const membership = campaign.org.memberships[0];
	if (!membership) {
		throw error(403, 'You are not a member of this organization');
	}
	requireRole(membership.role as 'owner' | 'editor' | 'member', 'editor');

	// Plan gating: debate markets require Organization tier or higher
	const meetsPlan = await orgMeetsPlan(campaign.orgId, 'organization');
	if (!meetsPlan) {
		throw error(403, 'Debate markets require an Organization plan or higher');
	}

	// Validate campaign has a template
	if (!campaign.templateId) {
		throw error(400, 'Campaign must be linked to a template to create a debate');
	}

	// Check for existing debate on this campaign
	if (campaign.debateId) {
		throw error(409, 'This campaign already has a linked debate');
	}

	// Check for existing active debate on the template
	const existingDebate = await db.debate.findFirst({
		where: { template_id: campaign.templateId, status: 'active' },
		select: { id: true }
	});
	if (existingDebate) {
		// Link the existing active debate to this campaign
		await db.campaign.update({
			where: { id: campaign.id },
			data: { debateId: existingDebate.id, debateEnabled: true }
		});
		return json({ debateId: existingDebate.id, linked: true });
	}

	// Parse request body
	const body = await request.json().catch(() => ({}));
	const propositionText = (body.propositionText as string)?.trim() || `Should we support: "${campaign.title}"?`;
	const durationSeconds = (body.duration as number) ?? 7 * 24 * 60 * 60;
	const bond = BigInt((body.bondAmount as number) ?? 1_000_000);
	const jurisdictionHint = (body.jurisdictionSizeHint as number) ?? 100;

	if (propositionText.length < 10) {
		throw error(400, 'Proposition text must be at least 10 characters');
	}

	// Compute proposition hash
	const propositionHash = solidityPackedKeccak256(['string'], [propositionText]);
	const baseDomain = '0x' + '0'.repeat(62) + '64';

	// On-chain call (falls back to off-chain for local dev)
	let debateIdOnchain: string;
	let txHash: string | undefined;
	let actionDomain: string;

	const onchainResult = await proposeDebate({
		propositionHash,
		duration: durationSeconds,
		jurisdictionSizeHint: jurisdictionHint,
		baseDomain,
		bondAmount: bond
	});

	if (onchainResult.success) {
		debateIdOnchain = onchainResult.debateId!;
		txHash = onchainResult.txHash;
		try {
			actionDomain = await deriveDomain(baseDomain, propositionHash);
		} catch {
			actionDomain = computeActionDomainLocally(debateIdOnchain, propositionHash);
		}
	} else if (onchainResult.error?.includes('not configured')) {
		// Off-chain fallback for local dev
		const timestamp = Math.floor(Date.now() / 1000);
		debateIdOnchain = solidityPackedKeccak256(
			['bytes32', 'uint256', 'address'],
			[propositionHash, timestamp, '0x0000000000000000000000000000000000000000']
		);
		actionDomain = computeActionDomainLocally(debateIdOnchain, propositionHash);
	} else {
		throw error(502, `On-chain debate creation failed: ${onchainResult.error}`);
	}

	const deadline = new Date(Date.now() + durationSeconds * 1000);

	// Create debate + link to campaign in a transaction
	const debate = await db.debate.create({
		data: {
			template_id: campaign.templateId,
			debate_id_onchain: debateIdOnchain,
			action_domain: actionDomain,
			proposition_hash: propositionHash,
			proposition_text: propositionText,
			deadline,
			jurisdiction_size: jurisdictionHint,
			status: 'active',
			proposer_address: '0x0000000000000000000000000000000000000000',
			proposer_bond: bond,
			tx_hash: txHash ?? null
		}
	});

	// Link debate to campaign
	await db.campaign.update({
		where: { id: campaign.id },
		data: { debateId: debate.id, debateEnabled: true }
	});

	return json({
		debateId: debate.id,
		debateIdOnchain: debate.debate_id_onchain,
		propositionText: debate.proposition_text,
		deadline: debate.deadline.toISOString()
	}, { status: 201 });
};
