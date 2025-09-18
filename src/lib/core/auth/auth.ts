import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from '@oslojs/encoding';
import { db } from '$lib/core/db';

const DAY_IN_MS = 1000 * 60 * 60 * 24;

export const sessionCookieName = 'auth-session';

// Type definitions for session management
export interface Session {
	id: string;
	userId: string;
	expiresAt: Date;
	createdAt: Date;
}

export interface User {
	id: string;
	email: string;
	name: string | null;
	avatar: string | null;
	createdAt: Date;
	updatedAt: Date;
	city: string | null;
	congressional_district: string | null;
	phone: string | null;
	state: string | null;
	street: string | null;
	zip: string | null;
	// Verification status
	is_verified: boolean;
	verification_method: string | null;
	verification_data: any;
	verified_at: Date | null;
	// VOTER Protocol blockchain identity
	wallet_address: string | null;
	district_hash: string | null;
	trust_score: number;
	reputation_tier: string;
	// Reward tracking
	pending_rewards: string | null;
	total_earned: string | null;
	last_certification: Date | null;
	// Reputation scores
	challenge_score: number | null;
	civic_score: number | null;
	discourse_score: number | null;
	// Profile fields
	role: string | null;
	organization: string | null;
	location: string | null;
	connection: string | null;
	connection_details: string | null;
	profile_completed_at: Date | null;
	profile_visibility: string;
}

export interface SessionValidationSuccess {
	session: Session;
	user: User;
}

export interface SessionValidationFailure {
	session: null;
	user: null;
}

function generateSessionToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(20));
	const token = encodeBase32LowerCaseNoPadding(bytes);
	return token;
}

export async function createSession(userId: string, extended = false): Promise<Session> {
	const token = generateSessionToken();
	const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));

	// Extended sessions for social media acquisition funnel (90 days)
	const expiryDays = extended ? 90 : 30;

	const session = await db.session.create({
		data: {
			id: sessionId,
			userId,
			expiresAt: new Date(Date.now() + DAY_IN_MS * expiryDays)
		}
	});
	return session;
}

export async function invalidateSession(sessionId: string): Promise<void> {
	await db.session.delete({ where: { id: sessionId } });
}

export async function validateSession(sessionId: string): Promise<SessionValidationSuccess | SessionValidationFailure> {
	const result = await db.session.findUnique({
		where: { id: sessionId },
		include: { user: true }
	});

	if (!result) {
		return { session: null, user: null };
	}
	const { user, ...session } = result;

	const sessionExpired = Date.now() >= session.expiresAt.getTime();
	if (sessionExpired) {
		await db.session.delete({ where: { id: session.id } });
		return { session: null, user: null };
	}

	const renewSession = Date.now() >= session.expiresAt.getTime() - DAY_IN_MS * 15;
	if (renewSession) {
		session.expiresAt = new Date(Date.now() + DAY_IN_MS * 30);
		await db.session.update({
			where: { id: session.id },
			data: { expiresAt: session.expiresAt }
		});
	}

	return { session, user };
}

export type SessionValidationResult = Awaited<ReturnType<typeof validateSession>>;
