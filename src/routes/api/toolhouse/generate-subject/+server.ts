import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const TOOLHOUSE_AGENT_ID = '762e6108-9164-4c7b-852b-d6a740ccfd22';
const TOOLHOUSE_API_BASE = 'https://agents.toolhouse.ai';

interface ToolhouseRequest {
	message: string;
	runId?: string;
}

interface ToolhouseResponse {
	subject_line: string;
	core_issue: string;
	domain: 'government' | 'corporate' | 'institutional' | 'labor' | 'advocacy';
	url_slug: string;
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

		// Extract all JSON arrays (eslint-disable-next-line no-useless-escape - escapes are required for regex)
		// eslint-disable-next-line no-useless-escape
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
 * Generate subject line using Toolhouse AI agent
 *
 * POST /api/toolhouse/generate-subject
 * Body: { message: string, runId?: string }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Authentication required
		const session = locals.session;
		if (!session?.userId) {
			throw error(401, 'Authentication required');
		}

		const body = (await request.json()) as ToolhouseRequest;
		const { message, runId } = body;

		if (!message?.trim()) {
			throw error(400, 'Message is required');
		}

		console.log('[Toolhouse] Generating subject line:', {
			userId: session.userId,
			messageLength: message.length,
			isRefinement: !!runId
		});

		// Determine request method and URL
		const method = runId ? 'PUT' : 'POST';
		const url = runId
			? `${TOOLHOUSE_API_BASE}/${TOOLHOUSE_AGENT_ID}/${runId}`
			: `${TOOLHOUSE_API_BASE}/${TOOLHOUSE_AGENT_ID}`;

		// Build headers
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		// Add auth (agent is private)
		const apiKey = process.env.TOOLHOUSE_API_KEY;
		if (!apiKey) {
			console.error('[Toolhouse] TOOLHOUSE_API_KEY not found in environment');
			throw error(500, 'Toolhouse API key not configured');
		}
		headers['Authorization'] = `Bearer ${apiKey}`;

		// Call Toolhouse agent
		const response = await fetch(url, {
			method,
			headers,
			body: JSON.stringify({ message })
		});

		if (!response.ok) {
			console.error('[Toolhouse] Agent call failed:', {
				status: response.status,
				statusText: response.statusText
			});
			throw error(500, 'Failed to generate subject line');
		}

		// Extract Run ID from headers
		const newRunId = response.headers.get('X-Toolhouse-Run-ID') || runId;

		// Extract JSON from response (handles markdown, notes, any flanking text)
		const text = await response.text();
		console.log('[Toolhouse] Raw response (first 500 chars):', text.substring(0, 500));

		const result = extractJSON(text) as ToolhouseResponse;

		if (!result) {
			console.error('[Toolhouse] No valid JSON found in response');
			console.error('[Toolhouse] Full text:', text);
			throw error(500, 'Failed to parse agent response - no valid JSON found');
		}

		console.log('[Toolhouse] Extracted JSON:', result);

		console.log('[Toolhouse] Subject line generated:', {
			userId: session.userId,
			subject_line: result.subject_line,
			domain: result.domain,
			runId: newRunId
		});

		return json({
			...result,
			runId: newRunId
		});
	} catch (err) {
		console.error('[Toolhouse] Error:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'Failed to generate subject line');
	}
};
