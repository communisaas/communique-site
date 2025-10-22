/**
 * Verification Session Management
 *
 * Database-backed session management for identity verification flow.
 * Replaced in-memory storage with Prisma database for production use.
 */

import { prisma } from '$lib/core/db';
import { generateNonce, generateChallenge } from './security';

export interface CreateSessionParams {
	userId: string;
	method: 'self.xyz' | 'didit';
	challenge: string; // QR code data or verification URL
}

/**
 * Create new verification session
 * @returns Session ID and nonce for client
 */
export async function createVerificationSession(params: CreateSessionParams) {
	const nonce = generateNonce();
	const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

	const session = await prisma.verificationSession.create({
		data: {
			user_id: params.userId,
			nonce,
			challenge: params.challenge,
			expires_at: expiresAt,
			method: params.method,
			status: 'pending'
		}
	});

	return {
		sessionId: session.id,
		nonce: session.nonce,
		expiresAt: session.expires_at
	};
}

/**
 * Retrieve session and validate expiration
 * @throws Error if session not found or expired
 */
export async function getVerificationSession(sessionId: string) {
	const session = await prisma.verificationSession.findUnique({
		where: { id: sessionId }
	});

	if (!session) {
		throw new Error('Verification session not found');
	}

	if (new Date() > session.expires_at) {
		// Mark as expired
		await prisma.verificationSession.update({
			where: { id: sessionId },
			data: { status: 'expired' }
		});
		throw new Error('Verification session expired');
	}

	return session;
}

/**
 * Mark session as verified
 */
export async function markSessionVerified(sessionId: string) {
	await prisma.verificationSession.update({
		where: { id: sessionId },
		data: { status: 'verified' }
	});
}

/**
 * Mark session as failed
 */
export async function markSessionFailed(sessionId: string) {
	await prisma.verificationSession.update({
		where: { id: sessionId },
		data: { status: 'failed' }
	});
}

/**
 * Cleanup expired sessions (run as cron job)
 * @returns Number of sessions deleted
 */
export async function cleanupExpiredSessions() {
	const result = await prisma.verificationSession.deleteMany({
		where: {
			expires_at: { lt: new Date() },
			status: { not: 'verified' }
		}
	});

	return result.count;
}
