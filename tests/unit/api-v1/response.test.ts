import { describe, it, expect } from 'vitest';
import { apiOk, apiError, parsePagination, API_PAGE_SIZE } from '$lib/server/api-v1/response';

describe('apiOk', () => {
	it('should return 200 by default', () => {
		const resp = apiOk({ id: '1' });
		expect(resp.status).toBe(200);
	});

	it('should set Content-Type to application/json', () => {
		const resp = apiOk({ id: '1' });
		expect(resp.headers.get('Content-Type')).toBe('application/json');
	});

	it('should wrap data in envelope', async () => {
		const resp = apiOk({ id: '1', name: 'Test' });
		const body = await resp.json();
		expect(body).toEqual({
			data: { id: '1', name: 'Test' }
		});
	});

	it('should include meta when provided', async () => {
		const resp = apiOk([1, 2, 3], { cursor: 'abc', hasMore: true, total: 100 });
		const body = await resp.json();
		expect(body.data).toEqual([1, 2, 3]);
		expect(body.meta).toEqual({ cursor: 'abc', hasMore: true, total: 100 });
	});

	it('should omit meta when not provided', async () => {
		const resp = apiOk('hello');
		const body = await resp.json();
		expect(body.meta).toBeUndefined();
	});

	it('should allow custom status code', () => {
		const resp = apiOk({ id: '1' }, undefined, 201);
		expect(resp.status).toBe(201);
	});
});

describe('apiError', () => {
	it('should return the given status code', () => {
		const resp = apiError('NOT_FOUND', 'Resource not found', 404);
		expect(resp.status).toBe(404);
	});

	it('should set Content-Type to application/json', () => {
		const resp = apiError('BAD_REQUEST', 'Invalid input', 400);
		expect(resp.headers.get('Content-Type')).toBe('application/json');
	});

	it('should return error envelope with null data', async () => {
		const resp = apiError('UNAUTHORIZED', 'Invalid API key', 401);
		const body = await resp.json();
		expect(body).toEqual({
			data: null,
			error: {
				code: 'UNAUTHORIZED',
				message: 'Invalid API key'
			}
		});
	});

	it('should handle 500 errors', async () => {
		const resp = apiError('INTERNAL_ERROR', 'Something went wrong', 500);
		expect(resp.status).toBe(500);
		const body = await resp.json();
		expect(body.error.code).toBe('INTERNAL_ERROR');
	});
});

describe('API_PAGE_SIZE', () => {
	it('should be 50', () => {
		expect(API_PAGE_SIZE).toBe(50);
	});
});

describe('parsePagination', () => {
	function makeUrl(params: string): URL {
		return new URL(`https://example.com/api/v1/test?${params}`);
	}

	it('should default to null cursor and page size limit', () => {
		const result = parsePagination(makeUrl(''));
		expect(result.cursor).toBeNull();
		expect(result.limit).toBe(API_PAGE_SIZE);
	});

	it('should parse cursor from query params', () => {
		const result = parsePagination(makeUrl('cursor=abc123'));
		expect(result.cursor).toBe('abc123');
	});

	it('should parse valid limit', () => {
		const result = parsePagination(makeUrl('limit=10'));
		expect(result.limit).toBe(10);
	});

	it('should cap limit at API_PAGE_SIZE', () => {
		const result = parsePagination(makeUrl('limit=100'));
		expect(result.limit).toBe(API_PAGE_SIZE);
	});

	it('should use default for invalid limit', () => {
		const result = parsePagination(makeUrl('limit=abc'));
		expect(result.limit).toBe(API_PAGE_SIZE);
	});

	it('should use default for zero limit', () => {
		const result = parsePagination(makeUrl('limit=0'));
		expect(result.limit).toBe(API_PAGE_SIZE);
	});

	it('should use default for negative limit', () => {
		const result = parsePagination(makeUrl('limit=-5'));
		expect(result.limit).toBe(API_PAGE_SIZE);
	});

	it('should handle both cursor and limit together', () => {
		const result = parsePagination(makeUrl('cursor=xyz&limit=25'));
		expect(result.cursor).toBe('xyz');
		expect(result.limit).toBe(25);
	});
});
