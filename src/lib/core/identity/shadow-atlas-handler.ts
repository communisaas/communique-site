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
	verificationMethod: 'self.xyz' | 'didit' | 'digital-credentials-api';
}

export interface TwoTreeRegistrationResult {
	success: boolean;
	sessionCredential?: SessionCredential;
	error?: string;
}

export interface TwoTreeRecoveryRequest {
	/** User ID */
	userId: string;
	/** Fresh leaf hash (new random inputs) */
	leaf: string;
	/** Cell ID derived from re-entered address */
	cellId: string;
	/** New random user secret */
	userSecret: string;
	/** New random registration salt */
	registrationSalt: string;
	/** Verification method (carried from original registration) */
	verificationMethod: 'self.xyz' | 'didit' | 'digital-credentials-api';
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

		if (tree1Data.leafIndex === undefined || !tree1Data.userRoot || !tree1Data.userPath || !tree1Data.pathIndices || !tree1Data.identityCommitment) {
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
			// NUL-001: Server returns canonical identity commitment (from User.identity_commitment).
			// Deterministic per verified person — ensures same nullifier across re-registrations.
			identityCommitment: tree1Data.identityCommitment,
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
			// Wave 39d: Signed receipt from operator (anti-censorship proof)
			receipt: tree1Data.receipt,
			createdAt: now,
			expiresAt: calculateExpirationDate(),
		};

		// Step 4: Store encrypted in IndexedDB
		await storeSessionCredential(sessionCredential);

		console.debug('[Shadow Atlas] Two-tree registration successful:', {
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

/**
 * Recover a user's two-tree credential after browser clear / device loss.
 *
 * Sends replace: true to the registration endpoint which:
 * 1. Looks up the user's existing registration in Postgres
 * 2. Calls Shadow Atlas POST /v1/register/replace to zero the old leaf
 * 3. Updates Postgres with the new leaf index and proof
 * 4. Returns fresh Tree 1 proof
 *
 * Then fetches fresh Tree 2 cell proof and stores all credentials in IndexedDB.
 *
 * @param request - Recovery data (includes private inputs stored locally)
 * @returns Session credential for ZK proof generation
 */
export async function recoverTwoTree(
	request: TwoTreeRecoveryRequest
): Promise<TwoTreeRegistrationResult> {
	try {
		// Step 1: Replace leaf in Tree 1 (sends replace: true)
		const tree1Response = await fetch('/api/shadow-atlas/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ leaf: request.leaf, replace: true }),
		});

		if (!tree1Response.ok) {
			const errorData = await tree1Response.json().catch(() => ({ error: 'Unknown error' }));
			return {
				success: false,
				error: errorData.error || `Tree 1 leaf replacement failed (${tree1Response.status})`,
			};
		}

		const tree1Data = await tree1Response.json();

		if (tree1Data.leafIndex === undefined || !tree1Data.userRoot || !tree1Data.userPath || !tree1Data.pathIndices || !tree1Data.identityCommitment) {
			return {
				success: false,
				error: 'Invalid Tree 1 replacement response',
			};
		}

		// Step 2: Fetch Tree 2 cell proof (same as registration)
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
			// NUL-001: Server returns canonical identity commitment (from User.identity_commitment).
			// Recovery now produces the same nullifier as original registration.
			identityCommitment: tree1Data.identityCommitment,
			leafIndex: tree1Data.leafIndex,
			merklePath: tree1Data.userPath,
			merkleRoot: tree1Data.userRoot,
			congressionalDistrict: 'two-tree',

			credentialType: 'two-tree',
			cellId: request.cellId,
			cellMapRoot: tree2Data.cellMapRoot,
			cellMapPath: tree2Data.cellMapPath,
			cellMapPathBits: tree2Data.cellMapPathBits,
			districts: tree2Data.districts,

			userSecret: request.userSecret,
			registrationSalt: request.registrationSalt,

			verificationMethod: request.verificationMethod,
			// W40-010: Thread receipt from recovery path (parity with registerTwoTree)
			receipt: tree1Data.receipt,
			createdAt: now,
			expiresAt: calculateExpirationDate(),
		};

		// Step 4: Store encrypted in IndexedDB
		await storeSessionCredential(sessionCredential);

		console.debug('[Shadow Atlas] Two-tree recovery successful:', {
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
		console.error('[Shadow Atlas] Two-tree recovery failed:', error);
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
 * SECURITY (NUL-001): The commitment MUST be deterministic per verified person.
 * Same person re-verifying must produce the SAME commitment so nullifiers match.
 * Therefore we hash ONLY provider + credentialHash (which is deterministic per
 * document), and EXCLUDE issuedAt/timestamps which would break Sybil prevention.
 *
 * @param providerData - Verification provider data
 * @returns Identity commitment (hex string with 0x prefix)
 */
export async function generateIdentityCommitment(providerData: {
	provider: 'self.xyz' | 'didit.me';
	credentialHash: string;
}): Promise<string> {
	const { poseidonHash } = await import('../crypto/poseidon');
	const input = `${providerData.provider}:${providerData.credentialHash}`;
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
