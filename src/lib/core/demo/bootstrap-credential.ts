/**
 * Demo Credential Bootstrap
 *
 * Generates a synthetic but circuit-valid SessionCredential for demo mode.
 * Uses bb.js Poseidon to compute valid tree data that the WASM prover can
 * actually generate a real ZK proof from.
 *
 * Trees:
 * - Tree 1 (User Identity): Single leaf at index 0, zero siblings
 * - Tree 2 (Cell-District Map): Single SMT entry, zero siblings
 * - Tree 3 (Engagement): Default tier-0 (all zeros)
 */

// CRITICAL: Import buffer shim BEFORE any bb.js code runs.
// bb.js uses Buffer as a global; without this, Fr constructor throws "Buffer is not defined".
import '$lib/core/proof/buffer-shim';

import {
	poseidon2Hash2,
	poseidon2Hash3,
	poseidon2Hash4,
	poseidon2Sponge24,
	computeMerkleRoot
} from '$lib/core/crypto/poseidon';
import {
	storeSessionCredential,
	calculateExpirationDate,
	type SessionCredential
} from '$lib/core/identity/session-credentials';

const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';
const TREE_DEPTH = 20;

/**
 * Bootstrap a demo credential with valid tree data for real ZK proof generation.
 *
 * Computes all Poseidon hashes client-side using bb.js so the proof circuit
 * will accept the inputs.
 *
 * @param userId - Demo user's ID
 * @param identityCommitment - Identity commitment from the DB (hex string)
 * @returns The stored SessionCredential
 */
export async function bootstrapDemoCredential(
	userId: string,
	identityCommitment: string
): Promise<SessionCredential> {
	console.log('[Demo Bootstrap] Starting credential bootstrap...');

	// Generate random secrets
	const randomBytes = (n: number) => {
		const arr = new Uint8Array(n);
		crypto.getRandomValues(arr);
		return '0x' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
	};

	const userSecret = randomBytes(31); // 31 bytes fits in BN254 field
	const registrationSalt = randomBytes(31);
	const authorityLevel = 3; // Verified identity

	// DC census tract (White House area)
	const cellId = '0x' + BigInt('110010001001001').toString(16).padStart(64, '0');

	// Normalize identity commitment
	const idCommitment = identityCommitment.startsWith('0x')
		? identityCommitment
		: '0x' + identityCommitment;

	// 24 district IDs (DC at-large + padding)
	// In production these come from the cell-district mapping
	const districts: string[] = [];
	// DC At-Large delegate district
	districts.push('0x' + BigInt('1100').toString(16).padStart(64, '0'));
	// Pad remaining 23 slots with zeros
	for (let i = 1; i < 24; i++) {
		districts.push(ZERO_HASH);
	}

	console.log('[Demo Bootstrap] Computing Tree 1 (User Identity)...');

	// ─── Tree 1: User Identity Merkle Tree ──────────────────────────────
	// Leaf = H4(userSecret, cellId, registrationSalt, authorityLevel)
	const authorityHex = '0x' + authorityLevel.toString(16).padStart(64, '0');
	const leaf = await poseidon2Hash4(userSecret, cellId, registrationSalt, authorityHex);

	// Single leaf at index 0, all siblings are zero
	const userPath = Array(TREE_DEPTH).fill(ZERO_HASH);
	const userIndex = 0;

	// Compute root by hashing up through zero siblings
	const userRoot = await computeMerkleRoot(leaf, userPath, userIndex);

	console.log('[Demo Bootstrap] Computing Tree 2 (Cell-District Map)...');

	// ─── Tree 2: Cell-District Sparse Merkle Tree ───────────────────────
	// Circuit computes:
	//   district_commitment = poseidon2_sponge_24(districts)
	//   cell_map_leaf = H2(cell_id, district_commitment)
	//   computed_root = compute_smt_root(cell_map_leaf, path, path_bits)

	// Step 1: Compute district commitment using the 24-input sponge (matches circuit)
	const districtCommitment = await poseidon2Sponge24(districts);

	// Step 2: Compute SMT leaf = H2(cellId, districtCommitment)
	const cellMapLeaf = await poseidon2Hash2(cellId, districtCommitment);

	// Step 3: Derive path bits from hash of cellId
	const cellIdHash = await poseidon2Hash2(cellId, ZERO_HASH);
	const cellIdBigInt = BigInt(cellIdHash);
	const cellMapPathBits: number[] = [];
	for (let i = 0; i < TREE_DEPTH; i++) {
		cellMapPathBits.push(Number((cellIdBigInt >> BigInt(i)) & 1n));
	}

	// All siblings are zero (single-entry SMT)
	const cellMapPath = Array(TREE_DEPTH).fill(ZERO_HASH);

	// Step 4: Compute SMT root from leaf through zero siblings
	let smtNode = cellMapLeaf;
	for (let i = 0; i < TREE_DEPTH; i++) {
		const sibling = cellMapPath[i];
		if (cellMapPathBits[i] === 1) {
			smtNode = await poseidon2Hash2(sibling, smtNode);
		} else {
			smtNode = await poseidon2Hash2(smtNode, sibling);
		}
	}
	const cellMapRoot = smtNode;

	console.log('[Demo Bootstrap] Computing Tree 3 (Engagement)...');

	// ─── Tree 3: Engagement (tier-0 defaults) ───────────────────────────
	// Circuit computes:
	//   engagement_data_commitment = H3(engagement_tier, action_count, diversity_score)
	//   engagement_leaf = H2(identity_commitment, engagement_data_commitment)
	const engagementTierHex = '0x' + (0).toString(16).padStart(64, '0');
	const actionCountHex = '0x' + (0).toString(16).padStart(64, '0');
	const diversityScoreHex = '0x' + (0).toString(16).padStart(64, '0');

	const engagementDataCommitment = await poseidon2Hash3(
		engagementTierHex,
		actionCountHex,
		diversityScoreHex
	);

	const engagementLeaf = await poseidon2Hash2(idCommitment, engagementDataCommitment);

	const engagementPath = Array(TREE_DEPTH).fill(ZERO_HASH);
	const engagementIndex = 0;
	const engagementRoot = await computeMerkleRoot(engagementLeaf, engagementPath, engagementIndex);

	// ─── Build and store credential ─────────────────────────────────────
	const now = new Date();
	const credential: SessionCredential = {
		userId,
		identityCommitment: idCommitment,
		leafIndex: userIndex,
		merklePath: userPath,
		merkleRoot: userRoot,
		congressionalDistrict: 'three-tree',
		credentialType: 'three-tree',
		cellId,
		cellMapRoot,
		cellMapPath,
		cellMapPathBits,
		districts,
		authorityLevel,
		userSecret,
		registrationSalt,
		engagementRoot,
		engagementPath,
		engagementIndex,
		engagementTier: 0,
		actionCount: '0',
		diversityScore: '0',
		verificationMethod: 'self.xyz',
		createdAt: now,
		expiresAt: calculateExpirationDate()
	};

	await storeSessionCredential(credential);

	console.log('[Demo Bootstrap] Credential stored in IndexedDB:', {
		userId,
		userRoot: userRoot.slice(0, 18) + '...',
		cellMapRoot: cellMapRoot.slice(0, 18) + '...',
		engagementRoot: engagementRoot.slice(0, 18) + '...',
		treeDepth: TREE_DEPTH
	});

	return credential;
}
