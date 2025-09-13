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
	street: string | null;
	city: string | null;
	state: string | null;
	zip: string | null;
	congressional_district: string | null;
	is_verified: boolean;
	createdAt: Date;
	updatedAt: Date;
	is_active: boolean;
	is_banned: boolean;
	is_admin: boolean;
	profile_picture: string | null;
	login_count: number;
	political_party: string | null;
	interests: string[];
	political_affiliation: string | null;
	profile_metadata: any;
	profile_visibility: string;
	// Additional fields for backwards compat
	avatar?: string | null;
	phone?: string | null;
	verification_method?: string | null;
	verified_at?: Date | null;
	coordinates?: any;
	preferences?: any;
	phone_verified?: boolean;
	email_verified?: boolean;
	last_active?: Date | null;
	failed_login_attempts?: number;
	last_failed_login?: Date | null;
	account_locked?: boolean;
	lock_reason?: string | null;
	locked_until?: Date | null;
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
		street: null,
		city: null,
		state: null,
		zip: null,
		congressional_district: null,
		is_verified: false,
		createdAt: now,
		updatedAt: now,
		is_active: true,
		is_banned: false,
		is_admin: false,
		profile_picture: null,
		login_count: 0,
		political_party: null,
		interests: [],
		political_affiliation: null,
		profile_metadata: {},
		profile_visibility: 'public',
		...overrides
	};
}