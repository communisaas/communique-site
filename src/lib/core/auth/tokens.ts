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
export async function verifySignedToken<T = unknown>(
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
	} catch (error) {
		if (error instanceof TokenExpiredError) {
			throw new Error('Token has expired');
		}
		if (error instanceof JsonWebTokenError) {
			throw new Error('Invalid token');
		}
		throw error;
	}
}

