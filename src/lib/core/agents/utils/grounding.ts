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
