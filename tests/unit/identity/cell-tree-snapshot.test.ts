/**
 * Tests for cell-tree-snapshot.ts — Client-Side Cell Tree Path Computation
 *
 * Tests deserialization, BN254 validation, path computation, and root validation.
 * Uses deterministic test data with known tree structure.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	deserializeCellTreeSnapshot,
	computeClientCellProof,
	validateSnapshotRoot,
	type CellTreeSnapshotWire,
	type CellTreeSnapshot,
} from '$lib/core/shadow-atlas/cell-tree-snapshot';

// ============================================================================
// Test Fixtures
// ============================================================================

/** Valid BN254 field element (well under modulus). */
const FIELD_HEX = '0x0000000000000000000000000000000000000000000000000000000000000042';

/** Another distinct valid field element. */
const FIELD_HEX_2 = '0x0000000000000000000000000000000000000000000000000000000000000099';

/** Zero hash (standard sparse tree convention). */
const ZERO_HASH = '0x' + '0'.padStart(64, '0');

/** Value exceeding BN254 modulus. */
const OVER_MODULUS =
	'0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000002';

/** Generate 24 district hex values for a cell. */
function makeDistricts(): string[] {
	return Array.from({ length: 24 }, (_, i) =>
		'0x' + (i + 1).toString(16).padStart(64, '0')
	);
}

/**
 * Build a minimal valid wire format for a depth-3 tree (8 leaves).
 * Populates two cells at leaf indices 2 and 5.
 */
function makeWireFixture(): CellTreeSnapshotWire {
	const depth = 3;
	const root = '0x' + 'aa'.padStart(64, '0');
	const zeroHashes = Array.from({ length: depth }, (_, i) =>
		'0x' + (100 + i).toString(16).padStart(64, '0')
	);

	// Layer 0 (leaves): positions 2 and 5 are non-zero
	const leaf2 = '0x' + '22'.padStart(64, '0');
	const leaf5 = '0x' + '55'.padStart(64, '0');

	// Layer 1 (internal): position 1 = H(leaf2, leaf3=zero) and position 2 = H(leaf4=zero, leaf5)
	const internal1 = '0x' + 'b1'.padStart(64, '0');
	const internal2 = '0x' + 'b2'.padStart(64, '0');

	// Layer 2 (internal): position 0 = H(internal0=zeroHash[1], internal1) and position 1 = H(internal2, internal3=zeroHash[1])
	const top0 = '0x' + 'c0'.padStart(64, '0');
	const top1 = '0x' + 'c1'.padStart(64, '0');

	return {
		version: 1,
		depth,
		root,
		zeroHashes,
		layers: [
			// Level 0: leaves at index 2 and 5
			[[2, leaf2], [5, leaf5]],
			// Level 1: internal nodes at index 1 and 2
			[[1, internal1], [2, internal2]],
			// Level 2: top-level nodes
			[[0, top0], [1, top1]],
		],
		cells: [
			{ cellId: 'cell-A', leafIndex: 2, districts: makeDistricts() },
			{ cellId: 'cell-B', leafIndex: 5, districts: makeDistricts() },
		],
	};
}

// ============================================================================
// Deserialization Tests
// ============================================================================

describe('deserializeCellTreeSnapshot', () => {
	it('deserializes a valid wire format', () => {
		const wire = makeWireFixture();
		const tree = deserializeCellTreeSnapshot(wire);

		expect(tree.depth).toBe(3);
		expect(tree.root).toBe(wire.root);
		expect(tree.zeroHashes).toEqual(wire.zeroHashes);
		expect(tree.layers.length).toBe(3);
		expect(tree.cellMeta.size).toBe(2);
	});

	it('builds Maps from sorted arrays', () => {
		const wire = makeWireFixture();
		const tree = deserializeCellTreeSnapshot(wire);

		// Level 0: leaves at index 2 and 5
		expect(tree.layers[0].size).toBe(2);
		expect(tree.layers[0].has(2)).toBe(true);
		expect(tree.layers[0].has(5)).toBe(true);
		expect(tree.layers[0].has(0)).toBe(false);

		// Level 1: internal at 1 and 2
		expect(tree.layers[1].size).toBe(2);
		expect(tree.layers[1].has(1)).toBe(true);
		expect(tree.layers[1].has(2)).toBe(true);
	});

	it('preserves cell metadata', () => {
		const wire = makeWireFixture();
		const tree = deserializeCellTreeSnapshot(wire);

		const cellA = tree.cellMeta.get('cell-A');
		expect(cellA).toBeDefined();
		expect(cellA!.leafIndex).toBe(2);
		expect(cellA!.districts.length).toBe(24);

		const cellB = tree.cellMeta.get('cell-B');
		expect(cellB).toBeDefined();
		expect(cellB!.leafIndex).toBe(5);
	});

	it('rejects unsupported version', () => {
		const wire = makeWireFixture();
		wire.version = 2;
		expect(() => deserializeCellTreeSnapshot(wire)).toThrow('unsupported version 2');
	});

	it('rejects null/undefined wire', () => {
		expect(() => deserializeCellTreeSnapshot(null as unknown as CellTreeSnapshotWire)).toThrow(
			'must be an object'
		);
	});

	it('rejects invalid depth', () => {
		const wire = makeWireFixture();
		wire.depth = 0;
		expect(() => deserializeCellTreeSnapshot(wire)).toThrow('invalid depth');
	});

	it('rejects root exceeding BN254 modulus', () => {
		const wire = makeWireFixture();
		wire.root = OVER_MODULUS;
		expect(() => deserializeCellTreeSnapshot(wire)).toThrow('exceeds BN254 field modulus');
	});

	it('rejects non-hex root', () => {
		const wire = makeWireFixture();
		wire.root = 'not-hex';
		expect(() => deserializeCellTreeSnapshot(wire)).toThrow('expected 0x-hex');
	});

	it('rejects mismatched zeroHashes length', () => {
		const wire = makeWireFixture();
		wire.zeroHashes = [ZERO_HASH]; // only 1 instead of 3
		expect(() => deserializeCellTreeSnapshot(wire)).toThrow('expected 3 zeroHashes');
	});

	it('rejects invalid zeroHash element', () => {
		const wire = makeWireFixture();
		wire.zeroHashes[1] = OVER_MODULUS;
		expect(() => deserializeCellTreeSnapshot(wire)).toThrow('zeroHashes[1]');
	});

	it('rejects mismatched layers count', () => {
		const wire = makeWireFixture();
		wire.layers = wire.layers.slice(0, 2); // 2 instead of 3
		expect(() => deserializeCellTreeSnapshot(wire)).toThrow('expected 3 layers');
	});

	it('rejects invalid layer entry format', () => {
		const wire = makeWireFixture();
		wire.layers[0] = [[1, FIELD_HEX, 'extra'] as unknown as [number, string]];
		expect(() => deserializeCellTreeSnapshot(wire)).toThrow('must be [index, hash]');
	});

	it('rejects layer node with value exceeding BN254', () => {
		const wire = makeWireFixture();
		wire.layers[0] = [[0, OVER_MODULUS]];
		expect(() => deserializeCellTreeSnapshot(wire)).toThrow('exceeds BN254 field modulus');
	});

	it('rejects cell with wrong district count', () => {
		const wire = makeWireFixture();
		wire.cells[0].districts = wire.cells[0].districts.slice(0, 10);
		expect(() => deserializeCellTreeSnapshot(wire)).toThrow('10 districts, expected 24');
	});

	it('rejects cell with district exceeding BN254', () => {
		const wire = makeWireFixture();
		wire.cells[0].districts[5] = OVER_MODULUS;
		expect(() => deserializeCellTreeSnapshot(wire)).toThrow('districts[5]');
	});
});

// ============================================================================
// Path Computation Tests
// ============================================================================

describe('computeClientCellProof', () => {
	let tree: CellTreeSnapshot;

	beforeEach(() => {
		tree = deserializeCellTreeSnapshot(makeWireFixture());
	});

	it('computes proof for cell-A (leafIndex=2)', () => {
		const proof = computeClientCellProof(tree, 'cell-A');

		expect(proof.cellMapRoot).toBe(tree.root);
		expect(proof.cellMapPath.length).toBe(3); // depth 3
		expect(proof.cellMapPathBits.length).toBe(3);
		expect(proof.districts.length).toBe(24);
	});

	it('computes proof for cell-B (leafIndex=5)', () => {
		const proof = computeClientCellProof(tree, 'cell-B');

		expect(proof.cellMapRoot).toBe(tree.root);
		expect(proof.cellMapPath.length).toBe(3);
		expect(proof.cellMapPathBits.length).toBe(3);
		expect(proof.districts.length).toBe(24);
	});

	it('returns correct path bits for leafIndex=2 (binary 010)', () => {
		const proof = computeClientCellProof(tree, 'cell-A');
		// leafIndex 2 = binary 010 → bits are [0, 1, 0] (LSB first)
		expect(proof.cellMapPathBits).toEqual([0, 1, 0]);
	});

	it('returns correct path bits for leafIndex=5 (binary 101)', () => {
		const proof = computeClientCellProof(tree, 'cell-B');
		// leafIndex 5 = binary 101 → bits are [1, 0, 1] (LSB first)
		expect(proof.cellMapPathBits).toEqual([1, 0, 1]);
	});

	it('uses zero hash for empty siblings', () => {
		const proof = computeClientCellProof(tree, 'cell-A');
		// leafIndex=2, level 0: sibling is index 3 (not in layer) → zeroHashes[0]
		expect(proof.cellMapPath[0]).toBe(tree.zeroHashes[0]);
	});

	it('uses stored node for non-empty siblings', () => {
		const proof = computeClientCellProof(tree, 'cell-A');
		// leafIndex=2, level 1: parent index = 1, sibling = index 0
		// Index 0 at level 1 is NOT in the sparse map → zeroHashes[1]
		expect(proof.cellMapPath[1]).toBe(tree.zeroHashes[1]);

		// level 2: parent index = 0, sibling = index 1
		// Index 1 at level 2 IS in the sparse map
		expect(proof.cellMapPath[2]).toBe(tree.layers[2].get(1));
	});

	it('throws for unknown cell', () => {
		expect(() => computeClientCellProof(tree, 'nonexistent')).toThrow(
			'Cell "nonexistent" not found'
		);
	});

	it('returns districts from cell metadata', () => {
		const proof = computeClientCellProof(tree, 'cell-A');
		const expectedDistricts = tree.cellMeta.get('cell-A')!.districts;
		expect(proof.districts).toEqual(expectedDistricts);
	});

	it('path computation for leafIndex=5 picks correct siblings', () => {
		const proof = computeClientCellProof(tree, 'cell-B');

		// leafIndex=5, level 0: bit=1, sibling=4. Index 4 not in map → zeroHashes[0]
		expect(proof.cellMapPath[0]).toBe(tree.zeroHashes[0]);

		// level 1: parent=2, bit=0, sibling=3. Index 3 not in map → zeroHashes[1]
		expect(proof.cellMapPath[1]).toBe(tree.zeroHashes[1]);

		// level 2: parent=1, bit=1, sibling=0. Index 0 IS in map
		expect(proof.cellMapPath[2]).toBe(tree.layers[2].get(0));
	});
});

// ============================================================================
// Path Consistency Tests
// ============================================================================

describe('path computation consistency', () => {
	it('all path elements are valid 0x-hex strings', () => {
		const tree = deserializeCellTreeSnapshot(makeWireFixture());
		const proof = computeClientCellProof(tree, 'cell-A');

		for (const sibling of proof.cellMapPath) {
			expect(sibling).toMatch(/^0x[0-9a-fA-F]+$/);
		}
	});

	it('path bits are all 0 or 1', () => {
		const tree = deserializeCellTreeSnapshot(makeWireFixture());
		const proof = computeClientCellProof(tree, 'cell-B');

		for (const bit of proof.cellMapPathBits) {
			expect(bit === 0 || bit === 1).toBe(true);
		}
	});

	it('root in proof matches tree root', () => {
		const tree = deserializeCellTreeSnapshot(makeWireFixture());
		const proofA = computeClientCellProof(tree, 'cell-A');
		const proofB = computeClientCellProof(tree, 'cell-B');

		expect(proofA.cellMapRoot).toBe(tree.root);
		expect(proofB.cellMapRoot).toBe(tree.root);
	});

	it('different cells produce different paths', () => {
		const tree = deserializeCellTreeSnapshot(makeWireFixture());
		const proofA = computeClientCellProof(tree, 'cell-A');
		const proofB = computeClientCellProof(tree, 'cell-B');

		// Different leaf indices → different path bits at minimum
		expect(proofA.cellMapPathBits).not.toEqual(proofB.cellMapPathBits);
	});
});

// ============================================================================
// Root Validation Tests
// ============================================================================

describe('validateSnapshotRoot', () => {
	it('returns true when trusted root matches', async () => {
		const tree = deserializeCellTreeSnapshot(makeWireFixture());
		const result = await validateSnapshotRoot(tree, tree.root);
		expect(result).toBe(true);
	});

	it('returns false when trusted root mismatches', async () => {
		const tree = deserializeCellTreeSnapshot(makeWireFixture());
		const result = await validateSnapshotRoot(tree, FIELD_HEX_2);
		expect(result).toBe(false);
	});

	it('returns false when no trusted root and Shadow Atlas unavailable', async () => {
		const tree = deserializeCellTreeSnapshot(makeWireFixture());

		// Without explicit trustedRoot, validateSnapshotRoot tries a dynamic import
		// of client.ts which won't resolve in test environment → returns false.
		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const result = await validateSnapshotRoot(tree);
		expect(result).toBe(false);
		consoleSpy.mockRestore();
	});
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
	it('handles tree with single cell', () => {
		const wire = makeWireFixture();
		wire.cells = [wire.cells[0]]; // Keep only cell-A
		const tree = deserializeCellTreeSnapshot(wire);

		expect(tree.cellMeta.size).toBe(1);
		const proof = computeClientCellProof(tree, 'cell-A');
		expect(proof.cellMapPath.length).toBe(3);
	});

	it('handles completely sparse layer (all zeros)', () => {
		const wire = makeWireFixture();
		// Make layer 1 empty — all internal nodes at this level are zero
		wire.layers[1] = [];
		const tree = deserializeCellTreeSnapshot(wire);

		expect(tree.layers[1].size).toBe(0);

		const proof = computeClientCellProof(tree, 'cell-A');
		// Level 1 sibling should be zeroHash[1]
		expect(proof.cellMapPath[1]).toBe(tree.zeroHashes[1]);
	});

	it('leafIndex 0 produces all-zero path bits', () => {
		const wire = makeWireFixture();
		wire.cells = [{ cellId: 'cell-zero', leafIndex: 0, districts: makeDistricts() }];
		wire.layers[0] = [[0, FIELD_HEX]];
		const tree = deserializeCellTreeSnapshot(wire);

		const proof = computeClientCellProof(tree, 'cell-zero');
		expect(proof.cellMapPathBits).toEqual([0, 0, 0]);
	});

	it('max leafIndex (2^depth - 1) produces all-one path bits', () => {
		const wire = makeWireFixture();
		const maxIdx = (1 << wire.depth) - 1; // 7 for depth 3
		wire.cells = [{ cellId: 'cell-max', leafIndex: maxIdx, districts: makeDistricts() }];
		wire.layers[0] = [[maxIdx, FIELD_HEX]];
		const tree = deserializeCellTreeSnapshot(wire);

		const proof = computeClientCellProof(tree, 'cell-max');
		expect(proof.cellMapPathBits).toEqual([1, 1, 1]);
	});
});
