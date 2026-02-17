/**
 * Dev-only in-memory session store for mDL verification.
 * Replaced by Workers KV (DC_SESSION_KV) in production.
 *
 * Shared between start and verify endpoints.
 */
export const devSessionStore = new Map<string, { data: string; expires: number }>();

// Clean up expired dev sessions periodically
if (typeof setInterval !== 'undefined') {
	setInterval(() => {
		const now = Date.now();
		for (const [key, value] of devSessionStore) {
			if (value.expires < now) devSessionStore.delete(key);
		}
	}, 60_000);
}
