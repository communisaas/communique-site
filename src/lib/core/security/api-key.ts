/**
 * API Key utilities — Workers-compatible (no Node crypto).
 *
 * Keys are formatted as: ck_live_{32 random hex chars}
 * Only the SHA-256 hash is stored; the plaintext is shown once on creation.
 */

/**
 * Generate a new API key.
 * Returns { plaintext, hash, prefix } — store hash only, show plaintext once.
 */
export async function generateApiKey(): Promise<{
	plaintext: string;
	hash: string;
	prefix: string;
}> {
	// 16 random bytes → 32 hex chars
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	const hex = Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

	const plaintext = `ck_live_${hex}`;
	const hash = await hashApiKey(plaintext);
	const prefix = plaintext.slice(0, 16); // "ck_live_a1b2c3d4"

	return { plaintext, hash, prefix };
}

/**
 * SHA-256 hash an API key using Web Crypto API (Workers-compatible).
 */
export async function hashApiKey(plaintext: string): Promise<string> {
	const encoded = new TextEncoder().encode(plaintext);
	const digest = await crypto.subtle.digest('SHA-256', encoded);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}
