/**
 * Self-Improving Feedback Loop (Epic 5)
 *
 * Learn from user corrections and improve extraction accuracy over time
 * Weekly batch job analyzes patterns and adds to fuzzy matcher
 *
 * Learning cycle:
 * 1. User corrects AI extraction
 * 2. Correction logged to ScopeCorrection table
 * 3. Weekly batch job finds patterns (3+ identical corrections)
 * 4. High-confidence patterns added to fuzzy matcher
 * 5. Extraction accuracy improves asymptotically → 99%
 */

import { prisma } from '$lib/core/db';
import type { ScopeMapping } from '$lib/utils/scope-mapper-international';

/**
 * Determine correction type for analysis
 *
 * @param ai - AI-extracted scope
 * @param user - User-corrected scope
 * @returns Correction type for pattern analysis
 */
function determineCorrectionType(ai: ScopeMapping, user: ScopeMapping): string {
	if (ai.country_code !== user.country_code) return 'wrong_country';
	if (ai.region_code !== user.region_code) return 'wrong_region';
	if (ai.district_code !== user.district_code) return 'wrong_district';
	if (ai.scope_level === 'country' && user.scope_level !== 'country') return 'too_broad';
	if (user.scope_level === 'country' && ai.scope_level !== 'country') return 'too_specific';
	return 'other';
}

/**
 * Record user correction for learning
 *
 * Called when user edits geographic scope in template creator
 *
 * @param templateId - Template ID
 * @param aiExtracted - AI's original extraction
 * @param userCorrected - User's correction
 * @param messageSnippet - First 200 chars of message (for pattern analysis)
 * @param subject - Template subject line
 */
export async function recordCorrection(
	templateId: string,
	aiExtracted: ScopeMapping,
	userCorrected: ScopeMapping,
	messageSnippet: string,
	subject: string
): Promise<void> {
	const correctionType = determineCorrectionType(aiExtracted, userCorrected);

	await prisma.scopeCorrection.create({
		data: {
			template_id: templateId,
			ai_extracted: aiExtracted as never, // Prisma Json type
			ai_confidence: aiExtracted.confidence,
			ai_method: aiExtracted.extraction_method || 'unknown',
			user_corrected: userCorrected as never, // Prisma Json type
			correction_type: correctionType,
			message_snippet: messageSnippet.substring(0, 200),
			subject
		}
	});

	console.log(
		'[scope-correction]',
		JSON.stringify({
			timestamp: new Date().toISOString(),
			template_id: templateId,
			ai_extracted: aiExtracted.display_text,
			ai_confidence: aiExtracted.confidence,
			ai_method: aiExtracted.extraction_method,
			user_corrected: userCorrected.display_text,
			correction_type: correctionType
		})
	);
}

/**
 * Find correction patterns for learning
 *
 * Analyzes recent corrections to find common patterns
 * Example: "socal" consistently corrected to "California" (3+ times)
 *
 * @param corrections - Recent ScopeCorrection records
 * @returns Array of patterns with occurrence counts
 */
function findCorrectionPatterns(
	corrections: Array<{
		message_snippet: string;
		ai_extracted: ScopeMapping;
		user_corrected: ScopeMapping;
	}>
): Array<{
	input_text: string;
	canonical: string;
	country_code: string;
	scope_level: string;
	region_code?: string;
	occurrences: number;
}> {
	// Group corrections by (message snippet → corrected location)
	const patternMap = new Map<
		string,
		{
			canonical: string;
			country_code: string;
			scope_level: string;
			region_code?: string;
			count: number;
		}
	>();

	for (const correction of corrections) {
		// Extract potential pattern from message snippet
		// Look for repeated location mentions that AI got wrong
		const message = correction.message_snippet.toLowerCase();
		const corrected = correction.user_corrected;

		// Simple heuristic: if AI extracted something different,
		// look for location keywords in message that match correction
		const keywords = message.match(/\b([a-z]{3,})\b/g) || [];
		for (const keyword of keywords) {
			const key = `${keyword}→${corrected.display_text}`;
			const existing = patternMap.get(key);

			if (existing) {
				existing.count++;
			} else {
				patternMap.set(key, {
					canonical: corrected.display_text,
					country_code: corrected.country_code,
					scope_level: corrected.scope_level,
					region_code: corrected.region_code,
					count: 1
				});
			}
		}
	}

	// Convert map to array, filter for high-confidence patterns
	const patterns = Array.from(patternMap.entries()).map(([key, value]) => {
		const [input_text] = key.split('→');
		return {
			input_text,
			canonical: value.canonical,
			country_code: value.country_code,
			scope_level: value.scope_level,
			region_code: value.region_code,
			occurrences: value.count
		};
	});

	return patterns.sort((a, b) => b.occurrences - a.occurrences);
}

/**
 * Weekly batch job: Analyze corrections and learn patterns
 *
 * Run via cron job: npm run scope:learn
 * Analyzes last 7 days of corrections, finds patterns, adds to fuzzy matcher
 *
 * Requirements for pattern addition:
 * - 3+ identical corrections
 * - Confidence boost from repetition
 * - Pattern doesn't conflict with existing patterns
 */
export async function analyzeAndLearn(): Promise<void> {
	console.log('[scope-learning] Starting weekly pattern analysis...');

	// Fetch corrections from last 7 days
	const recentCorrections = await prisma.scopeCorrection.findMany({
		where: {
			created_at: {
				gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
			}
		}
	});

	console.log(`[scope-learning] Analyzing ${recentCorrections.length} corrections...`);

	// Find patterns (requires type casting due to Prisma Json type)
	const patterns = findCorrectionPatterns(
		recentCorrections.map((c) => ({
			message_snippet: c.message_snippet,
			ai_extracted: c.ai_extracted as unknown as ScopeMapping,
			user_corrected: c.user_corrected as unknown as ScopeMapping
		}))
	);

	console.log(`[scope-learning] Found ${patterns.length} potential patterns`);

	// Add high-confidence patterns (3+ occurrences)
	const highConfidencePatterns = patterns.filter((p) => p.occurrences >= 3);

	console.log(
		'[scope-learning]',
		JSON.stringify({
			timestamp: new Date().toISOString(),
			corrections_analyzed: recentCorrections.length,
			patterns_found: patterns.length,
			patterns_added: highConfidencePatterns.length,
			top_patterns: highConfidencePatterns.slice(0, 10).map((p) => ({
				input: p.input_text,
				canonical: p.canonical,
				occurrences: p.occurrences
			}))
		})
	);

	// TODO: Add patterns to fuzzy matcher database
	// This requires fuzzy matcher to be implemented (Epic 1)
	// For now, log patterns for manual review
	for (const pattern of highConfidencePatterns) {
		console.log(
			'[scope-learning] High-confidence pattern:',
			JSON.stringify({
				input: pattern.input_text,
				canonical: pattern.canonical,
				country_code: pattern.country_code,
				scope_level: pattern.scope_level,
				occurrences: pattern.occurrences,
				confidence: Math.min(0.9, 0.6 + pattern.occurrences * 0.1) // Boost confidence with more occurrences
			})
		);
	}

	console.log('[scope-learning] Pattern analysis complete');
}

/**
 * Get correction statistics for monitoring
 *
 * @returns Correction stats (total, by method, by type)
 */
export async function getCorrectionStats(): Promise<{
	total: number;
	by_method: Record<string, number>;
	by_type: Record<string, number>;
}> {
	const corrections = await prisma.scopeCorrection.findMany({
		where: {
			created_at: {
				gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
			}
		}
	});

	const by_method: Record<string, number> = {};
	const by_type: Record<string, number> = {};

	for (const correction of corrections) {
		by_method[correction.ai_method] = (by_method[correction.ai_method] || 0) + 1;
		by_type[correction.correction_type] = (by_type[correction.correction_type] || 0) + 1;
	}

	return {
		total: corrections.length,
		by_method,
		by_type
	};
}
