/**
 * Grounding Utilities
 *
 * Extract and process Google Search grounding metadata from Gemini responses
 */

import type { GroundingMetadata, Source } from '../types';

// ============================================================================
// Source Extraction
// ============================================================================

/**
 * Extract source URLs from Gemini grounding metadata
 */
export function extractSourcesFromGrounding(metadata: GroundingMetadata): string[] {
	const chunks = metadata.groundingChunks || [];
	return chunks.map((chunk) => chunk.web?.uri).filter((uri): uri is string => !!uri);
}

// ============================================================================
// Citation Mapping
// ============================================================================

/**
 * Build inline citations from grounding supports
 * Maps text segments to source indices
 */
export function buildCitationMap(text: string, metadata: GroundingMetadata): Map<number, number[]> {
	const citationMap = new Map<number, number[]>();
	const supports = metadata.groundingSupports || [];

	for (const support of supports) {
		const endIndex = support.segment?.endIndex;
		const indices = support.groundingChunkIndices;

		if (endIndex !== undefined && indices?.length) {
			citationMap.set(endIndex, indices);
		}
	}

	return citationMap;
}

// ============================================================================
// Citation Injection
// ============================================================================

/**
 * Inject citation markers into text based on grounding supports
 */
export function injectCitations(text: string, metadata: GroundingMetadata): string {
	const supports = metadata.groundingSupports || [];
	const chunks = metadata.groundingChunks || [];

	// Sort by endIndex descending to inject from end (preserves indices)
	const sortedSupports = [...supports].sort(
		(a, b) => (b.segment?.endIndex ?? 0) - (a.segment?.endIndex ?? 0)
	);

	let result = text;

	for (const support of sortedSupports) {
		const endIndex = support.segment?.endIndex;
		const indices = support.groundingChunkIndices;

		if (endIndex === undefined || !indices?.length) continue;

		// Build citation string [1][2]
		const citations = indices
			.filter((i) => chunks[i]?.web?.uri)
			.map((i) => `[${i + 1}]`)
			.join('');

		if (citations) {
			result = result.slice(0, endIndex) + citations + result.slice(endIndex);
		}
	}

	return result;
}

// ============================================================================
// Source List Building
// ============================================================================

/**
 * Build source list from grounding chunks
 */
export function buildSourceList(metadata: GroundingMetadata): Source[] {
	const chunks = metadata.groundingChunks || [];

	return chunks
		.map((chunk, index) => {
			const uri = chunk.web?.uri;
			if (!uri) return null;
			return {
				num: index + 1,
				title: chunk.web?.title || 'Source',
				url: uri,
				type: inferSourceType(uri) as Source['type']
			};
		})
		.filter((source): source is Source => source !== null);
}

/**
 * Infer source type from URL
 */
export function inferSourceType(
	url: string
): 'government' | 'legal' | 'research' | 'advocacy' | 'journalism' {
	const urlLower = url.toLowerCase();
	if (urlLower.includes('.gov')) return 'government';
	if (urlLower.includes('law') || urlLower.includes('legal')) return 'legal';
	if (urlLower.includes('research') || urlLower.includes('.edu')) return 'research';
	if (urlLower.includes('ngo') || urlLower.includes('.org')) return 'advocacy';
	return 'journalism';
}

// ============================================================================
// Source Merging
// ============================================================================

/**
 * Merge sources from response with grounding sources
 */
export function mergeAndDeduplicateSources(
	responseSources: Source[],
	groundingSources: Source[]
): Source[] {
	const seen = new Set<string>();
	const merged: Source[] = [];

	// Add response sources first (higher priority)
	for (const source of responseSources) {
		if (!seen.has(source.url)) {
			seen.add(source.url);
			merged.push(source);
		}
	}

	// Add grounding sources with renumbered indices
	for (const source of groundingSources) {
		if (!seen.has(source.url)) {
			seen.add(source.url);
			merged.push({
				...source,
				num: merged.length + 1
			});
		}
	}

	return merged;
}

// ============================================================================
// Grounded Source Mapping for Entities
// ============================================================================

/**
 * Find verified grounding sources for an entity by searching for its text in the response.
 *
 * This is the KEY function for preventing hallucinated sources:
 * - Instead of trusting LLM-generated URLs, we find which grounding chunks actually
 *   support the text mentioning this entity.
 * - We search for the entity's name/title/org in the raw response text
 * - We check which groundingSupports cover those text positions
 * - We return the grounding chunk URIs as verified sources
 *
 * @param entitySearchTerms - Array of strings to search for (e.g., [name, title, org])
 * @param rawResponseText - The raw text response from Gemini
 * @param metadata - Grounding metadata from the response
 * @returns Array of verified source URLs backed by grounding
 */
export function findGroundedSourcesForEntity(
	entitySearchTerms: string[],
	rawResponseText: string,
	metadata: GroundingMetadata
): string[] {
	const supports = metadata.groundingSupports || [];
	const chunks = metadata.groundingChunks || [];

	if (supports.length === 0 || chunks.length === 0) {
		return [];
	}

	// Find all positions where entity terms appear in the response
	const entityPositions: Array<{ start: number; end: number }> = [];
	const textLower = rawResponseText.toLowerCase();

	for (const term of entitySearchTerms) {
		if (!term || term.length < 3) continue;
		const termLower = term.toLowerCase();
		let pos = 0;
		while ((pos = textLower.indexOf(termLower, pos)) !== -1) {
			entityPositions.push({ start: pos, end: pos + term.length });
			pos += term.length;
		}
	}

	if (entityPositions.length === 0) {
		return [];
	}

	// Find which grounding supports overlap with entity positions
	const matchingChunkIndices = new Set<number>();

	for (const support of supports) {
		const segStart = support.segment?.startIndex ?? 0;
		const segEnd = support.segment?.endIndex ?? 0;
		const chunkIndices = support.groundingChunkIndices || [];

		// Check if this support segment overlaps with any entity position
		for (const entityPos of entityPositions) {
			// Overlap check: segments overlap if one starts before the other ends
			if (segStart <= entityPos.end && segEnd >= entityPos.start) {
				for (const idx of chunkIndices) {
					matchingChunkIndices.add(idx);
				}
			}
		}
	}

	// Extract URLs from matching chunks (deduplicated)
	const urls: string[] = [];
	const seenUrls = new Set<string>();

	for (const idx of matchingChunkIndices) {
		const chunk = chunks[idx];
		const uri = chunk?.web?.uri;
		if (uri && !seenUrls.has(uri)) {
			seenUrls.add(uri);
			urls.push(uri);
		}
	}

	return urls;
}

/**
 * Find the best single source for an entity from grounding metadata.
 *
 * Prioritizes:
 * 1. Official domains (.gov, .edu, .org) from grounding
 * 2. Any grounding source
 * 3. Empty string if nothing found
 */
export function findBestGroundedSource(
	entitySearchTerms: string[],
	rawResponseText: string,
	metadata: GroundingMetadata
): string {
	const sources = findGroundedSourcesForEntity(entitySearchTerms, rawResponseText, metadata);

	if (sources.length === 0) {
		return '';
	}

	// Prioritize official domains
	const official = sources.find((url) => {
		const lower = url.toLowerCase();
		return lower.includes('.gov') || lower.includes('.edu') || lower.includes('.org');
	});

	return official || sources[0];
}
