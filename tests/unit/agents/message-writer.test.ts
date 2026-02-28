/**
 * Unit Tests — Message Writer Agent + Source Discovery
 *
 * Tests the two-phase pipeline:
 *   Phase 1 (source-discovery.ts): Google Search grounding, URL extraction, validation
 *   Phase 2 (message-writer.ts): Citation-only-from-verified-pool enforcement
 *
 * All Gemini SDK calls and HTTP fetch are mocked.
 */

import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';

// ============================================================================
// Hoisted mocks
// ============================================================================

const mockGenerateContentStream = vi.hoisted(() => vi.fn());

vi.mock('@google/genai', () => {
	class MockGoogleGenAI {
		models = {
			generateContent: vi.fn(),
			generateContentStream: mockGenerateContentStream
		};
		constructor(_opts: { apiKey: string }) {}
	}
	return { GoogleGenAI: MockGoogleGenAI };
});

// Mock the URL validator
const mockValidateUrls = vi.hoisted(() => vi.fn());
vi.mock('$lib/core/agents/utils/url-validator', () => ({
	validateUrls: mockValidateUrls,
	validateUrl: vi.fn(),
	filterValidUrls: vi.fn()
}));

// ============================================================================
// Import SUT
// ============================================================================

import {
	discoverSources,
	formatSourcesForPrompt,
	type VerifiedSource,
	type DiscoveredSource,
	type SourceDiscoveryOptions
} from '$lib/core/agents/agents/source-discovery';
import { generateMessage, type GenerateMessageOptions } from '$lib/core/agents/agents/message-writer';

// ============================================================================
// Helpers
// ============================================================================

/** Create a minimal async iterable for stream mocking */
function makeStream(chunks: Array<{ text?: string; thought?: boolean; usageMetadata?: unknown }>) {
	return {
		[Symbol.asyncIterator]: async function* () {
			for (const chunk of chunks) {
				const parts = chunk.text ? [{
					text: chunk.text,
					...(chunk.thought ? { thought: true } : {})
				}] : [];
				yield {
					text: chunk.text,
					candidates: [{
						content: { parts }
					}],
					usageMetadata: chunk.usageMetadata
				};
			}
		}
	};
}

/** Build a verified source fixture */
function makeVerifiedSource(overrides: Partial<VerifiedSource> = {}): VerifiedSource {
	return {
		num: 1,
		title: 'Test Article',
		url: 'https://example.com/article',
		type: 'journalism',
		snippet: 'A test article about policy',
		relevance: 'Directly addresses the core issue',
		validated: true,
		statusCode: 200,
		date: '2026-02-10',
		publisher: 'Test News',
		...overrides
	};
}

/** Build a standard discovery response JSON */
function makeDiscoveryResponse(sources: Partial<DiscoveredSource>[] = []) {
	const defaultSources = sources.length > 0 ? sources : [
		{
			num: 1,
			title: 'EPA Report on Water Quality',
			url: 'https://epa.gov/water-report-2026',
			type: 'government',
			snippet: 'Latest water quality data',
			relevance: 'Primary government source',
			date: '2026-01-15',
			publisher: 'EPA'
		},
		{
			num: 2,
			title: 'Local News Coverage',
			url: 'https://news.com/water-crisis',
			type: 'journalism',
			snippet: 'Investigative report',
			relevance: 'Recent media coverage',
			date: '2026-02-01',
			publisher: 'Local News'
		},
		{
			num: 3,
			title: 'Academic Study on Contaminants',
			url: 'https://university.edu/study',
			type: 'research',
			snippet: 'Peer-reviewed findings',
			relevance: 'Scientific evidence',
			date: '2025-11-20',
			publisher: 'University Press'
		}
	];

	return JSON.stringify({
		search_queries: ['water quality EPA 2026', 'water contamination local news'],
		sources: defaultSources
	});
}

/** Build a message response JSON */
function makeMessageResponse(overrides: Record<string, unknown> = {}) {
	return JSON.stringify({
		message: 'The water we drink tells a story about priorities. [Personal Connection]\n\nAccording to the latest EPA data [1], contamination levels have risen. Local reporting [2] confirms what residents already know.\n\nWe ask you to act now.',
		sources: [
			{ num: 1, title: 'EPA Report', url: 'https://epa.gov/water-report-2026', type: 'government' },
			{ num: 2, title: 'Local News', url: 'https://news.com/water-crisis', type: 'journalism' }
		],
		research_log: ['Searched EPA database', 'Found local coverage'],
		geographic_scope: { type: 'subnational', country: 'US', subdivision: 'MI', locality: 'Flint' },
		...overrides
	});
}

// ============================================================================
// Tests: Source Discovery (Phase 1)
// ============================================================================

describe('Source Discovery — discoverSources', () => {
	const baseOptions: SourceDiscoveryOptions = {
		coreMessage: 'Our water is contaminated',
		subjectLine: 'Urgent: Water Quality Crisis',
		topics: ['water', 'environment', 'public health']
	};

	beforeEach(() => {
		process.env.GEMINI_API_KEY = 'test-api-key';
		mockGenerateContentStream.mockReset();
		mockValidateUrls.mockReset();
	});

	it('discovers sources via Google Search grounding', async () => {
		mockGenerateContentStream.mockResolvedValueOnce(
			makeStream([{ text: makeDiscoveryResponse() }])
		);
		mockValidateUrls.mockResolvedValueOnce([
			{ url: 'https://epa.gov/water-report-2026', isValid: true, statusCode: 200 },
			{ url: 'https://news.com/water-crisis', isValid: true, statusCode: 200 },
			{ url: 'https://university.edu/study', isValid: true, statusCode: 200 }
		]);

		const result = await discoverSources(baseOptions);

		expect(result.discovered).toHaveLength(3);
		expect(result.verified).toHaveLength(3);
		expect(result.failed).toHaveLength(0);
	});

	it('filters out URLs that fail validation', async () => {
		mockGenerateContentStream.mockResolvedValueOnce(
			makeStream([{ text: makeDiscoveryResponse() }])
		);
		mockValidateUrls.mockResolvedValueOnce([
			{ url: 'https://epa.gov/water-report-2026', isValid: true, statusCode: 200 },
			{ url: 'https://news.com/water-crisis', isValid: false, statusCode: 404, error: 'Not Found' },
			{ url: 'https://university.edu/study', isValid: true, statusCode: 200 }
		]);

		const result = await discoverSources(baseOptions);

		expect(result.verified).toHaveLength(2);
		expect(result.failed).toHaveLength(1);
		expect(result.failed[0].error).toBe('Not Found');
	});

	it('returns empty result when Gemini finds no sources', async () => {
		mockGenerateContentStream.mockResolvedValueOnce(
			makeStream([{ text: '{"search_queries": ["test"], "sources": []}' }])
		);

		const result = await discoverSources(baseOptions);

		expect(result.discovered).toHaveLength(0);
		expect(result.verified).toHaveLength(0);
		expect(result.searchQueries).toEqual(['test']);
	});

	it('throws user-friendly error on JSON extraction failure', async () => {
		mockGenerateContentStream.mockResolvedValueOnce(
			makeStream([{ text: 'completely invalid response @@##$$' }])
		);

		await expect(discoverSources(baseOptions)).rejects.toThrow(
			/research service hit a snag/
		);
	});

	it('captures search queries from discovery response', async () => {
		mockGenerateContentStream.mockResolvedValueOnce(
			makeStream([{ text: makeDiscoveryResponse() }])
		);
		mockValidateUrls.mockResolvedValueOnce([
			{ url: 'https://epa.gov/water-report-2026', isValid: true, statusCode: 200 },
			{ url: 'https://news.com/water-crisis', isValid: true, statusCode: 200 },
			{ url: 'https://university.edu/study', isValid: true, statusCode: 200 }
		]);

		const result = await discoverSources(baseOptions);
		expect(result.searchQueries).toEqual(['water quality EPA 2026', 'water contamination local news']);
	});

	it('renumbers verified sources sequentially after filtering', async () => {
		mockGenerateContentStream.mockResolvedValueOnce(
			makeStream([{ text: makeDiscoveryResponse() }])
		);
		mockValidateUrls.mockResolvedValueOnce([
			{ url: 'https://epa.gov/water-report-2026', isValid: true, statusCode: 200 },
			{ url: 'https://news.com/water-crisis', isValid: false, statusCode: 404 },
			{ url: 'https://university.edu/study', isValid: true, statusCode: 200 }
		]);

		const result = await discoverSources(baseOptions);
		expect(result.verified[0].num).toBe(1);
		expect(result.verified[1].num).toBe(2);
	});

	it('updates URL when redirect occurs during validation', async () => {
		mockGenerateContentStream.mockResolvedValueOnce(
			makeStream([{ text: makeDiscoveryResponse([{
				num: 1,
				title: 'Redirected Page',
				url: 'https://old.gov/page',
				type: 'government',
				snippet: 'Test',
				relevance: 'Test'
			}]) }])
		);
		mockValidateUrls.mockResolvedValueOnce([
			{ url: 'https://old.gov/page', isValid: true, statusCode: 301, finalUrl: 'https://new.gov/page' }
		]);

		const result = await discoverSources(baseOptions);
		expect(result.verified[0].url).toBe('https://new.gov/page');
	});

	it('includes geographic scope in prompt when provided', async () => {
		mockGenerateContentStream.mockResolvedValueOnce(
			makeStream([{ text: '{"search_queries": [], "sources": []}' }])
		);

		await discoverSources({
			...baseOptions,
			geographicScope: {
				type: 'subnational',
				country: 'US',
				subdivision: 'MI',
				locality: 'Flint'
			}
		});

		const callContents = mockGenerateContentStream.mock.calls[0][0].contents;
		expect(callContents).toContain('Flint');
	});

	it('enables Google Search grounding for source discovery', async () => {
		mockGenerateContentStream.mockResolvedValueOnce(
			makeStream([{ text: '{"search_queries": [], "sources": []}' }])
		);

		await discoverSources(baseOptions);

		const callConfig = mockGenerateContentStream.mock.calls[0][0].config;
		expect(callConfig.tools).toEqual([{ googleSearch: {} }]);
	});

	it('includes current year in discovery prompt', async () => {
		mockGenerateContentStream.mockResolvedValueOnce(
			makeStream([{ text: '{"search_queries": [], "sources": []}' }])
		);

		await discoverSources(baseOptions);

		const callContents = mockGenerateContentStream.mock.calls[0][0].contents;
		const currentYear = new Date().getFullYear();
		expect(callContents).toContain(String(currentYear));
	});

	it('calls onThought callback with thoughts', async () => {
		mockGenerateContentStream.mockResolvedValueOnce(
			makeStream([
				{ text: 'Searching for water quality sources...', thought: true },
				{ text: '{"search_queries": [], "sources": []}' }
			])
		);

		const thoughts: string[] = [];
		await discoverSources({
			...baseOptions,
			onThought: (thought) => thoughts.push(thought)
		});

		expect(thoughts.length).toBeGreaterThan(0);
	});

	it('calls onPhase callbacks at each phase', async () => {
		mockGenerateContentStream.mockResolvedValueOnce(
			makeStream([{ text: makeDiscoveryResponse() }])
		);
		mockValidateUrls.mockResolvedValueOnce([
			{ url: 'https://epa.gov/water-report-2026', isValid: true, statusCode: 200 },
			{ url: 'https://news.com/water-crisis', isValid: true, statusCode: 200 },
			{ url: 'https://university.edu/study', isValid: true, statusCode: 200 }
		]);

		const phases: string[] = [];
		await discoverSources({
			...baseOptions,
			onPhase: (phase) => phases.push(phase)
		});

		expect(phases).toContain('discover');
		expect(phases).toContain('validate');
		expect(phases).toContain('complete');
	});

	it('returns token usage from the LLM call', async () => {
		mockGenerateContentStream.mockResolvedValueOnce(
			makeStream([{
				text: '{"search_queries": [], "sources": []}',
				usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 200, totalTokenCount: 700 }
			}])
		);

		const result = await discoverSources(baseOptions);
		expect(result.tokenUsage).toBeDefined();
		expect(result.tokenUsage?.totalTokens).toBe(700);
	});

	it('warns when fewer sources verified than minSources', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		mockGenerateContentStream.mockResolvedValueOnce(
			makeStream([{ text: makeDiscoveryResponse([{
				num: 1,
				title: 'Single Source',
				url: 'https://only.com',
				type: 'journalism',
				snippet: 'Only one',
				relevance: 'Limited'
			}]) }])
		);
		mockValidateUrls.mockResolvedValueOnce([
			{ url: 'https://only.com', isValid: true, statusCode: 200 }
		]);

		const result = await discoverSources({ ...baseOptions, minSources: 3 });
		expect(result.verified).toHaveLength(1);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('Only 1 verified sources')
		);

		warnSpy.mockRestore();
	});

	it('handles all URLs failing validation', async () => {
		mockGenerateContentStream.mockResolvedValueOnce(
			makeStream([{ text: makeDiscoveryResponse() }])
		);
		mockValidateUrls.mockResolvedValueOnce([
			{ url: 'https://epa.gov/water-report-2026', isValid: false, error: 'Timeout' },
			{ url: 'https://news.com/water-crisis', isValid: false, error: 'DNS failed' },
			{ url: 'https://university.edu/study', isValid: false, error: 'Connection refused' }
		]);

		const result = await discoverSources(baseOptions);
		expect(result.verified).toHaveLength(0);
		expect(result.failed).toHaveLength(3);
	});
});

// ============================================================================
// Tests: formatSourcesForPrompt
// ============================================================================

describe('formatSourcesForPrompt', () => {
	it('formats sources with citation numbers and URLs', () => {
		const sources: VerifiedSource[] = [
			makeVerifiedSource({ num: 1, title: 'EPA Report', url: 'https://epa.gov/report' }),
			makeVerifiedSource({ num: 2, title: 'News Article', url: 'https://news.com/story' })
		];

		const formatted = formatSourcesForPrompt(sources);
		expect(formatted).toContain('[1] EPA Report');
		expect(formatted).toContain('URL: https://epa.gov/report');
		expect(formatted).toContain('[2] News Article');
		expect(formatted).toContain('URL: https://news.com/story');
	});

	it('returns no-citations message when sources array is empty', () => {
		const formatted = formatSourcesForPrompt([]);
		expect(formatted).toContain('No verified sources available');
		expect(formatted).toContain('without citations');
	});

	it('includes ONLY citation constraint warning', () => {
		const sources: VerifiedSource[] = [
			makeVerifiedSource()
		];

		const formatted = formatSourcesForPrompt(sources);
		expect(formatted).toContain('ONLY cite sources from this list');
		expect(formatted).toContain('Do not fabricate or modify URLs');
	});

	it('sorts sources by freshness (most recent first)', () => {
		const sources: VerifiedSource[] = [
			makeVerifiedSource({ num: 1, title: 'Old Article', date: '2025-01-01' }),
			makeVerifiedSource({ num: 2, title: 'Fresh Article', date: '2026-02-20' }),
			makeVerifiedSource({ num: 3, title: 'Medium Article', date: '2025-08-15' })
		];

		const formatted = formatSourcesForPrompt(sources);
		const oldIdx = formatted.indexOf('Old Article');
		const freshIdx = formatted.indexOf('Fresh Article');
		const mediumIdx = formatted.indexOf('Medium Article');

		// Fresh should appear before medium, medium before old
		expect(freshIdx).toBeLessThan(mediumIdx);
		expect(mediumIdx).toBeLessThan(oldIdx);
	});

	it('places unknown-date sources last', () => {
		const sources: VerifiedSource[] = [
			makeVerifiedSource({ num: 1, title: 'No Date', date: undefined }),
			makeVerifiedSource({ num: 2, title: 'Has Date', date: '2026-02-01' })
		];

		const formatted = formatSourcesForPrompt(sources);
		const noDateIdx = formatted.indexOf('No Date');
		const hasDateIdx = formatted.indexOf('Has Date');
		expect(hasDateIdx).toBeLessThan(noDateIdx);
	});

	it('includes freshness summary when dates are available', () => {
		const sources: VerifiedSource[] = [
			makeVerifiedSource({ num: 1, date: '2026-02-20' })
		];

		const formatted = formatSourcesForPrompt(sources);
		expect(formatted).toContain('Freshest source:');
		expect(formatted).toContain('days old');
	});

	it('includes type, publisher, and relevance fields', () => {
		const source = makeVerifiedSource({
			type: 'government',
			publisher: 'EPA',
			relevance: 'Official data source'
		});

		const formatted = formatSourcesForPrompt([source]);
		expect(formatted).toContain('Type: government');
		expect(formatted).toContain('Publisher: EPA');
		expect(formatted).toContain('Relevance: Official data source');
	});

	it('shows "Unknown" for missing publisher', () => {
		const source = makeVerifiedSource({ publisher: undefined });
		const formatted = formatSourcesForPrompt([source]);
		expect(formatted).toContain('Publisher: Unknown');
	});

	it('annotates dates with days-ago calculation', () => {
		// Use a fixed recent date to test annotation
		const recentDate = new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0];
		const source = makeVerifiedSource({ date: recentDate });

		const formatted = formatSourcesForPrompt([source]);
		expect(formatted).toMatch(/\d+ days ago/);
	});
});

// ============================================================================
// Tests: Message Writer (Phase 2)
// ============================================================================

describe('Message Writer — generateMessage', () => {
	const baseOptions: GenerateMessageOptions = {
		subjectLine: 'Urgent: Water Quality Crisis',
		coreMessage: 'Our water is contaminated and we demand action',
		topics: ['water', 'environment', 'public health'],
		decisionMakers: [
			{
				name: 'Mayor Jane Smith',
				title: 'Mayor',
				organization: 'City of Flint',
				email: 'mayor@flint.gov',
				reasoning: 'Controls municipal budget',
				sourceUrl: 'https://flint.gov/mayor',
				emailSource: 'https://flint.gov/contact',
				emailGrounded: true,
				confidence: 0.9,
				contactChannel: 'email'
			}
		]
	};

	beforeEach(() => {
		process.env.GEMINI_API_KEY = 'test-api-key';
		mockGenerateContentStream.mockReset();
		mockValidateUrls.mockReset();
	});

	describe('with pre-verified sources (Phase 1 skipped)', () => {
		it('generates message using pre-verified sources', async () => {
			const verifiedSources = [
				makeVerifiedSource({ num: 1, title: 'EPA Report', url: 'https://epa.gov/report' }),
				makeVerifiedSource({ num: 2, title: 'Local News', url: 'https://news.com/story' })
			];

			mockGenerateContentStream.mockResolvedValueOnce(
				makeStream([{ text: makeMessageResponse() }])
			);

			const result = await generateMessage({
				...baseOptions,
				verifiedSources
			});

			expect(result.message).toBeDefined();
			expect(result.message.length).toBeGreaterThan(0);
		});

		it('skips Phase 1 entirely when verifiedSources is provided', async () => {
			const verifiedSources = [makeVerifiedSource()];

			mockGenerateContentStream.mockResolvedValueOnce(
				makeStream([{ text: makeMessageResponse() }])
			);

			await generateMessage({
				...baseOptions,
				verifiedSources
			});

			// Should only have 1 stream call (Phase 2), not 2 (Phase 1 + Phase 2)
			expect(mockGenerateContentStream).toHaveBeenCalledTimes(1);
		});

		it('replaces generated sources with verified source pool', async () => {
			const verifiedSources = [
				makeVerifiedSource({ num: 1, title: 'VERIFIED Source', url: 'https://verified.gov/page' })
			];

			mockGenerateContentStream.mockResolvedValueOnce(
				makeStream([{ text: makeMessageResponse() }])
			);

			const result = await generateMessage({
				...baseOptions,
				verifiedSources
			});

			// Sources in output should be the verified ones, not what the model generated
			expect(result.sources[0].url).toBe('https://verified.gov/page');
			expect(result.sources[0].title).toBe('VERIFIED Source');
		});

		it('normalizes [Personal Connection] case variations', async () => {
			const messageJson = JSON.stringify({
				message: 'This matters to us. [personal connection] is why we care.',
				sources: [],
				geographic_scope: { type: 'subnational', country: 'US', locality: 'Flint' }
			});

			mockGenerateContentStream.mockResolvedValueOnce(
				makeStream([{ text: messageJson }])
			);

			const result = await generateMessage({
				...baseOptions,
				verifiedSources: [makeVerifiedSource()]
			});

			expect(result.message).toContain('[Personal Connection]');
			expect(result.message).not.toContain('[personal connection]');
		});

		it('appends [Name] signature to message', async () => {
			mockGenerateContentStream.mockResolvedValueOnce(
				makeStream([{ text: makeMessageResponse() }])
			);

			const result = await generateMessage({
				...baseOptions,
				verifiedSources: [makeVerifiedSource()]
			});

			expect(result.message).toMatch(/\[Name\]$/);
		});

		it('disables grounding in Phase 2 (prevents URL hallucination)', async () => {
			mockGenerateContentStream.mockResolvedValueOnce(
				makeStream([{ text: makeMessageResponse() }])
			);

			await generateMessage({
				...baseOptions,
				verifiedSources: [makeVerifiedSource()]
			});

			const callConfig = mockGenerateContentStream.mock.calls[0][0].config;
			// grounding should NOT be enabled in Phase 2
			expect(callConfig.tools).toBeUndefined();
		});

		it('uses temperature 0.8 for message generation (creative latitude)', async () => {
			mockGenerateContentStream.mockResolvedValueOnce(
				makeStream([{ text: makeMessageResponse() }])
			);

			await generateMessage({
				...baseOptions,
				verifiedSources: [makeVerifiedSource()]
			});

			const callConfig = mockGenerateContentStream.mock.calls[0][0].config;
			expect(callConfig.temperature).toBe(0.8);
		});
	});

	describe('full pipeline (Phase 1 + Phase 2)', () => {
		it('runs source discovery then message generation', async () => {
			// Phase 1: source discovery
			mockGenerateContentStream.mockResolvedValueOnce(
				makeStream([{ text: makeDiscoveryResponse() }])
			);
			mockValidateUrls.mockResolvedValueOnce([
				{ url: 'https://epa.gov/water-report-2026', isValid: true, statusCode: 200 },
				{ url: 'https://news.com/water-crisis', isValid: true, statusCode: 200 },
				{ url: 'https://university.edu/study', isValid: true, statusCode: 200 }
			]);

			// Phase 2: message generation
			mockGenerateContentStream.mockResolvedValueOnce(
				makeStream([{ text: makeMessageResponse() }])
			);

			const result = await generateMessage(baseOptions);

			expect(mockGenerateContentStream).toHaveBeenCalledTimes(2);
			expect(result.message).toBeDefined();
			expect(result.sources.length).toBeGreaterThan(0);
		});

		it('uses actual search queries as research_log (not model-fabricated ones)', async () => {
			// Phase 1
			mockGenerateContentStream.mockResolvedValueOnce(
				makeStream([{ text: makeDiscoveryResponse() }])
			);
			mockValidateUrls.mockResolvedValueOnce([
				{ url: 'https://epa.gov/water-report-2026', isValid: true, statusCode: 200 },
				{ url: 'https://news.com/water-crisis', isValid: true, statusCode: 200 },
				{ url: 'https://university.edu/study', isValid: true, statusCode: 200 }
			]);

			// Phase 2
			mockGenerateContentStream.mockResolvedValueOnce(
				makeStream([{ text: makeMessageResponse() }])
			);

			const result = await generateMessage(baseOptions);

			// research_log should contain the REAL search queries from Phase 1
			expect(result.research_log).toEqual([
				'water quality EPA 2026',
				'water contamination local news'
			]);
		});

		it('accumulates token usage across both phases', async () => {
			// Phase 1 with token usage
			mockGenerateContentStream.mockResolvedValueOnce(
				makeStream([{
					text: makeDiscoveryResponse(),
					usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 200, totalTokenCount: 700 }
				}])
			);
			mockValidateUrls.mockResolvedValueOnce([
				{ url: 'https://epa.gov/water-report-2026', isValid: true, statusCode: 200 },
				{ url: 'https://news.com/water-crisis', isValid: true, statusCode: 200 },
				{ url: 'https://university.edu/study', isValid: true, statusCode: 200 }
			]);

			// Phase 2 with token usage
			mockGenerateContentStream.mockResolvedValueOnce(
				makeStream([{
					text: makeMessageResponse(),
					usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 500, totalTokenCount: 1500 }
				}])
			);

			const result = await generateMessage(baseOptions);
			expect(result.tokenUsage).toBeDefined();
			expect(result.tokenUsage!.totalTokens).toBe(2200);
		});
	});

	describe('error handling', () => {
		it('throws user-friendly error on Phase 2 JSON extraction failure', async () => {
			mockGenerateContentStream.mockResolvedValueOnce(
				makeStream([{ text: 'not valid JSON !!@@##' }])
			);

			await expect(generateMessage({
				...baseOptions,
				verifiedSources: [makeVerifiedSource()]
			})).rejects.toThrow(/hit a snag/);
		});

		it('throws user-friendly error on Zod validation failure', async () => {
			// Valid JSON but wrong structure
			const invalidStructure = JSON.stringify({
				not_message: 'wrong field',
				not_sources: []
			});

			mockGenerateContentStream.mockResolvedValueOnce(
				makeStream([{ text: invalidStructure }])
			);

			await expect(generateMessage({
				...baseOptions,
				verifiedSources: [makeVerifiedSource()]
			})).rejects.toThrow(/hit a snag/);
		});
	});

	describe('geographic scope coercion', () => {
		it('parses standard GeoScope object', async () => {
			const msgJson = JSON.stringify({
				message: 'Test message with [Personal Connection].',
				sources: [],
				geographic_scope: { type: 'nationwide', country: 'US' }
			});

			mockGenerateContentStream.mockResolvedValueOnce(
				makeStream([{ text: msgJson }])
			);

			const result = await generateMessage({
				...baseOptions,
				verifiedSources: [makeVerifiedSource()]
			});

			expect(result.geographic_scope).toEqual({ type: 'nationwide', country: 'US' });
		});

		it('coerces plain string geographic_scope into subnational', async () => {
			const msgJson = JSON.stringify({
				message: 'Test message with [Personal Connection].',
				sources: [],
				geographic_scope: 'San Francisco, CA'
			});

			mockGenerateContentStream.mockResolvedValueOnce(
				makeStream([{ text: msgJson }])
			);

			const result = await generateMessage({
				...baseOptions,
				verifiedSources: [makeVerifiedSource()]
			});

			expect(result.geographic_scope?.type).toBe('subnational');
		});

		it('coerces old { scope_level, scope_display } format', async () => {
			const msgJson = JSON.stringify({
				message: 'Test message with [Personal Connection].',
				sources: [],
				geographic_scope: { scope_level: 'national', scope_display: 'United States' }
			});

			mockGenerateContentStream.mockResolvedValueOnce(
				makeStream([{ text: msgJson }])
			);

			const result = await generateMessage({
				...baseOptions,
				verifiedSources: [makeVerifiedSource()]
			});

			expect(result.geographic_scope?.type).toBe('nationwide');
		});
	});

	describe('prompt construction', () => {
		it('includes decision-maker names and titles in prompt', async () => {
			mockGenerateContentStream.mockResolvedValueOnce(
				makeStream([{ text: makeMessageResponse() }])
			);

			await generateMessage({
				...baseOptions,
				verifiedSources: [makeVerifiedSource()]
			});

			const callContents = mockGenerateContentStream.mock.calls[0][0].contents;
			expect(callContents).toContain('Mayor Jane Smith');
			expect(callContents).toContain('Mayor');
			expect(callContents).toContain('City of Flint');
		});

		it('includes voice sample in prompt when provided', async () => {
			mockGenerateContentStream.mockResolvedValueOnce(
				makeStream([{ text: makeMessageResponse() }])
			);

			await generateMessage({
				...baseOptions,
				verifiedSources: [makeVerifiedSource()],
				voiceSample: 'I am furious about the contamination in our water'
			});

			const callContents = mockGenerateContentStream.mock.calls[0][0].contents;
			expect(callContents).toContain('I am furious about the contamination');
		});

		it('includes raw input in prompt when provided', async () => {
			mockGenerateContentStream.mockResolvedValueOnce(
				makeStream([{ text: makeMessageResponse() }])
			);

			await generateMessage({
				...baseOptions,
				verifiedSources: [makeVerifiedSource()],
				rawInput: 'The water tastes metallic and my kids are getting sick'
			});

			const callContents = mockGenerateContentStream.mock.calls[0][0].contents;
			expect(callContents).toContain('The water tastes metallic');
		});

		it('includes current date in system prompt', async () => {
			mockGenerateContentStream.mockResolvedValueOnce(
				makeStream([{ text: makeMessageResponse() }])
			);

			await generateMessage({
				...baseOptions,
				verifiedSources: [makeVerifiedSource()]
			});

			const callConfig = mockGenerateContentStream.mock.calls[0][0].config;
			const currentYear = new Date().getFullYear();
			expect(callConfig.systemInstruction).toContain(String(currentYear));
		});

		it('includes verified sources block in prompt', async () => {
			const verifiedSources = [
				makeVerifiedSource({ num: 1, title: 'Test EPA Report', url: 'https://epa.gov/test' })
			];

			mockGenerateContentStream.mockResolvedValueOnce(
				makeStream([{ text: makeMessageResponse() }])
			);

			await generateMessage({
				...baseOptions,
				verifiedSources
			});

			const callContents = mockGenerateContentStream.mock.calls[0][0].contents;
			expect(callContents).toContain('Test EPA Report');
			expect(callContents).toContain('https://epa.gov/test');
		});
	});

	describe('callbacks', () => {
		it('calls onPhase with phase transitions', async () => {
			mockGenerateContentStream.mockResolvedValueOnce(
				makeStream([{ text: makeMessageResponse() }])
			);

			const phases: string[] = [];
			await generateMessage({
				...baseOptions,
				verifiedSources: [makeVerifiedSource()],
				onPhase: (phase) => phases.push(phase)
			});

			expect(phases).toContain('message');
			expect(phases).toContain('complete');
		});

		it('calls onThought during message generation phase', async () => {
			mockGenerateContentStream.mockResolvedValueOnce(
				makeStream([
					{ text: 'thinking about emotional arc...', thought: true },
					{ text: makeMessageResponse() }
				])
			);

			const thoughts: Array<{ thought: string; phase?: string }> = [];
			await generateMessage({
				...baseOptions,
				verifiedSources: [makeVerifiedSource()],
				onThought: (thought, phase) => thoughts.push({ thought, phase })
			});

			expect(thoughts.length).toBeGreaterThan(0);
			expect(thoughts[0].phase).toBe('message');
		});

		it('calls onPhase with source count in complete message', async () => {
			const verifiedSources = [
				makeVerifiedSource({ num: 1 }),
				makeVerifiedSource({ num: 2 })
			];

			mockGenerateContentStream.mockResolvedValueOnce(
				makeStream([{ text: makeMessageResponse() }])
			);

			let completeMessage = '';
			await generateMessage({
				...baseOptions,
				verifiedSources,
				onPhase: (phase, message) => {
					if (phase === 'complete') completeMessage = message;
				}
			});

			expect(completeMessage).toContain('2 verified sources');
		});
	});
});

// ============================================================================
// Tests: daysSince (tested indirectly via formatSourcesForPrompt)
// ============================================================================

describe('Source freshness ranking', () => {
	it('handles Unknown date gracefully', () => {
		const source = makeVerifiedSource({ date: 'Unknown' });
		const formatted = formatSourcesForPrompt([source]);
		expect(formatted).toContain('Date: Unknown');
	});

	it('handles unparseable date strings', () => {
		const source = makeVerifiedSource({ date: 'not a date' });
		const formatted = formatSourcesForPrompt([source]);
		// Should not crash
		expect(formatted).toContain('Date: not a date');
	});

	it('handles partial dates like "January 2026"', () => {
		const source = makeVerifiedSource({ date: 'January 2026' });
		const formatted = formatSourcesForPrompt([source]);
		expect(formatted).toContain('January 2026');
		// Should parse and annotate with days ago
		expect(formatted).toMatch(/days ago/);
	});

	it('handles ISO date format', () => {
		const source = makeVerifiedSource({ date: '2026-02-15' });
		const formatted = formatSourcesForPrompt([source]);
		expect(formatted).toContain('2026-02-15');
		expect(formatted).toMatch(/days ago/);
	});

	it('correctly orders multiple sources by freshness', () => {
		const sources: VerifiedSource[] = [
			makeVerifiedSource({ num: 1, title: 'A_OLDEST', date: '2024-01-01' }),
			makeVerifiedSource({ num: 2, title: 'B_NEWEST', date: '2026-02-22' }),
			makeVerifiedSource({ num: 3, title: 'C_MIDDLE', date: '2025-06-15' }),
			makeVerifiedSource({ num: 4, title: 'D_NO_DATE', date: undefined })
		];

		const formatted = formatSourcesForPrompt(sources);
		const positions = {
			newest: formatted.indexOf('B_NEWEST'),
			middle: formatted.indexOf('C_MIDDLE'),
			oldest: formatted.indexOf('A_OLDEST'),
			noDate: formatted.indexOf('D_NO_DATE')
		};

		expect(positions.newest).toBeLessThan(positions.middle);
		expect(positions.middle).toBeLessThan(positions.oldest);
		expect(positions.oldest).toBeLessThan(positions.noDate);
	});
});
