import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Commons } from '../../../packages/sdk-typescript/src/index';
import {
	CommonsError,
	AuthenticationError,
	ForbiddenError,
	NotFoundError,
	RateLimitError
} from '../../../packages/sdk-typescript/src/errors';
import { CursorPage } from '../../../packages/sdk-typescript/src/pagination';

describe('TypeScript SDK', () => {
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	function mockFetch(body: unknown, status = 200): void {
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify(body), {
				status,
				headers: { 'Content-Type': 'application/json' }
			})
		);
	}

	function mockFetchError(status: number, code: string, message: string): void {
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({ data: null, error: { code, message } }),
				{ status, headers: { 'Content-Type': 'application/json' } }
			)
		);
	}

	describe('constructor', () => {
		it('requires apiKey (type-level enforcement)', () => {
			// The SDK enforces apiKey via TypeScript types (ClientOptions.apiKey is required).
			// At runtime, constructing without apiKey results in undefined being used as the Bearer token.
			// @ts-expect-error testing missing required field
			const client = new Commons({});
			// The client is created but will send 'Bearer undefined' — caught at the API layer
			expect(client).toBeDefined();
		});

		it('accepts custom baseUrl', () => {
			mockFetch({ data: [] });
			const client = new Commons({ apiKey: 'ck_live_test123', baseUrl: 'https://custom.example.com/api/v1' });
			expect(client).toBeDefined();
		});

		it('creates all resource namespaces', () => {
			const client = new Commons({ apiKey: 'ck_live_test' });
			expect(client.supporters).toBeDefined();
			expect(client.campaigns).toBeDefined();
			expect(client.events).toBeDefined();
			expect(client.donations).toBeDefined();
			expect(client.workflows).toBeDefined();
			expect(client.sms).toBeDefined();
			expect(client.calls).toBeDefined();
			expect(client.tags).toBeDefined();
			expect(client.representatives).toBeDefined();
			expect(client.usage).toBeDefined();
			expect(client.org).toBeDefined();
			expect(client.keys).toBeDefined();
		});
	});

	describe('auth', () => {
		it('sends Bearer token in Authorization header', async () => {
			mockFetch({ data: [] });
			const client = new Commons({ apiKey: 'ck_live_test123' });
			await client.tags.list();
			expect(globalThis.fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: 'Bearer ck_live_test123'
					})
				})
			);
		});

		it('sets Content-Type to application/json', async () => {
			mockFetch({ data: [] });
			const client = new Commons({ apiKey: 'ck_live_test' });
			await client.tags.list();
			expect(globalThis.fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({
						'Content-Type': 'application/json'
					})
				})
			);
		});
	});

	describe('list with pagination', () => {
		it('returns CursorPage with data and meta', async () => {
			mockFetch({
				data: [{ id: '1', email: 'a@b.com' }],
				meta: { cursor: 'abc', hasMore: false, total: 1 }
			});
			const client = new Commons({ apiKey: 'ck_live_test' });
			const page = await client.supporters.list();
			expect(page).toBeInstanceOf(CursorPage);
			expect(page.data).toHaveLength(1);
			expect(page.data[0].id).toBe('1');
			expect(page.meta.total).toBe(1);
			expect(page.hasMore).toBe(false);
		});

		it('auto-paginates with async iterator', async () => {
			// First call returns page 1 with hasMore=true
			const fetchMock = vi.fn()
				.mockResolvedValueOnce(
					new Response(
						JSON.stringify({
							data: [{ id: '1' }],
							meta: { cursor: 'page2', hasMore: true, total: 2 }
						}),
						{ status: 200, headers: { 'Content-Type': 'application/json' } }
					)
				)
				// Second call returns page 2 with hasMore=false
				.mockResolvedValueOnce(
					new Response(
						JSON.stringify({
							data: [{ id: '2' }],
							meta: { cursor: null, hasMore: false, total: 2 }
						}),
						{ status: 200, headers: { 'Content-Type': 'application/json' } }
					)
				);
			globalThis.fetch = fetchMock;

			const client = new Commons({ apiKey: 'ck_live_test' });
			const page = await client.supporters.list();
			const items: unknown[] = [];
			for await (const item of page) {
				items.push(item);
			}
			expect(items).toHaveLength(2);
		});

		it('passes query params correctly', async () => {
			mockFetch({
				data: [],
				meta: { cursor: null, hasMore: false, total: 0 }
			});
			const client = new Commons({ apiKey: 'ck_live_test' });
			await client.supporters.list({ verified: true, limit: 10 });
			const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
			expect(calledUrl).toContain('verified=true');
			expect(calledUrl).toContain('limit=10');
		});
	});

	describe('CRUD operations', () => {
		it('GET returns typed object', async () => {
			mockFetch({
				data: { id: 'org_1', name: 'Test Org', slug: 'test', description: null, avatar: null, createdAt: '2026-01-01', counts: { supporters: 0, campaigns: 0, templates: 0 } }
			});
			const client = new Commons({ apiKey: 'ck_live_test' });
			const org = await client.org.get();
			expect(org.id).toBe('org_1');
			expect(org.name).toBe('Test Org');
		});

		it('POST sends body and returns created', async () => {
			mockFetch({
				data: { id: 'sup_1', email: 'test@example.com', name: null, verified: false }
			});
			const client = new Commons({ apiKey: 'ck_live_test' });
			const created = await client.supporters.create({ email: 'test@example.com' });
			expect(created.id).toBe('sup_1');
			expect(created.email).toBe('test@example.com');

			const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(init.method).toBe('POST');
			expect(JSON.parse(init.body)).toEqual({ email: 'test@example.com' });
		});

		it('PATCH sends partial and returns updated', async () => {
			mockFetch({
				data: { id: 'sup_1', updatedAt: '2026-03-12' }
			});
			const client = new Commons({ apiKey: 'ck_live_test' });
			const result = await client.supporters.update('sup_1', { name: 'New Name' });
			expect(result.id).toBe('sup_1');

			const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(init.method).toBe('PATCH');
			expect(JSON.parse(init.body)).toEqual({ name: 'New Name' });
		});

		it('DELETE returns deleted confirmation', async () => {
			mockFetch({ data: { deleted: true } });
			const client = new Commons({ apiKey: 'ck_live_test' });
			const result = await client.supporters.delete('sup_1');
			expect(result.deleted).toBe(true);

			const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(init.method).toBe('DELETE');
		});
	});

	describe('error handling', () => {
		it('throws AuthenticationError on 401', async () => {
			mockFetchError(401, 'UNAUTHORIZED', 'Invalid API key');
			const client = new Commons({ apiKey: 'bad_key' });
			await expect(client.org.get()).rejects.toThrow(AuthenticationError);
		});

		it('throws ForbiddenError on 403', async () => {
			mockFetchError(403, 'FORBIDDEN', 'Missing scope');
			const client = new Commons({ apiKey: 'ck_live_test' });
			await expect(client.supporters.create({ email: 'a@b.com' })).rejects.toThrow(ForbiddenError);
		});

		it('throws NotFoundError on 404', async () => {
			mockFetchError(404, 'NOT_FOUND', 'Not found');
			const client = new Commons({ apiKey: 'ck_live_test' });
			await expect(client.supporters.get('nonexistent')).rejects.toThrow(NotFoundError);
		});

		it('throws RateLimitError on 429', async () => {
			mockFetchError(429, 'RATE_LIMITED', 'Too many requests');
			const client = new Commons({ apiKey: 'ck_live_test' });
			await expect(client.tags.list()).rejects.toThrow(RateLimitError);
		});

		it('throws CommonsError with code and message for other errors', async () => {
			mockFetchError(500, 'INTERNAL_ERROR', 'Something broke');
			const client = new Commons({ apiKey: 'ck_live_test' });
			try {
				await client.org.get();
				expect.fail('Should have thrown');
			} catch (err) {
				expect(err).toBeInstanceOf(CommonsError);
				const e = err as CommonsError;
				expect(e.code).toBe('INTERNAL_ERROR');
				expect(e.message).toBe('Something broke');
				expect(e.status).toBe(500);
			}
		});

		it('AuthenticationError has status 401', () => {
			const err = new AuthenticationError('UNAUTHORIZED', 'bad key');
			expect(err.status).toBe(401);
			expect(err.name).toBe('AuthenticationError');
		});

		it('NotFoundError has status 404', () => {
			const err = new NotFoundError('NOT_FOUND', 'gone');
			expect(err.status).toBe(404);
			expect(err.name).toBe('NotFoundError');
		});

		it('RateLimitError has status 429', () => {
			const err = new RateLimitError('RATE_LIMITED', 'slow down');
			expect(err.status).toBe(429);
			expect(err.name).toBe('RateLimitError');
		});
	});

	describe('CursorPage', () => {
		it('exposes data and meta', () => {
			const page = new CursorPage(
				[{ id: '1' }],
				{ cursor: null, hasMore: false, total: 1 },
				async () => ({ data: [], meta: { cursor: null, hasMore: false, total: 0 } })
			);
			expect(page.data).toEqual([{ id: '1' }]);
			expect(page.meta.total).toBe(1);
			expect(page.hasMore).toBe(false);
		});

		it('nextPage returns null when no more pages', async () => {
			const page = new CursorPage(
				[{ id: '1' }],
				{ cursor: null, hasMore: false, total: 1 },
				async () => ({ data: [], meta: { cursor: null, hasMore: false, total: 0 } })
			);
			const next = await page.nextPage();
			expect(next).toBeNull();
		});

		it('nextPage returns next CursorPage when hasMore', async () => {
			const fetchPage = vi.fn().mockResolvedValue({
				data: [{ id: '2' }],
				meta: { cursor: null, hasMore: false, total: 2 }
			});
			const page = new CursorPage(
				[{ id: '1' }],
				{ cursor: 'next_cursor', hasMore: true, total: 2 },
				fetchPage
			);
			const next = await page.nextPage();
			expect(next).toBeInstanceOf(CursorPage);
			expect(next!.data).toEqual([{ id: '2' }]);
			expect(fetchPage).toHaveBeenCalledWith('next_cursor');
		});
	});

	describe('resource methods', () => {
		it('campaigns.actions fetches actions for a campaign', async () => {
			mockFetch({
				data: [{ id: 'act_1', campaignId: 'camp_1' }],
				meta: { cursor: null, hasMore: false, total: 1 }
			});
			const client = new Commons({ apiKey: 'ck_live_test' });
			const page = await client.campaigns.actions('camp_1');
			expect(page.data[0].id).toBe('act_1');
			const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
			expect(calledUrl).toContain('/campaigns/camp_1/actions');
		});

		it('events.get fetches a single event', async () => {
			mockFetch({
				data: { id: 'evt_1', title: 'Town Hall' }
			});
			const client = new Commons({ apiKey: 'ck_live_test' });
			const event = await client.events.get('evt_1');
			expect(event.id).toBe('evt_1');
			expect(event.title).toBe('Town Hall');
		});

		it('donations.list returns paginated donations', async () => {
			mockFetch({
				data: [{ id: 'don_1', amountCents: 5000 }],
				meta: { cursor: null, hasMore: false, total: 1 }
			});
			const client = new Commons({ apiKey: 'ck_live_test' });
			const page = await client.donations.list({ status: 'completed' });
			expect(page.data[0].id).toBe('don_1');
		});

		it('workflows.get fetches a single workflow', async () => {
			mockFetch({
				data: { id: 'wf_1', name: 'Welcome', steps: [] }
			});
			const client = new Commons({ apiKey: 'ck_live_test' });
			const wf = await client.workflows.get('wf_1');
			expect(wf.id).toBe('wf_1');
			expect(wf.name).toBe('Welcome');
		});

		it('keys.create creates an API key', async () => {
			mockFetch({
				data: { id: 'key_1', key: 'ck_live_abc', prefix: 'ck_live_', name: 'Test Key', scopes: ['read'], createdAt: '2026-03-12' }
			});
			const client = new Commons({ apiKey: 'ck_live_test' });
			const key = await client.keys.create({ orgSlug: 'my-org', name: 'Test Key', scopes: ['read'] });
			expect(key.id).toBe('key_1');
			expect(key.key).toBe('ck_live_abc');
		});

		it('usage.get fetches usage stats', async () => {
			mockFetch({
				data: { verifiedActions: 50, maxVerifiedActions: 1000, emailsSent: 200, maxEmails: 5000 }
			});
			const client = new Commons({ apiKey: 'ck_live_test' });
			const usage = await client.usage.get();
			expect(usage.verifiedActions).toBe(50);
			expect(usage.maxEmails).toBe(5000);
		});
	});
});
