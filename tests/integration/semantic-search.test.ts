/**
 * Integration Tests: Semantic Search with OpenAI Embeddings
 *
 * Tests the complete semantic search pipeline:
 * 1. Embedding generation (OpenAI API)
 * 2. Cosine similarity calculation
 * 3. Contextual boosting (geographic, temporal, network, impact)
 * 4. Template ranking
 * 5. Search caching (IndexedDB)
 *
 * Note: Uses mocked OpenAI API to avoid real API calls in tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TemplateWithEmbedding, InferredLocation } from '$lib/core/search/types';
import { EmbeddingSearch } from '$lib/core/search/embedding-search';
import { ContextualBooster } from '$lib/core/search/contextual-boosting';
import { TemplateRanker } from '$lib/core/search/ranking';
import { OpenAIEmbeddingGenerator } from '$lib/core/search/openai-embeddings';
import type { TemplateJurisdiction } from '@prisma/client';

// Mock OpenAI API
vi.mock('$lib/core/api/client', () => ({
	api: {
		post: vi.fn()
	}
}));

describe('Semantic Search: Embedding Generation', () => {
	it('generates embeddings for text', async () => {
		const generator = new OpenAIEmbeddingGenerator('test-api-key');

		// Mock OpenAI API response
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				object: 'list',
				data: [
					{
						object: 'embedding',
						embedding: new Array(3072).fill(0.1),
						index: 0
					}
				],
				model: 'text-embedding-3-large',
				usage: {
					prompt_tokens: 10,
					total_tokens: 10
				}
			})
		});

		const embedding = await generator.generateEmbedding('test query');

		expect(embedding).toHaveLength(3072);
		expect(embedding[0]).toBe(0.1);
	});

	it('estimates cost correctly', () => {
		const generator = new OpenAIEmbeddingGenerator('test-api-key');
		const estimate = generator.estimateCost(1000);

		expect(estimate.text_length).toBe(1000);
		expect(estimate.estimated_tokens).toBeGreaterThan(0);
		expect(estimate.cost_usd).toBeGreaterThan(0);
		expect(estimate.model).toBe('text-embedding-3-large');
	});

	it('handles batch embedding generation', async () => {
		const generator = new OpenAIEmbeddingGenerator('test-api-key');

		// Mock batch response
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				object: 'list',
				data: [
					{ object: 'embedding', embedding: new Array(3072).fill(0.1), index: 0 },
					{ object: 'embedding', embedding: new Array(3072).fill(0.2), index: 1 }
				],
				model: 'text-embedding-3-large',
				usage: { prompt_tokens: 20, total_tokens: 20 }
			})
		});

		const result = await generator.generateBatchEmbeddings(['text 1', 'text 2']);

		expect(result.embeddings).toHaveLength(2);
		expect(result.embeddings[0]).toHaveLength(3072);
		expect(result.cost_usd).toBeGreaterThan(0);
	});
});

describe('Semantic Search: Cosine Similarity', () => {
	let embeddingSearch: EmbeddingSearch;
	let mockTemplates: TemplateWithEmbedding[];

	beforeEach(() => {
		mockTemplates = [
			{
				id: '1',
				slug: 'housing-affordability',
				title: 'Affordable Housing Support',
				description: 'Support for rent control and housing vouchers',
				category: 'housing',
				location_embedding: new Array(3072).fill(0.5),
				topic_embedding: new Array(3072).fill(0.8),
				embedding_version: 'v1',
				jurisdictions: [] as TemplateJurisdiction[],
				send_count: 100,
				quality_score: 85,
				last_sent_at: new Date().toISOString(),
				created_at: new Date().toISOString()
			},
			{
				id: '2',
				slug: 'minimum-wage',
				title: 'Increase Minimum Wage',
				description: 'Raise minimum wage to living wage',
				category: 'labor',
				location_embedding: new Array(3072).fill(0.3),
				topic_embedding: new Array(3072).fill(0.6),
				embedding_version: 'v1',
				jurisdictions: [] as TemplateJurisdiction[],
				send_count: 50,
				quality_score: 70,
				last_sent_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
				created_at: new Date().toISOString()
			}
		];

		embeddingSearch = new EmbeddingSearch(mockTemplates);
	});

	it('calculates cosine similarity correctly', () => {
		const a = [1, 0, 0];
		const b = [1, 0, 0];
		const c = [0, 1, 0];

		// Identical vectors
		expect(embeddingSearch.cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);

		// Orthogonal vectors
		expect(embeddingSearch.cosineSimilarity(a, c)).toBeCloseTo(0.0, 5);
	});

	it('throws error for mismatched dimensions', () => {
		const a = [1, 2, 3];
		const b = [1, 2];

		expect(() => embeddingSearch.cosineSimilarity(a, b)).toThrow('dimension mismatch');
	});
});

describe('Semantic Search: Contextual Boosting', () => {
	let booster: ContextualBooster;
	let userLocation: InferredLocation;
	let mockTemplate: TemplateWithEmbedding;

	beforeEach(() => {
		userLocation = {
			congressional_district: 'TX-18',
			state_code: 'TX',
			county_fips: '48201',
			city_fips: '4835000',
			city_name: 'Houston',
			confidence: 0.95,
			source: 'verified'
		};

		mockTemplate = {
			id: '1',
			slug: 'local-housing',
			title: 'Houston Housing Initiative',
			description: 'Support local housing development',
			category: 'housing',
			location_embedding: null,
			topic_embedding: new Array(3072).fill(0.5),
			embedding_version: 'v1',
			jurisdictions: [
				{
					id: 'j1',
					template_id: '1',
					jurisdiction_type: 'federal',
					congressional_district: 'TX-18',
					state_code: 'TX',
					county_fips: '48201',
					city_fips: '4835000',
					city_name: 'Houston',
					senate_class: null,
					state_senate_district: null,
					state_house_district: null,
					county_name: 'Harris County',
					school_district_id: null,
					school_district_name: null,
					latitude: 29.7604,
					longitude: -95.3698,
					estimated_population: null,
					coverage_notes: null,
					created_at: new Date(),
					updated_at: new Date()
				}
			],
			send_count: 150,
			quality_score: 90,
			last_sent_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
			created_at: new Date().toISOString()
		};

		booster = new ContextualBooster(userLocation, [mockTemplate]);
	});

	it('applies geographic boost for local templates', () => {
		const boost = booster.calculateGeographicBoost(mockTemplate);
		expect(boost).toBeGreaterThan(1.5); // Should get congressional district boost
	});

	it('applies temporal boost for recent templates', () => {
		const boost = booster.calculateTemporalBoost(mockTemplate);
		expect(boost).toBeGreaterThan(1.0); // Recently sent
	});

	it('applies network boost for popular templates', () => {
		const boost = booster.calculateNetworkBoost(mockTemplate);
		expect(boost).toBeGreaterThan(1.5); // > 100 sends
	});

	it('applies impact boost for high-quality templates', () => {
		const boost = booster.calculateImpactBoost(mockTemplate);
		expect(boost).toBeGreaterThan(1.5); // Quality score 90
	});

	it('combines all boosting factors', () => {
		const boost = booster.calculateBoost(mockTemplate);

		expect(boost.geographic).toBeGreaterThan(1.0);
		expect(boost.temporal).toBeGreaterThan(1.0);
		expect(boost.network).toBeGreaterThan(1.0);
		expect(boost.impact).toBeGreaterThan(1.0);
	});

	it('applies total boost to similarity score', () => {
		const similarity = 0.8;
		const boost = booster.calculateBoost(mockTemplate);
		const finalScore = booster.applyBoost(similarity, boost);

		expect(finalScore).toBeGreaterThan(similarity); // Should be boosted
	});
});

describe('Semantic Search: Template Ranking', () => {
	let ranker: TemplateRanker;
	let mockTemplates: TemplateWithEmbedding[];

	beforeEach(() => {
		mockTemplates = [
			{
				id: '1',
				slug: 'housing',
				title: 'Housing',
				description: 'Housing policy',
				category: 'housing',
				location_embedding: null,
				topic_embedding: new Array(3072).fill(0.8),
				embedding_version: 'v1',
				jurisdictions: [],
				send_count: 100,
				quality_score: 85,
				last_sent_at: new Date().toISOString(),
				created_at: new Date().toISOString()
			},
			{
				id: '2',
				slug: 'wages',
				title: 'Wages',
				description: 'Wage policy',
				category: 'labor',
				location_embedding: null,
				topic_embedding: new Array(3072).fill(0.6),
				embedding_version: 'v1',
				jurisdictions: [],
				send_count: 50,
				quality_score: 70,
				last_sent_at: new Date().toISOString(),
				created_at: new Date().toISOString()
			}
		];

		const embeddingSearch = new EmbeddingSearch(mockTemplates);
		const booster = new ContextualBooster(null, mockTemplates);
		ranker = new TemplateRanker(embeddingSearch, booster);
	});

	it('assigns ranks based on final scores', async () => {
		// Mock the embedding generation
		const { api } = await import('$lib/core/api/client');
		vi.mocked(api.post).mockResolvedValue({
			success: true,
			data: { embedding: new Array(3072).fill(0.75) }
		});

		const results = await ranker.rankTemplates({
			query: 'housing affordability',
			limit: 10
		});

		// Check that ranks are assigned
		expect(results[0].rank).toBe(1);
		if (results.length > 1) {
			expect(results[1].rank).toBe(2);
		}

		// Check that results are sorted by final_score
		for (let i = 1; i < results.length; i++) {
			expect(results[i - 1].final_score).toBeGreaterThanOrEqual(results[i].final_score);
		}
	});

	it('explains ranking decisions', async () => {
		const { api } = await import('$lib/core/api/client');
		vi.mocked(api.post).mockResolvedValue({
			success: true,
			data: { embedding: new Array(3072).fill(0.75) }
		});

		const results = await ranker.rankTemplates({
			query: 'housing',
			limit: 1
		});

		const explanation = ranker.explainRanking(results[0]);

		expect(explanation.template_id).toBe(results[0].id);
		expect(explanation.explanation).toContain('Similarity');
		expect(explanation.explanation).toContain('Final score');
	});
});

describe('Semantic Search: Privacy Guarantees', () => {
	it('client-side search never sends query to server for ranking', async () => {
		const mockTemplates: TemplateWithEmbedding[] = [
			{
				id: '1',
				slug: 'test',
				title: 'Test',
				description: 'Test',
				category: 'test',
				location_embedding: null,
				topic_embedding: new Array(3072).fill(0.5),
				embedding_version: 'v1',
				jurisdictions: [],
				send_count: 0,
				quality_score: 50,
				last_sent_at: null,
				created_at: new Date().toISOString()
			}
		];

		const embeddingSearch = new EmbeddingSearch(mockTemplates);

		// Mock API to verify it's only called for embedding generation, not ranking
		const { api } = await import('$lib/core/api/client');
		const mockPost = vi.mocked(api.post);
		mockPost.mockResolvedValue({
			success: true,
			data: { embedding: new Array(3072).fill(0.5) }
		});

		await embeddingSearch.search({ query: 'sensitive query', limit: 10 });

		// Verify API was called once for embedding generation
		expect(mockPost).toHaveBeenCalledTimes(1);
		expect(mockPost).toHaveBeenCalledWith(
			'/api/embeddings/generate',
			{ text: 'sensitive query' },
			expect.any(Object)
		);

		// Verify no additional API calls for ranking
		expect(mockPost).toHaveBeenCalledTimes(1);
	});
});
