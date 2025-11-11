/**
 * Shadow Atlas Registration Handler
 *
 * Orchestrates Shadow Atlas registration after identity verification.
 *
 * Flow:
 * 1. User completes identity verification (self.xyz or Didit.me)
 * 2. Extract identity commitment + congressional district
 * 3. Call Shadow Atlas registration API
 * 4. Receive merkle_path from voter-protocol
 * 5. Store in database (ShadowAtlasRegistration)
 * 6. Cache in IndexedDB (session-credentials.ts)
 *
 * This happens AFTER the existing verification-handler.ts flow:
 * - verification-handler.ts: Handles address encryption + storage
 * - shadow-atlas-handler.ts: Handles ZK proof registration (this file)
 *
 * Per COMMUNIQUE-ZK-IMPLEMENTATION-SPEC.md Phase 1.4
 */

import {
	storeSessionCredential,
	calculateExpirationDate,
	type SessionCredential
} from './session-credentials';

// ============================================================================
// Types
// ============================================================================

export interface ShadowAtlasRegistrationRequest {
	/** User ID */
	userId: string;
	/** Identity commitment (Poseidon hash from self.xyz/Didit.me) */
	identityCommitment: string;
	/** Congressional district (e.g., "CA-12") */
	congressionalDistrict: string;
	/** Verification method used */
	verificationMethod: 'self.xyz' | 'didit';
	/** External verification ID */
	verificationId: string;
}

export interface ShadowAtlasRegistrationResult {
	/** Was registration successful? */
	success: boolean;
	/** Session credential for IndexedDB caching */
	sessionCredential?: SessionCredential;
	/** Error message if failed */
	error?: string;
}

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Register user in Shadow Atlas Merkle tree
 *
 * Called AFTER identity verification completes.
 * Integrates with voter-protocol Shadow Atlas API.
 *
 * @param request - Registration request data
 * @returns Session credential for proof generation
 */
export async function registerInShadowAtlas(
	request: ShadowAtlasRegistrationRequest
): Promise<ShadowAtlasRegistrationResult> {
	try {
		// Call Shadow Atlas registration API
		const response = await fetch('/api/shadow-atlas/register', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				identityCommitment: request.identityCommitment,
				congressionalDistrict: request.congressionalDistrict,
				verificationMethod: request.verificationMethod,
				verificationId: request.verificationId
			})
		});

		if (!response.ok) {
			const errorData = await response.json();
			return {
				success: false,
				error: errorData.error || 'Shadow Atlas registration failed'
			};
		}

		const data = await response.json();

		if (!data.success || !data.data) {
			return {
				success: false,
				error: 'Invalid response from Shadow Atlas API'
			};
		}

		// Extract session credential from response
		const sessionCredential: SessionCredential = data.data.sessionCredential;

		// Cache in IndexedDB for future proof generation
		await storeSessionCredential(sessionCredential);

		console.log('[Shadow Atlas] Registration successful:', {
			userId: request.userId,
			district: request.congressionalDistrict,
			leafIndex: data.data.leafIndex,
			expiresAt: sessionCredential.expiresAt
		});

		return {
			success: true,
			sessionCredential
		};
	} catch (error) {
		console.error('[Shadow Atlas] Registration failed:', error);
		return {
			success: false,
			error:
				error instanceof Error ? error.message : 'Unknown error during Shadow Atlas registration'
		};
	}
}

/**
 * Generate identity commitment from verification provider data
 *
 * For now, this is a placeholder that generates a deterministic hash.
 * In production, this should use the actual Poseidon hash from the provider.
 *
 * @param providerData - Verification provider data
 * @returns Identity commitment (hex string)
 */
export async function generateIdentityCommitment(providerData: {
	provider: 'self.xyz' | 'didit.me';
	credentialHash: string;
	issuedAt: number;
}): Promise<string> {
	// TODO: Use actual Poseidon hash from self.xyz or Didit.me
	// For now, generate deterministic hash from credential data

	const input = `${providerData.provider}:${providerData.credentialHash}:${providerData.issuedAt}`;
	const encoder = new TextEncoder();
	const data = encoder.encode(input);

	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

	// Return as hex string with 0x prefix
	return '0x' + hashHex;
}

/**
 * Check if user is registered in Shadow Atlas
 *
 * @param userId - User ID
 * @returns True if registered and not expired, false otherwise
 */
export async function isShadowAtlasRegistered(userId: string): Promise<boolean> {
	try {
		const { getSessionCredential } = await import('./session-credentials');
		const credential = await getSessionCredential(userId);

		// Check if credential exists and hasn't expired
		if (!credential) {
			return false;
		}

		const expiresAt = new Date(credential.expiresAt);
		const now = new Date();

		if (expiresAt < now) {
			console.log('[Shadow Atlas] Registration expired for user:', userId);
			return false;
		}

		return true;
	} catch (error) {
		console.error('[Shadow Atlas] Registration check failed:', error);
		return false;
	}
}

/**
 * Get Shadow Atlas session credential
 *
 * @param userId - User ID
 * @returns Session credential if exists and valid, null otherwise
 */
export async function getShadowAtlasCredential(userId: string): Promise<SessionCredential | null> {
	try {
		const { getSessionCredential } = await import('./session-credentials');
		return await getSessionCredential(userId);
	} catch (error) {
		console.error('[Shadow Atlas] Failed to get credential:', error);
		return null;
	}
}

/**
 * Clear Shadow Atlas session credential
 *
 * @param userId - User ID
 */
export async function clearShadowAtlasCredential(userId: string): Promise<void> {
	try {
		const { clearSessionCredential } = await import('./session-credentials');
		await clearSessionCredential(userId);
		console.log('[Shadow Atlas] Cleared credential for user:', userId);
	} catch (error) {
		console.error('[Shadow Atlas] Failed to clear credential:', error);
		throw error;
	}
}
