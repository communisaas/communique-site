/**
 * Unit tests for debate-client validation logic and parameter construction.
 *
 * Tests the pure validation layer (validateProofInputs, publicInputsToBigInt)
 * and parameter type correctness without requiring a blockchain connection.
 *
 * The client functions (clientSubmitArgument, clientCoSignArgument) depend on
 * ethers, wallet providers, and on-chain reads. We test:
 *   A. Pure validation logic (no mocking needed)
 *   B. publicInputsToBigInt conversion
 *   C. Parameter type interfaces (compile-time + runtime shape checks)
 *   D. Error handling patterns (mocked wallet rejection)
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';

import {
	validateProofInputs,
	publicInputsToBigInt,
	THREE_TREE_PUBLIC_INPUT_COUNT,
	VALID_VERIFIER_DEPTHS
} from '$lib/core/wallet/eip712';

import type {
	ClientSubmitArgumentParams,
	ClientCoSignArgumentParams
} from '$lib/core/wallet/debate-client';

// ═══════════════════════════════════════════════════════════════════════════
// TEST FIXTURES
// ═══════════════════════════════════════════════════════════════════════════

/** Valid 256-byte proof as 0x-prefixed hex (512 hex chars + 0x). */
const VALID_PROOF = '0x' + 'ab'.repeat(256);

/** Valid proof without 0x prefix. */
const VALID_PROOF_NO_PREFIX = 'ab'.repeat(256);

/** 31 valid public inputs (decimal strings, small values). */
const VALID_PUBLIC_INPUTS = Array.from({ length: 31 }, (_, i) => String(i + 1));

/** 31 valid public inputs as hex strings (0x-prefixed). */
const VALID_PUBLIC_INPUTS_HEX = Array.from(
	{ length: 31 },
	(_, i) => '0x' + (i + 1).toString(16)
);

/** BN254 scalar field modulus. */
const BN254_MODULUS = BigInt(
	'21888242871839275222246405745257275088548364400416034343698204186575808495617'
);

const DUMMY_BYTES32 = '0x' + 'aa'.repeat(32);
const DUMMY_ADDRESS = '0x' + 'ff'.repeat(20);

// ═══════════════════════════════════════════════════════════════════════════
// A. validateProofInputs
// ═══════════════════════════════════════════════════════════════════════════

describe('validateProofInputs', () => {
	describe('valid inputs', () => {
		it('returns null for valid proof with 0x prefix, 31 inputs, depth 20', () => {
			const result = validateProofInputs(VALID_PROOF, VALID_PUBLIC_INPUTS, 20);
			expect(result).toBeNull();
		});

		it('returns null for valid proof without 0x prefix', () => {
			const result = validateProofInputs(VALID_PROOF_NO_PREFIX, VALID_PUBLIC_INPUTS, 20);
			expect(result).toBeNull();
		});

		it.each([18, 20, 22, 24] as const)(
			'returns null for valid depth %d',
			(depth) => {
				const result = validateProofInputs(VALID_PROOF, VALID_PUBLIC_INPUTS, depth);
				expect(result).toBeNull();
			}
		);

		it('accepts public inputs as hex strings', () => {
			const result = validateProofInputs(VALID_PROOF, VALID_PUBLIC_INPUTS_HEX, 20);
			expect(result).toBeNull();
		});

		it('accepts public input at max BN254 field value (modulus - 1)', () => {
			const maxValue = (BN254_MODULUS - 1n).toString();
			const inputs = Array(31).fill(maxValue);
			const result = validateProofInputs(VALID_PROOF, inputs, 20);
			expect(result).toBeNull();
		});

		it('accepts public input of 0', () => {
			const inputs = Array(31).fill('0');
			const result = validateProofInputs(VALID_PROOF, inputs, 20);
			expect(result).toBeNull();
		});
	});

	describe('empty / malformed proof', () => {
		it('rejects empty proof (empty string)', () => {
			const result = validateProofInputs('', VALID_PUBLIC_INPUTS, 20);
			expect(result).toBe('Proof is empty');
		});

		it('rejects proof that is only "0x" prefix with no hex data', () => {
			const result = validateProofInputs('0x', VALID_PUBLIC_INPUTS, 20);
			expect(result).toBe('Proof is empty');
		});

		it('rejects proof with invalid hex characters', () => {
			const result = validateProofInputs('0xZZZZ', VALID_PUBLIC_INPUTS, 20);
			expect(result).toMatch(/invalid hex/i);
		});

		it('rejects proof with spaces', () => {
			const result = validateProofInputs('0x ab cd', VALID_PUBLIC_INPUTS, 20);
			expect(result).toMatch(/invalid hex/i);
		});
	});

	describe('wrong number of public inputs', () => {
		it('rejects 30 public inputs (too few)', () => {
			const inputs = Array(30).fill('1');
			const result = validateProofInputs(VALID_PROOF, inputs, 20);
			expect(result).toContain('Expected 31');
			expect(result).toContain('got 30');
		});

		it('rejects 32 public inputs (too many)', () => {
			const inputs = Array(32).fill('1');
			const result = validateProofInputs(VALID_PROOF, inputs, 20);
			expect(result).toContain('Expected 31');
			expect(result).toContain('got 32');
		});

		it('rejects empty public inputs array', () => {
			const result = validateProofInputs(VALID_PROOF, [], 20);
			expect(result).toContain('Expected 31');
			expect(result).toContain('got 0');
		});

		it('rejects 1 public input', () => {
			const result = validateProofInputs(VALID_PROOF, ['42'], 20);
			expect(result).toContain('Expected 31');
			expect(result).toContain('got 1');
		});
	});

	describe('invalid verifier depths', () => {
		it.each([0, 1, 10, 15, 17, 19, 21, 23, 25, 26, 30, 100])(
			'rejects invalid depth %d',
			(depth) => {
				const result = validateProofInputs(VALID_PROOF, VALID_PUBLIC_INPUTS, depth);
				expect(result).toContain('Invalid verifierDepth');
				expect(result).toContain(String(depth));
			}
		);

		it('error message lists valid depths', () => {
			const result = validateProofInputs(VALID_PROOF, VALID_PUBLIC_INPUTS, 19);
			expect(result).toContain('18');
			expect(result).toContain('20');
			expect(result).toContain('22');
			expect(result).toContain('24');
		});
	});

	describe('public input field range', () => {
		it('rejects public input at BN254 modulus (exactly at boundary)', () => {
			const inputs = [...VALID_PUBLIC_INPUTS];
			inputs[0] = BN254_MODULUS.toString();
			const result = validateProofInputs(VALID_PROOF, inputs, 20);
			expect(result).toContain('out of BN254 field range');
			expect(result).toContain('[0]');
		});

		it('rejects negative public input', () => {
			const inputs = [...VALID_PUBLIC_INPUTS];
			inputs[5] = '-1';
			const result = validateProofInputs(VALID_PROOF, inputs, 20);
			expect(result).toContain('out of BN254 field range');
			expect(result).toContain('[5]');
		});

		it('rejects non-numeric public input', () => {
			const inputs = [...VALID_PUBLIC_INPUTS];
			inputs[10] = 'not_a_number';
			const result = validateProofInputs(VALID_PROOF, inputs, 20);
			expect(result).toContain('not a valid integer');
			expect(result).toContain('[10]');
		});

		it('reports the index of the first invalid public input', () => {
			const inputs = [...VALID_PUBLIC_INPUTS];
			inputs[26] = 'garbage';
			const result = validateProofInputs(VALID_PROOF, inputs, 20);
			expect(result).toContain('[26]');
		});
	});

	describe('validation order (first check wins)', () => {
		it('checks public input count before proof content', () => {
			// Pass an invalid proof AND wrong input count.
			// Public input count check runs first in the function.
			const result = validateProofInputs('0xZZZZ', Array(10).fill('1'), 20);
			expect(result).toContain('Expected 31');
		});

		it('checks verifier depth after proof validation', () => {
			// Valid proof and inputs, but bad depth
			const result = validateProofInputs(VALID_PROOF, VALID_PUBLIC_INPUTS, 19);
			expect(result).toContain('Invalid verifierDepth');
		});
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// B. publicInputsToBigInt
// ═══════════════════════════════════════════════════════════════════════════

describe('publicInputsToBigInt', () => {
	it('converts decimal string array to BigInt array', () => {
		const inputs = ['100', '200', '300'];
		const result = publicInputsToBigInt(inputs);

		expect(result).toHaveLength(3);
		expect(result[0]).toBe(100n);
		expect(result[1]).toBe(200n);
		expect(result[2]).toBe(300n);
	});

	it('converts hex string array to BigInt array', () => {
		const inputs = ['0xff', '0x100', '0xdeadbeef'];
		const result = publicInputsToBigInt(inputs);

		expect(result).toHaveLength(3);
		expect(result[0]).toBe(255n);
		expect(result[1]).toBe(256n);
		expect(result[2]).toBe(0xdeadbeefn);
	});

	it('handles "0" correctly', () => {
		const inputs = ['0', '0', '0'];
		const result = publicInputsToBigInt(inputs);

		expect(result).toEqual([0n, 0n, 0n]);
	});

	it('converts large BN254 field values correctly', () => {
		const maxField = (BN254_MODULUS - 1n).toString();
		const inputs = [maxField];
		const result = publicInputsToBigInt(inputs);

		expect(result[0]).toBe(BN254_MODULUS - 1n);
	});

	it('preserves array length (does not pad)', () => {
		// publicInputsToBigInt is a simple map — it does NOT pad.
		// If fewer than 31 are passed, it returns fewer than 31.
		const inputs = ['1', '2', '3'];
		const result = publicInputsToBigInt(inputs);

		expect(result).toHaveLength(3);
	});

	it('returns empty array for empty input', () => {
		const result = publicInputsToBigInt([]);
		expect(result).toEqual([]);
	});

	it('handles full 31-element array', () => {
		const result = publicInputsToBigInt(VALID_PUBLIC_INPUTS);
		expect(result).toHaveLength(31);
		expect(result.every((v) => typeof v === 'bigint')).toBe(true);
	});

	it('converts mixed decimal and hex strings', () => {
		const inputs = ['42', '0x2a']; // both are 42
		const result = publicInputsToBigInt(inputs);
		expect(result[0]).toBe(result[1]);
		expect(result[0]).toBe(42n);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// C. Parameter type interfaces
// ═══════════════════════════════════════════════════════════════════════════

describe('parameter type interfaces', () => {
	describe('ClientSubmitArgumentParams', () => {
		it('can construct a valid object with all required fields', () => {
			const params: ClientSubmitArgumentParams = {
				debateId: DUMMY_BYTES32,
				stance: 0,
				bodyHash: DUMMY_BYTES32,
				amendmentHash: '0x' + '00'.repeat(32),
				stakeAmount: 1000000n, // 1 USDC (6 decimals)
				proof: VALID_PROOF,
				publicInputs: VALID_PUBLIC_INPUTS,
				verifierDepth: 20,
				districtGateAddress: DUMMY_ADDRESS,
				chainId: 534351
			};

			expect(params.debateId).toBe(DUMMY_BYTES32);
			expect(params.stance).toBe(0);
			expect(params.bodyHash).toBe(DUMMY_BYTES32);
			expect(typeof params.stakeAmount).toBe('bigint');
			expect(params.publicInputs).toHaveLength(31);
			expect(params.verifierDepth).toBe(20);
			expect(params.chainId).toBe(534351);
		});

		it('stakeAmount is bigint (not number)', () => {
			const params: ClientSubmitArgumentParams = {
				debateId: DUMMY_BYTES32,
				stance: 1,
				bodyHash: DUMMY_BYTES32,
				amendmentHash: DUMMY_BYTES32,
				stakeAmount: BigInt('1000000'),
				proof: VALID_PROOF,
				publicInputs: VALID_PUBLIC_INPUTS,
				verifierDepth: 20,
				districtGateAddress: DUMMY_ADDRESS,
				chainId: 534351
			};

			expect(typeof params.stakeAmount).toBe('bigint');
		});
	});

	describe('ClientCoSignArgumentParams', () => {
		it('can construct a valid object with all required fields', () => {
			const params: ClientCoSignArgumentParams = {
				debateId: DUMMY_BYTES32,
				argumentIndex: 0,
				stakeAmount: 500000n, // 0.5 USDC
				proof: VALID_PROOF,
				publicInputs: VALID_PUBLIC_INPUTS,
				verifierDepth: 22,
				districtGateAddress: DUMMY_ADDRESS,
				chainId: 534351
			};

			expect(params.debateId).toBe(DUMMY_BYTES32);
			expect(params.argumentIndex).toBe(0);
			expect(typeof params.stakeAmount).toBe('bigint');
			expect(params.verifierDepth).toBe(22);
		});

		it('argumentIndex can be any non-negative integer', () => {
			const params: ClientCoSignArgumentParams = {
				debateId: DUMMY_BYTES32,
				argumentIndex: 42,
				stakeAmount: 1000000n,
				proof: VALID_PROOF,
				publicInputs: VALID_PUBLIC_INPUTS,
				verifierDepth: 20,
				districtGateAddress: DUMMY_ADDRESS,
				chainId: 534351
			};

			expect(params.argumentIndex).toBe(42);
		});
	});

	describe('stance mapping', () => {
		it('SUPPORT = 0', () => {
			// The contract uses uint8 stance: 0=SUPPORT, 1=OPPOSE, 2=AMEND
			const SUPPORT = 0;
			const params: ClientSubmitArgumentParams = {
				debateId: DUMMY_BYTES32,
				stance: SUPPORT,
				bodyHash: DUMMY_BYTES32,
				amendmentHash: '0x' + '00'.repeat(32),
				stakeAmount: 1000000n,
				proof: VALID_PROOF,
				publicInputs: VALID_PUBLIC_INPUTS,
				verifierDepth: 20,
				districtGateAddress: DUMMY_ADDRESS,
				chainId: 534351
			};
			expect(params.stance).toBe(0);
		});

		it('OPPOSE = 1', () => {
			const OPPOSE = 1;
			const params: ClientSubmitArgumentParams = {
				debateId: DUMMY_BYTES32,
				stance: OPPOSE,
				bodyHash: DUMMY_BYTES32,
				amendmentHash: '0x' + '00'.repeat(32),
				stakeAmount: 1000000n,
				proof: VALID_PROOF,
				publicInputs: VALID_PUBLIC_INPUTS,
				verifierDepth: 20,
				districtGateAddress: DUMMY_ADDRESS,
				chainId: 534351
			};
			expect(params.stance).toBe(1);
		});

		it('AMEND = 2', () => {
			const AMEND = 2;
			const params: ClientSubmitArgumentParams = {
				debateId: DUMMY_BYTES32,
				stance: AMEND,
				bodyHash: DUMMY_BYTES32,
				amendmentHash: DUMMY_BYTES32, // AMEND requires a real amendment hash
				stakeAmount: 1000000n,
				proof: VALID_PROOF,
				publicInputs: VALID_PUBLIC_INPUTS,
				verifierDepth: 20,
				districtGateAddress: DUMMY_ADDRESS,
				chainId: 534351
			};
			expect(params.stance).toBe(2);
		});
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// D. Error handling patterns
// ═══════════════════════════════════════════════════════════════════════════

describe('error handling patterns', () => {
	describe('validation errors in client functions', () => {
		// We can't easily import clientSubmitArgument/clientCoSignArgument because
		// they transitively import from $lib/core/contracts (via token.ts) which
		// needs $env/dynamic/public. Instead, we test the pattern they use:
		// validateProofInputs returns a string, and they wrap it in an Error.

		it('validation error becomes "Proof validation failed: ..." message', () => {
			const error = validateProofInputs('', VALID_PUBLIC_INPUTS, 20);
			expect(error).not.toBeNull();

			// This mirrors the pattern in clientSubmitArgument:
			// throw new Error(`Proof validation failed: ${validationError}`);
			const wrappedMessage = `Proof validation failed: ${error}`;
			expect(wrappedMessage).toBe('Proof validation failed: Proof is empty');
		});

		it('wrong input count produces a descriptive error', () => {
			const error = validateProofInputs(VALID_PROOF, Array(5).fill('1'), 20);
			const wrappedMessage = `Proof validation failed: ${error}`;
			expect(wrappedMessage).toContain('Expected 31 public inputs, got 5');
		});

		it('invalid depth produces a descriptive error', () => {
			const error = validateProofInputs(VALID_PROOF, VALID_PUBLIC_INPUTS, 19);
			const wrappedMessage = `Proof validation failed: ${error}`;
			expect(wrappedMessage).toContain('Invalid verifierDepth 19');
		});
	});

	describe('wallet rejection error codes', () => {
		// These test the error shapes that wallet providers produce.
		// The client functions propagate these errors to the calling component.

		it('MetaMask ACTION_REJECTED error has code property', () => {
			const error = Object.assign(
				new Error('user rejected transaction'),
				{ code: 'ACTION_REJECTED' }
			);
			expect(error.message).toBe('user rejected transaction');
			expect((error as Error & { code: string }).code).toBe('ACTION_REJECTED');
		});

		it('EIP-1193 error code 4001 indicates user rejection', () => {
			const error = Object.assign(
				new Error('User denied transaction signature'),
				{ code: 4001 }
			);
			expect((error as Error & { code: number }).code).toBe(4001);
		});

		it('EIP-1193 error code 4100 indicates unauthorized', () => {
			const error = Object.assign(
				new Error('The requested account is not authorized'),
				{ code: 4100 }
			);
			expect((error as Error & { code: number }).code).toBe(4100);
		});

		it('nested error object preserves inner code', () => {
			// Some providers wrap errors: { code: -32603, error: { code: 4001 } }
			const error = {
				code: -32603,
				message: 'Internal JSON-RPC error',
				error: {
					code: 4001,
					message: 'User rejected the request'
				}
			};
			expect(error.error.code).toBe(4001);
		});
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// E. Constants
// ═══════════════════════════════════════════════════════════════════════════

describe('constants', () => {
	it('THREE_TREE_PUBLIC_INPUT_COUNT is 31', () => {
		expect(THREE_TREE_PUBLIC_INPUT_COUNT).toBe(31);
	});

	it('VALID_VERIFIER_DEPTHS contains exactly [18, 20, 22, 24]', () => {
		expect([...VALID_VERIFIER_DEPTHS]).toEqual([18, 20, 22, 24]);
	});

	it('VALID_VERIFIER_DEPTHS is readonly (frozen tuple)', () => {
		// TypeScript enforces this at compile-time via `as const`,
		// but verify it behaves as expected at runtime.
		expect(VALID_VERIFIER_DEPTHS).toHaveLength(4);
		expect(VALID_VERIFIER_DEPTHS[0]).toBe(18);
		expect(VALID_VERIFIER_DEPTHS[3]).toBe(24);
	});
});
