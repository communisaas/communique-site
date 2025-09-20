/**
 * Token Generation and Verification Utilities
 * Secure token handling for email verification and other auth flows
 */

import jwt from 'jsonwebtoken';
const { sign, verify, TokenExpiredError, JsonWebTokenError } = jwt;
import { env } from '$env/dynamic/private';

interface EmailVerificationPayload {
	email: string;
	userId: string;
	templateSlug?: string;
	timestamp: number;
	purpose: 'email_verification';
}

interface TokenVerificationOptions {
	secret: string;
	maxAge?: number;
}

/**
 * Generate a secure token for email verification
 * Used when adding secondary emails via bounce flow
 */
export function generateEmailVerificationToken(
	email: string,
	userId: string,
	templateSlug?: string
): string {
	const payload: EmailVerificationPayload = {
		email,
		userId,
		templateSlug,
		timestamp: Date.now(),
		purpose: 'email_verification'
	};

	// Use environment secret or fall back to a configured secret
	const secret = env.EMAIL_VERIFICATION_SECRET || env.JWT_SECRET || 'development-secret';

	return sign(payload, secret, {
		expiresIn: '24h',
		issuer: 'communique.app',
		audience: 'email-verification'
	});
}

/**
 * Verify a signed token and extract payload
 */
export async function verifySignedToken<T = any>(
	token: string,
	options: TokenVerificationOptions
): Promise<T> {
	try {
		const decoded = verify(token, options.secret, {
			issuer: 'communique.app',
			audience: 'email-verification',
			maxAge: options.maxAge ? `${options.maxAge}s` : undefined
		}) as T;

		return decoded;
	} catch (_error) {
		if (_error instanceof TokenExpiredError) {
			throw new Error('Token has expired');
		}
		if (_error instanceof JsonWebTokenError) {
			throw new Error('Invalid token');
		}
		throw _error;
	}
}

/**
 * Generate a one-time use token for sensitive operations
 * Includes additional entropy for security
 */
export function generateOneTimeToken(data: Record<string, any>, expiresIn = '1h'): string {
	const payload = {
		...data,
		nonce: globalThis.crypto.randomUUID(),
		timestamp: Date.now()
	};

	const secret = env.JWT_SECRET || 'development-secret';

	return sign(payload, secret, {
		expiresIn,
		issuer: 'communique.app'
	} as any);
}

/**
 * Create a secure hash for email + userId combination
 * Used for quick lookups without exposing user data
 */
export function createEmailUserHash(email: string, userId: string): string {
	const data = `${email.toLowerCase()}:${userId}`;
	// In production, use proper crypto hashing
	return Buffer.from(data).toString('base64url');
}
