/**
 * Org Template Seed — Generative
 *
 * Drives org-scoped vibes through the full agent pipeline:
 *   subject line → decision makers → message → moderation → snapshot
 *
 * Produces seed-org-snapshot.json consumed by seed-phase2.ts for
 * deterministic re-seeding. Run once; commit the snapshot.
 *
 * Usage:
 *   npx tsx scripts/seed-org-templates.ts
 *
 * Required env vars:
 *   GEMINI_API_KEY   - Gemini API for all agents
 *   DATABASE_URL     - Database connection
 *
 * Optional env vars:
 *   GROQ_API_KEY     - Llama Guard moderation (skipped if absent)
 *   EXA_API_KEY      - Exa source discovery (falls back to Google grounding)
 */

import 'dotenv/config';
import { createHash } from 'crypto';
import { writeFileSync } from 'fs';
import { join } from 'path';

import { generateSubjectLine } from '$lib/core/agents/agents/subject-line';
import { resolveDecisionMakers } from '$lib/core/agents/agents/decision-maker';
import { generateMessage } from '$lib/core/agents/agents/message-writer';
import { moderateTemplate } from '$lib/core/server/moderation/index';
import type { DecisionMaker } from '$lib/core/agents/types';
import type { ResolveContext } from '$lib/core/agents/providers/types';
import type { ProcessedDecisionMaker } from '$lib/types/template';

// ============================================================================
// ORG VIBES — each maps to a seeded org + campaign in seed-phase2.ts
// ============================================================================

interface OrgVibe {
	vibe: string;
	orgSlug: string;
	campaignId: string;
	fallbackCategory: string;
	countryCode: 'US' | 'CA';
	targetHint?: string;
	locationHint?: { state?: string; city?: string; displayName?: string };
}

const VIBES: OrgVibe[] = [
	{
		vibe: 'The Clean Energy Investment Act would create 2.1 million jobs and cut carbon emissions 40% by 2035. Every dollar invested returns $3.20 in economic activity. Congress needs to pass it now.',
		orgSlug: 'climate-action-now',
		campaignId: 'camp_clean_energy_2026',
		fallbackCategory: 'Energy',
		countryCode: 'US',
	},
	{
		vibe: 'Same-day voter registration increases turnout by 5-7%. Mail-in voting reduces cost per ballot by 40%. Twenty states still block both. The Voter Access Expansion Act fixes this.',
		orgSlug: 'voter-rights-coalition',
		campaignId: 'camp_voter_access_act',
		fallbackCategory: 'Voting Rights',
		countryCode: 'US',
	},
	{
		vibe: "San Francisco approved 82,000 housing units since 2015 but only built 29,000. Permitting takes 27 months average. The city's own data shows streamlining approvals would cut costs 18% and timelines in half.",
		orgSlug: 'local-first-sf',
		campaignId: 'camp_sf_housing',
		fallbackCategory: 'Housing',
		countryCode: 'US',
		locationHint: { city: 'San Francisco', state: 'CA', displayName: 'San Francisco, CA' },
	},
];

// ============================================================================
// SNAPSHOT SHAPE — full template + linkage metadata
// ============================================================================

interface OrgTemplateSnapshot {
	slug: string;
	orgSlug: string;
	campaignId: string;
	title: string;
	description: string;
	message_body: string;
	preview: string;
	category: string;
	topics: string[];
	type: string;
	deliveryMethod: string;
	country_code: string;
	sources: Array<{ num: number; title: string; url: string; type: string }>;
	research_log: string[];
	recipient_config: Record<string, unknown>;
	delivery_config: Record<string, unknown>;
	cwc_config: Record<string, unknown>;
	content_hash: string;
	scope: {
		scope_level: string;
		country_code: string;
		region_code: string | null;
		locality_code: string | null;
		display_text: string;
	} | null;
	jurisdiction: {
		jurisdiction_type: string;
		state_code: string | null;
	} | null;
}

// ============================================================================
// HELPERS
// ============================================================================

function contentHash(title: string, body: string): string {
	return createHash('sha256').update(`${title}\0${body}`).digest('hex').slice(0, 40);
}

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
	geoScope?: { type: string; locality?: string }
): string {
	if (countryCode === 'US' && targetType === 'government') {
		if (!geoScope || geoScope.type === 'nationwide' || geoScope.type === 'international') {
			return 'cwc';
		}
		if (geoScope.type === 'subnational' && geoScope.locality) {
			return 'email';
		}
		return 'cwc';
	}
	return 'email';
}

function buildRecipientConfig(
	decisionMakers: ProcessedDecisionMaker[],
	deliveryMethod: string
): Record<string, unknown> {
	const emails = decisionMakers
		.map((dm) => dm.email)
		.filter((e): e is string => typeof e === 'string' && e.length > 0);

	if (deliveryMethod === 'cwc') {
		return {
			reach: 'district-based',
			cwcRouting: true,
			chambers: ['house', 'senate'],
			decisionMakers,
			emails,
		};
	}
	return {
		reach: 'location-specific',
		decisionMakers,
		emails,
	};
}

// ============================================================================
// PIPELINE — process one org vibe through all agents
// ============================================================================

async function processVibe(
	vibeData: OrgVibe,
	index: number
): Promise<OrgTemplateSnapshot | null> {
	const { vibe, orgSlug, campaignId, fallbackCategory, countryCode, targetHint, locationHint } =
		vibeData;

	console.log(`\n${'='.repeat(60)}`);
	console.log(`ORG VIBE ${index + 1}/${VIBES.length}: ${orgSlug}`);
	console.log(`  "${vibe.substring(0, 70)}..."`);
	console.log('='.repeat(60));

	// ── Step 1: Subject Line ────────────────────────────────────
	console.log('\n[1/4] Generating subject line...');
	let subjectResult;
	try {
		subjectResult = await generateSubjectLine({ description: vibe });
	} catch (err) {
		console.error('  FAILED:', err instanceof Error ? err.message : err);
		return null;
	}

	if (subjectResult.data.needs_clarification || !subjectResult.data.subject_line) {
		try {
			subjectResult = await generateSubjectLine({
				description: `Write an advocacy template about: ${vibe}. Generate the subject line directly.`,
				previousInteractionId: subjectResult.interactionId,
			});
		} catch (err) {
			console.error('  FAILED on retry:', err instanceof Error ? err.message : err);
			return null;
		}
	}

	const title = subjectResult.data.subject_line || vibe.substring(0, 60);
	const coreMessage = subjectResult.data.core_message || vibe;
	const topics = subjectResult.data.topics || [fallbackCategory];
	const urlSlug = subjectResult.data.url_slug || generateSlug(title);
	const voiceSample = subjectResult.data.voice_sample || '';
	const inferredContext = subjectResult.data.inferred_context;

	console.log(`  Title: "${title}"`);
	console.log(`  Slug: ${urlSlug}`);

	// ── Step 2: Decision Makers ─────────────────────────────────
	console.log('\n[2/4] Resolving decision makers...');

	const resolveContext: ResolveContext = {
		targetType: targetHint || inferredContext?.detected_target_type || 'government',
		subjectLine: title,
		coreMessage,
		topics,
		voiceSample,
	};

	if (locationHint) {
		resolveContext.geographicScope = {
			country: countryCode,
			state: locationHint.state,
			city: locationHint.city,
			displayName: locationHint.displayName,
		};
	} else if (inferredContext?.detected_location) {
		const scope = inferredContext.detected_scope;
		if (scope === 'local' || scope === 'state') {
			resolveContext.geographicScope = {
				country: countryCode,
				state: inferredContext.detected_location,
				displayName: inferredContext.detected_location,
			};
		}
	}

	let dmResult;
	try {
		dmResult = await resolveDecisionMakers(resolveContext, (segment) => {
			if (segment.type === 'candidate-resolved') {
				console.log(`  Resolved: ${segment.content}`);
			}
		});
	} catch (err) {
		console.error('  FAILED:', err instanceof Error ? err.message : err);
		return null;
	}

	const decisionMakersForMessage: DecisionMaker[] = dmResult.decisionMakers.map((dm) => ({
		name: dm.name,
		title: dm.title || '',
		organization: dm.organization || '',
		email: dm.email || '',
		reasoning: dm.reasoning || '',
		sourceUrl: dm.source || dm.source_url || '',
		emailSource: dm.emailSource || '',
		emailGrounded: dm.emailGrounded ?? false,
		confidence: dm.confidence ?? 0.5,
		contactChannel: 'email',
	}));

	console.log(`  Found ${dmResult.decisionMakers.length} decision maker(s)`);

	// ── Step 3: Message Generation ──────────────────────────────
	console.log('\n[3/4] Generating message...');

	let messageResult;
	try {
		messageResult = await generateMessage({
			subjectLine: title,
			coreMessage,
			topics,
			decisionMakers: decisionMakersForMessage,
			voiceSample,
			rawInput: vibe,
			onPhase: (phase, msg) => {
				console.log(`  [${phase}] ${msg}`);
			},
		});
	} catch (err) {
		console.error('  FAILED:', err instanceof Error ? err.message : err);
		return null;
	}

	console.log(`  Message: ${messageResult.message.length} chars, ${messageResult.sources.length} sources`);

	// ── Step 4: Moderation ──────────────────────────────────────
	console.log('\n[4/4] Running moderation...');

	let moderationResult;
	try {
		moderationResult = await moderateTemplate({ title, message_body: messageResult.message });
	} catch (err) {
		console.error('  Moderation error (non-fatal):', err instanceof Error ? err.message : err);
		moderationResult = { approved: true, summary: 'moderation_error (fail-open)' };
	}

	console.log(`  Result: ${moderationResult.approved ? 'APPROVED' : 'REJECTED'}`);

	// ── Build snapshot ──────────────────────────────────────────
	const geoScope = messageResult.geographic_scope;
	const targetType = targetHint || inferredContext?.detected_target_type || 'government';
	const deliveryMethod = inferDeliveryMethod(targetType, countryCode, geoScope);
	const recipientConfig = buildRecipientConfig(dmResult.decisionMakers, deliveryMethod);

	const slug = urlSlug || generateSlug(title);

	let scope: OrgTemplateSnapshot['scope'] = null;
	if (geoScope && geoScope.type !== 'international') {
		const scopeLevel =
			geoScope.type === 'nationwide'
				? 'country'
				: 'subdivision' in geoScope && (geoScope as Record<string, unknown>).locality
					? 'locality'
					: 'region';
		scope = {
			scope_level: scopeLevel,
			country_code:
				('country' in geoScope ? (geoScope as Record<string, string>).country : countryCode) ||
				countryCode,
			region_code:
				'subdivision' in geoScope
					? ((geoScope as Record<string, string | null>).subdivision ?? null)
					: null,
			locality_code:
				'locality' in geoScope
					? ((geoScope as Record<string, string | null>).locality ?? null)
					: null,
			display_text:
				('displayName' in geoScope
					? (geoScope as Record<string, string>).displayName
					: null) || geoScope.type,
		};
	}

	const jurisdictionType =
		inferredContext?.detected_scope === 'local'
			? 'city'
			: inferredContext?.detected_scope === 'state'
				? 'state'
				: 'federal';

	const snapshot: OrgTemplateSnapshot = {
		slug,
		orgSlug,
		campaignId,
		title,
		description: coreMessage,
		message_body: messageResult.message,
		preview: messageResult.message.substring(0, 200),
		category: fallbackCategory,
		topics,
		type: 'advocacy',
		deliveryMethod,
		country_code: countryCode,
		sources: messageResult.sources,
		research_log: messageResult.research_log || [],
		recipient_config: recipientConfig,
		delivery_config:
			deliveryMethod === 'cwc'
				? { timing: 'immediate', followUp: true, cwcEnabled: true }
				: { timing: 'immediate', followUp: false, cwcEnabled: false },
		cwc_config:
			deliveryMethod === 'cwc'
				? { topic: topics[0] || fallbackCategory, urgency: 'high', policy_area: fallbackCategory }
				: {},
		content_hash: contentHash(title, messageResult.message),
		scope,
		jurisdiction: {
			jurisdiction_type: jurisdictionType,
			state_code:
				geoScope && 'subdivision' in geoScope
					? ((geoScope as Record<string, string | null>).subdivision ?? null)
					: null,
		},
	};

	console.log(`  DONE: "${title}" (${slug})`);
	return snapshot;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
	console.log('\n' + '='.repeat(60));
	console.log('ORG TEMPLATE SEED — GENERATIVE');
	console.log(`Processing ${VIBES.length} org vibes`);
	console.log('='.repeat(60));

	if (!process.env.GEMINI_API_KEY) {
		console.error('\nFATAL: GEMINI_API_KEY is required.');
		process.exit(1);
	}

	if (!process.env.GROQ_API_KEY) {
		console.log('\nNote: GROQ_API_KEY not set. Moderation will be skipped.');
	}

	const snapshots: OrgTemplateSnapshot[] = [];
	let successCount = 0;

	for (let i = 0; i < VIBES.length; i++) {
		try {
			const result = await processVibe(VIBES[i], i);
			if (result) {
				snapshots.push(result);
				successCount++;
			}
		} catch (err) {
			console.error(`\nVibe ${i + 1} crashed:`, err);
		}

		if (i < VIBES.length - 1) {
			console.log('\n  Waiting 5s for rate limits...');
			await sleep(5000);
		}
	}

	// Write snapshot
	if (snapshots.length > 0) {
		const snapshotPath = join(import.meta.dirname ?? '.', 'seed-org-snapshot.json');
		const snapshotData = Object.fromEntries(snapshots.map((s) => [s.orgSlug, s]));
		writeFileSync(snapshotPath, JSON.stringify(snapshotData, null, '\t') + '\n');
		console.log(`\nSnapshot: ${snapshotPath} (${snapshots.length} org templates)`);
	}

	console.log('\n' + '='.repeat(60));
	console.log('ORG TEMPLATE SEED COMPLETE');
	console.log(`  ${successCount}/${VIBES.length} succeeded`);
	console.log('='.repeat(60));
}

main();
