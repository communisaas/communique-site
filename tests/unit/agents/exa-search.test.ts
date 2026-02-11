import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockSearch = vi.fn();
const mockScrapeUrl = vi.fn();

// Mock rate limiter that executes immediately without throttling
const createMockRateLimiter = () => ({
	execute: async <T>(fn: () => Promise<T>, _context: string) => {
		try {
			const data = await fn();
			return { success: true, data, attempts: 1, wasRateLimited: false };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
				attempts: 1,
				wasRateLimited: false
			};
		}
	},
	getState: () => ({
		requestTimestamps: [],
		circuitState: 'closed' as const,
		circuitOpenedAt: null,
		consecutiveFailures: 0
	}),
	reset: vi.fn()
});

const mockSearchRateLimiter = createMockRateLimiter();
const mockFirecrawlRateLimiter = createMockRateLimiter();

vi.mock('$lib/server/exa', () => ({
	getExaClient: () => ({
		search: mockSearch
	}),
	getSearchRateLimiter: () => mockSearchRateLimiter
}));

vi.mock('$lib/server/firecrawl', () => ({
	getFirecrawlClient: () => ({
		scrapeUrl: mockScrapeUrl
	}),
	getFirecrawlRateLimiter: () => mockFirecrawlRateLimiter
}));

import { searchWeb, readPage } from '$lib/core/agents/exa-search';

describe('searchWeb', () => {
	beforeEach(() => {
		mockSearch.mockReset();
	});

	it('calls exa.search with metadata-only (contents: false)', async () => {
		mockSearch.mockResolvedValue({ results: [] });

		await searchWeb('Portland mayor contact');

		expect(mockSearch).toHaveBeenCalledTimes(1);
		const [query, options] = mockSearch.mock.calls[0];
		expect(query).toBe('Portland mayor contact');
		expect(options.contents).toBe(false);
		expect(options.type).toBe('auto');
	});

	it('defaults to 25 results', async () => {
		mockSearch.mockResolvedValue({ results: [] });

		await searchWeb('test query');

		const options = mockSearch.mock.calls[0][1];
		expect(options.numResults).toBe(25);
	});

	it('respects custom maxResults', async () => {
		mockSearch.mockResolvedValue({ results: [] });

		await searchWeb('test query', { maxResults: 10 });

		const options = mockSearch.mock.calls[0][1];
		expect(options.numResults).toBe(10);
	});

	it('returns correctly shaped search hits', async () => {
		mockSearch.mockResolvedValue({
			results: [
				{
					url: 'https://portland.gov/mayor',
					title: 'Mayor of Portland',
					publishedDate: '2025-01-01',
					author: 'City of Portland',
					score: 0.95
				},
				{
					url: 'https://oregonlive.com/mayor',
					title: 'Portland Mayor Profile',
					score: 0.8
				}
			]
		});

		const hits = await searchWeb('Portland mayor');

		expect(hits).toHaveLength(2);
		expect(hits[0]).toEqual({
			url: 'https://portland.gov/mayor',
			title: 'Mayor of Portland',
			publishedDate: '2025-01-01',
			author: 'City of Portland',
			score: 0.95
		});
		expect(hits[1].url).toBe('https://oregonlive.com/mayor');
		expect(hits[1].publishedDate).toBeUndefined();
	});

	it('throws when search fails', async () => {
		mockSearch.mockRejectedValue(new Error('Rate limited'));

		await expect(searchWeb('test')).rejects.toThrow('Search failed');
	});
});

describe('readPage', () => {
	beforeEach(() => {
		mockScrapeUrl.mockReset();
	});

	it('calls firecrawl.scrapeUrl with markdown+links format', async () => {
		mockScrapeUrl.mockResolvedValue({
			success: true,
			markdown: '# Test Page\nSome content',
			links: [],
			metadata: { title: 'Test', statusCode: 200 }
		});

		await readPage('https://example.com');

		expect(mockScrapeUrl).toHaveBeenCalledTimes(1);
		const [url, options] = mockScrapeUrl.mock.calls[0];
		expect(url).toBe('https://example.com');
		expect(options.formats).toEqual(['markdown', 'links']);
	});

	it('returns page content with correct shape', async () => {
		mockScrapeUrl.mockResolvedValue({
			success: true,
			markdown: 'Mayor Ted Wheeler\nEmail: mayor@portlandoregon.gov',
			links: ['mailto:mayor@portlandoregon.gov'],
			metadata: { title: 'Staff Directory', statusCode: 200 }
		});

		const result = await readPage('https://portland.gov/staff');

		expect(result).toMatchObject({
			url: 'https://portland.gov/staff',
			title: 'Staff Directory',
			statusCode: 200
		});
		expect(result!.text).toContain('Mayor Ted Wheeler');
		expect(result!.text).toContain('mayor@portlandoregon.gov');
		// mailto emails are extracted to highlights
		expect(result!.highlights).toEqual(['mayor@portlandoregon.gov']);
	});

	it('captures emails from JS-rendered pages that Exa would miss', async () => {
		// Firecrawl renders the full page with headless browser —
		// emails in mailto: links and contact widgets are captured inline
		mockScrapeUrl.mockResolvedValue({
			success: true,
			markdown: 'The Federal Trade Commission\n\nContact us: [opa@ftc.gov](mailto:opa@ftc.gov)\n\nOffice of Public Affairs',
			links: ['mailto:opa@ftc.gov', 'https://ftc.gov/about'],
			metadata: { title: 'About the FTC', statusCode: 200 }
		});

		const result = await readPage('https://ftc.gov/about');

		expect(result!.text).toContain('opa@ftc.gov');
		expect(result!.text).toContain('CONTACT EMAILS');
		expect(result!.title).toBe('About the FTC');
		expect(result!.highlights).toEqual(['opa@ftc.gov']);
	});

	it('truncates content to maxCharacters', async () => {
		const longContent = 'A'.repeat(20000);
		mockScrapeUrl.mockResolvedValue({
			success: true,
			markdown: longContent,
			links: [],
			metadata: { title: 'Long Page', statusCode: 200 }
		});

		const result = await readPage('https://example.com', { maxCharacters: 5000 });

		expect(result!.text.length).toBe(5000);
	});

	it('defaults to 12000 maxCharacters', async () => {
		const longContent = 'B'.repeat(20000);
		mockScrapeUrl.mockResolvedValue({
			success: true,
			markdown: longContent,
			links: [],
			metadata: { title: 'Long Page', statusCode: 200 }
		});

		const result = await readPage('https://example.com');

		expect(result!.text.length).toBe(12000);
	});

	it('returns null when scrape has no markdown content', async () => {
		mockScrapeUrl.mockResolvedValue({
			success: true,
			markdown: '',
			metadata: { title: 'Empty', statusCode: 200 }
		});

		const result = await readPage('https://example.com');
		expect(result).toBeNull();
	});

	it('returns null when scrape fails', async () => {
		mockScrapeUrl.mockResolvedValue({
			success: false,
			error: 'Page not found'
		});

		const result = await readPage('https://example.com');
		expect(result).toBeNull();
	});

	it('returns null when scrapeUrl throws', async () => {
		mockScrapeUrl.mockRejectedValue(new Error('Network error'));

		const result = await readPage('https://example.com');
		expect(result).toBeNull();
	});

	it('handles missing metadata gracefully', async () => {
		mockScrapeUrl.mockResolvedValue({
			success: true,
			markdown: '# Content here',
			links: [],
			metadata: {}
		});

		const result = await readPage('https://example.com');

		expect(result!.title).toBe('');
		expect(result!.text).toBe('# Content here');
	});
});
