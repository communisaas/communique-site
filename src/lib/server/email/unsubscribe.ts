import { createHmac } from 'node:crypto';
import { env } from '$env/dynamic/private';

/**
 * Generate an HMAC unsubscribe token for a supporter.
 * Token = hex(HMAC-SHA256(secret, supporterId:orgId))
 * The token is URL-safe and deterministic (same supporter+org = same token).
 */
export function generateUnsubscribeToken(supporterId: string, orgId: string): string {
	const secret = env.UNSUBSCRIBE_SECRET;
	if (!secret) throw new Error('UNSUBSCRIBE_SECRET env var is required');
	const hmac = createHmac('sha256', secret);
	hmac.update(`${supporterId}:${orgId}`);
	return hmac.digest('hex');
}

/**
 * Build the full unsubscribe URL for a supporter.
 */
export function buildUnsubscribeUrl(supporterId: string, orgId: string): string {
	const token = generateUnsubscribeToken(supporterId, orgId);
	const baseUrl = env.PUBLIC_BASE_URL || 'https://commons.email';
	return `${baseUrl}/unsubscribe/${supporterId}/${orgId}/${token}`;
}

/**
 * Verify an unsubscribe token.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyUnsubscribeToken(supporterId: string, orgId: string, token: string): boolean {
	const expected = generateUnsubscribeToken(supporterId, orgId);
	if (expected.length !== token.length) return false;
	let result = 0;
	for (let i = 0; i < expected.length; i++) {
		result |= expected.charCodeAt(i) ^ token.charCodeAt(i);
	}
	return result === 0;
}
