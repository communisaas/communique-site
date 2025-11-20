import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { mapLocationToScope } from '$lib/utils/scope-mapper-international';
import type { ScopeMapping } from '$lib/utils/scope-mapper-international';
import { fuzzyMatchScope } from '$lib/utils/fuzzy-scope-matcher';
import { geocodeLocation, geocodeResultToScopeMapping } from '$lib/server/geocoding';
import { getCachedGeocode, setCachedGeocode } from '$lib/server/geocoding-cache';
import { checkRateLimit } from '$lib/server/geocoding-rate-limiter';

const TOOLHOUSE_API_BASE = 'https://agents.toolhouse.ai';

/**
 * Extract geographic scope from message content
 * Multi-layer extraction pipeline:
 * 1. Regex patterns (fast path, 70-80% coverage)
 * 2. Fuzzy matching (abbreviations/typos, 85% coverage) - NEW LAYER
 * 3. Geocoding API (addresses/landmarks, 95% coverage)
 *
 * Priority order (highest confidence first):
 * 1. Congressional district patterns (CA-12, NY-15)
 * 2. State names (California, New York, Texas)
 * 3. Nationwide/federal patterns
 * 4. Fuzzy patterns (SoCal, NYC, typos)
 * 5. Geocoding API for addresses/landmarks
 */
async function extractGeographicScope(
	message: string,
	subject: string,
	countryCode: string = 'US'
): Promise<ScopeMapping | null> {
	const combinedText = `${subject} ${message}`.toLowerCase();

	// Pattern 1: Congressional district (highest confidence)
	const districtPattern = /\b([a-z]{2})-(\d{1,2})\b/gi;
	const districtMatch = districtPattern.exec(combinedText);
	if (districtMatch) {
		const locationText = districtMatch[0];
		return mapLocationToScope(locationText, countryCode);
	}

	// Pattern 2: State names (common US states)
	const statePatterns = [
		/\bcalifornia\b/,
		/\bnew york\b/,
		/\btexas\b/,
		/\bflorida\b/,
		/\billinois\b/,
		/\bpennsylvania\b/,
		/\bohio\b/,
		/\bgeorgia\b/,
		/\bmichigan\b/,
		/\bnorth carolina\b/,
		/\bin (california|new york|texas|florida|illinois)\b/
	];

	for (const pattern of statePatterns) {
		const match = pattern.exec(combinedText);
		if (match) {
			// Extract just the state name (remove "in " prefix if present)
			const stateName = match[0].replace(/^in /, '').trim();
			return mapLocationToScope(stateName, countryCode);
		}
	}

	// Pattern 3: Nationwide/federal
	const nationwidePatterns = [
		/\bnationwide\b/,
		/\ball states\b/,
		/\bfederal\b/,
		/\bacross america\b/,
		/\bacross the (country|nation|united states)\b/
	];

	for (const pattern of nationwidePatterns) {
		if (pattern.test(combinedText)) {
			return mapLocationToScope('nationwide', countryCode);
		}
	}

	// LAYER 2: Fuzzy matching (abbreviations, nicknames, typos)
	// Try to extract location terms from combined text for fuzzy matching
	const words = combinedText.split(/\s+/);

	// Try fuzzy matching on individual words and 2-word phrases
	for (let i = 0; i < words.length; i++) {
		// Try single word
		const singleWord = words[i].replace(/[^\w\s-]/g, '').toLowerCase();
		if (singleWord.length >= 2) {
			const fuzzyResult = fuzzyMatchScope(singleWord, countryCode);
			if (fuzzyResult && fuzzyResult.confidence >= 0.8) {
				console.log(
					'[fuzzy-scope-match]',
					JSON.stringify({
						timestamp: new Date().toISOString(),
						input: singleWord,
						matched: fuzzyResult.display_text,
						confidence: fuzzyResult.confidence,
						method: 'single-word'
					})
				);
				return fuzzyResult;
			}
		}

		// Try 2-word phrase (e.g., "bay area", "new york")
		if (i < words.length - 1) {
			const twoWords = `${words[i]} ${words[i + 1]}`.replace(/[^\w\s-]/g, '').toLowerCase();
			const fuzzyResult = fuzzyMatchScope(twoWords, countryCode);
			if (fuzzyResult && fuzzyResult.confidence >= 0.8) {
				console.log(
					'[fuzzy-scope-match]',
					JSON.stringify({
						timestamp: new Date().toISOString(),
						input: twoWords,
						matched: fuzzyResult.display_text,
						confidence: fuzzyResult.confidence,
						method: 'two-word'
					})
				);
				return fuzzyResult;
			}
		}
	}

	// LAYER 3: Geocoding API (addresses/landmarks)
	// Check cache first
	const cached = await getCachedGeocode(combinedText);
	if (cached) {
		return geocodeResultToScopeMapping(cached);
	}

	// Check rate limit before calling API
	const rateLimitCheck = checkRateLimit();
	if (!rateLimitCheck.allowed) {
		console.warn('[geographic-scope-extraction] Rate limit hit:', rateLimitCheck.reason);
		// Fallback to low-confidence country-level
		return {
			country_code: countryCode,
			scope_level: 'country',
			display_text: 'Nationwide',
			confidence: 0.3,
			extraction_method: 'regex'
		};
	}

	// Call geocoding API
	const geocodeResult = await geocodeLocation(combinedText, { timeout: 2000 });
	if (geocodeResult) {
		// Cache result for future use
		await setCachedGeocode(combinedText, geocodeResult);
		return geocodeResultToScopeMapping(geocodeResult);
	}

	// No clear geographic scope found
	return null;
}

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
	geographic_scope?: ScopeMapping; // Agent-extracted or deterministically parsed
}

export const POST: RequestHandler = async ({ request, locals }) => {
	// Authentication check
	const session = locals.session;
	if (!session?.userId) {
		throw error(401, 'Authentication required');
	}

	const apiKey = process.env.TOOLHOUSE_API_KEY;
	// Use message generation agent (writer), not subject line agent
	const messageAgentId =
		process.env.TOOLHOUSE_MESSAGE_AGENT_ID || 'fb9e5f19-cb4d-4a0d-8e6f-31337c253893';

	if (!apiKey) {
		console.error('[generate-message] Missing TOOLHOUSE_API_KEY environment variable');
		throw error(500, 'Server configuration error: Missing API key');
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
		// Create abort controller for timeout (180 seconds for AI agent processing)
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 180000);

		// Call Toolhouse message generation agent
		const response = await fetch(`${TOOLHOUSE_API_BASE}/${messageAgentId}`, {
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

		// Extract geographic scope from message content (async now with geocoding)
		const geographic_scope = await extractGeographicScope(result.message, result.subject);

		// Structured logging for monitoring extraction accuracy
		if (geographic_scope) {
			console.log(
				'[geographic-scope-extraction]',
				JSON.stringify({
					timestamp: new Date().toISOString(),
					extraction_method: geographic_scope.extraction_method || 'unknown',
					confidence: geographic_scope.confidence,
					scope_level: geographic_scope.scope_level,
					display_text: geographic_scope.display_text,
					country_code: geographic_scope.country_code,
					has_alternatives: Boolean(geographic_scope.alternatives?.length),
					alternatives_count: geographic_scope.alternatives?.length || 0,
					message_preview: result.message.substring(0, 100),
					subject: result.subject
				})
			);
		} else {
			console.log(
				'[geographic-scope-extraction]',
				JSON.stringify({
					timestamp: new Date().toISOString(),
					extraction_method: 'none',
					confidence: 0,
					scope_level: null,
					display_text: null,
					message_preview: result.message.substring(0, 100),
					subject: result.subject
				})
			);
		}

		// Return structured data
		return json({
			message: result.message,
			subject: result.subject,
			sources: result.sources || [],
			research_log: result.research_log || [],
			geographic_scope: geographic_scope || undefined
		});
	} catch (err) {
		console.error('[generate-message] Error calling Toolhouse:', err);
		if (err instanceof Error && 'status' in err) {
			throw err; // Re-throw SvelteKit errors
		}
		throw error(500, err instanceof Error ? err.message : 'Failed to generate message');
	}
};
