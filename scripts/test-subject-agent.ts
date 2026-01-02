/**
 * Quick test for subject-line agent
 * Run: npx tsx scripts/test-subject-agent.ts
 */

import { config } from 'dotenv';
config();

import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
	console.error('Missing GEMINI_API_KEY in .env');
	process.exit(1);
}

const SUBJECT_LINE_SCHEMA = {
	type: 'object',
	properties: {
		subject_line: { type: 'string', description: 'Compelling subject line (max 80 chars)' },
		core_issue: { type: 'string', description: 'One-sentence distillation of the core problem' },
		topics: {
			type: 'array',
			items: { type: 'string' },
			minItems: 1,
			maxItems: 5,
			description: 'Topic clusters (1-5 lowercase tags)'
		},
		url_slug: { type: 'string', description: 'URL-safe slug (lowercase, hyphens, 2-4 words)' },
		voice_sample: {
			type: 'string',
			description:
				'The most visceral phrase from input - the emotional peak (1-2 sentences, verbatim or near-verbatim)'
		}
	},
	required: ['subject_line', 'core_issue', 'topics', 'url_slug', 'voice_sample']
};

// Import the optimized prompt
const SUBJECT_LINE_PROMPT = `You distill power structure accountability issues into viral subject lines.

## Subject Lines (max 80 chars)

BAD → GOOD:
- "Issues with Amazon workplace conditions" → "Amazon Drivers Pissing in Bottles While Bezos Makes $2.5M/Hour"
- "Corporate malfeasance in logistics" → "FedEx Threatening Drivers Who Report Heat Exhaustion"
- "A major tech company exploiting workers" → "Meta Layoffs While Zuckerberg Gets $29B Richer"
- "Housing affordability crisis" → "Your Landlord Gets Tax Breaks While You Pay 60% of Income on Rent"
- "Hospital billing practices need reform" → "Hospital Billing $50 for Tylenol Your Insurance Won't Cover"

Pattern: Name actors. Show the contrast. Make power imbalance visceral.

## Core Issue

One sentence: structural problem → who has power → who is harmed.
- "Workers lack safety protections while executives extract record profits"
- "Tenants subsidize landlord wealth through tax policy designed for investors"

## Topics (1-5 lowercase tags)

Vocabulary:
- Worker: wages, safety, unions, gig-workers, warehouse, retail
- Housing: rent, eviction, landlords, housing, zoning
- Healthcare: insurance, hospitals, pharma, medical-billing
- Environment: climate, pollution, water, energy
- Tech: privacy, surveillance, big-tech, ai, data
- Education: student-debt, universities, teachers
- Government: congress, local-gov, elections, lobbying
- Finance: banking, taxes, wall-street, predatory-lending
- Civil rights: voting-rights, police, immigration

Examples:
- "Amazon Drivers Pissing in Bottles..." → ["warehouse", "safety", "wages", "amazon"]
- "Hospital Billing $50 for Tylenol..." → ["hospitals", "insurance", "medical-billing"]
- "Your Landlord Gets Tax Breaks..." → ["rent", "housing", "taxes", "landlords"]

## URL Slug (2-4 words, memorable)

BAD → GOOD:
- "amazon-worker-safety" → "piss-bottle-prime"
- "housing-affordability-crisis" → "landlord-tax-scam"
- "hospital-billing-reform" → "50-dollar-tylenol"

Pattern: Capture the most visceral detail. The thing that makes someone stop scrolling.

CRITICAL: Slugs must be lowercase, hyphens only, and UNIQUE—not generic policy terms.

## Voice Sample

Extract the emotional peak from the input—the sentence or phrase that carries the most visceral charge. This will flow to downstream agents so the final message channels the original voice.

Look for:
- Personal stakes ("my mom", "my family", "I was denied")
- Specific outrages (dollar amounts, percentages, named villains)
- Moral clarity (the moment where injustice crystallizes)

Keep it verbatim or near-verbatim. 1-2 sentences max. This is the carrier wave.`;

async function test() {
	// SF housing 28-day policy issue
	const testIssue = `sf has this annoying 28-day policy for people in need of housing and this convoluted conversion to tenancy makes it hard for property owners trying to solve the housing crisis and for the people themselves in need of the fucking housing`;

	console.log('Testing subject-line agent with new issue...\n');
	console.log('Input:');
	console.log(testIssue);
	console.log('\n' + '='.repeat(60) + '\n');

	const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

	try {
		const response = await ai.models.generateContent({
			model: 'gemini-2.5-flash',
			contents: `Analyze this issue and generate a subject line:\n\n${testIssue}`,
			config: {
				temperature: 0.4,
				systemInstruction: SUBJECT_LINE_PROMPT,
				responseMimeType: 'application/json',
				responseSchema: SUBJECT_LINE_SCHEMA
			}
		});

		const output = response.text;

		if (output) {
			const parsed = JSON.parse(output);
			console.log('Result:\n');
			console.log(`  subject_line: "${parsed.subject_line}"`);
			console.log(`  core_issue:   "${parsed.core_issue}"`);
			console.log(`  topics:       ${JSON.stringify(parsed.topics)}`);
			console.log(`  url_slug:     "${parsed.url_slug}"`);
			console.log(`  voice_sample: "${parsed.voice_sample}"`);

			console.log('\n' + '='.repeat(60));
			console.log('\nValidation:');
			console.log(`  ✓ Subject line: ${parsed.subject_line.length} chars (max 80)`);
			console.log(
				`  ✓ Topics: ${parsed.topics.length} tags, all lowercase: ${parsed.topics.every((t: string) => t === t.toLowerCase())}`
			);
			console.log(`  ✓ Slug format: ${/^[a-z0-9-]+$/.test(parsed.url_slug) ? 'valid' : 'INVALID'}`);
			console.log(`  ✓ Voice sample: ${parsed.voice_sample ? 'present' : 'MISSING'}`);
		}
	} catch (error) {
		console.error('Error:', error);
	}
}

test();
