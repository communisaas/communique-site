import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkEmail, checkEmailBatch, type ReacherResult } from '$lib/server/reacher-client';

function makeResult(email: string, verdict: ReacherResult['is_reachable'] = 'safe'): ReacherResult {
	const domain = email.split('@')[1];
	return {
		input: email,
		is_reachable: verdict,
		misc: { is_disposable: false, is_role_account: false },
		mx: { accepts_mail: true, records: [`mx.${domain}`] },
		smtp: { can_connect_smtp: true, has_full_inbox: false, is_catch_all: false, is_deliverable: verdict === 'safe', is_disabled: false },
		syntax: { address: email, domain, is_valid_syntax: true, username: email.split('@')[0] }
	};
}

const TEST_CONFIG = { url: 'https://reacher.test', apiKey: 'test-key' };

describe('reacher-client', () => {
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	describe('checkEmail', () => {
		it('returns result on success and sends correct headers', async () => {
			const expected = makeResult('good@example.com');
			(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(expected)
			});

			const result = await checkEmail('good@example.com', TEST_CONFIG);
			expect(result).toEqual(expected);

			const [url, opts] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toBe('https://reacher.test/v0/check_email');
			expect(opts.method).toBe('POST');
			expect(opts.headers.Authorization).toBe('test-key');
			expect(opts.body).toBe(JSON.stringify({ to_email: 'good@example.com' }));
		});

		it('returns null on HTTP error', async () => {
			(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				ok: false,
				status: 429
			});

			const result = await checkEmail('rate@limited.com', TEST_CONFIG);
			expect(result).toBeNull();
		});

		it('returns null on network error', async () => {
			(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
				new Error('ECONNREFUSED')
			);

			const result = await checkEmail('down@host.com', TEST_CONFIG);
			expect(result).toBeNull();
		});

		it('returns null on timeout', async () => {
			(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
				new DOMException('The operation was aborted.', 'AbortError')
			);

			const result = await checkEmail('slow@host.com', TEST_CONFIG);
			expect(result).toBeNull();
		});

		it('returns null when config is missing', async () => {
			const result = await checkEmail('no@config.com', { url: '', apiKey: '' });
			expect(result).toBeNull();
			expect(globalThis.fetch).not.toHaveBeenCalled();
		});

		it('returns null for invalid email format', async () => {
			const result = await checkEmail('not-an-email', TEST_CONFIG);
			expect(result).toBeNull();
			expect(globalThis.fetch).not.toHaveBeenCalled();
		});
	});

	describe('checkEmailBatch', () => {
		it('deduplicates emails', async () => {
			const expected = makeResult('dup@example.com');
			(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(expected)
			});

			const results = await checkEmailBatch(
				['dup@example.com', 'dup@example.com', 'dup@example.com'],
				3,
				TEST_CONFIG
			);

			expect(globalThis.fetch).toHaveBeenCalledTimes(1);
			expect(results.get('dup@example.com')).toEqual(expected);
		});

		it('respects concurrency limit', async () => {
			let concurrent = 0;
			let maxConcurrent = 0;

			(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(async () => {
				concurrent++;
				maxConcurrent = Math.max(maxConcurrent, concurrent);
				await new Promise((r) => setTimeout(r, 10));
				concurrent--;
				return {
					ok: true,
					json: () => Promise.resolve(makeResult('a@b.com'))
				};
			});

			await checkEmailBatch(
				['a@b.com', 'b@b.com', 'c@b.com', 'd@b.com', 'e@b.com'],
				2,
				TEST_CONFIG
			);

			expect(maxConcurrent).toBeLessThanOrEqual(2);
		});

		it('returns null for failed entries without breaking batch', async () => {
			const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(makeResult('good@example.com'))
			});
			fetchMock.mockRejectedValueOnce(new Error('fail'));

			const results = await checkEmailBatch(
				['good@example.com', 'bad@example.com'],
				3,
				TEST_CONFIG
			);

			expect(results.get('good@example.com')).not.toBeNull();
			expect(results.get('bad@example.com')).toBeNull();
		});
	});
});
