import { json } from '@sveltejs/kit';
import { prisma } from '$lib/core/db';
import type { RequestHandler } from './$types';
import { Poseidon2Hasher } from '@voter-protocol/crypto';

/**
 * CVE-VOTER-004 FIX: Use production Poseidon2 hasher for Merkle tree operations
 *
 * CRITICAL: This module now uses the same Poseidon2 implementation as the ZK circuits.
 * The Poseidon2Hasher executes the actual Noir stdlib Poseidon2 permutation, ensuring
 * that Merkle roots computed here will match those verified in zero-knowledge proofs.
 *
 * ZERO padding constant - represents empty leaf in Merkle tree
 */
const ZERO_LEAF = 0n;

/**
 * Merkle tree depth - supports up to 2^12 = 4096 leaves per district
 */
const MERKLE_DEPTH = 12;

/**
 * Compute the Merkle path (authentication path) for a leaf at given index
 *
 * @param hasher - Poseidon2Hasher instance
 * @param leaves - Array of leaf values as bigint
 * @param index - Index of the leaf to compute path for
 * @param depth - Tree depth (default: 12)
 * @returns Array of sibling hashes along the path from leaf to root
 */
async function computeMerklePath(
	hasher: Poseidon2Hasher,
	leaves: bigint[],
	index: number,
	depth: number = MERKLE_DEPTH
): Promise<bigint[]> {
	const path: bigint[] = [];
	let currentLevel = [...leaves];
	let currentIndex = index;

	for (let i = 0; i < depth; i++) {
		// Pad level to even length with zero leaves
		if (currentLevel.length % 2 !== 0) {
			currentLevel.push(ZERO_LEAF);
		}

		// Determine sibling position
		const isRightNode = currentIndex % 2 !== 0;
		const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;

		// Get sibling (or zero if out of bounds)
		const sibling = siblingIndex < currentLevel.length ? currentLevel[siblingIndex] : ZERO_LEAF;
		path.push(sibling);

		// Compute next level using Poseidon2
		const nextLevel: bigint[] = [];
		for (let j = 0; j < currentLevel.length; j += 2) {
			const left = currentLevel[j];
			const right = j + 1 < currentLevel.length ? currentLevel[j + 1] : ZERO_LEAF;
			const hash = await hasher.hashPair(left, right);
			nextLevel.push(hash);
		}

		currentLevel = nextLevel;
		currentIndex = Math.floor(currentIndex / 2);
	}

	return path;
}

/**
 * Compute the Merkle root from an array of leaves
 *
 * @param hasher - Poseidon2Hasher instance
 * @param leaves - Array of leaf values as bigint
 * @param depth - Tree depth (default: 12)
 * @returns The Merkle root as bigint
 */
async function computeMerkleRoot(
	hasher: Poseidon2Hasher,
	leaves: bigint[],
	depth: number = MERKLE_DEPTH
): Promise<bigint> {
	if (leaves.length === 0) {
		return ZERO_LEAF;
	}

	let currentLevel = [...leaves];

	for (let i = 0; i < depth; i++) {
		// Pad level to even length with zero leaves
		if (currentLevel.length % 2 !== 0) {
			currentLevel.push(ZERO_LEAF);
		}

		// Compute next level using Poseidon2
		const nextLevel: bigint[] = [];
		for (let j = 0; j < currentLevel.length; j += 2) {
			const left = currentLevel[j];
			const right = j + 1 < currentLevel.length ? currentLevel[j + 1] : ZERO_LEAF;
			const hash = await hasher.hashPair(left, right);
			nextLevel.push(hash);
		}

		currentLevel = nextLevel;
	}

	return currentLevel[0] ?? ZERO_LEAF;
}

/**
 * Convert bigint array to string array for database storage
 */
function bigintArrayToStringArray(arr: bigint[]): string[] {
	return arr.map((v) => v.toString());
}

/**
 * Convert string array from database to bigint array
 */
function stringArrayToBigintArray(arr: string[]): bigint[] {
	return arr.map((v) => BigInt(v));
}

export const POST: RequestHandler = async ({ request, locals }) => {
	console.log('Register endpoint called');
	try {
		const session = locals.session;
		console.log('Session:', session);
		if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

		const { identityCommitment, district } = await request.json();

		if (!identityCommitment || !district) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		// Parse identity commitment as bigint (accepts hex string or decimal string)
		let commitmentBigint: bigint;
		try {
			if (typeof identityCommitment === 'string') {
				commitmentBigint = identityCommitment.startsWith('0x')
					? BigInt(identityCommitment)
					: BigInt(identityCommitment);
			} else if (typeof identityCommitment === 'bigint') {
				commitmentBigint = identityCommitment;
			} else {
				return json({ error: 'Invalid identityCommitment format' }, { status: 400 });
			}
		} catch {
			return json({ error: 'Failed to parse identityCommitment as bigint' }, { status: 400 });
		}

		// Initialize Poseidon2 hasher (singleton, cached after first call)
		const hasher = await Poseidon2Hasher.getInstance();

		// Use transaction to ensure consistency
		const result = await prisma.$transaction(async (tx) => {
			// 0. Verify user exists (defensive check for test isolation)
			const userExists = await tx.user.findUnique({
				where: { id: session.userId },
				select: { id: true }
			});
			if (!userExists) {
				throw new Error(`User ${session.userId} not found - cannot register for Shadow Atlas`);
			}

			// 1. Get or create the tree for this district
			let tree = await tx.shadowAtlasTree.findUnique({
				where: { congressional_district: district }
			});

			if (!tree) {
				tree = await tx.shadowAtlasTree.create({
					data: {
						congressional_district: district,
						leaves: [],
						merkle_root: '0',
						leaf_count: 0
					}
				});
			}

			// 2. Check if user is already registered in this district
			const existingRegistration = await tx.shadowAtlasRegistration.findUnique({
				where: { user_id: session.userId }
			});

			if (existingRegistration) {
				// If already registered, return existing path
				// Convert stored string arrays back to bigint for response
				return {
					leafIndex: existingRegistration.leaf_index,
					merklePath: existingRegistration.merkle_path,
					root: existingRegistration.merkle_root
				};
			}

			// 3. Add leaf to tree (convert existing leaves to bigint)
			const existingLeaves = stringArrayToBigintArray(tree.leaves);
			const newLeaves = [...existingLeaves, commitmentBigint];
			const leafIndex = existingLeaves.length;

			// 4. Compute new root and path using Poseidon2
			// Note: This is O(N) which is fine for small trees (4096 leaves)
			// For larger trees, we'd use a sparse tree or incremental updates
			const root = await computeMerkleRoot(hasher, newLeaves);
			const path = await computeMerklePath(hasher, newLeaves, leafIndex);

			// Convert bigint values to strings for database storage
			const rootString = root.toString();
			const pathStrings = bigintArrayToStringArray(path);
			const leavesStrings = bigintArrayToStringArray(newLeaves);

			// 5. Update tree
			await tx.shadowAtlasTree.update({
				where: { id: tree.id },
				data: {
					leaves: leavesStrings,
					leaf_count: newLeaves.length,
					merkle_root: rootString
				}
			});

			// 6. Create registration record
			await tx.shadowAtlasRegistration.create({
				data: {
					user_id: session.userId,
					congressional_district: district,
					identity_commitment: commitmentBigint.toString(),
					leaf_index: leafIndex,
					merkle_root: rootString,
					merkle_path: pathStrings,
					verification_method: 'self.xyz', // Default for Phase 1
					verification_id: 'mock-verification-id',
					verification_timestamp: new Date(),
					registration_status: 'registered',
					expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) // 6 months
				}
			});

			return {
				leafIndex,
				merklePath: pathStrings,
				root: rootString
			};
		});

		return json(result);
	} catch (error) {
		console.error('Shadow Atlas registration error:', error);
		if (error instanceof Error) {
			console.error('Error stack:', error.stack);
		}
		return json({ error: 'Internal server error', details: String(error) }, { status: 500 });
	}
};
