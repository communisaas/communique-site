/**
 * Proof Input Mapper Tests (CR-009)
 *
 * Validates SessionCredential → TwoTreeProofInputs mapping.
 * This is the bridge between stored credentials (IndexedDB) and
 * proof generation (Noir circuit via WASM).
 *
 * CRITICAL: Field name mismatches here cause silent proof failures.
 * The mapper renames merkleRoot→userRoot, merklePath→userPath, leafIndex→userIndex.
 */

import { describe, it, expect } from 'vitest';
import {
	mapCredentialToProofInputs,
	type ProofContext
} from '$lib/core/identity/proof-input-mapper';
import type { SessionCredential } from '$lib/core/identity/session-credentials';

// ============================================================================
// Test Fixtures
// ============================================================================

function makeTwoTreeCredential(overrides: Partial<SessionCredential> = {}): SessionCredential {
	return {
		userId: 'test-user-1',
		identityCommitment: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
		leafIndex: 5,
		merklePath: Array(20).fill('0x' + '01'.padStart(64, '0')),
		merkleRoot: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
		congressionalDistrict: 'two-tree',
		credentialType: 'two-tree',
		cellId: '0x0000000000000000000000000000000000000000000000000000006075061200',
		cellMapRoot: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
		cellMapPath: Array(20).fill('0x' + '02'.padStart(64, '0')),
		cellMapPathBits: Array(20).fill(0),
		districts: Array(24).fill('0x' + '03'.padStart(64, '0')),
		userSecret: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
		registrationSalt: '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
		verificationMethod: 'self.xyz',
		createdAt: new Date('2026-02-01'),
		expiresAt: new Date('2026-08-01'),
		...overrides
	};
}

function makeProofContext(overrides: Partial<ProofContext> = {}): ProofContext {
	return {
		actionDomain: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
		nullifier: '0x0fedcba098765432fedcba098765432fedcba098765432fedcba098765432fed',
		...overrides
	};
}

// ============================================================================
// Field Mapping
// ============================================================================

describe('mapCredentialToProofInputs', () => {
	describe('field mapping', () => {
		it('maps merkleRoot → userRoot', () => {
			const credential = makeTwoTreeCredential();
			const context = makeProofContext();
			const inputs = mapCredentialToProofInputs(credential, context);

			expect(inputs.userRoot).toBe(credential.merkleRoot);
		});

		it('maps merklePath → userPath', () => {
			const credential = makeTwoTreeCredential();
			const context = makeProofContext();
			const inputs = mapCredentialToProofInputs(credential, context);

			expect(inputs.userPath).toBe(credential.merklePath);
		});

		it('maps leafIndex → userIndex', () => {
			const credential = makeTwoTreeCredential();
			const context = makeProofContext();
			const inputs = mapCredentialToProofInputs(credential, context);

			expect(inputs.userIndex).toBe(credential.leafIndex);
		});

		it('passes cellMapRoot directly', () => {
			const credential = makeTwoTreeCredential();
			const context = makeProofContext();
			const inputs = mapCredentialToProofInputs(credential, context);

			expect(inputs.cellMapRoot).toBe(credential.cellMapRoot);
		});

		it('passes cellMapPath directly', () => {
			const credential = makeTwoTreeCredential();
			const context = makeProofContext();
			const inputs = mapCredentialToProofInputs(credential, context);

			expect(inputs.cellMapPath).toBe(credential.cellMapPath);
		});

		it('passes cellMapPathBits directly', () => {
			const credential = makeTwoTreeCredential();
			const context = makeProofContext();
			const inputs = mapCredentialToProofInputs(credential, context);

			expect(inputs.cellMapPathBits).toBe(credential.cellMapPathBits);
		});

		it('passes districts directly', () => {
			const credential = makeTwoTreeCredential();
			const context = makeProofContext();
			const inputs = mapCredentialToProofInputs(credential, context);

			expect(inputs.districts).toBe(credential.districts);
		});

		it('passes userSecret directly', () => {
			const credential = makeTwoTreeCredential();
			const context = makeProofContext();
			const inputs = mapCredentialToProofInputs(credential, context);

			expect(inputs.userSecret).toBe(credential.userSecret);
		});

		it('passes cellId directly', () => {
			const credential = makeTwoTreeCredential();
			const context = makeProofContext();
			const inputs = mapCredentialToProofInputs(credential, context);

			expect(inputs.cellId).toBe(credential.cellId);
		});

		it('passes registrationSalt directly', () => {
			const credential = makeTwoTreeCredential();
			const context = makeProofContext();
			const inputs = mapCredentialToProofInputs(credential, context);

			expect(inputs.registrationSalt).toBe(credential.registrationSalt);
		});

		it('passes identityCommitment directly (NUL-001)', () => {
			const credential = makeTwoTreeCredential();
			const context = makeProofContext();
			const inputs = mapCredentialToProofInputs(credential, context);

			expect(inputs.identityCommitment).toBe(credential.identityCommitment);
		});

		it('uses context.nullifier', () => {
			const credential = makeTwoTreeCredential();
			const context = makeProofContext({ nullifier: '0x42' });
			const inputs = mapCredentialToProofInputs(credential, context);

			expect(inputs.nullifier).toBe('0x42');
		});

		it('uses context.actionDomain', () => {
			const credential = makeTwoTreeCredential();
			const context = makeProofContext({ actionDomain: '0x99' });
			const inputs = mapCredentialToProofInputs(credential, context);

			expect(inputs.actionDomain).toBe('0x99');
		});
	});

	// ============================================================================
	// Authority Level Resolution
	// ============================================================================

	describe('authority level resolution', () => {
		it('uses credential.authorityLevel when present (server-derived)', () => {
			const credential = makeTwoTreeCredential({ authorityLevel: 4 });
			const context = makeProofContext({ authorityLevel: 2 });

			const inputs = mapCredentialToProofInputs(credential, context);

			expect(inputs.authorityLevel).toBe(4);
		});

		it('falls back to context.authorityLevel when credential lacks it', () => {
			const credential = makeTwoTreeCredential();
			const context = makeProofContext({ authorityLevel: 5 });

			const inputs = mapCredentialToProofInputs(credential, context);

			expect(inputs.authorityLevel).toBe(5);
		});

		it('uses conservative fallback (3) for verified users without authorityLevel', () => {
			const credential = makeTwoTreeCredential({
				identityCommitment: '0x1234' // present → verified
			});
			const context = makeProofContext(); // no authorityLevel

			const inputs = mapCredentialToProofInputs(credential, context);

			// Conservative: level 3 (not 4) because we don't know document_type client-side
			expect(inputs.authorityLevel).toBe(3);
		});

		it('throws when identityCommitment is empty (NUL-001 requires verified identity)', () => {
			const credential = makeTwoTreeCredential({
				identityCommitment: '' // empty → unverified → cannot generate proof
			});
			const context = makeProofContext();

			expect(() => mapCredentialToProofInputs(credential, context)).toThrow(
				'identityCommitment'
			);
		});
	});

	// ============================================================================
	// Validation
	// ============================================================================

	describe('validation', () => {
		it('throws for single-tree credential', () => {
			const credential = makeTwoTreeCredential({ credentialType: 'single-tree' });
			const context = makeProofContext();

			expect(() => mapCredentialToProofInputs(credential, context)).toThrow(
				'Expected two-tree credential'
			);
		});

		it('throws for undefined credentialType (legacy)', () => {
			const credential = makeTwoTreeCredential({ credentialType: undefined });
			const context = makeProofContext();

			expect(() => mapCredentialToProofInputs(credential, context)).toThrow(
				'Expected two-tree credential'
			);
		});

		it('throws when merkleRoot is missing', () => {
			const credential = makeTwoTreeCredential({ merkleRoot: '' });
			const context = makeProofContext();

			expect(() => mapCredentialToProofInputs(credential, context)).toThrow(
				'missing required fields'
			);
			expect(() => mapCredentialToProofInputs(credential, context)).toThrow('merkleRoot');
		});

		it('throws when cellMapRoot is missing', () => {
			const credential = makeTwoTreeCredential({ cellMapRoot: '' });
			const context = makeProofContext();

			expect(() => mapCredentialToProofInputs(credential, context)).toThrow('cellMapRoot');
		});

		it('throws when userSecret is missing', () => {
			const credential = makeTwoTreeCredential({ userSecret: '' });
			const context = makeProofContext();

			expect(() => mapCredentialToProofInputs(credential, context)).toThrow('userSecret');
		});

		it('throws when districts is missing', () => {
			const credential = makeTwoTreeCredential({ districts: undefined });
			const context = makeProofContext();

			expect(() => mapCredentialToProofInputs(credential, context)).toThrow('districts');
		});

		it('reports all missing fields at once', () => {
			const credential = makeTwoTreeCredential({
				merkleRoot: '',
				cellMapRoot: '',
				userSecret: ''
			});
			const context = makeProofContext();

			expect(() => mapCredentialToProofInputs(credential, context)).toThrow(
				/merkleRoot.*cellMapRoot.*userSecret/
			);
		});

		it('succeeds with a complete credential', () => {
			const credential = makeTwoTreeCredential();
			const context = makeProofContext();

			const inputs = mapCredentialToProofInputs(credential, context);

			expect(inputs).toBeDefined();
			expect(inputs.userRoot).toBeDefined();
			expect(inputs.cellMapRoot).toBeDefined();
			expect(inputs.nullifier).toBeDefined();
			expect(inputs.actionDomain).toBeDefined();
			expect(inputs.authorityLevel).toBeGreaterThanOrEqual(1);
			expect(inputs.authorityLevel).toBeLessThanOrEqual(5);
		});
	});

	// ============================================================================
	// Output Shape (matches TwoTreeProofInputs interface)
	// ============================================================================

	describe('output shape', () => {
		it('has all required public input fields', () => {
			const credential = makeTwoTreeCredential();
			const context = makeProofContext();
			const inputs = mapCredentialToProofInputs(credential, context);

			expect(inputs).toHaveProperty('userRoot');
			expect(inputs).toHaveProperty('cellMapRoot');
			expect(inputs).toHaveProperty('districts');
			expect(inputs).toHaveProperty('nullifier');
			expect(inputs).toHaveProperty('actionDomain');
			expect(inputs).toHaveProperty('authorityLevel');
		});

		it('has all required private input fields', () => {
			const credential = makeTwoTreeCredential();
			const context = makeProofContext();
			const inputs = mapCredentialToProofInputs(credential, context);

			expect(inputs).toHaveProperty('userSecret');
			expect(inputs).toHaveProperty('cellId');
			expect(inputs).toHaveProperty('registrationSalt');
			expect(inputs).toHaveProperty('identityCommitment');
		});

		it('has all required tree proof fields', () => {
			const credential = makeTwoTreeCredential();
			const context = makeProofContext();
			const inputs = mapCredentialToProofInputs(credential, context);

			// Tree 1
			expect(inputs).toHaveProperty('userPath');
			expect(inputs).toHaveProperty('userIndex');

			// Tree 2
			expect(inputs).toHaveProperty('cellMapPath');
			expect(inputs).toHaveProperty('cellMapPathBits');
		});
	});
});
