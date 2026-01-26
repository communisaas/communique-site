import { dev } from '$app/environment';
import * as auth from '$lib/core/auth/auth.js';
import type { Handle } from '@sveltejs/kit';

const handleAuth: Handle = async ({ event, resolve }) => {
	try {
		const sessionId = event.cookies.get(auth.sessionCookieName);
		if (!sessionId) {
			event.locals.user = null;
			event.locals.session = null;
			return resolve(event);
		}

		const { session, user } = await auth.validateSession(sessionId);
		if (session) {
			event.cookies.set(auth.sessionCookieName, session.id, {
				path: '/',
				sameSite: 'lax',
				httpOnly: true,
				expires: session.expiresAt,
				secure: !dev
			});
		} else {
			event.cookies.delete(auth.sessionCookieName, { path: '/' });
		}

		event.locals.user = user
			? {
					id: user.id,
					email: user.email,
					name: user.name,
					avatar: user.avatar,
					// Verification status
					is_verified: user.is_verified,
					verification_method: user.verification_method ?? null,
					verified_at: user.verified_at ?? null,
					// Privacy-preserving district (hash only, no PII)
					district_hash: user.district_hash ?? null,
					district_verified: user.district_verified ?? false,
					// Profile fields
					role: user.role ?? null,
					organization: user.organization ?? null,
					location: user.location ?? null,
					connection: user.connection ?? null,
					profile_completed_at: user.profile_completed_at ?? null,
					profile_visibility: user.profile_visibility ?? 'private',
					// Reputation
					trust_score: user.trust_score ?? 0,
					reputation_tier: user.reputation_tier ?? 'novice',
					// Timestamps
					createdAt: user.createdAt,
					updatedAt: user.updatedAt
				}
			: null;
		event.locals.session = session;

		return resolve(event);
	} catch {
		// If authentication fails for any reason, clear session and continue
		console.error('Error occurred');
		event.locals.user = null;
		event.locals.session = null;
		// Clear the session cookie on error
		event.cookies.delete(auth.sessionCookieName, { path: '/' });
		return resolve(event);
	}
};

// Add cross-origin isolation headers for ZK proving (SharedArrayBuffer support)
const handleCrossOriginIsolation: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// Set COOP/COEP headers for all responses
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');

	return response;
};

// Compose multiple handles using SvelteKit's sequence
import { sequence } from '@sveltejs/kit/hooks';

export const handle = sequence(handleCrossOriginIsolation, handleAuth);
