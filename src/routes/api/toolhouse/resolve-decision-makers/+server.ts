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

		console.log('[DecisionMaker] Raw response (full):', text);
		console.log('[DecisionMaker] Response length:', text.length);

		let result: DecisionMakerResponse;
		try {
			// Attempt to parse as JSON
			result = JSON.parse(text);
			console.log('[DecisionMaker] Parsed as single JSON object');
		} catch (parseError) {
			console.log(
				'[DecisionMaker] Not a single JSON object, attempting to parse streaming format...'
			);

			// Handle streaming/newline-delimited JSON
			const lines = text.split('\n').filter((line) => line.trim());
			console.log('[DecisionMaker] Found', lines.length, 'lines in response');

			let lastValidJson: DecisionMakerResponse | null = null;
			for (const line of lines) {
				try {
					const parsed = JSON.parse(line);
					if (parsed && typeof parsed === 'object') {
						lastValidJson = parsed as DecisionMakerResponse;
						console.log('[DecisionMaker] Successfully parsed line:', parsed);
					}
				} catch {
					// Skip non-JSON lines
					console.log('[DecisionMaker] Skipping non-JSON line:', line.substring(0, 100));
				}
			}

			if (lastValidJson) {
				result = lastValidJson;
			} else {
				console.error('[DecisionMaker] Failed to parse any valid JSON from response');
				console.error('[DecisionMaker] Raw text:', text.substring(0, 500));
				throw error(500, 'Failed to parse agent response');
			}
		}

		console.log('[DecisionMaker] Final parsed result:', result);

		// Validate response structure
		if (!result.decision_makers || !Array.isArray(result.decision_makers)) {
			console.error('[DecisionMaker] Invalid response structure:', result);
			throw error(500, 'Invalid agent response structure');
		}

		console.log('[DecisionMaker] Resolved decision-makers:', {
			userId: session.userId,
			count: result.decision_makers.length,
			names: result.decision_makers.map((dm) => dm.name)
		});

		return json(result);
	} catch (err) {
		console.error('[DecisionMaker] Error:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'Failed to resolve decision-makers');
	}
};
