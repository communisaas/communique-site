import type { RequestEvent as SvelteKitRequestEvent } from '@sveltejs/kit';

/**
 * API Locals interface with proper typing
 */
export interface ApiLocals {
	user?: {
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
	} | null;
	session?: {
		id: string;
		userId: string;
		expiresAt: Date;
	} | null;
}

/**
 * Properly typed RequestEvent for API routes
 */
export type ApiRequestEvent<Params = Record<string, string>> = SvelteKitRequestEvent<Params> & {
	locals: ApiLocals;
};

/**
 * Type guard to check if user is authenticated
 */
export function isAuthenticated(
	locals: ApiLocals
): locals is ApiLocals & { user: NonNullable<ApiLocals['user']> } {
	return locals.user !== null && locals.user !== undefined;
}

/**
 * Helper to ensure user is authenticated in API routes
 */
export function requireAuth(locals: ApiLocals): NonNullable<ApiLocals['user']> {
	if (!isAuthenticated(locals)) {
		throw new Error('Authentication required');
	}
	return locals.user;
}
