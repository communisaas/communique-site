import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockSearch = vi.fn();
const mockGetContents = vi.fn();

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
	executeStaggered: async <T>(fns: Array<() => Promise<T>>, _context: string) => {
		const results = [];
		for (const fn of fns) {
			try {
				const data = await fn();
				results.push({ success: true, data, attempts: 1, wasRateLimited: false });
			} catch (error) {
				results.push({
					success: false,
					error: error instanceof Error ? error.message : String(error),
					attempts: 1,
					wasRateLimited: false
				});
			}
		}
		return results;
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
const mockContentsRateLimiter = createMockRateLimiter();

vi.mock('$lib/server/exa', () => ({
	getExaClient: () => ({
		search: mockSearch,
		getContents: mockGetContents
	}),
	getSearchRateLimiter: () => mockSearchRateLimiter,
	getContentsRateLimiter: () => mockContentsRateLimiter
}));

import { searchForRoleHolders, fetchPageContents } from '$lib/core/agents/exa-search';
import type { DiscoveredRole } from '$lib/core/agents/exa-search';

function makeRole(position: string, organization: string): DiscoveredRole {
	return {
		position,
		organization,
		jurisdiction: 'National',
		reasoning: 'Test reasoning',
		search_query: `${organization} ${position}`
	};
}

describe('searchForRoleHolders', () => {
	beforeEach(() => {
		mockSearch.mockReset();
		mockGetContents.mockReset();
	});

	it('returns empty array when given no roles', async () => {
		const results = await searchForRoleHolders([], { currentYear: '2026' });
		expect(results).toEqual([]);
		expect(mockSearch).not.toHaveBeenCalled();
	});

	it('groups roles with the same normalized organization name', async () => {
		mockSearch.mockResolvedValue({ results: [] });

		const roles: DiscoveredRole[] = [
			makeRole('CEO', 'Apple Inc.'),
			makeRole('CTO', 'apple'),
			makeRole('CFO', 'Apple Corporation')
		];

		await searchForRoleHolders(roles, { currentYear: '2026' });

		// All three should be grouped into one search
		expect(mockSearch).toHaveBeenCalledTimes(1);
	});

	it('creates separate searches for different organizations', async () => {
		mockSearch.mockResolvedValue({ results: [] });

		const roles: DiscoveredRole[] = [
			makeRole('CEO', 'Apple Inc.'),
			makeRole('Mayor', 'City of Portland')
		];

		await searchForRoleHolders(roles, { currentYear: '2026' });

		expect(mockSearch).toHaveBeenCalledTimes(2);
	});

	it('sorts groups by role count descending (most roles searched first)', async () => {
		const searchCalls: string[] = [];
		mockSearch.mockImplementation((query: string) => {
			searchCalls.push(query);
			return Promise.resolve({ results: [] });
		});

		const roles: DiscoveredRole[] = [
			makeRole('Mayor', 'City of Portland'),
			makeRole('CEO', 'Apple Inc.'),
			makeRole('CTO', 'Apple Inc.'),
			makeRole('CFO', 'Apple Inc.')
		];

		await searchForRoleHolders(roles, { currentYear: '2026' });

		expect(mockSearch).toHaveBeenCalledTimes(2);
		// Apple has 3 roles, Portland has 1 — Apple should be searched first
		expect(searchCalls[0]).toContain('Apple');
		expect(searchCalls[1]).toContain('Portland');
	});

	it('includes org name, role keywords, and year in the search query', async () => {
		mockSearch.mockResolvedValue({ results: [] });

		const roles: DiscoveredRole[] = [
			makeRole('Chief Executive Officer', 'Acme Corp')
		];

		await searchForRoleHolders(roles, { currentYear: '2026' });

		const query = mockSearch.mock.calls[0][0] as string;
		expect(query).toContain('Acme Corp');
		expect(query).toContain('Chief');
		expect(query).toContain('Executive');
		expect(query).toContain('Officer');
		expect(query).toContain('2026');
	});

	it('calls exa.search with contents: false', async () => {
		mockSearch.mockResolvedValue({ results: [] });

		await searchForRoleHolders(
			[makeRole('Mayor', 'City of Portland')],
			{ currentYear: '2026' }
		);

		const searchOptions = mockSearch.mock.calls[0][1];
		expect(searchOptions.contents).toBe(false);
	});

	it('returns correctly shaped results from exa search', async () => {
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

		const results = await searchForRoleHolders(
			[makeRole('Mayor', 'City of Portland')],
			{ currentYear: '2026' }
		);

		expect(results).toHaveLength(1);
		expect(results[0].organization).toBe('City of Portland');
		expect(results[0].roleIndices).toEqual([0]);
		expect(results[0].hits).toHaveLength(2);
		expect(results[0].hits[0]).toEqual({
			url: 'https://portland.gov/mayor',
			title: 'Mayor of Portland',
			publishedDate: '2025-01-01',
			author: 'City of Portland',
			score: 0.95
		});
		expect(results[0].hits[1].url).toBe('https://oregonlive.com/mayor');
		expect(results[0].hits[1].publishedDate).toBeUndefined();
	});

	it('handles a search failure without breaking other searches', async () => {
		mockSearch
			.mockRejectedValueOnce(new Error('Rate limited'))
			.mockResolvedValueOnce({
				results: [{ url: 'https://stanford.edu/president', title: 'President', score: 0.9 }]
			});

		const roles: DiscoveredRole[] = [
			makeRole('Mayor', 'City of Portland'),
			makeRole('President', 'Stanford University')
		];

		const results = await searchForRoleHolders(roles, { currentYear: '2026' });

		expect(results).toHaveLength(2);
		const portland = results.find(r => r.organization === 'City of Portland');
		const stanford = results.find(r => r.organization === 'Stanford University');

		expect(portland!.hits).toHaveLength(0);
		expect(stanford!.hits).toHaveLength(1);
	});

	it('respects maxSearches by batching overflow orgs', async () => {
		mockSearch.mockResolvedValue({ results: [] });

		const roles: DiscoveredRole[] = [
			makeRole('CEO', 'Org A'),
			makeRole('CEO', 'Org B'),
			makeRole('CEO', 'Org C'),
			makeRole('CEO', 'Org D'),
			makeRole('CEO', 'Org E')
		];

		await searchForRoleHolders(roles, { currentYear: '2026', maxSearches: 3 });

		// 2 individual + 1 batched = 3 searches
		expect(mockSearch).toHaveBeenCalledTimes(3);
	});
});

describe('fetchPageContents', () => {
	beforeEach(() => {
		mockSearch.mockReset();
		mockGetContents.mockReset();
	});

	it('returns empty array when given no URLs', async () => {
		const results = await fetchPageContents([]);
		expect(results).toEqual([]);
		expect(mockGetContents).not.toHaveBeenCalled();
	});

	it('calls exa.getContents with livecrawl preferred', async () => {
		mockGetContents.mockResolvedValue({ results: [] });

		await fetchPageContents(['https://example.com']);

		expect(mockGetContents).toHaveBeenCalledTimes(1);
		const options = mockGetContents.mock.calls[0][1];
		expect(options.livecrawl).toBe('preferred');
	});

	it('passes maxCharacters to the text option', async () => {
		mockGetContents.mockResolvedValue({ results: [] });

		await fetchPageContents(['https://example.com'], { maxCharacters: 5000 });

		const options = mockGetContents.mock.calls[0][1];
		expect(options.text.maxCharacters).toBe(5000);
	});

	it('returns page contents with correct shape', async () => {
		mockGetContents.mockResolvedValue({
			results: [
				{
					url: 'https://portland.gov/staff',
					title: 'Staff Directory',
					text: 'Mayor Ted Wheeler\nEmail: mayor@portlandoregon.gov',
					publishedDate: '2025-06-01'
				}
			]
		});

		const results = await fetchPageContents(['https://portland.gov/staff']);

		expect(results).toHaveLength(1);
		expect(results[0]).toEqual({
			url: 'https://portland.gov/staff',
			title: 'Staff Directory',
			text: 'Mayor Ted Wheeler\nEmail: mayor@portlandoregon.gov',
			publishedDate: '2025-06-01'
		});
	});

	it('filters out pages without text content', async () => {
		mockGetContents.mockResolvedValue({
			results: [
				{
					url: 'https://example.com/page1',
					title: 'Page 1',
					text: 'Some content here'
				},
				{
					url: 'https://example.com/page2',
					title: 'Page 2',
					text: undefined
				},
				{
					url: 'https://example.com/page3',
					title: 'Page 3',
					text: ''
				}
			]
		});

		const results = await fetchPageContents([
			'https://example.com/page1',
			'https://example.com/page2',
			'https://example.com/page3'
		]);

		expect(results).toHaveLength(1);
		expect(results[0].url).toBe('https://example.com/page1');
	});

	it('returns empty array when getContents throws', async () => {
		mockGetContents.mockRejectedValue(new Error('API error'));

		const results = await fetchPageContents(['https://example.com']);
		expect(results).toEqual([]);
	});
});
