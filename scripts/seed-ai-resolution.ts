#!/usr/bin/env npx tsx
/**
 * Seed a debate with realistic AI resolution data for visual QA.
 *
 * Creates (or updates) a debate with 3 arguments, full AI dimension scores,
 * alpha-blended final scores, and model agreement data — everything needed
 * to render the ResolutionPanel without running the LLM evaluation pipeline.
 *
 * Also seeds a second template (no debate) to test the dormant deliberation surface.
 *
 * Usage:
 *   npx tsx scripts/seed-ai-resolution.ts [--status resolved|awaiting_governance|under_appeal]
 *
 * Requires: Prisma client generated, DATABASE_URL set.
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const status = process.argv.includes('--status')
	? process.argv[process.argv.indexOf('--status') + 1]
	: 'resolved';

const USER_ID = 'user-demo-1';
const DEBATE_TEMPLATE_ID = 'tpl-demo-1';
const DORMANT_TEMPLATE_ID = 'tpl-no-debate';
const DEBATE_ID = 'debate-ai-seed-001';

async function main() {
	console.log(`Seeding AI resolution debate (status: ${status})...`);

	// ── Demo user ──────────────────────────────────────────────
	await db.user.upsert({
		where: { id: USER_ID },
		update: {},
		create: {
			id: USER_ID,
			email: 'demo@communi.email',
			name: 'Demo User',
			is_verified: true,
			trust_score: 100,
			reputation_tier: 'verified',
			templates_contributed: 0,
			template_adoption_rate: 0,
			peer_endorsements: 0,
			active_months: 0
		}
	});

	// ── Template 1: Has a resolved debate ─────────────────────
	await db.template.upsert({
		where: { id: DEBATE_TEMPLATE_ID },
		update: {
			slug: 'algorithmic-transparency',
			title: 'Require Algorithmic Transparency for Social Media',
			description: 'Urge Congress to mandate that large platforms publish their recommendation algorithms for independent audit.',
			category: 'technology',
			is_public: true,
			deliveryMethod: 'email',
			status: 'active',
			preview: 'Tell your representative: require platforms with 50M+ users to publish recommendation algorithms as auditable open-source code.',
			message_body: [
				'Dear [Representative],',
				'',
				'I am writing to urge you to support legislation requiring social media platforms with more than 50 million users to publish their recommendation algorithms as auditable open-source code within 18 months.',
				'',
				'Invisible systems shape what information citizens see. Without transparency, there is no meaningful public oversight of the algorithmic forces driving our national discourse.',
				'',
				'Independent auditing, academic research, and public accountability depend on access to these systems — much like financial disclosure requirements enable market integrity.',
				'',
				'Sincerely,',
				'[Name]'
			].join('\n'),
			recipient_config: {
				targetType: 'body',
				targetBody: 'us_house',
				targetLevel: 'federal'
			}
		},
		create: {
			id: DEBATE_TEMPLATE_ID,
			slug: 'algorithmic-transparency',
			title: 'Require Algorithmic Transparency for Social Media',
			description: 'Urge Congress to mandate that large platforms publish their recommendation algorithms for independent audit.',
			category: 'technology',
			type: 'email',
			deliveryMethod: 'email',
			preview: 'Tell your representative: require platforms with 50M+ users to publish recommendation algorithms as auditable open-source code.',
			message_body: [
				'Dear [Representative],',
				'',
				'I am writing to urge you to support legislation requiring social media platforms with more than 50 million users to publish their recommendation algorithms as auditable open-source code within 18 months.',
				'',
				'Invisible systems shape what information citizens see. Without transparency, there is no meaningful public oversight of the algorithmic forces driving our national discourse.',
				'',
				'Independent auditing, academic research, and public accountability depend on access to these systems — much like financial disclosure requirements enable market integrity.',
				'',
				'Sincerely,',
				'[Name]'
			].join('\n'),
			delivery_config: {},
			recipient_config: {
				targetType: 'body',
				targetBody: 'us_house',
				targetLevel: 'federal'
			},
			metrics: { sent: 0, unique_senders: 0, engagement_rate: 0 },
			status: 'active',
			is_public: true,
			user: { connect: { id: USER_ID } }
		}
	});

	// ── Template 2: No debate (dormant deliberation surface) ──
	await db.template.upsert({
		where: { id: DORMANT_TEMPLATE_ID },
		update: {
			slug: 'rent-stabilization',
			title: 'Adopt Rent Stabilization to Prevent Displacement',
			description: 'Ask your city council to protect long-term residents from rent increases that force displacement.',
			category: 'housing',
			is_public: true,
			deliveryMethod: 'email',
			status: 'active',
			preview: 'Tell your city council: adopt rent stabilization measures to prevent displacement of long-term residents.',
			message_body: [
				'Dear [Council Member],',
				'',
				'I urge you to adopt rent stabilization measures that protect long-term residents from displacement.',
				'',
				'Rents in our city have risen 40% in five years while wages have grown less than 12%. Families who have lived here for decades are being forced out. Rent stabilization is not a radical measure — it is a recognition that housing is infrastructure, not a speculative asset.',
				'',
				'Please act before more of our neighbors are displaced.',
				'',
				'Sincerely,',
				'[Name]'
			].join('\n'),
			recipient_config: {
				targetType: 'body',
				targetBody: 'city_council',
				targetLevel: 'local'
			}
		},
		create: {
			id: DORMANT_TEMPLATE_ID,
			slug: 'rent-stabilization',
			title: 'Adopt Rent Stabilization to Prevent Displacement',
			description: 'Ask your city council to protect long-term residents from rent increases that force displacement.',
			category: 'housing',
			type: 'email',
			deliveryMethod: 'email',
			preview: 'Tell your city council: adopt rent stabilization measures to prevent displacement of long-term residents.',
			message_body: [
				'Dear [Council Member],',
				'',
				'I urge you to adopt rent stabilization measures that protect long-term residents from displacement.',
				'',
				'Rents in our city have risen 40% in five years while wages have grown less than 12%. Families who have lived here for decades are being forced out. Rent stabilization is not a radical measure — it is a recognition that housing is infrastructure, not a speculative asset.',
				'',
				'Please act before more of our neighbors are displaced.',
				'',
				'Sincerely,',
				'[Name]'
			].join('\n'),
			delivery_config: {},
			recipient_config: {
				targetType: 'body',
				targetBody: 'city_council',
				targetLevel: 'local'
			},
			metrics: { sent: 0, unique_senders: 0, engagement_rate: 0 },
			status: 'active',
			is_public: true,
			user: { connect: { id: USER_ID } }
		}
	});

	// ── Debate with AI resolution ─────────────────────────────
	const deadline = new Date(Date.now() - 86400_000);
	const resolvedAt = new Date(Date.now() - 3600_000);
	const appealDeadline = new Date(Date.now() + 7 * 86400_000);
	const DEBATE_ONCHAIN_ID = '0x' + 'ab'.repeat(32);

	const aiResolutionBlob = {
		scores: [
			{
				argumentIndex: 0,
				medianScores: { reasoning: 7200, accuracy: 6800, evidence: 7500, constructiveness: 8100, feasibility: 6500 },
				weightedScore: 7210,
				modelAgreement: 0.88
			},
			{
				argumentIndex: 1,
				medianScores: { reasoning: 8500, accuracy: 8200, evidence: 7800, constructiveness: 7600, feasibility: 7900 },
				weightedScore: 8180,
				modelAgreement: 0.92
			},
			{
				argumentIndex: 2,
				medianScores: { reasoning: 6100, accuracy: 5800, evidence: 6400, constructiveness: 6900, feasibility: 5500 },
				weightedScore: 6140,
				modelAgreement: 0.72
			}
		],
		models: [
			{ provider: 0, modelName: 'GPT-5 Nano', timestamp: Date.now() - 120000 },
			{ provider: 1, modelName: 'Gemini 3 Flash', timestamp: Date.now() - 115000 },
			{ provider: 2, modelName: 'DeepSeek V3.2', timestamp: Date.now() - 110000 },
			{ provider: 3, modelName: 'Mistral Large 3', timestamp: Date.now() - 105000 },
			{ provider: 4, modelName: 'Claude Haiku 4.5', timestamp: Date.now() - 100000 }
		],
		consensusAchieved: status === 'resolved',
		evaluatedAt: resolvedAt.toISOString(),
		submitTxHash: '0xabc123def456789012345678901234567890123456789012345678901234abcd',
		resolveTxHash: '0xdef456789012345678901234567890123456789012345678901234567890abcd',
		gasUsed: '2200522'
	};

	await db.debate.upsert({
		where: { id: DEBATE_ID },
		update: {
			status,
			winning_argument_index: status === 'resolved' ? 1 : null,
			winning_stance: status === 'resolved' ? 'AMEND' : null,
			resolved_at: status === 'resolved' ? resolvedAt : null,
			ai_resolution: aiResolutionBlob,
			ai_signature_count: 5,
			ai_panel_consensus: 0.84,
			resolution_method: status === 'awaiting_governance' ? 'governance_override' : 'ai_community',
			appeal_deadline: status === 'under_appeal' ? appealDeadline : null,
			governance_justification:
				status === 'awaiting_governance'
					? 'AI panel consensus (0.52) below threshold. Governance review required.'
					: null
		},
		create: {
			id: DEBATE_ID,
			template_id: DEBATE_TEMPLATE_ID,
			debate_id_onchain: DEBATE_ONCHAIN_ID,
			proposition_text:
				'Congress should mandate that all social media platforms with >50M users publish their recommendation algorithms as auditable open-source code within 18 months.',
			proposition_hash: '0x' + '1234'.repeat(16),
			action_domain: 'legislation.us.congress.118',
			proposer_address: '0x42aBe6E1fBf6436720bbCF9db8B0c115cF7650fF',
			proposer_bond: BigInt('1000000'),
			deadline,
			jurisdiction_size: 435,
			status,
			argument_count: 3,
			unique_participants: 3,
			total_stake: BigInt('3000000'),
			winning_argument_index: status === 'resolved' ? 1 : null,
			winning_stance: status === 'resolved' ? 'AMEND' : null,
			resolved_at: status === 'resolved' ? resolvedAt : null,
			ai_resolution: aiResolutionBlob,
			ai_signature_count: 5,
			ai_panel_consensus: 0.84,
			resolution_method: status === 'awaiting_governance' ? 'governance_override' : 'ai_community',
			appeal_deadline: status === 'under_appeal' ? appealDeadline : null,
			governance_justification:
				status === 'awaiting_governance'
					? 'AI panel consensus (0.52) below threshold. Governance review required.'
					: null
		}
	});

	// ── 3 arguments with AI scores ────────────────────────────
	const arguments_ = [
		{
			argument_index: 0,
			stance: 'SUPPORT',
			body: 'Algorithmic transparency is a democratic imperative. Citizens cannot meaningfully participate in public discourse when invisible systems shape what information they see. Open-source publication of recommendation algorithms would enable independent auditing, academic research, and public accountability — much like financial disclosure requirements enable market integrity.',
			amendment_text: null,
			stake_amount: BigInt('1000000'),
			engagement_tier: 3,
			weighted_score: 6800,
			ai_scores: { reasoning: 7200, accuracy: 6800, evidence: 7500, constructiveness: 8100, feasibility: 6500 },
			ai_weighted: 7210,
			final_score: 7084,
			model_agreement: 0.88
		},
		{
			argument_index: 1,
			stance: 'AMEND',
			body: 'Full open-source disclosure risks gaming and adversarial exploitation. Instead, mandate algorithmic auditing by independent, credentialed third parties (similar to financial auditing) with public summary reports. This achieves transparency goals while protecting against manipulation. Require quarterly audit cycles with 30-day public comment periods on methodology.',
			amendment_text:
				'Replace "publish as auditable open-source code" with "submit to quarterly independent algorithmic audits with published summary reports, conducted by NIST-accredited auditors."',
			stake_amount: BigInt('1200000'),
			engagement_tier: 4,
			weighted_score: 8000,
			ai_scores: { reasoning: 8500, accuracy: 8200, evidence: 7800, constructiveness: 7600, feasibility: 7900 },
			ai_weighted: 8180,
			final_score: 8072,
			model_agreement: 0.92
		},
		{
			argument_index: 2,
			stance: 'OPPOSE',
			body: 'This mandate would violate First Amendment protections of editorial discretion established in Miami Herald v. Tornillo. Recommendation algorithms are editorial judgment at scale — forcing their disclosure is compelled speech. Additionally, the 18-month timeline is technically infeasible given the complexity of modern ML systems with billions of parameters.',
			amendment_text: null,
			stake_amount: BigInt('800000'),
			engagement_tier: 3,
			weighted_score: 5500,
			ai_scores: { reasoning: 6100, accuracy: 5800, evidence: 6400, constructiveness: 6900, feasibility: 5500 },
			ai_weighted: 6140,
			final_score: 5756,
			model_agreement: 0.72
		}
	];

	for (const arg of arguments_) {
		const bodyHash = '0x' + Buffer.from(arg.body.slice(0, 32)).toString('hex').padEnd(64, '0');

		await db.debateArgument.upsert({
			where: {
				debate_id_argument_index: {
					debate_id: DEBATE_ID,
					argument_index: arg.argument_index
				}
			},
			update: {
				ai_scores: arg.ai_scores,
				ai_weighted: arg.ai_weighted,
				final_score: arg.final_score,
				model_agreement: arg.model_agreement,
				weighted_score: arg.weighted_score
			},
			create: {
				debate_id: DEBATE_ID,
				argument_index: arg.argument_index,
				stance: arg.stance,
				body: arg.body,
				body_hash: bodyHash,
				amendment_text: arg.amendment_text,
				amendment_hash: arg.amendment_text
					? '0x' + Buffer.from(arg.amendment_text.slice(0, 32)).toString('hex').padEnd(64, '0')
					: null,
				stake_amount: arg.stake_amount,
				engagement_tier: arg.engagement_tier,
				weighted_score: arg.weighted_score,
				total_stake: arg.stake_amount,
				co_sign_count: 0,
				ai_scores: arg.ai_scores,
				ai_weighted: arg.ai_weighted,
				final_score: arg.final_score,
				model_agreement: arg.model_agreement
			}
		});
	}

	console.log('');
	console.log('  Templates:');
	console.log(`    ${DEBATE_TEMPLATE_ID} → /s/algorithmic-transparency (has debate)`);
	console.log(`    ${DORMANT_TEMPLATE_ID} → /s/rent-stabilization (dormant deliberation)`);
	console.log('');
	console.log(`  Debate: ${DEBATE_ID} (status: ${status})`);
	console.log(`    Winner: arg[1] AMEND (final: 80.72%)`);
	console.log(`    Panel consensus: 84%, Signatures: 5/5`);
	console.log('');
	console.log('  Full debate: http://localhost:5173/s/algorithmic-transparency/debate/debate-ai-seed-001');
	console.log('');
	console.log('Done.');
}

main()
	.catch((err) => {
		console.error('FATAL:', err);
		process.exit(1);
	})
	.finally(() => db.$disconnect());
