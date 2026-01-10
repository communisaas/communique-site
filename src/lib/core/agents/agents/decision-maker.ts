/**
 * Decision-Maker Resolver Agent
 *
 * Uses Gemini 3 Flash with Google Search grounding to research and identify
 * REAL people with power over social issues.
 *
 * CRITICAL: This agent MUST use Google Search grounding to find verifiable
 * decision-makers. Without grounding, the model will hallucinate names.
 */

import { generate } from '../gemini-client';
import { extractSourcesFromGrounding } from '../utils/grounding';
import { DECISION_MAKER_PROMPT } from '../prompts/decision-maker';
import { DECISION_MAKER_SCHEMA } from '../schemas';
import type { DecisionMakerResponse, DecisionMaker } from '../types';

// ========================================
// Options Interface
// ========================================

export interface ResolveOptions {
	subjectLine: string;
	coreIssue: string;
	topics: string[];
	voiceSample?: string;
	urlSlug?: string;
}

// ========================================
// Decision-Maker Resolution
// ========================================

/**
 * Resolve decision-makers for a given issue
 *
 * Uses Google Search grounding to find REAL, verifiable people with power
 * over the issue. Returns 3-5 decision-makers with provenance and sources.
 *
 * @param options - Resolution options (subject, issue, topics, voiceSample)
 * @returns Decision-maker response with research summary
 *
 * @example
 * ```typescript
 * const result = await resolveDecisionMakers({
 *   subjectLine: 'Amazon Warehouse Safety Violations',
 *   coreIssue: 'Workers facing unsafe conditions and pressure',
 *   topics: ['safety', 'warehouse', 'wages'],
 *   voiceSample: 'My coworker collapsed from heat and they told him to walk it off'
 * });
 *
 * console.log(result.decision_makers);
 * // [
 * //   { name: 'Andy Jassy', title: 'CEO', organization: 'Amazon', ... },
 * //   { name: 'Beth Galetti', title: 'SVP, People Experience', ... }
 * // ]
 * ```
 */
export async function resolveDecisionMakers(
	options: ResolveOptions
): Promise<DecisionMakerResponse> {
	const { subjectLine, coreIssue, topics, voiceSample, urlSlug } = options;

	// Build prompt with issue context and voice sample
	const voiceBlock = voiceSample ? `\nVoice Sample (the human stakes):\n"${voiceSample}"\n` : '';

	const prompt = `Find the decision-makers for this issue:

Subject: ${subjectLine}
Core Issue: ${coreIssue}
Topics: ${topics.join(', ')}
${urlSlug ? `URL Slug: ${urlSlug}` : ''}${voiceBlock}
Research and identify 3-5 specific people who have direct power over this issue.
For each person, explain WHY they have power and provide source URLs proving it.

Use Google Search to find current, verifiable information. Only include REAL people
you can verify through credible sources. Never invent names or guess positions.

IMPORTANT: Return your response as valid JSON matching this exact structure:
{
  "decision_makers": [
    {
      "name": "Full Name",
      "title": "Current Job Title",
      "organization": "Organization Name",
      "reasoning": "Why this person has power over this issue",
      "contact_channel": "email" | "form" | "phone" | "congress" | "other",
      "confidence": 0.0-1.0,
      "source_url": "URL proving this information"
    }
  ],
  "research_summary": "Summary of why these people were selected"
}

Return ONLY the JSON object, no additional text before or after.`;

	try {
		// Call Gemini with Google Search grounding enabled
		const response = await generate(prompt, {
			systemInstruction: DECISION_MAKER_PROMPT,
			responseSchema: DECISION_MAKER_SCHEMA,
			temperature: 0.2, // Low temperature for factual accuracy
			thinkingLevel: 'high', // Deep reasoning for research
			enableGrounding: true, // CRITICAL: Enable Google Search
			maxOutputTokens: 4096
		});

		// Parse response - may have markdown code blocks when using grounding
		let responseText = response.text || '{}';

		// Strip markdown code blocks if present
		const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
		if (jsonMatch) {
			responseText = jsonMatch[1].trim();
		}

		// Try to find JSON object if there's surrounding text
		const jsonStartIndex = responseText.indexOf('{');
		const jsonEndIndex = responseText.lastIndexOf('}');
		if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
			responseText = responseText.slice(jsonStartIndex, jsonEndIndex + 1);
		}


		// Attempt to parse JSON
		let data: DecisionMakerResponse;
		try {
			data = JSON.parse(responseText) as DecisionMakerResponse;
		} catch (parseError) {
			console.error('[decision-maker] JSON Parse Error. Raw text:', responseText);
			// Try to sanitize common JSON errors (trailing commas, missing commas between objects)
			try {
				const sanitized = responseText
					.replace(/,\s*}/g, '}')       // Remove trailing comma before }
					.replace(/,\s*]/g, ']')       // Remove trailing comma before ]
					.replace(/}\s*{/g, '}, {');   // Insert missing comma between objects
				data = JSON.parse(sanitized) as DecisionMakerResponse;
			} catch (retryError) {
				throw new Error(`JSON parse failed: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
			}
		}

		// Extract grounding metadata for enhanced sources
		const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

		if (groundingMetadata) {
			const groundingSources = extractSourcesFromGrounding(
				groundingMetadata as unknown as import('../types').GroundingMetadata
			);

			// Cross-reference decision-makers with grounding sources
			// If a decision-maker doesn't have a source_url, try to find one
			data.decision_makers = data.decision_makers.map((dm) => ({
				...dm,
				source_url: dm.source_url || findMatchingSource(dm, groundingSources)
			}));

			// Log search queries for debugging
			if (groundingMetadata.webSearchQueries && groundingMetadata.webSearchQueries.length > 0) {
				console.log('[decision-maker] Google Search queries:', groundingMetadata.webSearchQueries);
			}
		}

		// Validate minimum quality threshold
		if (data.decision_makers.length === 0) {
			throw new Error('No decision-makers found. The agent may not have access to grounding.');
		}

		// Log results
		console.log('[decision-maker] Resolved:', {
			count: data.decision_makers.length,
			names: data.decision_makers.map((dm) => dm.name),
			avgConfidence:
				data.decision_makers.reduce((sum, dm) => sum + dm.confidence, 0) /
				data.decision_makers.length
		});

		return data;
	} catch (error) {
		console.error('[decision-maker] Resolution error:', error);
		throw new Error(
			`Failed to resolve decision-makers: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

// ========================================
// Helper Functions
// ========================================

/**
 * Find a matching source URL for a decision-maker
 *
 * Attempts to match organization name to source URLs from grounding.
 * Used when the model doesn't explicitly provide a source_url.
 *
 * @param dm - Decision-maker to find source for
 * @param sources - Available source URLs from grounding
 * @returns Matching URL or undefined
 */
function findMatchingSource(dm: DecisionMaker, sources: string[]): string | undefined {
	// Try to match organization name to source URLs
	const orgLower = dm.organization.toLowerCase();
	const orgSlug = orgLower.replace(/\s+/g, ''); // Remove spaces for URL matching

	// Look for URLs containing the organization name
	return sources.find((url) => {
		const urlLower = url.toLowerCase();
		return (
			urlLower.includes(orgSlug) ||
			urlLower.includes(orgLower) ||
			// Try individual words from org name
			orgLower.split(/\s+/).some((word) => word.length > 3 && urlLower.includes(word))
		);
	});
}
