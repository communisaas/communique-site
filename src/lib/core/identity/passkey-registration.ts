/**
 * Passkey Registration (Wave 2A: Graduated Trust Architecture)
 *
 * Server-side WebAuthn registration logic using @simplewebauthn/server.
 *
 * Flow:
 *   1. Authenticated user (OAuth session) calls generatePasskeyRegistrationOptions()
 *   2. Options + challenge stored in VerificationSession (5-minute TTL)
 *   3. Browser calls navigator.credentials.create() with those options
 *   4. Browser posts attestation response to verifyPasskeyRegistration()
 *   5. Server verifies attestation, stores credential, upgrades trust_tier to 1
 *
 * Storage format:
 *   - passkey_credential_id: base64url string (the credential's raw ID)
 *   - passkey_public_key_jwk: base64url-encoded raw public key bytes (despite field name)
 *
 * Cloudflare Workers constraints:
 *   - No Buffer — Uint8Array everywhere
 *   - No persistent in-memory state — challenges in DB (VerificationSession)
 *   - crypto.getRandomValues() available
 */

import {
	generateRegistrationOptions,
	verifyRegistrationResponse
} from '@simplewebauthn/server';
import type {
	RegistrationResponseJSON,
	PublicKeyCredentialCreationOptionsJSON
} from '@simplewebauthn/server';
import { db } from '$lib/core/db';
import { getPasskeyRPConfig } from './passkey-rp-config';
import { deriveDIDKey } from './did-key-derivation';

// ---------------------------------------------------------------------------
// Uint8Array <-> base64url helpers (Web API only, no Buffer)
// ---------------------------------------------------------------------------

/**
 * Encode a Uint8Array to a base64url string.
 * Uses standard btoa + URL-safe character replacement.
 */
export function uint8ArrayToBase64url(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a base64url string to a Uint8Array.
 */
export function base64urlToUint8Array(base64url: string): Uint8Array {
	// Restore standard base64 characters
	const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
	// Pad if necessary
	const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

// ---------------------------------------------------------------------------
// Registration: Step 1 — Generate options
// ---------------------------------------------------------------------------

export interface PasskeyRegistrationUser {
	id: string;
	email: string;
}

/**
 * Generate WebAuthn registration options for a user.
 *
 * Stores the challenge in a VerificationSession record (5-minute TTL).
 * Queries the DB for existing credentials to populate excludeCredentials.
 *
 * @returns The registration options JSON to send to the browser, plus the session ID
 *          needed to look up the challenge during verification.
 */
export async function generatePasskeyRegistrationOptions(
	user: PasskeyRegistrationUser
): Promise<{
	options: PublicKeyCredentialCreationOptionsJSON;
	sessionId: string;
}> {
	const { rpName, rpID } = getPasskeyRPConfig();

	// Look up existing credential from DB to populate excludeCredentials
	// (prevents re-registration of the same authenticator)
	const existingUser = await db.user.findUnique({
		where: { id: user.id },
		select: { passkey_credential_id: true }
	});

	const excludeCredentials: { id: string }[] = [];
	if (existingUser?.passkey_credential_id) {
		excludeCredentials.push({ id: existingUser.passkey_credential_id });
	}

	const options = await generateRegistrationOptions({
		rpName,
		rpID,
		userName: user.email,
		attestationType: 'none',
		excludeCredentials,
		authenticatorSelection: {
			residentKey: 'preferred',
			userVerification: 'preferred',
			authenticatorAttachment: 'platform'
		}
	});

	// Generate a cryptographic nonce for the session record
	const nonceBytes = crypto.getRandomValues(new Uint8Array(32));
	const nonce = uint8ArrayToBase64url(nonceBytes);

	// Store challenge in VerificationSession with 5-minute expiry
	const session = await db.verificationSession.create({
		data: {
			user_id: user.id,
			nonce,
			challenge: JSON.stringify({
				challenge: options.challenge,
				rpID
			}),
			expires_at: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
			status: 'pending',
			method: 'webauthn'
		}
	});

	return { options, sessionId: session.id };
}

// ---------------------------------------------------------------------------
// Registration: Step 2 — Verify attestation response
// ---------------------------------------------------------------------------

export interface PasskeyRegistrationResult {
	credentialId: string;
	publicKeyBase64url: string;
	counter: number;
	credentialDeviceType: string;
	credentialBackedUp: boolean;
}

/**
 * Verify a WebAuthn registration response and save the credential to the user.
 *
 * On success:
 *   - Stores passkey_credential_id (base64url credential ID)
 *   - Stores passkey_public_key_jwk (base64url raw public key bytes)
 *   - Sets passkey_created_at
 *   - Upgrades trust_tier to 1
 *   - Marks the VerificationSession as 'verified'
 *
 * @throws Error if verification fails, session expired, or already used
 */
export async function verifyPasskeyRegistration(
	userId: string,
	response: RegistrationResponseJSON,
	verificationSessionId: string
): Promise<PasskeyRegistrationResult> {
	// Look up the VerificationSession to get the stored challenge
	const session = await db.verificationSession.findUnique({
		where: { id: verificationSessionId }
	});

	if (!session) {
		throw new Error('Verification session not found');
	}

	if (session.user_id !== userId) {
		throw new Error('Session does not belong to this user');
	}

	if (session.status !== 'pending') {
		throw new Error('Verification session already used or expired');
	}

	if (new Date() > session.expires_at) {
		// Mark as expired
		await db.verificationSession.update({
			where: { id: verificationSessionId },
			data: { status: 'expired' }
		});
		throw new Error('Verification session expired');
	}

	if (session.method !== 'webauthn') {
		throw new Error('Invalid session method');
	}

	// Parse stored challenge data
	const challengeData = JSON.parse(session.challenge) as {
		challenge: string;
		rpID: string;
	};

	const { origin } = getPasskeyRPConfig();

	// Verify the registration response
	const verification = await verifyRegistrationResponse({
		response,
		expectedChallenge: challengeData.challenge,
		expectedOrigin: origin,
		expectedRPID: challengeData.rpID
	});

	if (!verification.verified || !verification.registrationInfo) {
		// Mark session as failed
		await db.verificationSession.update({
			where: { id: verificationSessionId },
			data: { status: 'failed' }
		});
		throw new Error('WebAuthn registration verification failed');
	}

	const { credential, credentialDeviceType, credentialBackedUp } =
		verification.registrationInfo;

	// Convert public key (Uint8Array) to base64url for storage
	const publicKeyBase64url = uint8ArrayToBase64url(credential.publicKey);
	const credentialId = credential.id; // Already a base64url string

	// Derive did:key from COSE-encoded public key (Wave 2B)
	// This is deterministic — same key always produces the same did:key
	let didKey: string | null = null;
	try {
		didKey = deriveDIDKey(credential.publicKey);
	} catch (err) {
		// Non-fatal: did:key derivation failure shouldn't block registration
		console.warn('[passkey] did:key derivation failed:', err);
	}

	// Save credential and upgrade trust tier in a single transaction
	await db.$transaction(async (tx) => {
		// Update the user record with passkey data
		await tx.user.update({
			where: { id: userId },
			data: {
				passkey_credential_id: credentialId,
				// Store raw public key bytes as base64url (despite field name)
				passkey_public_key_jwk: publicKeyBase64url,
				passkey_created_at: new Date(),
				trust_tier: 1,
				// did:key derived from WebAuthn public key (Wave 2B)
				...(didKey ? { did_key: didKey } : {})
			}
		});

		// Mark the verification session as verified
		await tx.verificationSession.update({
			where: { id: verificationSessionId },
			data: { status: 'verified' }
		});
	});

	return {
		credentialId,
		publicKeyBase64url,
		counter: credential.counter,
		credentialDeviceType,
		credentialBackedUp
	};
}
