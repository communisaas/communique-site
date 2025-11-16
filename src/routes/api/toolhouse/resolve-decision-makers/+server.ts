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

		// Parse response (handle streaming like subject-line agent)
		const text = await response.text();

		console.log('[DecisionMaker] Raw response (first 500 chars):', text.substring(0, 500));
		console.log('[DecisionMaker] Response length:', text.length);

		let result: DecisionMakerResponse;

		// Strategy 1: Try parsing as single JSON
		try {
			result = JSON.parse(text);
			console.log('[DecisionMaker] Parsed as single JSON object');
		} catch (parseError) {
			console.log('[DecisionMaker] Not a single JSON object, trying alternative strategies...');

			// Strategy 2: Try newline-delimited JSON (look for last valid JSON)
			const lines = text.split('\n').filter((line) => line.trim());
			console.log('[DecisionMaker] Found', lines.length, 'lines in response');

			let lastValidJson: DecisionMakerResponse | null = null;
			for (const line of lines) {
				try {
					const parsed = JSON.parse(line);
					if (parsed && typeof parsed === 'object' && 'decision_makers' in parsed) {
						lastValidJson = parsed as DecisionMakerResponse;
						console.log('[DecisionMaker] Found valid decision_makers JSON in line');
					}
				} catch {
					// Skip non-JSON lines silently
				}
			}

			if (lastValidJson) {
				result = lastValidJson;
			} else {
				// Strategy 3: Try to extract JSON from within text (regex search)
				console.log('[DecisionMaker] No valid JSON in lines, trying regex extraction...');

				// Look for JSON object with decision_makers key
				const jsonMatch = text.match(/\{[^{}]*"decision_makers"[^{}]*\[[^\]]*\][^{}]*\}/s);
				if (jsonMatch) {
					try {
						result = JSON.parse(jsonMatch[0]);
						console.log('[DecisionMaker] Extracted JSON via regex');
					} catch {
						// Strategy 4: Look for any valid JSON object anywhere in the text
						const allJsonMatches = text.matchAll(/\{(?:[^{}]|(?:\{[^{}]*\}))*\}/g);
						for (const match of allJsonMatches) {
							try {
								const parsed = JSON.parse(match[0]);
								if (parsed && typeof parsed === 'object' && 'decision_makers' in parsed) {
									result = parsed as DecisionMakerResponse;
									console.log('[DecisionMaker] Found valid JSON in regex scan');
									break;
								}
							} catch {
								continue;
							}
						}
					}
				}

				if (!result) {
					console.error('[DecisionMaker] Failed to parse any valid JSON from response');
					console.error('[DecisionMaker] Full raw text:', text);
					throw error(500, 'Failed to parse agent response - no valid JSON found');
				}
			}
		}

		console.log('[DecisionMaker] Final parsed result:', result);

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
