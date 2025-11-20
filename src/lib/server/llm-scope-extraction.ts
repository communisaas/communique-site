/**
 * LLM-based Geographic Scope Extraction (Epic 3)
 *
 * GPT-4 structured output for edge cases that regex/fuzzy/geocoding can't handle
 * Examples: "Contact your representative" + Rep. Pelosi → CA
 *           "NYC rent control" → New York City
 *           "Federal climate policy" → Nationwide
 *
 * Cost mitigation: 90-day caching, only called for confidence < 0.7
 * Expected usage: < 5% of extractions (500/month @ 10K templates)
 * Expected cost: < $20/month
 */

import OpenAI from 'openai';
import type { ScopeMapping } from '$lib/utils/scope-mapper-international';

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY
});

export interface LLMExtractionContext {
	decision_makers?: string[]; // "Rep. Nancy Pelosi" → CA inference
	domain?: string; // "housing" + "rent control" → city-level
	user_location?: { country?: string; region?: string }; // For disambiguation
}

/**
 * Extract geographic scope using GPT-4 with structured output
 *
 * Only call this when regex/fuzzy/geocoding all fail or have low confidence
 * Always cache results by content hash (saves 95%+ of costs)
 *
 * @param message - Template message body
 * @param subject - Template subject line
 * @param context - Optional context (decision makers, domain, user location)
 * @returns ScopeMapping with 'llm' extraction method, or null if extraction fails
 */
export async function extractScopeWithLLM(
	message: string,
	subject: string,
	context?: LLMExtractionContext
): Promise<ScopeMapping | null> {
	// Build context-aware prompt
	const decisionMakersContext = context?.decision_makers?.length
		? `\nDecision makers: ${context.decision_makers.join(', ')}`
		: '';

	const domainContext = context?.domain ? `\nDomain/Topic: ${context.domain}` : '';

	const userLocationContext = context?.user_location?.country
		? `\nUser location hint: ${context.user_location.country}${context.user_location.region ? ', ' + context.user_location.region : ''}`
		: '';

	const prompt = `Extract the geographic scope from this message. Return ONLY valid JSON.

Subject: "${subject}"
Message: "${message.substring(0, 500)}"${decisionMakersContext}${domainContext}${userLocationContext}

Examples:
- "Contact your representative" + Rep. Pelosi → {"country_code": "US", "region_code": "CA", "scope_level": "region"}
- "NYC rent control" → {"country_code": "US", "region_code": "NY", "locality": "New York City", "scope_level": "locality"}
- "Federal climate policy" → {"country_code": "US", "scope_level": "country"}
- "London housing crisis" → {"country_code": "GB", "locality": "London", "scope_level": "locality"}
- "California wildfire relief" → {"country_code": "US", "region_code": "CA", "scope_level": "region"}

Return JSON matching this schema:
{
  "country_code": "US|GB|FR|JP|BR",
  "region_code": "CA|NY|TX|...",
  "locality": "City name or code",
  "district": "CA-12|...",
  "scope_level": "country|region|locality|district",
  "confidence": 0.0-1.0,
  "reasoning": "1-sentence explanation"
}`;

	try {
		const response = await openai.chat.completions.create({
			model: 'gpt-4-turbo-preview',
			messages: [{ role: 'user', content: prompt }],
			response_format: { type: 'json_object' },
			temperature: 0.3, // Low temp for consistency
			max_tokens: 200 // Small output = lower cost
		});

		const content = response.choices[0].message.content;
		if (!content) {
			console.error('[llm-extraction] Empty response from OpenAI');
			return null;
		}

		const parsed = JSON.parse(content);

		// Map OpenAI response to ScopeMapping
		const result: ScopeMapping = {
			country_code: parsed.country_code || 'US',
			scope_level: parsed.scope_level || 'country',
			display_text: parsed.locality || parsed.region_code || parsed.country_code,
			region_code: parsed.region_code,
			locality_code: parsed.locality,
			district_code: parsed.district,
			confidence: (parsed.confidence || 0.7) * 0.9, // Reduce LLM confidence slightly (hallucinations)
			extraction_method: 'llm'
		};

		// Structured logging for monitoring
		console.log(
			'[llm-extraction]',
			JSON.stringify({
				timestamp: new Date().toISOString(),
				subject: subject.substring(0, 50),
				message_preview: message.substring(0, 100),
				extracted: result.display_text,
				scope_level: result.scope_level,
				confidence: result.confidence,
				reasoning: parsed.reasoning,
				cost_usd: 0.002, // Approximate GPT-4 cost per request
				context_used: Boolean(context?.decision_makers || context?.domain)
			})
		);

		return result;
	} catch (error) {
		console.error('[llm-extraction] Error:', error);
		return null;
	}
}
