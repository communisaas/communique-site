import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const TOOLHOUSE_AGENT_ID = '3004aca3-c465-498b-a1af-361d451aa7fc';
const TOOLHOUSE_API_BASE = 'https://agents.toolhouse.ai';

interface DecisionMakerRequest {
	subject_line: string;
	core_issue: string;
	domain: string;
	url_slug?: string;
}

interface DecisionMakerResponse {
	decision_makers: Array<{
		name: string;
		title: string;
		organization: string;
		email?: string;
		provenance: string;
	}>;
}

/**
 * Extract ANY valid JSON from text, regardless of surrounding content
 */
function extractJSON(text: string): any | null {
	// Try parsing the whole thing first
	try {
		return JSON.parse(text);
	} catch {
		// Find the largest valid JSON structure (prefer arrays/objects)
		const candidates: any[] = [];

		// Extract all JSON arrays
		const arrayMatches = text.matchAll(/\[(?:[^\[\]]|\[[^\[\]]*\])*\]/gs);
		for (const match of arrayMatches) {
			try {
				const parsed = JSON.parse(match[0]);
				if (Array.isArray(parsed) && parsed.length > 0) {
					candidates.push({ value: parsed, length: match[0].length });
				}
			} catch {
				continue;
			}
		}

		// Extract all JSON objects
		const objectMatches = text.matchAll(/\{(?:[^{}]|\{[^{}]*\})*\}/gs);
		for (const match of objectMatches) {
			try {
				const parsed = JSON.parse(match[0]);
				if (parsed && typeof parsed === 'object') {
					candidates.push({ value: parsed, length: match[0].length });
				}
			} catch {
				continue;
			}
		}

		// Return the largest valid JSON found
		if (candidates.length > 0) {
			candidates.sort((a, b) => b.length - a.length);
			return candidates[0].value;
		}

		return null;
	}
}

/**
 * Resolve decision-makers using Toolhouse AI agent
 *
 * POST /api/toolhouse/resolve-decision-makers
 * Body: { subject_line, core_issue, domain, url_slug? }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Authentication required
		const session = locals.session;
		if (!session?.userId) {
			throw error(401, 'Authentication required');
		}

		const body = (await request.json()) as DecisionMakerRequest;
		const { subject_line, core_issue, domain, url_slug } = body;

		if (!subject_line?.trim() || !core_issue?.trim()) {
			throw error(400, 'Subject line and core issue are required');
		}

		console.log('[DecisionMaker] Resolving decision-makers:', {
			userId: session.userId,
			subject_line: subject_line.substring(0, 50),
			domain,
			hasSlug: !!url_slug
		});

		// Build headers with auth
		const apiKey = process.env.TOOLHOUSE_API_KEY;
		if (!apiKey) {
			console.error('[DecisionMaker] TOOLHOUSE_API_KEY not found in environment');
			throw error(500, 'Toolhouse API key not configured');
		}

		// Call Toolhouse agent
		const response = await fetch(`${TOOLHOUSE_API_BASE}/${TOOLHOUSE_AGENT_ID}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				message: JSON.stringify({
					subject_line,
					core_issue,
					domain,
					url_slug
				})
			})
		});

		if (!response.ok) {
			console.error('[DecisionMaker] Agent call failed:', {
				status: response.status,
				statusText: response.statusText
			});
			throw error(500, 'Failed to resolve decision-makers');
		}

		// Extract JSON from response (handles markdown, notes, any flanking text)
		const text = await response.text();
		console.log('[DecisionMaker] Raw response (first 500 chars):', text.substring(0, 500));

		const result = extractJSON(text);

		if (!result) {
			console.error('[DecisionMaker] No valid JSON found in response');
			console.error('[DecisionMaker] Full text:', text);
			throw error(500, 'Failed to parse agent response - no valid JSON found');
		}

		console.log('[DecisionMaker] Extracted JSON:', result);

		// Normalize response: handle both { decision_makers: [...] } and direct array
		let normalizedResult: DecisionMakerResponse;

		if (Array.isArray(result)) {
			// Direct array format - wrap it
			console.log('[DecisionMaker] Response is direct array, wrapping in decision_makers key');
			normalizedResult = { decision_makers: result };
		} else if (result && typeof result === 'object' && 'decision_makers' in result) {
			// Already has decision_makers key
			normalizedResult = result as DecisionMakerResponse;
		} else {
			console.error('[DecisionMaker] Invalid response structure:', result);
			throw error(500, 'Invalid agent response structure');
		}

		// Validate array
		if (!Array.isArray(normalizedResult.decision_makers)) {
			console.error('[DecisionMaker] decision_makers is not an array:', normalizedResult);
			throw error(500, 'Invalid agent response structure');
		}

		console.log('[DecisionMaker] Resolved decision-makers:', {
			userId: session.userId,
			count: normalizedResult.decision_makers.length,
			names: normalizedResult.decision_makers.map((dm) => dm.name)
		});

		return json(normalizedResult);
	} catch (err) {
		console.error('[DecisionMaker] Error:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'Failed to resolve decision-makers');
	}
};
