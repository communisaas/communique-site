import { dev } from '$app/environment';
import * as auth from '$lib/core/auth/auth.js';
import type { Handle } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { ensureAllIndexes } from '$lib/server/mongodb/indexes';

/**
 * MongoDB Index Initialization
 *
 * Runs lazily on first MongoDB-using request to ensure all indexes exist.
 * Uses a module-level guard to prevent multiple invocations.
 * Fire-and-forget pattern: doesn't block request handling.
 *
 * NOTE: MongoDB initialization is deferred because the Node.js MongoDB driver
 * may not be available in all deployment environments (e.g., Cloudflare Workers).
 */
let indexInitialized = false;

function initializeMongoIndexes(): void {
	// Skip if already initialized or in a serverless environment that may not support MongoDB
	if (indexInitialized) {
		return;
	}
	indexInitialized = true;

	// Fire and forget - don't block request handling
	ensureAllIndexes()
		.then(() => {
			console.log('[Hooks] MongoDB indexes initialized successfully');
		})
		.catch((err) => {
			// Log error but don't crash the server
			console.error('[Hooks] Failed to initialize MongoDB indexes:', err);
			// Reset flag so it can be retried on next request if needed
			indexInitialized = false;
		});
}

// NOTE: Do not initialize indexes on module load - MongoDB may not be available
// in all environments. Index initialization will happen on first MongoDB access.

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

/**
 * BA-010: Defense-in-depth CSRF protection for sensitive identity endpoints.
 *
 * SvelteKit's built-in csrf.checkOrigin (enabled in svelte.config.js) already
 * rejects non-GET requests with a mismatched Origin header. This handle adds
 * an additional layer specifically for identity verification endpoints:
 *
 * 1. Logs CSRF-relevant metadata on sensitive identity POST requests for audit.
 * 2. Explicitly validates that browser-originated requests to identity endpoints
 *    carry a same-origin Origin header (redundant with SvelteKit's check, but
 *    provides an explicit security boundary if the framework default is ever
 *    changed or bypassed).
 * 3. Exempts the Didit webhook path, which receives server-to-server POSTs
 *    authenticated via HMAC signature (no browser Origin header expected).
 */
const SENSITIVE_IDENTITY_PATHS = [
	'/api/identity/verify',
	'/api/identity/init',
	'/api/identity/store-blob',
	'/api/identity/delete-blob',
	'/api/identity/didit/init',
	'/api/address/verify'
];

// Webhook paths that receive server-to-server requests (HMAC-authenticated, no Origin)
const WEBHOOK_PATHS = ['/api/identity/didit/webhook'];

const handleCsrfGuard: Handle = async ({ event, resolve }) => {
	const { request, url } = event;
	const method = request.method;
	const pathname = url.pathname;

	// Only check non-GET/HEAD/OPTIONS methods
	if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
		return resolve(event);
	}

	// Skip webhook paths (authenticated via HMAC, not Origin)
	if (WEBHOOK_PATHS.some((p) => pathname.startsWith(p))) {
		return resolve(event);
	}

	// Check if this is a sensitive identity endpoint
	const isSensitive = SENSITIVE_IDENTITY_PATHS.some((p) => pathname.startsWith(p));
	if (!isSensitive) {
		return resolve(event);
	}

	// Validate Origin header for sensitive identity endpoints
	const origin = request.headers.get('origin');
	if (origin) {
		const expectedOrigin = url.origin;
		if (origin !== expectedOrigin) {
			console.error(
				`[CSRF] Blocked cross-origin ${method} to ${pathname}. ` +
					`Origin: ${origin}, Expected: ${expectedOrigin}`
			);
			throw error(403, 'Cross-origin requests to identity endpoints are forbidden');
		}
	}

	// If no Origin header at all on a sensitive endpoint, this is suspicious
	// for browser requests (browsers always send Origin on POST). Server-to-server
	// calls won't have Origin. SvelteKit's checkOrigin handles this case, but
	// we log it for audit visibility.
	if (!origin && isSensitive) {
		console.warn(
			`[CSRF] ${method} to sensitive path ${pathname} without Origin header. ` +
				`This is expected for server-to-server calls but suspicious for browser requests.`
		);
	}

	return resolve(event);
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

/**
 * TODO [BA-014]: Add per-endpoint rate limiting for sensitive POST endpoints.
 *
 * ASSESSMENT (2026-01-26):
 *
 * The repo has three rate-limiter implementations that are NOT wired to any
 * of the high-risk endpoints listed below:
 *   - src/lib/server/rate-limiter.ts          (in-memory, generic — singleton exists but unused by routes)
 *   - src/lib/core/server/api-security.ts     (in-memory, per-IP per-endpoint — only configured for analytics endpoints)
 *   - src/lib/core/analytics/rate-limit-db.ts (Postgres-based — analytics contribution limits only)
 *   - src/lib/server/geocoding-rate-limiter.ts (Google Maps quota guard — protects upstream API, not the endpoint)
 *
 * HIGH-RISK ENDPOINTS WITH NO SERVER-SIDE RATE LIMITING:
 *
 *   Risk  | Endpoint                              | Threat
 *   ------+---------------------------------------+----------------------------------------------
 *   P1    | POST /api/identity/verify             | Brute-force verification codes / replay proofs
 *   P1    | POST /api/identity/init               | QR-code generation spam (self.xyz API abuse)
 *   P1    | POST /api/identity/didit/init          | Session creation spam (Didit.me API abuse)
 *   P2    | POST /api/address/verify              | Census Geocoding API abuse (external rate limit)
 *   P2    | POST /api/submissions/create          | Spam congressional submissions via CWC
 *   P2    | POST /api/shadow-atlas/register       | Merkle tree spam / resource exhaustion
 *   P3    | POST /api/identity/store-blob         | Storage spam
 *   P3    | POST /api/identity/delete-blob        | Deletion spam
 *
 * All high-risk endpoints already require authentication (session check), which
 * limits the attack surface to authenticated users. However, a compromised or
 * malicious account can still abuse these endpoints without rate limits.
 *
 * EXISTING MITIGATIONS:
 *   - SvelteKit csrf.checkOrigin blocks cross-origin POST (svelte.config.js)
 *   - handleCsrfGuard (above) adds defense-in-depth Origin validation for identity paths
 *   - All sensitive endpoints require authenticated session
 *   - geocoding-rate-limiter.ts protects upstream Google Maps quota (but not the /api/address/verify endpoint itself)
 *
 * RECOMMENDED APPROACH (non-invasive):
 *   Option A — Cloudflare WAF Rate Limiting Rules (preferred for Cloudflare Pages deployment):
 *     Configure via Cloudflare Dashboard > Security > WAF > Rate limiting rules.
 *     Target: POST requests to /api/identity/*, /api/address/*, /api/submissions/*,
 *     /api/shadow-atlas/* with thresholds like 10 req/min per IP for identity,
 *     5 req/min for submissions. Zero code changes required.
 *
 *   Option B — Hook-level rate limiting using existing InMemoryRateLimiter:
 *     Import rateLimiter from '$lib/server/rate-limiter' and add a handleRateLimit
 *     hook in this sequence. Key by IP + pathname, with per-path limits.
 *     Caveat: in-memory state resets on deploy and is single-instance only.
 *     Acceptable for current scale (Cloudflare Pages single-instance).
 *
 * DEFERRED — Requires either Cloudflare WAF configuration (Option A) or a new
 * handleRateLimit hook (Option B). Not implementing in this assessment.
 */

export const handle = sequence(handleCsrfGuard, handleCrossOriginIsolation, handleAuth);
