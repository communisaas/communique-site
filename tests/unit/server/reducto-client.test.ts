/**
 * Unit tests for Reducto Document Client (reducto/client.ts)
 *
 * Tests the PDF/document parsing API wrapper with Postgres JSONB caching.
 * Covers the full lifecycle: cache key generation, API calls, cache hit/miss,
 * response transformation, relevance scoring, and error handling.
 *
 * Mocks:
 * - global fetch (API calls to Reducto)
 * - $lib/core/db (Prisma database operations for JSONB cache)
 *
 * Tested behaviors:
 * - Cache key generation (SHA256 of URL)
 * - JSONB serialization/deserialization via Prisma
 * - API call: request format, headers, Bearer token
 * - Cache hit: returns cached result without API call
 * - Cache miss: calls API, stores result in JSONB cache
 * - Cache statistics
 * - Document type inference from URL
 * - Source name extraction from hostname
 * - Section extraction from chunks
 * - Entity extraction and type mapping
 * - Query relevance computation
 * - Error handling: API errors, malformed responses, missing API key
 * - Singleton management (getReductoClient, resetReductoClient)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';

// ============================================================================
// Hoisted mock variables
// ============================================================================

const mockFindUnique = vi.hoisted(() => vi.fn());
const mockFindFirst = vi.hoisted(() => vi.fn());
const mockFindMany = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockUpsert = vi.hoisted(() => vi.fn());
const mockCount = vi.hoisted(() => vi.fn());
const mockGroupBy = vi.hoisted(() => vi.fn());

// ============================================================================
// Module mocks
// ============================================================================

vi.mock('$lib/core/db', () => ({
	db: {
		parsedDocumentCache: {
			findUnique: (...args: unknown[]) => mockFindUnique(...args),
			findFirst: (...args: unknown[]) => mockFindFirst(...args),
			findMany: (...args: unknown[]) => mockFindMany(...args),
			update: (...args: unknown[]) => mockUpdate(...args),
			upsert: (...args: unknown[]) => mockUpsert(...args),
			count: (...args: unknown[]) => mockCount(...args),
			groupBy: (...args: unknown[]) => mockGroupBy(...args)
		}
	}
}));

// ============================================================================
// Import SUT after mocks
// ============================================================================

import {
	ReductoClient,
	getReductoClient,
	resetReductoClient
} from '$lib/server/reducto/client';

// ============================================================================
// Test helpers
// ============================================================================

const TEST_API_KEY = 'test-reducto-api-key-123';

function createClient(apiKey: string = TEST_API_KEY): ReductoClient {
	return new ReductoClient(apiKey);
}

function urlHash(url: string): string {
	return createHash('sha256').update(url).digest('hex');
}

/** Build a minimal Reducto API response */
function mockReductoResponse(overrides: Record<string, unknown> = {}) {
	return {
		job_id: 'job-abc123',
		title: 'Test Document',
		metadata: {
			title: 'Test Document',
			date: '2026-01-15',
			page_count: 3
		},
		chunks: [
			{ type: 'heading', text: 'Introduction', level: 1 },
			{ type: 'paragraph', text: 'This is the introduction content about climate policy.' },
			{ type: 'heading', text: 'Section Two', level: 1 },
			{ type: 'paragraph', text: 'Details about energy regulations and carbon taxes.' }
		],
		entities: [
			{ type: 'date', value: '2026-01-15', context: 'Published on 2026-01-15' },
			{ type: 'organization', value: 'EPA', context: 'The EPA issued new guidelines' }
		],
		...overrides
	};
}

/** Build a minimal cached document */
function mockCachedDocument(url: string, overrides: Record<string, unknown> = {}) {
	return {
		id: 'cache-1',
		source_url: url,
		source_url_hash: urlHash(url),
		document_type: 'legislative',
		document: {
			id: 'doc-123',
			title: 'Cached Document',
			source: { name: 'congress.gov', url, type: 'legislative' },
			type: 'legislative',
			sections: [
				{
					id: 'section-1',
					title: 'Overview',
					level: 0,
					content: 'This bill addresses healthcare reform and insurance requirements.'
				}
			],
			entities: [],
			crossRefs: [],
			metadata: {
				parsedAt: new Date('2026-01-10'),
				sourceUrl: url,
				pageCount: 2
			}
		},
		expires_at: new Date(Date.now() + 86400000), // expires tomorrow
		hit_count: 5,
		created_at: new Date('2026-01-10'),
		last_accessed_at: new Date('2026-01-20'),
		...overrides
	};
}

/** Mock successful fetch response */
function mockFetchResponse(body: unknown, status = 200) {
	return {
		ok: status >= 200 && status < 300,
		status,
		text: async () => JSON.stringify(body),
		json: async () => body
	};
}

// ============================================================================
// Tests
// ============================================================================

describe('ReductoClient', () => {
	let client: ReductoClient;

	beforeEach(() => {
		vi.clearAllMocks();
		client = createClient();
		// Reset fetch mock
		vi.stubGlobal('fetch', vi.fn());
	});

	// =========================================================================
	// Constructor / API Key
	// =========================================================================

	describe('constructor', () => {
		it('should accept API key in constructor', () => {
			const c = new ReductoClient('my-key');
			// No error means success - the key is stored internally
			expect(c).toBeInstanceOf(ReductoClient);
		});

		it('should warn when no API key is provided', () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			// Temporarily clear env
			const orig = process.env.REDUCTO_API_KEY;
			delete process.env.REDUCTO_API_KEY;

			new ReductoClient('');

			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('No API key provided')
			);

			process.env.REDUCTO_API_KEY = orig;
			warnSpy.mockRestore();
		});

		it('should fall back to REDUCTO_API_KEY env var', () => {
			process.env.REDUCTO_API_KEY = 'env-key';
			const c = new ReductoClient();
			expect(c).toBeInstanceOf(ReductoClient);
			delete process.env.REDUCTO_API_KEY;
		});
	});

	// =========================================================================
	// Cache Key Generation
	// =========================================================================

	describe('cache key generation', () => {
		it('should generate SHA256 hash from URL for cache lookups', async () => {
			const testUrl = 'https://congress.gov/bill/hr-1234';
			const expectedHash = urlHash(testUrl);

			mockFindUnique.mockResolvedValue(null);
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse()) as any
			);
			mockUpsert.mockResolvedValue({});

			await client.parse({ url: testUrl });

			// Verify the cache lookup used the correct hash
			expect(mockFindUnique).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { source_url_hash: expectedHash }
				})
			);
		});

		it('should produce different hashes for different URLs', () => {
			const hash1 = urlHash('https://example.com/doc1');
			const hash2 = urlHash('https://example.com/doc2');
			expect(hash1).not.toBe(hash2);
		});

		it('should produce consistent hashes for the same URL', () => {
			const url = 'https://congress.gov/bill/hr-1234';
			expect(urlHash(url)).toBe(urlHash(url));
		});

		it('should produce 64-character hex hashes', () => {
			const hash = urlHash('https://example.com');
			expect(hash).toMatch(/^[0-9a-f]{64}$/);
		});
	});

	// =========================================================================
	// Cache Hit
	// =========================================================================

	describe('cache hit', () => {
		it('should return cached result without calling fetch', async () => {
			const testUrl = 'https://congress.gov/bill/hr-9999';
			const cached = mockCachedDocument(testUrl);

			mockFindUnique.mockResolvedValue(cached);
			mockUpdate.mockResolvedValue({});

			const result = await client.parse({ url: testUrl });

			expect(result.success).toBe(true);
			expect(result.cached).toBe(true);
			expect(result.document?.title).toBe('Cached Document');
			expect(fetch).not.toHaveBeenCalled();
		});

		it('should increment hit_count on cache hit', async () => {
			const testUrl = 'https://congress.gov/bill/hr-9999';
			const cached = mockCachedDocument(testUrl);

			mockFindUnique.mockResolvedValue(cached);
			mockUpdate.mockResolvedValue({});

			await client.parse({ url: testUrl });

			expect(mockUpdate).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: cached.id },
					data: expect.objectContaining({
						hit_count: { increment: 1 }
					})
				})
			);
		});

		it('should update last_accessed_at on cache hit', async () => {
			const testUrl = 'https://congress.gov/bill/hr-9999';
			const cached = mockCachedDocument(testUrl);

			mockFindUnique.mockResolvedValue(cached);
			mockUpdate.mockResolvedValue({});

			await client.parse({ url: testUrl });

			expect(mockUpdate).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						last_accessed_at: expect.any(Date)
					})
				})
			);
		});

		it('should treat expired cache entries as cache misses', async () => {
			const testUrl = 'https://congress.gov/bill/hr-expired';
			const expiredCache = mockCachedDocument(testUrl, {
				expires_at: new Date(Date.now() - 86400000) // expired yesterday
			});

			mockFindUnique.mockResolvedValue(expiredCache);
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse()) as any
			);
			mockUpsert.mockResolvedValue({});

			const result = await client.parse({ url: testUrl });

			// Should have called the API since cache is expired
			expect(result.cached).toBe(false);
			expect(fetch).toHaveBeenCalled();
		});

		it('should compute query relevance on cached document when query is provided', async () => {
			const testUrl = 'https://congress.gov/bill/hr-9999';
			const cached = mockCachedDocument(testUrl);

			mockFindUnique.mockResolvedValue(cached);
			mockUpdate.mockResolvedValue({});

			const result = await client.parse({
				url: testUrl,
				query: 'healthcare reform'
			});

			expect(result.success).toBe(true);
			expect(result.document?.queryRelevance).toBeDefined();
			expect(result.document?.queryRelevance?.score).toBeGreaterThan(0);
		});
	});

	// =========================================================================
	// Cache Miss -> API Call
	// =========================================================================

	describe('cache miss -> API call', () => {
		it('should call Reducto API with correct URL and headers', async () => {
			const testUrl = 'https://congress.gov/bill/hr-5678';

			mockFindUnique.mockResolvedValue(null);
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse()) as any
			);
			mockUpsert.mockResolvedValue({});

			await client.parse({ url: testUrl });

			expect(fetch).toHaveBeenCalledWith(
				'https://api.reducto.ai/v1/parse',
				expect.objectContaining({
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${TEST_API_KEY}`
					},
					body: expect.any(String)
				})
			);
		});

		it('should send correct request body to Reducto API', async () => {
			const testUrl = 'https://congress.gov/bill/hr-5678';

			mockFindUnique.mockResolvedValue(null);
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse()) as any
			);
			mockUpsert.mockResolvedValue({});

			await client.parse({ url: testUrl });

			const callArgs = vi.mocked(fetch).mock.calls[0];
			const body = JSON.parse(callArgs[1]!.body as string);

			expect(body.url).toBe(testUrl);
			expect(body.options.extract_tables).toBe(true);
			expect(body.options.extract_images).toBe(false);
			expect(body.options.chunking_strategy).toBe('semantic');
		});

		it('should save parsed document to cache after successful API call', async () => {
			const testUrl = 'https://congress.gov/bill/hr-5678';
			const expectedHash = urlHash(testUrl);

			mockFindUnique.mockResolvedValue(null);
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse()) as any
			);
			mockUpsert.mockResolvedValue({});

			await client.parse({ url: testUrl });

			expect(mockUpsert).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { source_url_hash: expectedHash },
					create: expect.objectContaining({
						source_url: testUrl,
						source_url_hash: expectedHash,
						document_type: expect.any(String)
					}),
					update: expect.objectContaining({
						document_type: expect.any(String)
					})
				})
			);
		});

		it('should return cached: false on cache miss', async () => {
			const testUrl = 'https://congress.gov/bill/hr-5678';

			mockFindUnique.mockResolvedValue(null);
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse()) as any
			);
			mockUpsert.mockResolvedValue({});

			const result = await client.parse({ url: testUrl });

			expect(result.cached).toBe(false);
			expect(result.success).toBe(true);
		});

		it('should compute query relevance on freshly parsed document', async () => {
			const testUrl = 'https://congress.gov/bill/hr-5678';

			mockFindUnique.mockResolvedValue(null);
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse()) as any
			);
			mockUpsert.mockResolvedValue({});

			const result = await client.parse({
				url: testUrl,
				query: 'climate policy'
			});

			expect(result.document?.queryRelevance).toBeDefined();
			expect(result.document?.queryRelevance?.score).toBeGreaterThan(0);
		});
	});

	// =========================================================================
	// Document Type Inference
	// =========================================================================

	describe('document type inference', () => {
		beforeEach(() => {
			mockFindUnique.mockResolvedValue(null);
			mockUpsert.mockResolvedValue({});
		});

		it('should infer "legislative" for congress.gov URLs', async () => {
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse()) as any
			);

			const result = await client.parse({ url: 'https://congress.gov/bill/hr-1' });

			expect(result.document?.type).toBe('legislative');
		});

		it('should infer "legislative" for govinfo.gov URLs', async () => {
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse()) as any
			);

			const result = await client.parse({ url: 'https://www.govinfo.gov/content/pkg/BILLS-117' });

			expect(result.document?.type).toBe('legislative');
		});

		it('should infer "corporate" for sec.gov URLs', async () => {
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse()) as any
			);

			const result = await client.parse({ url: 'https://sec.gov/cgi-bin/browse-edgar' });

			expect(result.document?.type).toBe('corporate');
		});

		it('should infer "corporate" for edgar URLs', async () => {
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse()) as any
			);

			const result = await client.parse({ url: 'https://efts.sec.gov/LATEST/search-index?q=edgar' });

			expect(result.document?.type).toBe('corporate');
		});

		it('should infer "official" for .gov URLs', async () => {
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse()) as any
			);

			const result = await client.parse({ url: 'https://www.epa.gov/report' });

			expect(result.document?.type).toBe('official');
		});

		it('should infer "academic" for arxiv URLs', async () => {
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse()) as any
			);

			const result = await client.parse({ url: 'https://arxiv.org/abs/2401.12345' });

			expect(result.document?.type).toBe('academic');
		});

		it('should infer "academic" for .edu URLs', async () => {
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse()) as any
			);

			const result = await client.parse({ url: 'https://www.mit.edu/research/paper.pdf' });

			expect(result.document?.type).toBe('academic');
		});

		it('should default to "media" for unknown URLs', async () => {
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse()) as any
			);

			const result = await client.parse({ url: 'https://www.nytimes.com/article' });

			expect(result.document?.type).toBe('media');
		});

		it('should use provided type hint over inference', async () => {
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse()) as any
			);

			const result = await client.parse({
				url: 'https://www.nytimes.com/article',
				type: 'official'
			});

			expect(result.document?.type).toBe('official');
		});
	});

	// =========================================================================
	// Response Transformation
	// =========================================================================

	describe('response transformation', () => {
		beforeEach(() => {
			mockFindUnique.mockResolvedValue(null);
			mockUpsert.mockResolvedValue({});
		});

		it('should extract document title from response', async () => {
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse({ title: 'My Bill Title' })) as any
			);

			const result = await client.parse({ url: 'https://congress.gov/bill/hr-1' });

			expect(result.document?.title).toBe('My Bill Title');
		});

		it('should fall back to metadata title when title is missing', async () => {
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse({
					title: undefined,
					metadata: { title: 'Metadata Title', page_count: 1 }
				})) as any
			);

			const result = await client.parse({ url: 'https://congress.gov/bill/hr-1' });

			expect(result.document?.title).toBe('Metadata Title');
		});

		it('should use "Untitled Document" when no title is available', async () => {
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse({
					title: undefined,
					metadata: {}
				})) as any
			);

			const result = await client.parse({ url: 'https://congress.gov/bill/hr-1' });

			expect(result.document?.title).toBe('Untitled Document');
		});

		it('should extract sections from chunks', async () => {
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse()) as any
			);

			const result = await client.parse({ url: 'https://congress.gov/bill/hr-1' });
			const sections = result.document?.sections ?? [];

			expect(sections.length).toBeGreaterThanOrEqual(2);
			expect(sections[0].title).toBe('Introduction');
			expect(sections[0].content).toContain('climate policy');
		});

		it('should create implicit Introduction section for leading non-heading chunks', async () => {
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse({
					chunks: [
						{ type: 'paragraph', text: 'Leading text without heading' }
					]
				})) as any
			);

			const result = await client.parse({ url: 'https://example.com/doc' });
			const sections = result.document?.sections ?? [];

			expect(sections[0].title).toBe('Introduction');
			expect(sections[0].content).toBe('Leading text without heading');
		});

		it('should extract entities from API response', async () => {
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse()) as any
			);

			const result = await client.parse({ url: 'https://congress.gov/bill/hr-1' });
			const entities = result.document?.entities ?? [];

			expect(entities.length).toBe(2);
			expect(entities[0].type).toBe('date');
			expect(entities[0].value).toBe('2026-01-15');
			expect(entities[1].type).toBe('organization');
			expect(entities[1].value).toBe('EPA');
		});

		it('should map entity types correctly', async () => {
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse({
					entities: [
						{ type: 'money', value: '$1M', context: 'Budget of $1M' },
						{ type: 'person', value: 'Jane Doe', context: 'Rep. Jane Doe' },
						{ type: 'location', value: 'DC', context: 'Washington DC' },
						{ type: 'citation', value: 'HR 1234', context: 'Amends HR 1234' },
						{ type: 'unknown_type', value: 'X', context: 'Unknown' }
					]
				})) as any
			);

			const result = await client.parse({ url: 'https://congress.gov/bill/hr-1' });
			const entities = result.document?.entities ?? [];

			expect(entities[0].type).toBe('amount');
			expect(entities[1].type).toBe('person');
			expect(entities[2].type).toBe('location');
			expect(entities[3].type).toBe('reference');
			expect(entities[4].type).toBe('reference'); // default fallback
		});

		it('should extract source name from hostname', async () => {
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse()) as any
			);

			const result = await client.parse({ url: 'https://www.congress.gov/bill/hr-1' });

			expect(result.document?.source.name).toBe('congress');
		});

		it('should use job_id from API response as document ID', async () => {
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse({ job_id: 'reducto-job-xyz' })) as any
			);

			const result = await client.parse({ url: 'https://congress.gov/bill/hr-1' });

			expect(result.document?.id).toBe('reducto-job-xyz');
		});

		it('should generate hash-based ID when job_id is missing', async () => {
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse({ job_id: undefined })) as any
			);

			const result = await client.parse({ url: 'https://congress.gov/bill/hr-1' });

			// Should be a 16-char hex hash
			expect(result.document?.id).toMatch(/^[0-9a-f]{16}$/);
		});

		it('should include metadata with parsedAt, sourceUrl, and pageCount', async () => {
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse()) as any
			);

			const result = await client.parse({ url: 'https://congress.gov/bill/hr-1' });
			const metadata = result.document?.metadata;

			expect(metadata).toBeDefined();
			expect(metadata?.parsedAt).toBeInstanceOf(Date);
			expect(metadata?.sourceUrl).toBe('https://congress.gov/bill/hr-1');
			expect(metadata?.pageCount).toBe(3);
			expect(metadata?.reductoJobId).toBe('job-abc123');
		});
	});

	// =========================================================================
	// Error Handling
	// =========================================================================

	describe('error handling', () => {
		it('should return error when API key is missing', async () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			const noKeyClient = new ReductoClient('');

			mockFindUnique.mockResolvedValue(null);

			const result = await noKeyClient.parse({ url: 'https://example.com/doc' });

			expect(result.success).toBe(false);
			expect(result.error).toContain('API key not configured');

			warnSpy.mockRestore();
			errorSpy.mockRestore();
		});

		it('should return error on API 500 response', async () => {
			const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			mockFindUnique.mockResolvedValue(null);
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse('Internal Server Error', 500) as any
			);

			const result = await client.parse({ url: 'https://example.com/doc' });

			expect(result.success).toBe(false);
			expect(result.error).toContain('500');

			errorSpy.mockRestore();
		});

		it('should return error on API 401 response', async () => {
			const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			mockFindUnique.mockResolvedValue(null);
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse('Unauthorized', 401) as any
			);

			const result = await client.parse({ url: 'https://example.com/doc' });

			expect(result.success).toBe(false);
			expect(result.error).toContain('401');

			errorSpy.mockRestore();
		});

		it('should return error on network failure', async () => {
			const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			mockFindUnique.mockResolvedValue(null);
			vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

			const result = await client.parse({ url: 'https://example.com/doc' });

			expect(result.success).toBe(false);
			expect(result.error).toBe('Network error');

			errorSpy.mockRestore();
		});

		it('should handle cache read failure gracefully', async () => {
			const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			mockFindUnique.mockRejectedValue(new Error('DB connection lost'));
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse()) as any
			);
			mockUpsert.mockResolvedValue({});

			const result = await client.parse({ url: 'https://example.com/doc' });

			// Should still succeed by falling through to API
			expect(result.success).toBe(true);
			expect(result.cached).toBe(false);

			errorSpy.mockRestore();
		});

		it('should handle cache write failure gracefully', async () => {
			const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			mockFindUnique.mockResolvedValue(null);
			vi.mocked(fetch).mockResolvedValue(
				mockFetchResponse(mockReductoResponse()) as any
			);
			mockUpsert.mockRejectedValue(new Error('DB write failed'));

			const result = await client.parse({ url: 'https://example.com/doc' });

			// Should still return the parsed document even if caching fails
			expect(result.success).toBe(true);
			expect(result.document).toBeDefined();

			errorSpy.mockRestore();
		});

		it('should stringify non-Error parse failures', async () => {
			const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			mockFindUnique.mockResolvedValue(null);
			vi.mocked(fetch).mockRejectedValue('string error');

			const result = await client.parse({ url: 'https://example.com/doc' });

			expect(result.success).toBe(false);
			expect(result.error).toBe('Unknown error');

			errorSpy.mockRestore();
		});
	});

	// =========================================================================
	// Query Relevance Computation
	// =========================================================================

	describe('query relevance computation', () => {
		it('should score sections based on query term matches', async () => {
			const testUrl = 'https://congress.gov/bill/hr-9999';
			const cached = mockCachedDocument(testUrl, {
				document: {
					id: 'doc-rel',
					title: 'Relevance Test',
					source: { name: 'congress.gov', url: testUrl, type: 'legislative' },
					type: 'legislative',
					sections: [
						{ id: 's1', title: 'Healthcare', level: 0, content: 'This section covers healthcare costs and insurance reform.' },
						{ id: 's2', title: 'Other', level: 0, content: 'This section is about transportation.' }
					],
					entities: [],
					crossRefs: [],
					metadata: { parsedAt: new Date(), sourceUrl: testUrl, pageCount: 1 }
				}
			});

			mockFindUnique.mockResolvedValue(cached);
			mockUpdate.mockResolvedValue({});

			const result = await client.parse({
				url: testUrl,
				query: 'healthcare insurance'
			});

			const relevance = result.document?.queryRelevance;
			expect(relevance).toBeDefined();
			expect(relevance!.score).toBeGreaterThan(0);
			expect(relevance!.relevantSections).toContain('s1');
		});

		it('should return zero score when no sections match', async () => {
			const testUrl = 'https://congress.gov/bill/hr-no-match';
			const cached = mockCachedDocument(testUrl, {
				document: {
					id: 'doc-nomatch',
					title: 'No Match',
					source: { name: 'congress.gov', url: testUrl, type: 'legislative' },
					type: 'legislative',
					sections: [
						{ id: 's1', title: 'Agriculture', level: 0, content: 'Corn and wheat subsidies.' }
					],
					entities: [],
					crossRefs: [],
					metadata: { parsedAt: new Date(), sourceUrl: testUrl, pageCount: 1 }
				}
			});

			mockFindUnique.mockResolvedValue(cached);
			mockUpdate.mockResolvedValue({});

			const result = await client.parse({
				url: testUrl,
				query: 'cybersecurity encryption'
			});

			const relevance = result.document?.queryRelevance;
			expect(relevance!.score).toBe(0);
			expect(relevance!.summary).toContain('No relevant content');
		});

		it('should include summary with passage count', async () => {
			const testUrl = 'https://congress.gov/bill/hr-summary';
			const cached = mockCachedDocument(testUrl);

			mockFindUnique.mockResolvedValue(cached);
			mockUpdate.mockResolvedValue({});

			const result = await client.parse({
				url: testUrl,
				query: 'healthcare reform'
			});

			const relevance = result.document?.queryRelevance;
			expect(relevance!.summary).toContain('relevant passages');
		});

		it('should not compute relevance when no query is provided', async () => {
			const testUrl = 'https://congress.gov/bill/hr-9999';
			const cached = mockCachedDocument(testUrl);

			mockFindUnique.mockResolvedValue(cached);
			mockUpdate.mockResolvedValue({});

			const result = await client.parse({ url: testUrl });

			expect(result.document?.queryRelevance).toBeUndefined();
		});
	});

	// =========================================================================
	// analyze()
	// =========================================================================

	describe('analyze', () => {
		it('should return error when document is not found', async () => {
			mockFindFirst.mockResolvedValue(null);

			const result = await client.analyze({
				documentId: 'nonexistent',
				query: 'test'
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain('not found');
		});

		it('should return relevance for found document', async () => {
			mockFindFirst.mockResolvedValue({
				document: {
					id: 'doc-analysis',
					title: 'Test',
					source: { name: 'test', url: 'https://example.com', type: 'media' },
					type: 'media',
					sections: [
						{ id: 's1', title: 'Data', level: 0, content: 'Machine learning models for data analysis.' }
					],
					entities: [],
					crossRefs: [],
					metadata: { parsedAt: new Date(), sourceUrl: 'https://example.com', pageCount: 1 }
				}
			});

			const result = await client.analyze({
				documentId: 'doc-analysis',
				query: 'machine learning'
			});

			expect(result.success).toBe(true);
			expect(result.relevance).toBeDefined();
			expect(result.relevance!.score).toBeGreaterThan(0);
		});
	});

	// =========================================================================
	// getByUrl
	// =========================================================================

	describe('getByUrl', () => {
		it('should query by source_url_hash and check expiry', async () => {
			const testUrl = 'https://congress.gov/bill/hr-1';
			const expectedHash = urlHash(testUrl);

			mockFindUnique.mockResolvedValue(
				mockCachedDocument(testUrl)
			);

			const doc = await client.getByUrl(testUrl);

			expect(mockFindUnique).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						source_url_hash: expectedHash,
						expires_at: expect.objectContaining({ gt: expect.any(Date) })
					})
				})
			);
			expect(doc?.title).toBe('Cached Document');
		});

		it('should return null on database error', async () => {
			const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			mockFindUnique.mockRejectedValue(new Error('DB error'));

			const doc = await client.getByUrl('https://example.com/fail');
			expect(doc).toBeNull();

			errorSpy.mockRestore();
		});
	});

	// =========================================================================
	// getById
	// =========================================================================

	describe('getById', () => {
		it('should query by document JSON path for id', async () => {
			mockFindFirst.mockResolvedValue({
				document: {
					id: 'doc-find',
					title: 'Found Doc',
					source: { name: 'test', url: 'https://example.com', type: 'media' },
					type: 'media',
					sections: [],
					entities: [],
					crossRefs: [],
					metadata: { parsedAt: new Date(), sourceUrl: 'https://example.com', pageCount: 1 }
				}
			});

			const doc = await client.getById('doc-find');

			expect(mockFindFirst).toHaveBeenCalledWith(
				expect.objectContaining({
					where: {
						document: { path: ['id'], equals: 'doc-find' }
					}
				})
			);
			expect(doc?.title).toBe('Found Doc');
		});

		it('should return null when document is not found', async () => {
			mockFindFirst.mockResolvedValue(null);

			const doc = await client.getById('nonexistent');
			expect(doc).toBeNull();
		});

		it('should return null on database error', async () => {
			const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			mockFindFirst.mockRejectedValue(new Error('DB error'));

			const doc = await client.getById('doc-error');
			expect(doc).toBeNull();

			errorSpy.mockRestore();
		});
	});

	// =========================================================================
	// getByType
	// =========================================================================

	describe('getByType', () => {
		it('should query by document_type with limit and expiry filter', async () => {
			mockFindMany.mockResolvedValue([
				mockCachedDocument('https://congress.gov/bill/1'),
				mockCachedDocument('https://congress.gov/bill/2')
			]);

			const docs = await client.getByType('legislative', 5);

			expect(mockFindMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						document_type: 'legislative',
						expires_at: { gt: expect.any(Date) }
					}),
					take: 5,
					orderBy: { created_at: 'desc' }
				})
			);
			expect(docs).toHaveLength(2);
		});

		it('should default to limit of 10', async () => {
			mockFindMany.mockResolvedValue([]);

			await client.getByType('media');

			expect(mockFindMany).toHaveBeenCalledWith(
				expect.objectContaining({
					take: 10
				})
			);
		});

		it('should return empty array on database error', async () => {
			const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			mockFindMany.mockRejectedValue(new Error('DB error'));

			const docs = await client.getByType('academic');
			expect(docs).toEqual([]);

			errorSpy.mockRestore();
		});
	});

	// =========================================================================
	// getCacheStats
	// =========================================================================

	describe('getCacheStats', () => {
		it('should return total document count and breakdown by type', async () => {
			mockCount.mockResolvedValue(25);
			mockGroupBy.mockResolvedValue([
				{ document_type: 'legislative', _count: 10 },
				{ document_type: 'media', _count: 8 },
				{ document_type: 'official', _count: 7 }
			]);
			mockFindFirst
				.mockResolvedValueOnce({ created_at: new Date('2025-06-01') })
				.mockResolvedValueOnce({ created_at: new Date('2026-02-20') });

			const stats = await client.getCacheStats();

			expect(stats.totalDocuments).toBe(25);
			expect(stats.byType.legislative).toBe(10);
			expect(stats.byType.media).toBe(8);
			expect(stats.byType.official).toBe(7);
			expect(stats.byType.corporate).toBe(0);
			expect(stats.byType.academic).toBe(0);
			expect(stats.oldestDocument).toEqual(new Date('2025-06-01'));
			expect(stats.newestDocument).toEqual(new Date('2026-02-20'));
		});

		it('should return zero counts on database error', async () => {
			const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			mockCount.mockRejectedValue(new Error('DB error'));

			const stats = await client.getCacheStats();

			expect(stats.totalDocuments).toBe(0);
			expect(stats.byType.legislative).toBe(0);
			expect(stats.byType.media).toBe(0);

			errorSpy.mockRestore();
		});
	});

	// =========================================================================
	// Singleton Management
	// =========================================================================

	describe('singleton management', () => {
		it('getReductoClient should return same instance on repeated calls', () => {
			resetReductoClient();
			const c1 = getReductoClient();
			const c2 = getReductoClient();
			expect(c1).toBe(c2);
		});

		it('resetReductoClient should clear the singleton', () => {
			const c1 = getReductoClient();
			resetReductoClient();
			const c2 = getReductoClient();
			expect(c1).not.toBe(c2);
		});

		it('getReductoClient should return a ReductoClient instance', () => {
			resetReductoClient();
			const c = getReductoClient();
			expect(c).toBeInstanceOf(ReductoClient);
		});
	});
});
