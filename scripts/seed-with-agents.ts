/**
 * Agent-Powered Seed Script (v2)
 *
 * Feeds diverse "vibes" through the full agent pipeline:
 *   subject line → decision makers → message → moderation → DB save
 *
 * Covers US + Canada across federal, state/provincial, municipal, corporate,
 * and institutional power structures. After running, dump the resolved data
 * into seed-database.ts for API-key-free seeding.
 *
 * Usage:
 *   npx tsx scripts/seed-with-agents.ts
 *   VIBE_LIMIT=3 npx tsx scripts/seed-with-agents.ts   # first N vibes only
 *
 * Required env vars:
 *   GEMINI_API_KEY   - Gemini API for all agents
 *
 * Optional env vars:
 *   GROQ_API_KEY     - Llama Guard safety moderation (skipped if absent)
 *   EXA_API_KEY      - Exa source discovery (falls back to Google grounding)
 *   DATABASE_URL     - Database connection (defaults to local)
 *   VIBE_LIMIT       - Process only first N vibes (for testing)
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import type { InputJsonValue } from '@prisma/client/runtime/library';

// Agent pipeline imports — called directly, no HTTP server needed
// tsx resolves $lib via scripts/tsconfig.json paths; SvelteKit virtual modules
// ($app/environment, $env/dynamic/private) are shimmed by scripts/shims/
import { generateSubjectLine } from '$lib/core/agents/agents/subject-line';
import { resolveDecisionMakers } from '$lib/core/agents/agents/decision-maker';
import { generateMessage } from '$lib/core/agents/agents/message-writer';
import { moderateTemplate } from '$lib/core/server/moderation/index';
import type { DecisionMaker, GeoScope } from '$lib/core/agents/types';
import type { ResolveContext } from '$lib/core/agents/providers/types';

const db = new PrismaClient();

// ============================================================================
// VIBES — Raw user inputs that drive the pipeline
// ============================================================================

interface Vibe {
	vibe: string;
	fallbackCategory: string;
	countryCode: 'US' | 'CA';
	/** Hint for the DM resolver — what kind of power structure to target */
	targetHint?: string;
	/** Geographic hint for the DM resolver */
	locationHint?: { state?: string; city?: string; displayName?: string };
}

const VIBES: Vibe[] = [
	// ── US Federal ──────────────────────────────────────────────
	{
		vibe: "The VA's telehealth program served 2.4 million veterans last year and cut wait times by 40%. It works. Fund the expansion to every rural clinic in the country.",
		fallbackCategory: 'Healthcare',
		countryCode: 'US'
	},
	{
		vibe: "Kids spend 7 hours a day online. Companies harvest 72 million data points per child per year. Federal privacy law hasn't updated since 1998 — COPPA is older than the kids it's supposed to protect.",
		fallbackCategory: 'Digital Rights',
		countryCode: 'US'
	},

	// ── US State ────────────────────────────────────────────────
	{
		vibe: "Colorado's universal preschool program costs $322 million and saves families $336 million in childcare. Every dollar returns $4.30 in reduced remediation and lifetime earnings. Every state should replicate this.",
		fallbackCategory: 'Education',
		countryCode: 'US',
		locationHint: { state: 'CO', displayName: 'Colorado' }
	},
	{
		vibe: "Oregon's drug treatment courts cost $7,100 less per person than incarceration. Recidivism dropped 31%. Taxpayers save money, families stay together, outcomes improve across every metric.",
		fallbackCategory: 'Criminal Justice',
		countryCode: 'US',
		locationHint: { state: 'OR', displayName: 'Oregon' }
	},

	// ── US Municipal ────────────────────────────────────────────
	{
		vibe: "Portland approved 3D-printed homes at $160K each when traditional construction costs $450K. Austin's community land trusts created 1,200 permanently affordable homes. Why are most cities still banning both?",
		fallbackCategory: 'Housing',
		countryCode: 'US',
		locationHint: { city: 'Portland', state: 'OR', displayName: 'Portland, OR' }
	},
	{
		vibe: "When Seoul tore down a highway and restored the Cheonggyecheon stream, property values rose 25% and air quality improved 35%. Dallas, Rochester, and Syracuse are considering the same. Urban freeways are scars, not infrastructure.",
		fallbackCategory: 'Urban Development',
		countryCode: 'US'
	},

	// ── Canadian Federal ────────────────────────────────────────
	{
		vibe: "Canada's national parks generate $3.3 billion in visitor spending on a $900 million Parks Canada budget — a 3.6x return. But there's a $3.6 billion maintenance backlog. Investing in parks literally pays for itself.",
		fallbackCategory: 'Environment',
		countryCode: 'CA'
	},
	{
		vibe: "Express Entry processes skilled worker applications in 6 months. The US employment green card backlog is 1.8 million people deep — some wait 134 years. Canada proves fast, fair immigration processing is a policy choice.",
		fallbackCategory: 'Immigration',
		countryCode: 'CA'
	},

	// ── Canadian Provincial ─────────────────────────────────────
	{
		vibe: "Ontario public libraries run free coding bootcamps that have placed 2,400 people in tech jobs since 2022. No tuition, no debt, no waitlist — just a library card. Scale it province-wide.",
		fallbackCategory: 'Education',
		countryCode: 'CA',
		locationHint: { state: 'ON', displayName: 'Ontario' }
	},
	{
		vibe: "First Nations communities in BC generate 40% of the province's clean energy. They receive 3% of resource extraction revenue from their own territories. If reconciliation means anything, the revenue sharing has to match the contribution.",
		fallbackCategory: 'Indigenous Rights',
		countryCode: 'CA',
		locationHint: { state: 'BC', displayName: 'British Columbia' }
	},

	// ── Canadian Municipal ──────────────────────────────────────
	{
		vibe: "Montreal's BIXI bike-share program cut downtown car trips by 12% and saves $14 million per year in healthcare costs from reduced pollution. It costs the city $5 per resident per year.",
		fallbackCategory: 'Transportation',
		countryCode: 'CA',
		locationHint: { city: 'Montreal', state: 'QC', displayName: 'Montreal, QC' }
	},

	// ── Corporate ───────────────────────────────────────────────
	{
		vibe: "Apple holds $162 billion in cash reserves. Their retail employees start at $22/hour. Fifteen minutes of Apple's daily interest income equals one retail worker's entire annual salary.",
		fallbackCategory: 'Labor Rights',
		countryCode: 'US',
		targetHint: 'corporate'
	}
];

// ============================================================================
// SEED USERS
// ============================================================================

const seedUserData = [
	{
		id: 'user-seed-1',
		email: 'seed-1@communi.email',
		name: 'Alex Rivera',
		is_verified: true,
		verification_method: 'mdl',
		verified_at: new Date(),
		document_type: 'drivers_license',
		authority_level: 3,
		birth_year: 1992,
		trust_score: 85,
		reputation_tier: 'verified',
		location: 'Denver, CO',
		profile_completed_at: new Date(),
		profile_visibility: 'public',
		templates_contributed: 0,
		template_adoption_rate: 0.0,
		peer_endorsements: 0,
		active_months: 0
	},
	{
		id: 'user-seed-2',
		email: 'seed-2@communi.email',
		name: 'Jordan Chen',
		is_verified: true,
		verification_method: 'mdl',
		verified_at: new Date(),
		document_type: 'drivers_license',
		authority_level: 3,
		birth_year: 1988,
		trust_score: 72,
		reputation_tier: 'verified',
		location: 'Toronto, ON',
		profile_completed_at: new Date(),
		profile_visibility: 'public',
		templates_contributed: 0,
		template_adoption_rate: 0.0,
		peer_endorsements: 0,
		active_months: 0
	},
	{
		id: 'user-seed-3',
		email: 'seed-3@communi.email',
		name: 'Morgan Tremblay',
		is_verified: false,
		trust_score: 0,
		reputation_tier: 'novice',
		templates_contributed: 0,
		template_adoption_rate: 0.0,
		peer_endorsements: 0,
		active_months: 0
	}
];

// ============================================================================
// HELPERS
// ============================================================================

function generateSlug(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.substring(0, 50);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function inferDeliveryMethod(
	targetType: string | null | undefined,
	countryCode: string,
	geoScope?: GeoScope
): string {
	// CWC is US Congress only
	if (countryCode === 'US' && targetType === 'government') {
		if (!geoScope || geoScope.type === 'nationwide' || geoScope.type === 'international') {
			return 'cwc';
		}
		if (geoScope.type === 'subnational' && geoScope.locality) {
			return 'email';
		}
		// State-level without locality → could be CWC (federal) or email (state legislature)
		return 'cwc';
	}
	// Everything else → email
	return 'email';
}

function buildRecipientConfig(
	decisionMakers: DecisionMaker[],
	deliveryMethod: string
): Record<string, unknown> {
	if (deliveryMethod === 'cwc') {
		return {
			reach: 'district-based',
			cwcRouting: true,
			chambers: ['house', 'senate']
		};
	}

	return {
		reach: 'location-specific',
		decisionMakers: decisionMakers.map((dm) => ({
			name: dm.name,
			shortName: dm.name.split(' ').pop(),
			role: dm.title,
			organization: dm.organization,
			email: dm.email
		})),
		emails: decisionMakers.map((dm) => dm.email).filter(Boolean)
	};
}

// ============================================================================
// TEARDOWN — dependency order
// ============================================================================

async function teardownDatabase() {
	console.log('Starting complete database teardown...');

	const deletions = [
		{ name: 'agent_trace', fn: () => db.agentTrace.deleteMany({}) },
		{ name: 'submission_retry', fn: () => db.submissionRetry.deleteMany({}) },
		{ name: 'verification_audit', fn: () => db.verificationAudit.deleteMany({}) },
		{ name: 'shadow_atlas_registration', fn: () => db.shadowAtlasRegistration.deleteMany({}) },
		{ name: 'debate_argument', fn: () => db.debateArgument.deleteMany({}) },
		{ name: 'debate', fn: () => db.debate.deleteMany({}) },
		{ name: 'resolved_contact', fn: () => db.resolvedContact.deleteMany({}) },
		{ name: 'parsed_document_cache', fn: () => db.parsedDocumentCache.deleteMany({}) },
		{ name: 'intelligence', fn: () => db.intelligence.deleteMany({}) },
		{ name: 'rate_limit', fn: () => db.rateLimit.deleteMany({}) },
		{ name: 'district_credential', fn: () => db.districtCredential.deleteMany({}) },
		{ name: 'verification_session', fn: () => db.verificationSession.deleteMany({}) },
		{ name: 'submission', fn: () => db.submission.deleteMany({}) },
		{ name: 'encrypted_delivery_data', fn: () => db.encryptedDeliveryData.deleteMany({}) },
		{ name: 'privacy_budget', fn: () => db.privacy_budget.deleteMany({}) },
		{ name: 'analytics_snapshot', fn: () => db.analytics_snapshot.deleteMany({}) },
		{ name: 'analytics_aggregate', fn: () => db.analytics_aggregate.deleteMany({}) },
		{ name: 'user_representatives', fn: () => db.user_representatives.deleteMany({}) },
		{ name: 'representative', fn: () => db.representative.deleteMany({}) },
		{ name: 'legislative_channel', fn: () => db.legislative_channel.deleteMany({}) },
		{ name: 'template_campaign', fn: () => db.template_campaign.deleteMany({}) },
		{ name: 'template_jurisdiction', fn: () => db.templateJurisdiction.deleteMany({}) },
		{ name: 'template_scope', fn: () => db.templateScope.deleteMany({}) },
		{ name: 'message', fn: () => db.message.deleteMany({}) },
		{ name: 'template', fn: () => db.template.deleteMany({}) },
		{ name: 'session', fn: () => db.session.deleteMany({}) },
		{ name: 'account', fn: () => db.account.deleteMany({}) },
		{ name: 'user', fn: () => db.user.deleteMany({}) },
	];

	for (const { name, fn } of deletions) {
		try {
			const result = await fn();
			if (result.count > 0) {
				console.log(`  Deleted ${result.count} ${name} records`);
			}
		} catch {
			console.log(`  Skipped ${name} (table may not exist)`);
		}
	}

	console.log('Database teardown complete\n');
}

// ============================================================================
// MAIN PIPELINE — process one vibe through all agents
// ============================================================================

async function processVibe(
	vibeData: Vibe,
	userId: string,
	index: number
): Promise<{ success: boolean; templateId?: string }> {
	const { vibe, fallbackCategory, countryCode, targetHint, locationHint } = vibeData;

	console.log(`\n${'='.repeat(60)}`);
	console.log(`VIBE ${index + 1}/${VIBES.length}: "${vibe.substring(0, 70)}..."`);
	console.log(`  Country: ${countryCode} | Category: ${fallbackCategory}`);
	console.log('='.repeat(60));

	// ── Step 1: Subject Line Generation ──────────────────────────
	console.log('\n[1/5] Generating subject line...');
	let subjectResult;
	try {
		subjectResult = await generateSubjectLine({ description: vibe });
	} catch (err) {
		console.error('  FAILED:', err instanceof Error ? err.message : err);
		return { success: false };
	}

	const subjectData = subjectResult.data;

	if (subjectData.needs_clarification || !subjectData.subject_line) {
		console.log('  Agent asked for clarification, retrying with direct prompt...');
		try {
			subjectResult = await generateSubjectLine({
				description: `Write an advocacy template about: ${vibe}. This is a clear policy issue, generate the subject line directly.`,
				previousInteractionId: subjectResult.interactionId
			});
		} catch (err) {
			console.error('  FAILED on retry:', err instanceof Error ? err.message : err);
			return { success: false };
		}
	}

	const title = subjectResult.data.subject_line || vibe.substring(0, 60);
	const coreMessage = subjectResult.data.core_message || vibe;
	const topics = subjectResult.data.topics || [fallbackCategory];
	const urlSlug = subjectResult.data.url_slug || generateSlug(title);
	const voiceSample = subjectResult.data.voice_sample || '';
	const inferredContext = subjectResult.data.inferred_context;

	console.log(`  Title: "${title}"`);
	console.log(`  Core: "${coreMessage.substring(0, 80)}..."`);
	console.log(`  Topics: [${topics.join(', ')}]`);
	console.log(`  Slug: ${urlSlug}`);

	// ── Step 2: Decision Maker Resolution ────────────────────────
	console.log('\n[2/5] Resolving decision makers...');

	const targetType =
		targetHint || inferredContext?.detected_target_type || 'government';
	const resolveContext: ResolveContext = {
		targetType,
		subjectLine: title,
		coreMessage,
		topics,
		voiceSample
	};

	// Build geographic scope
	if (locationHint) {
		resolveContext.geographicScope = {
			country: countryCode,
			state: locationHint.state,
			city: locationHint.city,
			displayName: locationHint.displayName
		};
	} else if (inferredContext?.detected_location) {
		const scope = inferredContext.detected_scope;
		if (scope === 'local' || scope === 'state') {
			resolveContext.geographicScope = {
				country: countryCode,
				state: inferredContext.detected_location,
				displayName: inferredContext.detected_location
			};
		}
	}

	let dmResult;
	try {
		dmResult = await resolveDecisionMakers(resolveContext, (segment) => {
			if (segment.type === 'identity-found') {
				console.log(`  Found: ${segment.content}`);
			} else if (segment.type === 'candidate-resolved') {
				console.log(`  Resolved: ${segment.content}`);
			}
		});
	} catch (err) {
		console.error('  FAILED:', err instanceof Error ? err.message : err);
		return { success: false };
	}

	const decisionMakers: DecisionMaker[] = dmResult.decisionMakers.map((dm) => ({
		name: dm.name,
		title: dm.title || '',
		organization: dm.organization || '',
		email: dm.email || '',
		reasoning: dm.reasoning || '',
		sourceUrl: dm.source_url || dm.source || '',
		emailSource: dm.emailSource || '',
		emailGrounded: dm.emailGrounded ?? false,
		confidence: dm.confidence ?? 0.5,
		contactChannel: 'email'
	}));

	console.log(`  Found ${decisionMakers.length} decision maker(s)`);
	for (const dm of decisionMakers) {
		console.log(`    - ${dm.name} (${dm.title}, ${dm.organization}) <${dm.email}>`);
	}

	// ── Step 3: Message Generation ───────────────────────────────
	console.log('\n[3/5] Generating message...');

	let messageResult;
	try {
		messageResult = await generateMessage({
			subjectLine: title,
			coreMessage,
			topics,
			decisionMakers,
			voiceSample,
			rawInput: vibe,
			onPhase: (phase, msg) => {
				console.log(`  [${phase}] ${msg}`);
			}
		});
	} catch (err) {
		console.error('  FAILED:', err instanceof Error ? err.message : err);
		return { success: false };
	}

	console.log(`  Message length: ${messageResult.message.length} chars`);
	console.log(`  Sources: ${messageResult.sources.length}`);
	for (const src of messageResult.sources) {
		console.log(`    [${src.num}] ${src.title} (${src.type})`);
	}

	// ── Step 4: Moderation ───────────────────────────────────────
	console.log('\n[4/5] Running moderation...');

	let moderationResult;
	try {
		moderationResult = await moderateTemplate({
			title,
			message_body: messageResult.message,
			category: fallbackCategory
		});
	} catch (err) {
		console.error(
			'  Moderation error (non-fatal):',
			err instanceof Error ? err.message : err
		);
		moderationResult = { approved: false, summary: 'moderation_error' };
	}

	const approved = moderationResult.approved;
	console.log(`  Result: ${approved ? 'APPROVED' : 'REJECTED'} (${moderationResult.summary})`);

	// ── Step 5: Database Save ────────────────────────────────────
	console.log('\n[5/5] Saving to database...');

	const geoScope = messageResult.geographic_scope;
	const deliveryMethod = inferDeliveryMethod(targetType, countryCode, geoScope);
	const recipientConfig = buildRecipientConfig(decisionMakers, deliveryMethod);

	const slug = urlSlug || generateSlug(title);
	const existingSlug = await db.template.findFirst({ where: { slug } });
	const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug;

	const template = await db.template.create({
		data: {
			title,
			slug: finalSlug,
			description: coreMessage,
			message_body: messageResult.message,
			sources: (messageResult.sources || []) as unknown as InputJsonValue,
			research_log: (messageResult.research_log || []) as unknown as InputJsonValue,
			category: fallbackCategory,
			topics: topics as unknown as InputJsonValue,
			type: 'advocacy',
			deliveryMethod,
			preview: messageResult.message.substring(0, 200),
			delivery_config: (deliveryMethod === 'cwc'
				? { timing: 'immediate', followUp: true, cwcEnabled: true }
				: { timing: 'immediate', followUp: false, cwcEnabled: false }) as InputJsonValue,
			cwc_config: (deliveryMethod === 'cwc'
				? {
						topic: topics[0] || fallbackCategory,
						urgency: 'high',
						policy_area: fallbackCategory
					}
				: {}) as InputJsonValue,
			recipient_config: recipientConfig as InputJsonValue,
			metrics: {
				sent: 0,
				opened: 0,
				clicked: 0,
				responded: 0,
				districts_covered: 0,
				total_districts: countryCode === 'CA' ? 338 : 435,
				district_coverage_percent: 0
			} as InputJsonValue,
			status: approved ? 'published' : 'draft',
			is_public: approved,
			verification_status: approved ? 'approved' : 'pending',
			consensus_approved: approved,
			country_code: countryCode,
			reputation_applied: false,
			verified_sends: 0,
			unique_districts: 0,
			reputation_delta: 0,
			user: { connect: { id: userId } }
		}
	});

	console.log(`  Created template: ${template.id} (/${finalSlug})`);

	// Create TemplateScope if geographic scope exists
	if (geoScope && geoScope.type !== 'international') {
		try {
			const scopeLevel =
				geoScope.type === 'nationwide'
					? 'country'
					: 'subdivision' in geoScope && geoScope.locality
						? 'locality'
						: 'region';

			await db.templateScope.create({
				data: {
					template_id: template.id,
					country_code: ('country' in geoScope ? geoScope.country : countryCode) || countryCode,
					region_code: 'subdivision' in geoScope ? (geoScope.subdivision ?? null) : null,
					locality_code: 'locality' in geoScope ? (geoScope.locality ?? null) : null,
					display_text:
						('displayName' in geoScope ? geoScope.displayName : null) || geoScope.type,
					scope_level: scopeLevel,
					confidence: 1.0,
					extraction_method: 'gemini_inline'
				}
			});
			console.log(`  Created TemplateScope (${scopeLevel})`);
		} catch (err) {
			console.error(
				'  TemplateScope creation failed (non-fatal):',
				err instanceof Error ? err.message : err
			);
		}
	}

	// Create TemplateJurisdiction
	try {
		const jurisdictionType =
			inferredContext?.detected_scope === 'local'
				? 'city'
				: inferredContext?.detected_scope === 'state'
					? 'state'
					: 'federal';

		await db.templateJurisdiction.create({
			data: {
				template_id: template.id,
				jurisdiction_type: jurisdictionType,
				state_code:
					geoScope && 'subdivision' in geoScope ? (geoScope.subdivision ?? null) : null
			}
		});
		console.log(`  Created TemplateJurisdiction (${jurisdictionType})`);
	} catch (err) {
		console.error(
			'  TemplateJurisdiction creation failed (non-fatal):',
			err instanceof Error ? err.message : err
		);
	}

	console.log(`  DONE: "${title}" saved as ${approved ? 'published' : 'draft'}`);
	return { success: true, templateId: template.id };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
	console.log('\n' + '='.repeat(60));
	console.log('AGENT-POWERED SEED v2');
	console.log(`Processing ${VIBES.length} vibes (US + Canada) through the agent pipeline`);
	console.log('='.repeat(60));

	if (!process.env.GEMINI_API_KEY) {
		console.error('\nFATAL: GEMINI_API_KEY is required.');
		console.error('Set it in .env or pass it directly:');
		console.error('  GEMINI_API_KEY=your-key npx tsx scripts/seed-with-agents.ts');
		process.exit(1);
	}

	if (!process.env.GROQ_API_KEY) {
		console.log('\nNote: GROQ_API_KEY not set. Llama Guard safety moderation will be skipped.');
	}

	try {
		await teardownDatabase();

		// Create seed users
		console.log('Seeding users...');
		const createdUsers = [];
		for (const userData of seedUserData) {
			const user = await db.user.create({ data: userData });
			createdUsers.push(user);
			console.log(`  Created: "${userData.name}" (${userData.email})`);
		}

		// Process each vibe
		let successCount = 0;
		let failCount = 0;
		const vibeLimit = parseInt(process.env.VIBE_LIMIT || '0') || VIBES.length;

		for (let i = 0; i < Math.min(vibeLimit, VIBES.length); i++) {
			const vibeData = VIBES[i];
			// Assign US vibes to user 1, CA vibes to user 2, overflow to user 3
			const userIndex = vibeData.countryCode === 'US' ? 0 : vibeData.countryCode === 'CA' ? 1 : 2;
			const userId = createdUsers[userIndex % createdUsers.length].id;

			try {
				const result = await processVibe(vibeData, userId, i);
				if (result.success) {
					successCount++;
				} else {
					failCount++;
				}
			} catch (err) {
				console.error(`\nVibe ${i + 1} crashed:`, err);
				failCount++;
			}

			// Rate limit between vibes (skip after last)
			if (i < Math.min(vibeLimit, VIBES.length) - 1) {
				console.log('\n  Waiting 5s for rate limits...');
				await sleep(5000);
			}
		}

		// Summary
		const counts = {
			users: await db.user.count(),
			templates: await db.template.count(),
			published: await db.template.count({ where: { status: 'published' } }),
			drafts: await db.template.count({ where: { status: 'draft' } })
		};

		console.log('\n' + '='.repeat(60));
		console.log('SEED COMPLETE');
		console.log('='.repeat(60));
		console.log(`Users:      ${counts.users}`);
		console.log(`Templates:  ${counts.templates} (${counts.published} published, ${counts.drafts} drafts)`);
		console.log(`Pipeline:   ${successCount} succeeded, ${failCount} failed`);
		console.log('='.repeat(60));
		console.log('\nNext: dump resolved data into seed-database.ts, then add debates on top.');
	} catch (error) {
		console.error('\nFATAL:', error);
		process.exit(1);
	} finally {
		await db.$disconnect();
	}
}

main();
