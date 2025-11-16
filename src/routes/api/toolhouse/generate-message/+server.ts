import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const TOOLHOUSE_API_BASE = 'https://agents.toolhouse.ai';

interface MessageGenerationRequest {
	subject_line: string;
	core_issue: string;
	decision_makers: Array<{
		name: string;
		title: string;
		organization: string;
	}>;
	domain: string;
}

interface Source {
	num: number;
	title: string;
	url: string;
	type: 'journalism' | 'research' | 'government' | 'legal' | 'advocacy';
}

interface MessageGenerationResponse {
	message: string;
	subject: string;
	sources: Source[];
	research_log: string[];
}

export const POST: RequestHandler = async ({ request, locals }) => {
	// Authentication check
	const session = locals.session;
	if (!session?.userId) {
		throw error(401, 'Authentication required');
	}

	const apiKey = process.env.TOOLHOUSE_API_KEY;
	const agentId = process.env.TOOLHOUSE_AGENT_ID;

	if (!apiKey) {
		console.error('[generate-message] Missing TOOLHOUSE_API_KEY environment variable');
		throw error(500, 'Server configuration error: Missing API key');
	}

	if (!agentId) {
		console.error('[generate-message] Missing TOOLHOUSE_AGENT_ID environment variable');
		throw error(500, 'Server configuration error: Missing agent ID');
	}

	let body: MessageGenerationRequest;
	try {
		body = await request.json();
	} catch (err) {
		console.error('[generate-message] Invalid request body:', err);
		throw error(400, 'Invalid request body');
	}

	// Validate required fields
	if (!body.subject_line || !body.core_issue) {
		throw error(400, 'Missing required fields: subject_line, core_issue');
	}

	console.log('[generate-message] Calling Toolhouse agent with:', {
		subject_line: body.subject_line,
		core_issue: body.core_issue,
		decision_makers_count: body.decision_makers?.length || 0,
		domain: body.domain
	});

	try {
		// Create abort controller for timeout (90 seconds for AI agent processing)
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 90000);

		// Call Toolhouse agent
		const response = await fetch(`${TOOLHOUSE_API_BASE}/${agentId}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				message: JSON.stringify({
					subject_line: body.subject_line,
					core_issue: body.core_issue,
					decision_makers: body.decision_makers || [],
					domain: body.domain || 'general'
				})
			}),
			signal: controller.signal
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			const errorText = await response.text();
			console.error('[generate-message] Toolhouse API error:', {
				status: response.status,
				statusText: response.statusText,
				error: errorText
			});
			throw error(response.status, `Toolhouse API error: ${response.statusText}`);
		}

		// Parse response (may be streaming newline-delimited JSON or single JSON)
		const text = await response.text();
		console.log('[generate-message] Raw response:', text.substring(0, 200));

		let result: MessageGenerationResponse;

		try {
			// Try parsing as single JSON first
			result = JSON.parse(text);
		} catch {
			// If that fails, try newline-delimited JSON parsing
			const lines = text.split('\n').filter((line) => line.trim());
			if (lines.length === 0) {
				throw new Error('Empty response from Toolhouse');
			}

			// Take the last non-empty line as the final result
			const lastLine = lines[lines.length - 1];
			result = JSON.parse(lastLine);
		}

		console.log('[generate-message] Parsed result:', {
			message_length: result.message?.length || 0,
			subject: result.subject,
			sources_count: result.sources?.length || 0,
			research_log_count: result.research_log?.length || 0
		});

		// Validate response structure
		if (!result.message || !result.subject) {
			console.error('[generate-message] Invalid response structure:', result);
			throw error(500, 'Invalid response from message generation agent');
		}

		// Return structured data
		return json({
			message: result.message,
			subject: result.subject,
			sources: result.sources || [],
			research_log: result.research_log || []
		});
	} catch (err) {
		console.error('[generate-message] Error calling Toolhouse:', err);
		if (err instanceof Error && 'status' in err) {
			throw err; // Re-throw SvelteKit errors
		}
		throw error(500, err instanceof Error ? err.message : 'Failed to generate message');
	}
};
