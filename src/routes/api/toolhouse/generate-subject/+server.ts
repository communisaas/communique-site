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

		// Parse response (handle streaming)
		const text = await response.text();

		console.log('[Toolhouse] Raw response (full):', text);
		console.log('[Toolhouse] Response length:', text.length);

		let result: ToolhouseResponse;
		try {
			// Attempt to parse as JSON
			result = JSON.parse(text);
			console.log('[Toolhouse] Parsed as single JSON object');
		} catch (parseError) {
			console.log('[Toolhouse] Not a single JSON object, attempting to parse streaming format...');

			// If streaming, try to extract complete JSON objects
			// Handle newline-delimited JSON or SSE format
			const lines = text.split('\n').filter((line) => line.trim());
			console.log('[Toolhouse] Found', lines.length, 'lines in response');

			let lastValidJson: ToolhouseResponse | null = null;
			for (const line of lines) {
				try {
					// Try parsing each line as JSON
					const parsed = JSON.parse(line);
					if (parsed && typeof parsed === 'object') {
						lastValidJson = parsed as ToolhouseResponse;
						console.log('[Toolhouse] Successfully parsed line:', parsed);
					}
				} catch {
					// Skip lines that aren't valid JSON
					console.log('[Toolhouse] Skipping non-JSON line:', line.substring(0, 100));
				}
			}

			if (lastValidJson) {
				result = lastValidJson;
			} else {
				console.error('[Toolhouse] Failed to parse any valid JSON from response');
				console.error('[Toolhouse] Raw text:', text.substring(0, 500));
				throw error(500, 'Failed to parse agent response');
			}
		}

		console.log('[Toolhouse] Final parsed result:', result);

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
