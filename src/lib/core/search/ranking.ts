/**
 * Template Ranking Algorithm
 *
 * Combines semantic similarity with contextual boosting to produce
 * final ranked results. Provides debugging tools to explain ranking decisions.
 *
 * Pipeline:
 * 1. Generate query embedding
 * 2. Calculate cosine similarity for all templates
 * 3. Apply contextual boosting (geographic, temporal, network, impact)
 * 4. Sort by final score
 * 5. Return ranked results
 */

import type {
	TemplateWithEmbedding,
	RankedTemplate,
	SearchQuery,
	SearchResult,
	RankingExplanation
} from './types';
import { EmbeddingSearch } from './embedding-search';
import { ContextualBooster } from './contextual-boosting';

export class TemplateRanker {
	private embeddingSearch: EmbeddingSearch;
	private contextualBooster: ContextualBooster;

	constructor(embeddingSearch: EmbeddingSearch, contextualBooster: ContextualBooster) {
		this.embeddingSearch = embeddingSearch;
		this.contextualBooster = contextualBooster;
	}

	/**
	 * Full ranking pipeline with contextual boosting
	 */
	async rankTemplates(query: SearchQuery): Promise<RankedTemplate[]> {
		const startTime = performance.now();

		// Step 1: Semantic search (cosine similarity)
		const similarityResults = await this.embeddingSearch.search(query);

		// Step 2: Apply contextual boosting (if enabled)
		const enableBoosting = query.enableBoosting ?? true;

		const rankedResults: RankedTemplate[] = similarityResults.map((result) => {
			if (enableBoosting) {
				const { boost, final_score } = this.contextualBooster.calculateBoostedScore(
					result,
					result.similarity
				);

				return {
					...result,
					boost,
					final_score,
					rank: 0 // Will be set after sorting
				};
			} else {
				// No boosting - use raw similarity
				return {
					...result,
					boost: { geographic: 1, temporal: 1, network: 1, impact: 1 },
					final_score: result.similarity,
					rank: 0
				};
			}
		});

		// Step 3: Sort by final score
		rankedResults.sort((a, b) => b.final_score - a.final_score);

		// Step 4: Assign ranks
		rankedResults.forEach((result, index) => {
			result.rank = index + 1;
		});

		const endTime = performance.now();
		console.log(`Ranking completed in ${(endTime - startTime).toFixed(2)}ms`);

		return rankedResults;
	}

	/**
	 * Rank templates with full metadata
	 */
	async rankWithMetadata(query: SearchQuery): Promise<SearchResult> {
		const startTime = performance.now();

		// Generate query embedding
		const queryEmbedding = await this.embeddingSearch.generateQueryEmbedding(query.query);

		// Rank templates
		const results = await this.rankTemplates(query);

		return {
			results,
			query: query.query,
			total_results: results.length,
			query_embedding: queryEmbedding,
			search_time_ms: performance.now() - startTime,
			cached: false
		};
	}

	/**
	 * Explain ranking for a specific template (debugging)
	 */
	explainRanking(template: RankedTemplate): RankingExplanation {
		const { boost, similarity, final_score, rank } = template;

		// Build explanation string
		const explanationParts: string[] = [];

		explanationParts.push(`Similarity: ${(similarity * 100).toFixed(1)}%`);

		if (boost.geographic > 1.0) {
			explanationParts.push(`Geographic boost: ${boost.geographic.toFixed(2)}x (local match)`);
		}

		if (boost.temporal > 1.0) {
			explanationParts.push(`Temporal boost: ${boost.temporal.toFixed(2)}x (recently popular)`);
		}

		if (boost.network > 1.0) {
			explanationParts.push(`Network boost: ${boost.network.toFixed(2)}x (high adoption)`);
		}

		if (boost.impact > 1.0) {
			explanationParts.push(`Quality boost: ${boost.impact.toFixed(2)}x (high quality)`);
		}

		const totalBoost = boost.geographic * boost.temporal * boost.network * boost.impact;
		explanationParts.push(`Total boost: ${totalBoost.toFixed(2)}x`);
		explanationParts.push(`Final score: ${(final_score * 100).toFixed(1)}%`);

		return {
			template_id: template.id,
			title: template.title,
			similarity,
			boost,
			final_score,
			rank,
			explanation: explanationParts.join(' | ')
		};
	}

	/**
	 * Batch explain rankings for all results (debugging)
	 */
	explainAllRankings(results: RankedTemplate[]): RankingExplanation[] {
		return results.map((result) => this.explainRanking(result));
	}

	/**
	 * Get top N templates with explanations
	 */
	async getTopWithExplanations(
		query: SearchQuery,
		topN = 10
	): Promise<{ results: RankedTemplate[]; explanations: RankingExplanation[] }> {
		const results = await this.rankTemplates({ ...query, limit: topN });
		const explanations = this.explainAllRankings(results);

		return { results, explanations };
	}
}

/**
 * Create template ranker instance
 */
export function createTemplateRanker(
	embeddingSearch: EmbeddingSearch,
	contextualBooster: ContextualBooster
): TemplateRanker {
	return new TemplateRanker(embeddingSearch, contextualBooster);
}
