/**
 * Integration test: cell-tree-snapshot with real Poseidon2 data from substrate.
 *
 * Uses the 10-cell sample at depth 20 built by substrate's build-cell-tree-snapshot.ts
 * with real Poseidon2 hashes. Verifies that deserialization and path computation
 * work correctly with production-grade data.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	deserializeCellTreeSnapshot,
	computeClientCellProof,
	validateSnapshotRoot,
	type CellTreeSnapshotWire,
} from '$lib/core/shadow-atlas/cell-tree-snapshot';

// Load substrate's real Poseidon2 sample
const samplePath = join(__dirname, '../../fixtures/cell-tree-snapshot-sample.json');
const sampleWire: CellTreeSnapshotWire = JSON.parse(readFileSync(samplePath, 'utf-8'));

describe('cell-tree-snapshot integration (real Poseidon2 data)', () => {
	// ========================================================================
	// Deserialization
	// ========================================================================

	it('deserializes substrate sample without errors', () => {
		const tree = deserializeCellTreeSnapshot(sampleWire);
		expect(tree).toBeDefined();
		expect(tree.depth).toBe(20);
		expect(tree.cellMeta.size).toBe(10);
	});

	it('has correct root from substrate', () => {
		const tree = deserializeCellTreeSnapshot(sampleWire);
		expect(tree.root).toBe(
			'0x18c7bb262121221abde90b71cea864fa18e0587ca7da822dec7e1f62afece0e0'
		);
	});

	it('has 20 zero hashes (production depth)', () => {
		const tree = deserializeCellTreeSnapshot(sampleWire);
		expect(tree.zeroHashes.length).toBe(20);
		// First zero hash is always the zero element
		expect(tree.zeroHashes[0]).toBe(
			'0x0000000000000000000000000000000000000000000000000000000000000000'
		);
		// Subsequent zero hashes are Poseidon2(zh[i-1], zh[i-1]) — non-trivial
		expect(tree.zeroHashes[1]).not.toBe(tree.zeroHashes[0]);
	});

	it('has 20 sparse layers', () => {
		const tree = deserializeCellTreeSnapshot(sampleWire);
		expect(tree.layers.length).toBe(20);
	});

	it('layer 0 (leaves) has 10 entries', () => {
		const tree = deserializeCellTreeSnapshot(sampleWire);
		expect(tree.layers[0].size).toBe(10);
	});

	it('higher layers have decreasing node counts', () => {
		const tree = deserializeCellTreeSnapshot(sampleWire);
		// 10 leaves → 5 parents → 3 → 2 → 1 → ... → 1 at top
		expect(tree.layers[0].size).toBe(10); // leaves
		expect(tree.layers[1].size).toBe(5); // pairs
		expect(tree.layers[2].size).toBe(3);
		expect(tree.layers[3].size).toBe(2);
		// From layer 4 up, single node (root subtree propagates)
		for (let i = 4; i < 20; i++) {
			expect(tree.layers[i].size).toBe(1);
		}
	});

	it('all 10 H3 cell IDs are present in cellMeta', () => {
		const tree = deserializeCellTreeSnapshot(sampleWire);
		const expectedCells = [
			'872830828ffffff', // SF
			'87283082affffff', // SF neighbor
			'872a1072dffffff', // NYC
			'872a1072bffffff', // NYC neighbor
			'87264e64dffffff', // DC
			'8726cc6cdffffff', // Chicago
			'8726a20a9ffffff', // Houston
			'87290d049ffffff', // LA? Atlanta?
			'87266e1a3ffffff', // Denver?
			'8726a5429ffffff', // another city
		];
		for (const cellId of expectedCells) {
			expect(tree.cellMeta.has(cellId)).toBe(true);
		}
	});

	it('each cell has 24 districts', () => {
		const tree = deserializeCellTreeSnapshot(sampleWire);
		for (const [cellId, meta] of tree.cellMeta) {
			expect(meta.districts.length).toBe(24);
		}
	});

	// ========================================================================
	// Path Computation
	// ========================================================================

	it('computes proof for each of the 10 cells', () => {
		const tree = deserializeCellTreeSnapshot(sampleWire);

		for (const [cellId, meta] of tree.cellMeta) {
			const proof = computeClientCellProof(tree, cellId);

			expect(proof.cellMapRoot).toBe(tree.root);
			expect(proof.cellMapPath.length).toBe(20);
			expect(proof.cellMapPathBits.length).toBe(20);
			expect(proof.districts.length).toBe(24);
			expect(proof.districts).toEqual(meta.districts);
		}
	});

	it('path bits match binary decomposition of leaf index', () => {
		const tree = deserializeCellTreeSnapshot(sampleWire);

		for (const [cellId, meta] of tree.cellMeta) {
			const proof = computeClientCellProof(tree, cellId);

			// Verify path bits are the binary decomposition of leafIndex (LSB first)
			let idx = meta.leafIndex;
			for (let level = 0; level < 20; level++) {
				expect(proof.cellMapPathBits[level]).toBe(idx & 1);
				idx = idx >> 1;
			}
		}
	});

	it('siblings at leaf level are correct (adjacent leaves or zero hashes)', () => {
		const tree = deserializeCellTreeSnapshot(sampleWire);

		// For leafIndex 0 (SF): sibling is leafIndex 1 (SF neighbor) — should be non-zero
		const sfProof = computeClientCellProof(tree, '872830828ffffff');
		expect(sfProof.cellMapPath[0]).toBe(tree.layers[0].get(1));
		expect(sfProof.cellMapPath[0]).not.toBe(tree.zeroHashes[0]);

		// For leafIndex 9 (last cell): sibling is leafIndex 8 — should be non-zero
		const lastProof = computeClientCellProof(tree, '8726a5429ffffff');
		expect(lastProof.cellMapPath[0]).toBe(tree.layers[0].get(8));
	});

	it('higher-level siblings use zero hashes where subtree is empty', () => {
		const tree = deserializeCellTreeSnapshot(sampleWire);

		// At depth 20, most of the tree is empty. Levels 5-19 should have
		// zero hash siblings for all cells (only one subtree branch is populated).
		const proof = computeClientCellProof(tree, '872830828ffffff');

		// From level 5 up (where there's only 1 node per level), sibling should
		// be zeroHash at that level
		for (let level = 5; level < 20; level++) {
			const siblingIdx = proof.cellMapPathBits[level] === 0 ? 1 : 0;
			// If sibling isn't in the sparse map, it should be zeroHash
			if (!tree.layers[level].has(siblingIdx)) {
				expect(proof.cellMapPath[level]).toBe(tree.zeroHashes[level]);
			}
		}
	});

	it('all path elements are valid 0x-hex BN254 field elements', () => {
		const tree = deserializeCellTreeSnapshot(sampleWire);
		const BN254 =
			21888242871839275222246405745257275088548364400416034343698204186575808495617n;

		for (const [cellId] of tree.cellMeta) {
			const proof = computeClientCellProof(tree, cellId);

			for (const sibling of proof.cellMapPath) {
				expect(sibling).toMatch(/^0x[0-9a-fA-F]+$/);
				expect(BigInt(sibling)).toBeLessThan(BN254);
			}
		}
	});

	// ========================================================================
	// Root Validation
	// ========================================================================

	it('validates root against known correct value', async () => {
		const tree = deserializeCellTreeSnapshot(sampleWire);
		const valid = await validateSnapshotRoot(tree, tree.root);
		expect(valid).toBe(true);
	});

	it('rejects mismatched root', async () => {
		const tree = deserializeCellTreeSnapshot(sampleWire);
		const wrongRoot =
			'0x0000000000000000000000000000000000000000000000000000000000000001';
		const valid = await validateSnapshotRoot(tree, wrongRoot);
		expect(valid).toBe(false);
	});

	// ========================================================================
	// Consistency
	// ========================================================================

	it('deserialization is deterministic (same input → same output)', () => {
		const tree1 = deserializeCellTreeSnapshot(sampleWire);
		const tree2 = deserializeCellTreeSnapshot(sampleWire);

		expect(tree1.root).toBe(tree2.root);
		expect(tree1.depth).toBe(tree2.depth);
		expect(tree1.cellMeta.size).toBe(tree2.cellMeta.size);

		// Compare proofs for same cell
		const proof1 = computeClientCellProof(tree1, '872830828ffffff');
		const proof2 = computeClientCellProof(tree2, '872830828ffffff');
		expect(proof1.cellMapPath).toEqual(proof2.cellMapPath);
		expect(proof1.cellMapPathBits).toEqual(proof2.cellMapPathBits);
	});

	it('different cells produce different paths but same root', () => {
		const tree = deserializeCellTreeSnapshot(sampleWire);
		const proofSF = computeClientCellProof(tree, '872830828ffffff'); // leafIndex 0
		const proofNYC = computeClientCellProof(tree, '872a1072dffffff'); // leafIndex 2

		expect(proofSF.cellMapRoot).toBe(proofNYC.cellMapRoot);
		expect(proofSF.cellMapPathBits).not.toEqual(proofNYC.cellMapPathBits);
		// At least some siblings differ
		const someDiffer = proofSF.cellMapPath.some(
			(s, i) => s !== proofNYC.cellMapPath[i]
		);
		expect(someDiffer).toBe(true);
	});
});
