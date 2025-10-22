/**
 * OpenAI Content Moderation API Integration
 *
 * Phase 1: Auto-reject illegal/harmful content (CSAM, threats, spam)
 * Uses OpenAI's free moderation tier (20 requests/min)
 *
 * NOT fact-checking or political bias detection - just safety filtering
 */

import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';

export interface ModerationResult {
	approved: boolean;
	flagged_categories: string[];
	category_scores: Record<string, number>;
	timestamp: string;
}

export interface TemplateModerationInput {
	title: string;
	message_body: string;
}

/**
 * Moderate template content using OpenAI Moderation API
 *
 * @param template - Template with title and message_body
 * @returns ModerationResult with approval status and flagged categories
 */
export async function moderateTemplate(
	template: TemplateModerationInput
): Promise<ModerationResult> {
	const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

	// Combine title and body for comprehensive moderation
	const content = `${template.title}\n\n${template.message_body}`;

	const response = await openai.moderations.create({
		input: content,
		model: 'text-moderation-latest' // Latest stable moderation model
	});

	const result = response.results[0];

	// Extract flagged categories (where flagged = true)
	const flagged = Object.entries(result.categories)
		.filter(([_, flagged]) => flagged)
		.map(([category]) => category);

	return {
		approved: flagged.length === 0, // Approve only if NO categories flagged
		flagged_categories: flagged,
		category_scores: result.category_scores as Record<string, number>,
		timestamp: new Date().toISOString()
	};
}

/**
 * Moderate multiple templates in batch (rate-limited)
 *
 * @param templates - Array of templates to moderate
 * @returns Array of moderation results
 */
export async function moderateTemplatesBatch(
	templates: TemplateModerationInput[]
): Promise<ModerationResult[]> {
	// OpenAI free tier: 20 requests/min
	// Process in batches with rate limiting
	const results: ModerationResult[] = [];

	for (const template of templates) {
		const result = await moderateTemplate(template);
		results.push(result);

		// Rate limit: 3 seconds between requests (20/min = 1 per 3 seconds)
		if (templates.indexOf(template) < templates.length - 1) {
			await new Promise((resolve) => setTimeout(resolve, 3000));
		}
	}

	return results;
}

/**
 * Check if content contains specific harmful patterns
 * Used for edge cases not caught by OpenAI moderation
 *
 * @param content - Text to check
 * @returns boolean indicating if content should be blocked
 */
export function containsProhibitedPatterns(content: string): boolean {
	const prohibitedPatterns = [
		// Congressional office-specific blocks
		/\b(bribe|kickback|extortion|blackmail)\b/i,
		// Threats
		/\b(kill|murder|assassinate|bomb|attack)\b/i,
		// CSAM indicators
		/\b(child porn|underage|minor)\b/i,
		// Spam indicators
		/\b(viagra|cialis|crypto|bitcoin|forex)\b/i
	];

	return prohibitedPatterns.some((pattern) => pattern.test(content));
}
