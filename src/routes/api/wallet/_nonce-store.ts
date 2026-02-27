/**
 * Ephemeral nonce store for wallet connection flow.
 *
 * Module-level Map is acceptable on Cloudflare Workers for short-lived nonces:
 * - Nonces expire after 5 minutes
 * - Each nonce is deleted immediately after use (replay protection)
 * - Worst case on isolate recycle: user re-requests a nonce (no security impact)
 * - cleanupExpiredNonces() runs on every nonce/connect request to prevent unbounded growth
 */

export interface NonceEntry {
	userId: string;
	nonce: string;
	message: string;
	expiresAt: number;
}

export const nonceStore = new Map<string, NonceEntry>();

/**
 * Delete all expired entries from the nonce store.
 * Called on every request to /api/wallet/nonce and /api/wallet/connect.
 */
export function cleanupExpiredNonces(): void {
	const now = Date.now();
	for (const [key, entry] of nonceStore) {
		if (entry.expiresAt <= now) {
			nonceStore.delete(key);
		}
	}
}
