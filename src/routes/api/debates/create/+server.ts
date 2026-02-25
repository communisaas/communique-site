import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/core/db';
import { solidityPackedKeccak256 } from 'ethers';

/**
 * POST /api/debates/create
 *
 * Creates a new debate for a template. Requires Tier 3+ user.
 *
 * Body: { templateId, propositionText, bondAmount, duration? }
 * Returns: { debateId, debateIdOnchain, actionDomain }
 *
 * NOTE: In production, this calls DebateMarket.proposeDebate() on-chain.
 * Currently stores off-chain only for frontend development.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	// Check authentication
	const session = locals.session;
	if (!session?.userId) {
		throw error(401, 'Authentication required');
	}

	const user = locals.user;
	if (!user || (user.trust_tier ?? 0) < 3) {
		throw error(403, 'Tier 3+ verification required to create debates');
	}

	const body = await request.json();
	const { templateId, propositionText, bondAmount, duration } = body;

	if (!templateId || typeof templateId !== 'string') {
		throw error(400, 'templateId is required');
	}
	if (!propositionText || typeof propositionText !== 'string' || propositionText.length < 10) {
		throw error(400, 'propositionText must be at least 10 characters');
	}

	// Verify template exists
	const template = await prisma.template.findUnique({
		where: { id: templateId },
		select: { id: true, slug: true }
	});
	if (!template) {
		throw error(404, 'Template not found');
	}

	// Check for existing active debate
	const existingDebate = await prisma.debate.findFirst({
		where: { template_id: templateId, status: 'active' },
		select: { id: true }
	});
	if (existingDebate) {
		throw error(409, 'An active debate already exists for this template');
	}

	// Compute proposition hash
	const propositionHash = solidityPackedKeccak256(['string'], [propositionText]);

	// Generate debate ID (mirrors on-chain: keccak256(propositionHash, actionDomain, timestamp, sender))
	const timestamp = Math.floor(Date.now() / 1000);
	const debateIdOnchain = solidityPackedKeccak256(
		['bytes32', 'uint256', 'address'],
		[propositionHash, timestamp, '0x0000000000000000000000000000000000000000']
	);

	// Compute action domain (placeholder — in production, derived on-chain via DebateMarket.deriveDomain)
	const BN254_MODULUS = BigInt(
		'21888242871839275222246405745257275088548364400416034343698204186575808495617'
	);
	const domainRaw = BigInt(
		solidityPackedKeccak256(['bytes32', 'string', 'bytes32'], [debateIdOnchain, 'debate', propositionHash])
	);
	const actionDomain = '0x' + (domainRaw % BN254_MODULUS).toString(16).padStart(64, '0');

	// Default deadline: 7 days from now
	const durationMs = (duration ?? 7 * 24 * 60 * 60) * 1000;
	const deadline = new Date(Date.now() + durationMs);

	// Create debate record
	const debate = await prisma.debate.create({
		data: {
			template_id: templateId,
			debate_id_onchain: debateIdOnchain,
			action_domain: actionDomain,
			proposition_hash: propositionHash,
			proposition_text: propositionText,
			deadline,
			jurisdiction_size: 0,
			status: 'active',
			proposer_address: '0x0000000000000000000000000000000000000000', // Placeholder
			proposer_bond: BigInt(bondAmount ?? 1_000_000)
		}
	});

	return json({
		debateId: debate.id,
		debateIdOnchain: debate.debate_id_onchain,
		actionDomain: debate.action_domain,
		propositionHash: debate.proposition_hash,
		deadline: debate.deadline.toISOString()
	});
};
