/**
 * Shadow Atlas Registration Handler (Two-Tree Architecture)
 *
 * Orchestrates the two-tree registration flow after identity verification:
 *
 * 1. User completes identity verification (self.xyz or Didit.me)
 * 2. Browser generates user_secret and registration_salt
 * 3. Browser computes leaf = Poseidon2_H3(user_secret, cell_id, registration_salt)
 * 4. Browser sends ONLY the leaf hash to communique server
 * 5. Server proxies to Shadow Atlas POST /v1/register → Tree 1 proof
 * 6. Browser requests Tree 2 cell proof (separate call)
 * 7. All credentials stored encrypted in IndexedDB
 *
 * PRIVACY: The communique server never receives user_secret, cell_id,
 * or registration_salt. It sees only the leaf hash.
 *
 * SPEC REFERENCE: WAVE-17-19-IMPLEMENTATION-PLAN.md Section 17c
 * SPEC REFERENCE: COMMUNIQUE-INTEGRATION-SPEC.md Section 2.3
 */

import {
	storeSessionCredential,
	calculateExpirationDate,
	type SessionCredential
} from './session-credentials';

// ============================================================================
// Types
// ============================================================================

export interface TwoTreeRegistrationRequest {
	/** User ID */
	userId: string;
	/** Precomputed leaf hash (hex with 0x prefix) */
	leaf: string;
	/** Census tract cell ID (for Tree 2 proof lookup) */
	cellId: string;
	/** User secret (stored client-side only, never sent to server) */
	userSecret: string;
	/** Registration salt (stored client-side only, never sent to server) */
	registrationSalt: string;
	/** Verification method used */
	verificationMethod: 'self.xyz' | 'didit';
}

export interface TwoTreeRegistrationResult {
	success: boolean;
	sessionCredential?: SessionCredential;
	error?: string;
}

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Register user in the two-tree architecture.
 *
 * Sends only the leaf hash to the server (Tree 1 registration),
 * then fetches the cell proof (Tree 2) for the user's cell_id.
 * Stores all credentials in encrypted IndexedDB.
 *
 * @param request - Registration data (includes private inputs stored locally)
 * @returns Session credential for ZK proof generation
 */
export async function registerTwoTree(
	request: TwoTreeRegistrationRequest
): Promise<TwoTreeRegistrationResult> {
	try {
		// Step 1: Register leaf hash in Tree 1 (server sees only the hash)
		const tree1Response = await fetch('/api/shadow-atlas/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ leaf: request.leaf }),
		});

		if (!tree1Response.ok) {
			const errorData = await tree1Response.json().catch(() => ({ error: 'Unknown error' }));
			return {
				success: false,
				error: errorData.error || `Tree 1 registration failed (${tree1Response.status})`,
			};
		}

		const tree1Data = await tree1Response.json();

		if (tree1Data.leafIndex === undefined || !tree1Data.userRoot || !tree1Data.userPath || !tree1Data.pathIndices) {
			return {
				success: false,
				error: 'Invalid Tree 1 registration response',
			};
		}

		// Step 2: Fetch Tree 2 cell proof (server proxies to Shadow Atlas)
		const tree2Response = await fetch(
			`/api/shadow-atlas/cell-proof?cell_id=${encodeURIComponent(request.cellId)}`
		);

		if (!tree2Response.ok) {
			const errorData = await tree2Response.json().catch(() => ({ error: 'Unknown error' }));
			return {
				success: false,
				error: errorData.error || `Tree 2 cell proof failed (${tree2Response.status})`,
			};
		}

		const tree2Data = await tree2Response.json();

		if (!tree2Data.cellMapRoot || !tree2Data.cellMapPath || !tree2Data.districts) {
			return {
				success: false,
				error: 'Invalid Tree 2 cell proof response',
			};
		}

		// Step 3: Construct session credential with BOTH tree proofs
		const now = new Date();
		const sessionCredential: SessionCredential = {
			userId: request.userId,
			identityCommitment: request.leaf, // The leaf hash is our identity commitment
			leafIndex: tree1Data.leafIndex,
			merklePath: tree1Data.userPath, // Tree 1 siblings
			merkleRoot: tree1Data.userRoot, // Tree 1 root
			congressionalDistrict: 'two-tree', // Districts come from Tree 2

			// Two-tree specific fields
			credentialType: 'two-tree',
			cellId: request.cellId,
			cellMapRoot: tree2Data.cellMapRoot,
			cellMapPath: tree2Data.cellMapPath,
			cellMapPathBits: tree2Data.cellMapPathBits,
			districts: tree2Data.districts,

			// Private inputs (stored client-side only, NEVER sent to server)
			userSecret: request.userSecret,
			registrationSalt: request.registrationSalt,

			verificationMethod: request.verificationMethod,
			createdAt: now,
			expiresAt: calculateExpirationDate(),
		};

		// Step 4: Store encrypted in IndexedDB
		await storeSessionCredential(sessionCredential);

		console.log('[Shadow Atlas] Two-tree registration successful:', {
			userId: request.userId,
			leafIndex: tree1Data.leafIndex,
			districts: tree2Data.districts.length,
			expiresAt: sessionCredential.expiresAt,
		});

		return {
			success: true,
			sessionCredential,
		};
	} catch (error) {
		console.error('[Shadow Atlas] Two-tree registration failed:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

// ============================================================================
// Identity Commitment Generation
// ============================================================================

/**
 * Generate identity commitment from verification provider data.
 *
 * Uses Poseidon hash to create a pseudonymous identity commitment
 * compatible with on-chain verification.
 *
 * @param providerData - Verification provider data
 * @returns Identity commitment (hex string with 0x prefix)
 */
export async function generateIdentityCommitment(providerData: {
	provider: 'self.xyz' | 'didit.me';
	credentialHash: string;
	issuedAt: number;
}): Promise<string> {
	const { poseidonHash } = await import('../crypto/poseidon');
	const input = `${providerData.provider}:${providerData.credentialHash}:${providerData.issuedAt}`;
	return await poseidonHash(input);
}

// ============================================================================
// Legacy Support
// ============================================================================

/**
 * @deprecated Use registerTwoTree() instead. Single-tree registration is superseded
 * by the two-tree architecture. This function remains for backward compatibility
 * during the transition period.
 */
export { registerTwoTree as registerInShadowAtlas };
