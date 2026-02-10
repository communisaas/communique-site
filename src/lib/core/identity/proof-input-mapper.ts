/**
 * SessionCredential → TwoTreeProofInputs Mapper (CR-009)
 *
 * Bridges the stored credential format (SessionCredential in IndexedDB) to
 * the prover input format (TwoTreeProofInputs for circuit execution).
 *
 * FIELD MAPPING:
 *   SessionCredential.merkleRoot    → TwoTreeProofInputs.userRoot
 *   SessionCredential.merklePath    → TwoTreeProofInputs.userPath
 *   SessionCredential.leafIndex     → TwoTreeProofInputs.userIndex
 *   SessionCredential.cellMapRoot   → TwoTreeProofInputs.cellMapRoot   (direct)
 *   SessionCredential.cellMapPath   → TwoTreeProofInputs.cellMapPath   (direct)
 *   SessionCredential.cellMapPathBits → TwoTreeProofInputs.cellMapPathBits (direct)
 *   SessionCredential.districts     → TwoTreeProofInputs.districts     (direct)
 *   SessionCredential.userSecret    → TwoTreeProofInputs.userSecret    (direct)
 *   SessionCredential.cellId        → TwoTreeProofInputs.cellId        (direct)
 *   SessionCredential.registrationSalt → TwoTreeProofInputs.registrationSalt (direct)
 *
 * COMPUTED AT PROOF TIME:
 *   nullifier     = poseidon2Hash2(userSecret, actionDomain)  [CVE-002 fix]
 *   actionDomain  = buildActionDomain(actionParams)  [caller-provided]
 *   authorityLevel = credential.authorityLevel (server-derived via deriveAuthorityLevel)
 *                    ?? context.authorityLevel (caller override)
 *                    ?? conservative fallback (3 if verified, 1 if not)
 *
 * See also: authority-level.ts for canonical server-side derivation,
 *           PUBLIC-INPUT-FIELD-REFERENCE.md for 29-input circuit ordering.
 *
 * PRIVACY INVARIANT:
 *   This mapper operates entirely in the browser. No private inputs
 *   (userSecret, cellId, registrationSalt) leave the client.
 */

import type { SessionCredential } from './session-credentials';
import type { TwoTreeProofInputs } from '$lib/core/zkp/prover-client';

/**
 * Context required at proof time (not stored in credential)
 */
export interface ProofContext {
	/** Action domain hex string (from buildActionDomain) */
	actionDomain: string;

	/** Pre-computed nullifier hex string = H2(userSecret, actionDomain) */
	nullifier: string;

	/**
	 * User's authority level (1-5).
	 *
	 * Resolution order:
	 *   1. credential.authorityLevel (set during registration by server via deriveAuthorityLevel)
	 *   2. context.authorityLevel (caller override)
	 *   3. Conservative fallback: identity_commitment present → 3, otherwise → 1
	 *
	 * IMPORTANT: The canonical derivation lives in authority-level.ts and considers
	 * document_type + trust_score. The client-side fallback is intentionally conservative
	 * (level 3 not 4) because SessionCredential lacks document_type.
	 */
	authorityLevel?: 1 | 2 | 3 | 4 | 5;
}

/**
 * Conservative fallback authority level when credential.authorityLevel is not stored.
 *
 * This is intentionally conservative: we default verified users to level 3 (not 4)
 * because we don't know document_type client-side. The canonical derivation in
 * authority-level.ts requires document_type === 'passport' for level 4.
 *
 * Callers who need level 4 MUST provide context.authorityLevel explicitly,
 * or ensure credential.authorityLevel is set during registration.
 */
function fallbackAuthorityLevel(credential: SessionCredential): 1 | 2 | 3 | 4 | 5 {
	// If identity was verified (identity commitment present), conservative level 3
	if (credential.identityCommitment) {
		return 3;
	}
	// Unverified / OAuth-only
	return 1;
}

/**
 * Map a stored SessionCredential + proof-time context to TwoTreeProofInputs.
 *
 * @param credential - Stored two-tree credential from IndexedDB
 * @param context - Proof-time context (actionDomain, nullifier, optional authorityLevel)
 * @returns TwoTreeProofInputs ready for generateTwoTreeProof()
 * @throws Error if credential is not a two-tree credential or missing required fields
 */
export function mapCredentialToProofInputs(
	credential: SessionCredential,
	context: ProofContext
): TwoTreeProofInputs {
	// Validate credential type
	if (credential.credentialType !== 'two-tree') {
		throw new Error(
			`Expected two-tree credential, got "${credential.credentialType || 'single-tree'}". ` +
				'Re-register with the two-tree flow to generate a compatible credential.'
		);
	}

	// Validate base fields (required for all credential types)
	const missing: string[] = [];
	if (!credential.merkleRoot) missing.push('merkleRoot');
	if (!credential.merklePath) missing.push('merklePath');
	if (credential.leafIndex === undefined) missing.push('leafIndex');

	// Validate two-tree-specific fields
	if (!credential.cellMapRoot) missing.push('cellMapRoot');
	if (!credential.cellMapPath) missing.push('cellMapPath');
	if (!credential.cellMapPathBits) missing.push('cellMapPathBits');
	if (!credential.districts) missing.push('districts');
	if (!credential.userSecret) missing.push('userSecret');
	if (!credential.cellId) missing.push('cellId');
	if (!credential.registrationSalt) missing.push('registrationSalt');

	if (missing.length > 0) {
		throw new Error(
			`Credential missing required fields: ${missing.join(', ')}. ` +
				'This may indicate a partial registration. Re-register to obtain a complete credential.'
		);
	}

	// Authority level resolution: credential (server-derived) > context > conservative fallback
	const authorityLevel =
		(credential as SessionCredential & { authorityLevel?: 1 | 2 | 3 | 4 | 5 }).authorityLevel ??
		context.authorityLevel ??
		fallbackAuthorityLevel(credential);

	return {
		// Public inputs
		userRoot: credential.merkleRoot,
		cellMapRoot: credential.cellMapRoot!,
		districts: credential.districts!,
		nullifier: context.nullifier,
		actionDomain: context.actionDomain,
		authorityLevel,

		// Private inputs
		userSecret: credential.userSecret!,
		cellId: credential.cellId!,
		registrationSalt: credential.registrationSalt!,

		// Tree 1 proof (renamed fields)
		userPath: credential.merklePath,
		userIndex: credential.leafIndex,

		// Tree 2 proof (direct mapping)
		cellMapPath: credential.cellMapPath!,
		cellMapPathBits: credential.cellMapPathBits!
	};
}
