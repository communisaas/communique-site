/**
 * Congressional Delegation Alignment API
 *
 * POST /api/congress/alignment/delegation - Get alignment for full delegation
 *
 * Returns alignment scores for a user's representative and both senators
 * based on their address (state + district).
 *
 * Request Body:
 * {
 *   state: "CA",
 *   district: 12,
 *   positions: [
 *     { topic: "healthcare", stance: "support" },
 *     { topic: "climate", stance: "support" }
 *   ]
 * }
 *
 * Response: { representative?: AlignmentResult, senators: AlignmentResult[] }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rateLimiter } from '$lib/server/rate-limiter';
import {
	getDelegationAlignment,
	type PolicyPosition,
	TOPIC_KEYWORDS
} from '$lib/server/congress/alignment';

interface DelegationRequest {
	state: string;
	district: number;
	positions: PolicyPosition[];
}

// Valid US state codes
const VALID_STATES = new Set([
	'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
	'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
	'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
	'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
	'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
	'DC', 'PR', 'GU', 'VI', 'AS', 'MP' // Territories
]);

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	// Rate limiting: 10 requests per minute (heavy endpoint)
	const clientIp = getClientAddress();
	const rateLimitResult = await rateLimiter.limit(`delegation-alignment:${clientIp}`, 10, 60 * 1000);

	if (!rateLimitResult.success) {
		return json(
			{
				error: 'Rate limit exceeded',
				retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
			},
			{
				status: 429,
				headers: {
					'Retry-After': String(Math.ceil((rateLimitResult.reset - Date.now()) / 1000))
				}
			}
		);
	}

	// Parse request body
	let body: DelegationRequest;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	// Validate state
	if (!body.state || typeof body.state !== 'string') {
		return json({ error: 'state is required (e.g., "CA")' }, { status: 400 });
	}

	const stateUpper = body.state.toUpperCase();
	if (!VALID_STATES.has(stateUpper)) {
		return json({ error: `Invalid state code: ${body.state}` }, { status: 400 });
	}

	// Validate district
	if (typeof body.district !== 'number' || body.district < 0 || body.district > 53) {
		return json(
			{ error: 'district must be a number between 0 (at-large) and 53' },
			{ status: 400 }
		);
	}

	// Validate positions
	if (!body.positions || !Array.isArray(body.positions) || body.positions.length === 0) {
		return json(
			{
				error: 'positions array is required',
				example: {
					state: 'CA',
					district: 12,
					positions: [
						{ topic: 'healthcare', stance: 'support' },
						{ topic: 'climate', stance: 'support' }
					]
				}
			},
			{ status: 400 }
		);
	}

	// Validate each position
	for (const pos of body.positions) {
		if (!pos.topic || typeof pos.topic !== 'string') {
			return json({ error: 'Each position must have a topic string' }, { status: 400 });
		}
		if (!pos.stance || !['support', 'oppose'].includes(pos.stance)) {
			return json(
				{ error: 'Each position must have stance of "support" or "oppose"' },
				{ status: 400 }
			);
		}
	}

	// Limit positions
	if (body.positions.length > 10) {
		return json({ error: 'Maximum 10 positions per request' }, { status: 400 });
	}

	try {
		console.log(`[Delegation Alignment] Calculating for ${stateUpper}-${body.district}`);

		const result = await getDelegationAlignment(
			stateUpper,
			body.district,
			body.positions
		);

		// Sort senators by alignment (highest first)
		result.senators.sort((a, b) => b.overallScore - a.overallScore);

		return json({
			location: {
				state: stateUpper,
				district: body.district
			},
			delegation: {
				representative: result.representative || null,
				senators: result.senators
			},
			summary: generateDelegationSummary(result),
			meta: {
				positionsAnalyzed: body.positions.length,
				requestedAt: new Date().toISOString()
			}
		});
	} catch (error) {
		console.error(`[Delegation Alignment] Error for ${stateUpper}-${body.district}:`, error);

		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		if (errorMessage.includes('Rate limit')) {
			return json(
				{ error: 'Congress.gov API rate limit exceeded. Please try again later.' },
				{ status: 503 }
			);
		}

		return json({ error: 'Failed to calculate delegation alignment' }, { status: 500 });
	}
};

/**
 * Generate summary for delegation alignment
 */
function generateDelegationSummary(result: {
	representative?: { memberName: string; overallScore: number; party: string };
	senators: Array<{ memberName: string; overallScore: number; party: string }>;
}): string {
	const parts: string[] = [];

	if (result.representative) {
		const rep = result.representative;
		parts.push(
			`Your House representative ${rep.memberName} (${rep.party}) has ${rep.overallScore}% alignment with your positions.`
		);
	} else {
		parts.push('No House representative found for your district.');
	}

	if (result.senators.length > 0) {
		const senatorSummaries = result.senators.map(
			s => `${s.memberName} (${s.party}): ${s.overallScore}%`
		);
		parts.push(`Your senators: ${senatorSummaries.join(', ')}.`);
	} else {
		parts.push('No senators found for your state.');
	}

	return parts.join(' ');
}

/**
 * GET /api/congress/alignment/delegation
 *
 * Returns usage instructions
 */
export const GET: RequestHandler = async () => {
	return json({
		message: 'Use POST to calculate delegation alignment',
		usage: {
			method: 'POST',
			contentType: 'application/json',
			body: {
				state: 'Two-letter state code (e.g., "CA")',
				district: 'Congressional district number (0 for at-large)',
				positions: [
					{
						topic: 'string (required)',
						stance: '"support" | "oppose" (required)',
						keywords: 'string[] (optional)',
						importance: 'number 1-10 (optional)'
					}
				]
			}
		},
		availableTopics: Object.keys(TOPIC_KEYWORDS),
		example: {
			state: 'CA',
			district: 12,
			positions: [
				{ topic: 'healthcare', stance: 'support', importance: 8 },
				{ topic: 'climate', stance: 'support', importance: 7 },
				{ topic: 'economy', stance: 'support', importance: 5 }
			]
		}
	});
};
