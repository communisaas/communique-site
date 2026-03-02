/**
 * Merkle Builder Unit Tests
 *
 * Validates tree construction, path extraction, path indices, zero-padding,
 * and roundtrip consistency with computeMerkleRoot.
 *
 * Uses a deterministic mock for poseidon2Hash2 to avoid WASM dependency.
 */

import { describe, it, expect, vi } from 'vitest';

// Deterministic mock: concatenate inputs → hash to produce stable 0x-prefixed hex.
// This mirrors the pattern used in user-secret-derivation.test.ts.
vi.mock('$lib/core/crypto/poseidon', () => ({
	poseidon2Hash2: vi.fn(async (left: string, right: string) => {
		const combined = left + '|' + right;
		let hash = 0n;
		for (let i = 0; i < combined.length; i++) {
			hash = ((hash << 5n) - hash + BigInt(combined.charCodeAt(i))) & 0xffffffffffffffffn;
		}
		return '0x' + hash.toString(16).padStart(64, '0');
	})
}));

import {
	buildPoseidonMerkleTree,
	extractMerklePath,
	extractPathIndices,
	type MerkleTree
} from '$lib/core/crypto/merkle-builder';
import { poseidon2Hash2 } from '$lib/core/crypto/poseidon';

const ZERO_LEAF = '0x' + '0'.padStart(64, '0');

// Helper: generate deterministic leaf values
function makeLeaf(i: number): string {
	return '0x' + (i + 1).toString(16).padStart(64, '0');
}

describe('buildPoseidonMerkleTree', () => {
	it('builds a depth-1 tree with 2 leaves', async () => {
		const leaves = [makeLeaf(0), makeLeaf(1)];
		const tree = await buildPoseidonMerkleTree(leaves, 1);

		expect(tree.depth).toBe(1);
		expect(tree.layers).toHaveLength(2); // leaves + root
		expect(tree.layers[0]).toHaveLength(2);
		expect(tree.layers[1]).toHaveLength(1);
		expect(tree.root).toBe(tree.layers[1][0]);
	});

	it('builds a depth-4 tree (MAX_CELLS=16)', async () => {
		const leaves = Array.from({ length: 8 }, (_, i) => makeLeaf(i));
		const tree = await buildPoseidonMerkleTree(leaves, 4);

		expect(tree.depth).toBe(4);
		expect(tree.layers).toHaveLength(5); // 4 levels + root
		expect(tree.layers[0]).toHaveLength(16); // padded to 2^4
		expect(tree.layers[1]).toHaveLength(8);
		expect(tree.layers[2]).toHaveLength(4);
		expect(tree.layers[3]).toHaveLength(2);
		expect(tree.layers[4]).toHaveLength(1);
		expect(tree.root).toBe(tree.layers[4][0]);
	});

	it('pads empty slots with zero leaves', async () => {
		const leaves = [makeLeaf(0)];
		const tree = await buildPoseidonMerkleTree(leaves, 2); // depth-2 = 4 slots

		expect(tree.layers[0]).toHaveLength(4);
		expect(tree.layers[0][0]).toBe(makeLeaf(0));
		expect(tree.layers[0][1]).toBe(ZERO_LEAF);
		expect(tree.layers[0][2]).toBe(ZERO_LEAF);
		expect(tree.layers[0][3]).toBe(ZERO_LEAF);
	});

	it('accepts exactly 2^depth leaves (full tree)', async () => {
		const leaves = Array.from({ length: 4 }, (_, i) => makeLeaf(i));
		const tree = await buildPoseidonMerkleTree(leaves, 2);

		expect(tree.layers[0]).toHaveLength(4);
		// No zero leaves when full
		for (let i = 0; i < 4; i++) {
			expect(tree.layers[0][i]).toBe(makeLeaf(i));
		}
	});

	it('rejects more than 2^depth leaves', async () => {
		const leaves = Array.from({ length: 5 }, (_, i) => makeLeaf(i));
		await expect(buildPoseidonMerkleTree(leaves, 2)).rejects.toThrow(
			'Too many leaves: 5 exceeds 2^2 = 4'
		);
	});

	it('produces a deterministic root', async () => {
		const leaves = [makeLeaf(0), makeLeaf(1), makeLeaf(2)];
		const tree1 = await buildPoseidonMerkleTree(leaves, 2);
		const tree2 = await buildPoseidonMerkleTree([...leaves], 2);

		expect(tree1.root).toBe(tree2.root);
	});

	it('different leaves produce different roots', async () => {
		const tree1 = await buildPoseidonMerkleTree([makeLeaf(0), makeLeaf(1)], 1);
		const tree2 = await buildPoseidonMerkleTree([makeLeaf(2), makeLeaf(3)], 1);

		expect(tree1.root).not.toBe(tree2.root);
	});

	it('calls poseidon2Hash2 for each parent node', async () => {
		vi.mocked(poseidon2Hash2).mockClear();
		const leaves = [makeLeaf(0), makeLeaf(1)];
		await buildPoseidonMerkleTree(leaves, 1);

		// depth-1: 1 parent = 1 hash call
		expect(poseidon2Hash2).toHaveBeenCalledTimes(1);
		expect(poseidon2Hash2).toHaveBeenCalledWith(makeLeaf(0), makeLeaf(1));
	});

	it('hashes correct pairs at each level (depth-2)', async () => {
		vi.mocked(poseidon2Hash2).mockClear();
		const leaves = [makeLeaf(0), makeLeaf(1), makeLeaf(2), makeLeaf(3)];
		await buildPoseidonMerkleTree(leaves, 2);

		// Level 0→1: 2 hash calls (pairs 0-1, 2-3)
		// Level 1→2: 1 hash call (root)
		expect(poseidon2Hash2).toHaveBeenCalledTimes(3);
		expect(poseidon2Hash2).toHaveBeenCalledWith(makeLeaf(0), makeLeaf(1));
		expect(poseidon2Hash2).toHaveBeenCalledWith(makeLeaf(2), makeLeaf(3));
	});

	it('handles zero leaves (empty tree)', async () => {
		const tree = await buildPoseidonMerkleTree([], 2);

		expect(tree.layers[0]).toHaveLength(4);
		expect(tree.layers[0].every((l) => l === ZERO_LEAF)).toBe(true);
		// Root should still be computed (hash of zero leaves)
		expect(tree.root).toMatch(/^0x[0-9a-f]{64}$/);
	});

	it('root is a valid hex field element', async () => {
		const tree = await buildPoseidonMerkleTree([makeLeaf(0)], 4);
		expect(tree.root).toMatch(/^0x[0-9a-f]{64}$/);
	});
});

describe('extractMerklePath', () => {
	let tree: MerkleTree;

	// Build a depth-2 tree with 4 distinct leaves for path tests
	async function buildTestTree() {
		const leaves = Array.from({ length: 4 }, (_, i) => makeLeaf(i));
		return buildPoseidonMerkleTree(leaves, 2);
	}

	it('returns correct number of siblings (= depth)', async () => {
		tree = await buildTestTree();
		const path = extractMerklePath(tree, 0);
		expect(path).toHaveLength(2);
	});

	it('leaf 0 sibling at level 0 is leaf 1', async () => {
		tree = await buildTestTree();
		const path = extractMerklePath(tree, 0);
		// Leaf 0 is at index 0 → sibling is index 1
		expect(path[0]).toBe(tree.layers[0][1]);
	});

	it('leaf 1 sibling at level 0 is leaf 0', async () => {
		tree = await buildTestTree();
		const path = extractMerklePath(tree, 1);
		// Leaf 1 is at index 1 → sibling is index 0
		expect(path[0]).toBe(tree.layers[0][0]);
	});

	it('leaf 2 sibling at level 0 is leaf 3', async () => {
		tree = await buildTestTree();
		const path = extractMerklePath(tree, 2);
		expect(path[0]).toBe(tree.layers[0][3]);
	});

	it('leaf 3 sibling at level 0 is leaf 2', async () => {
		tree = await buildTestTree();
		const path = extractMerklePath(tree, 3);
		expect(path[0]).toBe(tree.layers[0][2]);
	});

	it('level 1 sibling is the other subtree root', async () => {
		tree = await buildTestTree();
		const path0 = extractMerklePath(tree, 0);
		const path2 = extractMerklePath(tree, 2);

		// Leaf 0 is in left subtree → level 1 sibling is right subtree root
		expect(path0[1]).toBe(tree.layers[1][1]);
		// Leaf 2 is in right subtree → level 1 sibling is left subtree root
		expect(path2[1]).toBe(tree.layers[1][0]);
	});

	it('rejects negative leaf index', async () => {
		tree = await buildTestTree();
		expect(() => extractMerklePath(tree, -1)).toThrow('out of range');
	});

	it('rejects leaf index >= 2^depth', async () => {
		tree = await buildTestTree();
		expect(() => extractMerklePath(tree, 4)).toThrow('out of range');
	});

	it('works for depth-4 tree', async () => {
		const leaves = Array.from({ length: 10 }, (_, i) => makeLeaf(i));
		const bigTree = await buildPoseidonMerkleTree(leaves, 4);
		const path = extractMerklePath(bigTree, 5);

		expect(path).toHaveLength(4);
		// Each path element should be a valid hex
		for (const sibling of path) {
			expect(sibling).toMatch(/^0x[0-9a-f]{64}$/);
		}
	});
});

describe('extractPathIndices', () => {
	it('leaf 0 is always left (all zeros)', () => {
		const indices = extractPathIndices(0, 4);
		expect(indices).toEqual([0, 0, 0, 0]);
	});

	it('last leaf is always right (all ones)', () => {
		// Leaf 15 in depth-4: binary 1111
		const indices = extractPathIndices(15, 4);
		expect(indices).toEqual([1, 1, 1, 1]);
	});

	it('leaf 1 in depth-2: binary 01', () => {
		const indices = extractPathIndices(1, 2);
		expect(indices).toEqual([1, 0]);
	});

	it('leaf 2 in depth-2: binary 10', () => {
		const indices = extractPathIndices(2, 2);
		expect(indices).toEqual([0, 1]);
	});

	it('leaf 5 in depth-4: binary 0101', () => {
		const indices = extractPathIndices(5, 4);
		expect(indices).toEqual([1, 0, 1, 0]);
	});

	it('leaf 10 in depth-4: binary 1010', () => {
		const indices = extractPathIndices(10, 4);
		expect(indices).toEqual([0, 1, 0, 1]);
	});

	it('returns array of length = depth', () => {
		expect(extractPathIndices(0, 1)).toHaveLength(1);
		expect(extractPathIndices(0, 4)).toHaveLength(4);
		expect(extractPathIndices(0, 8)).toHaveLength(8);
	});

	it('only contains 0s and 1s', () => {
		for (let leaf = 0; leaf < 16; leaf++) {
			const indices = extractPathIndices(leaf, 4);
			for (const bit of indices) {
				expect(bit === 0 || bit === 1).toBe(true);
			}
		}
	});
});

describe('roundtrip: build → extract path → verify root', () => {
	it('extracted path recomputes to same root (leaf 0)', async () => {
		const leaves = [makeLeaf(0), makeLeaf(1), makeLeaf(2), makeLeaf(3)];
		const tree = await buildPoseidonMerkleTree(leaves, 2);
		const path = extractMerklePath(tree, 0);
		const indices = extractPathIndices(0, 2);

		// Manually recompute root using path + indices
		let node = leaves[0];
		for (let i = 0; i < path.length; i++) {
			if (indices[i] === 1) {
				node = await poseidon2Hash2(path[i], node);
			} else {
				node = await poseidon2Hash2(node, path[i]);
			}
		}

		expect(node).toBe(tree.root);
	});

	it('extracted path recomputes to same root (leaf 3)', async () => {
		const leaves = [makeLeaf(0), makeLeaf(1), makeLeaf(2), makeLeaf(3)];
		const tree = await buildPoseidonMerkleTree(leaves, 2);
		const path = extractMerklePath(tree, 3);
		const indices = extractPathIndices(3, 2);

		let node = leaves[3];
		for (let i = 0; i < path.length; i++) {
			if (indices[i] === 1) {
				node = await poseidon2Hash2(path[i], node);
			} else {
				node = await poseidon2Hash2(node, path[i]);
			}
		}

		expect(node).toBe(tree.root);
	});

	it('every leaf in depth-4 tree recomputes to same root', async () => {
		const leaves = Array.from({ length: 12 }, (_, i) => makeLeaf(i));
		const tree = await buildPoseidonMerkleTree(leaves, 4);

		// Verify all 16 positions (including zero-padded)
		for (let leafIdx = 0; leafIdx < 16; leafIdx++) {
			const path = extractMerklePath(tree, leafIdx);
			const indices = extractPathIndices(leafIdx, 4);

			let node = tree.layers[0][leafIdx]; // includes zero-padded leaves
			for (let i = 0; i < path.length; i++) {
				if (indices[i] === 1) {
					node = await poseidon2Hash2(path[i], node);
				} else {
					node = await poseidon2Hash2(node, path[i]);
				}
			}

			expect(node).toBe(tree.root);
		}
	});
});
