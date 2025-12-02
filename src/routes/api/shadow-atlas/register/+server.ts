import { json } from '@sveltejs/kit';
import { prisma } from '$lib/core/db';
import type { RequestHandler } from './$types';

// Mock Poseidon hash for now (in production, use @voter-protocol/crypto or circomlibjs)
// We need a stable hash function for the Merkle tree
function mockHash(left: string, right: string): string {
	// Simple string concatenation hash for demo purposes
	// In real ZK, this MUST be Poseidon
	return `hash(${left},${right})`;
}

function computeMerklePath(leaves: string[], index: number, depth: number = 12): string[] {
	const path: string[] = [];
	let currentLevel = [...leaves];
	let currentIndex = index;

	for (let i = 0; i < depth; i++) {
		// Pad level if odd
		if (currentLevel.length % 2 !== 0) {
			currentLevel.push('0'); // Zero value
		}

		const isRightNode = currentIndex % 2 !== 0;
		const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;

		// Get sibling (or zero if out of bounds)
		const sibling = currentLevel[siblingIndex] || '0';
		path.push(sibling);

		// Move to next level
		const nextLevel: string[] = [];
		for (let j = 0; j < currentLevel.length; j += 2) {
			nextLevel.push(mockHash(currentLevel[j], currentLevel[j + 1] || '0'));
		}
		currentLevel = nextLevel;
		currentIndex = Math.floor(currentIndex / 2);
	}

	return path;
}

function computeMerkleRoot(leaves: string[], depth: number = 12): string {
	let currentLevel = [...leaves];

	for (let i = 0; i < depth; i++) {
		if (currentLevel.length % 2 !== 0) currentLevel.push('0');
		const nextLevel: string[] = [];
		for (let j = 0; j < currentLevel.length; j += 2) {
			nextLevel.push(mockHash(currentLevel[j], currentLevel[j + 1] || '0'));
		}
		currentLevel = nextLevel;
	}

	return currentLevel[0] || '0';
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

		// Use transaction to ensure consistency
		const result = await prisma.$transaction(async (tx) => {
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
				// In a real app, we might allow re-registration or updates
				return {
					leafIndex: existingRegistration.leaf_index,
					merklePath: existingRegistration.merkle_path,
					root: existingRegistration.merkle_root
				};
			}

			// 3. Add leaf to tree
			const newLeaves = [...tree.leaves, identityCommitment];
			const leafIndex = tree.leaves.length;

			// 4. Compute new root and path
			// Note: This is O(N) which is fine for small trees (4096 leaves)
			// For larger trees, we'd use a sparse tree or incremental updates
			const root = computeMerkleRoot(newLeaves);
			const path = computeMerklePath(newLeaves, leafIndex);

			// 5. Update tree
			await tx.shadowAtlasTree.update({
				where: { id: tree.id },
				data: {
					leaves: newLeaves,
					leaf_count: newLeaves.length,
					merkle_root: root
				}
			});

			// 6. Create registration record
			await tx.shadowAtlasRegistration.create({
				data: {
					user_id: session.userId,
					congressional_district: district,
					identity_commitment: identityCommitment,
					leaf_index: leafIndex,
					merkle_root: root,
					merkle_path: path,
					verification_method: 'self.xyz', // Default for Phase 1
					verification_id: 'mock-verification-id',
					verification_timestamp: new Date(),
					registration_status: 'registered',
					expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) // 6 months
				}
			});

			return {
				leafIndex,
				merklePath: path,
				root
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
