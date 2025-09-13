import type { RequestEvent } from '@sveltejs/kit';
import { vi } from 'vitest';

/**
 * Mock Request object for tests
 */
export interface MockRequest {
	json: ReturnType<typeof vi.fn>;
	text?: ReturnType<typeof vi.fn>;
	formData?: ReturnType<typeof vi.fn>;
	headers?: Headers;
	method?: string;
	url?: string;
}

/**
 * Mock User object matching Prisma schema
 */
export interface MockUser {
	id: string;
	email: string;
	name: string | null;
	avatar: string | null;
	createdAt: Date;
	updatedAt: Date;
	city: string | null;
	congressional_district: string | null;
	phone: string | null;
	street: string | null;
	state: string | null;
	zip: string | null;
	is_verified: boolean;
	verification_method: string | null;
	verified_at: Date | null;
	coordinates?: any;
	preferences?: any;
	phone_verified: boolean;
	email_verified: boolean;
	last_active: Date | null;
	login_count: number;
	failed_login_attempts: number;
	last_failed_login: Date | null;
	account_locked: boolean;
	lock_reason: string | null;
	locked_until: Date | null;
	profile_visibility: string;
}

/**
 * Mock Locals object for API routes
 */
export interface MockLocals {
	user?: Partial<MockUser> | null;
	session?: any;
}

/**
 * Helper to create a proper RequestEvent from mocks
 */
export function asRequestEvent(
	request: MockRequest | any,
	locals: MockLocals | any,
	params: Record<string, string> = {}
): any {
	return {
		request: request as Request,
		locals,
		params,
		url: new URL('http://localhost:3000'),
		route: { id: '' },
		cookies: {} as any,
		fetch: fetch,
		getClientAddress: () => '127.0.0.1',
		platform: {},
		setHeaders: () => {},
		isDataRequest: false,
		isSubRequest: false
	};
}

/**
 * Create a minimal mock user
 */
export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
	const now = new Date();
	return {
		id: 'user-123',
		email: 'test@example.com',
		name: 'Test User',
		avatar: null,
		createdAt: now,
		updatedAt: now,
		city: null,
		congressional_district: null,
		phone: null,
		street: null,
		state: null,
		zip: null,
		is_verified: false,
		verification_method: null,
		verified_at: null,
		phone_verified: false,
		email_verified: false,
		last_active: null,
		login_count: 0,
		failed_login_attempts: 0,
		last_failed_login: null,
		account_locked: false,
		lock_reason: null,
		locked_until: null,
		profile_visibility: 'public',
		...overrides
	};
}