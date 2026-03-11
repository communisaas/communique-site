/**
 * Unit Tests: POST /api/wallet/sponsor-userop
 *
 * Tests the ERC-4337 UserOperation sponsorship endpoint which:
 * 1. Requires authentication (locals.user)
 * 2. Per-user rate limit (5 ops / 24h)
 * 3. Validates request body (userOp + signature)
 * 4. Deserializes wire-format UserOp (hex strings -> bigint)
 * 5. Creates Pimlico client for gas sponsorship
 * 6. Policy enforcement: allowed targets (DebateMarket only), max gas cap
 * 7. Sponsors, submits to bundler, waits for receipt
 * 8. Returns txHash on success, structured errors on failure
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const {
	mockCreatePimlicoClient,
	mockSponsorUserOperation,
	mockSendUserOperation,
	mockWaitForUserOperationReceipt
} = vi.hoisted(() => ({
	mockCreatePimlicoClient: vi.fn(),
	mockSponsorUserOperation: vi.fn(),
	mockSendUserOperation: vi.fn(),
	mockWaitForUserOperationReceipt: vi.fn()
}));

vi.mock('$lib/core/gas/pimlico', () => ({
	createPimlicoClient: (...args: unknown[]) => mockCreatePimlicoClient(...args),
	sponsorUserOperation: (...args: unknown[]) => mockSponsorUserOperation(...args),
	sendUserOperation: (...args: unknown[]) => mockSendUserOperation(...args),
	waitForUserOperationReceipt: (...args: unknown[]) => mockWaitForUserOperationReceipt(...args)
}));

vi.mock('$env/dynamic/private', () => ({
	env: {
		DEBATE_MARKET_ADDRESS: '0x410699589e5c03EBd18bB1Bd62db06FF5C704Eaa',
		SCROLL_NETWORK: 'scroll-sepolia'
	}
}));

// Mock $types
vi.mock('../../../../src/routes/api/wallet/sponsor-userop/$types', () => ({}));

// Import handler AFTER mocks
const { POST } = await import('../../../src/routes/api/wallet/sponsor-userop/+server');

// =============================================================================
// HELPERS
// =============================================================================

const VALID_USEROP = {
	sender: '0x1234567890abcdef1234567890abcdef12345678',
	nonce: '0x0',
	callData: '0xdeadbeef',
	callGasLimit: '0x0',
	verificationGasLimit: '0x0',
	preVerificationGas: '0x0',
	maxFeePerGas: '0x0',
	maxPriorityFeePerGas: '0x0'
};

const VALID_SIGNATURE = '0x' + 'ab'.repeat(65);

function createEvent(overrides: {
	user?: { id: string } | null;
	body?: Record<string, unknown>;
} = {}): any {
	const body = overrides.body ?? { userOp: VALID_USEROP, signature: VALID_SIGNATURE };
	return {
		request: new Request('http://localhost/api/wallet/sponsor-userop', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		locals: {
			user: overrides.user !== undefined ? overrides.user : { id: 'user-001' }
		}
	};
}

const MOCK_PIMLICO_CLIENT = { type: 'pimlico-client' };

// =============================================================================
// TESTS
// =============================================================================

describe('POST /api/wallet/sponsor-userop', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockCreatePimlicoClient.mockReturnValue(MOCK_PIMLICO_CLIENT);
		mockSponsorUserOperation.mockResolvedValue({
			sponsored: true,
			paymaster: '0xPaymaster',
			paymasterData: '0xPMData',
			paymasterVerificationGasLimit: 100000n,
			paymasterPostOpGasLimit: 50000n,
			callGasLimit: 300000n,
			verificationGasLimit: 200000n,
			preVerificationGas: 50000n,
			maxFeePerGas: 1000000000n,
			maxPriorityFeePerGas: 100000000n
		});
		mockSendUserOperation.mockResolvedValue('0xUserOpHash123');
		mockWaitForUserOperationReceipt.mockResolvedValue({
			txHash: '0xTxHash456',
			success: true
		});
	});

	// =========================================================================
	// Authentication
	// =========================================================================

	describe('Authentication', () => {
		it('should return 401 when user is not authenticated', async () => {
			const event = createEvent({ user: null });

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.success).toBe(false);
			expect(data.error).toContain('Authentication required');
		});
	});

	// =========================================================================
	// Rate Limiting
	// =========================================================================

	describe('Rate Limiting', () => {
		it('should return 429 after 5 requests from same user', async () => {
			// Make 5 successful requests
			for (let i = 0; i < 5; i++) {
				const event = createEvent({ user: { id: 'rate-limit-user' } });
				const response = await POST(event);
				expect(response.status).toBe(200);
			}

			// 6th request should be rate limited
			const event = createEvent({ user: { id: 'rate-limit-user' } });
			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(429);
			expect(data.success).toBe(false);
			expect(data.error).toContain('rate limit');
			expect(response.headers.get('Retry-After')).toBeDefined();
		});

		it('should allow requests from different users independently', async () => {
			// 5 requests from user A
			for (let i = 0; i < 5; i++) {
				const event = createEvent({ user: { id: 'user-A' } });
				await POST(event);
			}

			// User B should still be allowed
			const event = createEvent({ user: { id: 'user-B' } });
			const response = await POST(event);

			expect(response.status).toBe(200);
		});
	});

	// =========================================================================
	// Input Validation
	// =========================================================================

	describe('Input Validation', () => {
		it('should return 400 for invalid JSON body', async () => {
			const event = {
				request: new Request('http://localhost/test', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: 'not json'
				}),
				locals: { user: { id: 'user-001' } }
			};

			const response = await POST(event as any);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toContain('Invalid JSON');
		});

		it('should return 400 when userOp is missing', async () => {
			const event = createEvent({
				body: { signature: VALID_SIGNATURE }
			});

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toContain('userOp');
		});

		it('should return 400 when signature is missing', async () => {
			const event = createEvent({
				body: { userOp: VALID_USEROP }
			});

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toContain('signature');
		});

		it('should return 400 when signature is not 0x-prefixed', async () => {
			const event = createEvent({
				body: { userOp: VALID_USEROP, signature: 'not-hex' }
			});

			const response = await POST(event);

			expect(response.status).toBe(400);
		});

		it('should return 400 when sender is invalid address', async () => {
			const event = createEvent({
				body: {
					userOp: { ...VALID_USEROP, sender: 'not-an-address' },
					signature: VALID_SIGNATURE
				}
			});

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toContain('sender');
		});

		it('should return 400 when nonce is missing', async () => {
			const event = createEvent({
				user: { id: 'validate-user-1' },
				body: {
					userOp: { ...VALID_USEROP, nonce: '' },
					signature: VALID_SIGNATURE
				}
			});

			const response = await POST(event);

			expect(response.status).toBe(400);
		});

		it('should return 400 when callData is not 0x-prefixed', async () => {
			const event = createEvent({
				user: { id: 'validate-user-2' },
				body: {
					userOp: { ...VALID_USEROP, callData: 'deadbeef' },
					signature: VALID_SIGNATURE
				}
			});

			const response = await POST(event);

			expect(response.status).toBe(400);
		});
	});

	// =========================================================================
	// Pimlico Client
	// =========================================================================

	describe('Pimlico Client', () => {
		it('should return 503 when Pimlico client creation fails', async () => {
			mockCreatePimlicoClient.mockImplementation(() => {
				throw new Error('PIMLICO_API_KEY not set');
			});

			const event = createEvent({ user: { id: 'pimlico-user-1' } });
			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(503);
			expect(data.error).toContain('unavailable');
		});
	});

	// =========================================================================
	// Sponsorship Policy
	// =========================================================================

	describe('Sponsorship Policy', () => {
		it('should pass policy with allowed targets and max gas to sponsor call', async () => {
			const event = createEvent({ user: { id: 'policy-user-1' } });

			await POST(event);

			expect(mockSponsorUserOperation).toHaveBeenCalledWith(
				MOCK_PIMLICO_CLIENT,
				expect.any(Object),
				expect.objectContaining({
					allowedTargets: expect.arrayContaining([expect.any(String)]),
					maxGasPerOp: expect.any(BigInt)
				})
			);
		});

		it('should return 402 when sponsorship is denied', async () => {
			mockSponsorUserOperation.mockResolvedValue({
				sponsored: false,
				reason: 'Target contract not in allow-list'
			});

			const event = createEvent({ user: { id: 'policy-user-2' } });
			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(402);
			expect(data.success).toBe(false);
			expect(data.error).toContain('denied');
			expect(data.reason).toBe('Target contract not in allow-list');
		});

		it('should return 502 when sponsorship call throws', async () => {
			mockSponsorUserOperation.mockRejectedValue(new Error('Pimlico RPC timeout'));

			const event = createEvent({ user: { id: 'policy-user-3' } });
			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(502);
			expect(data.error).toContain('Sponsorship failed');
		});
	});

	// =========================================================================
	// Bundler Submission
	// =========================================================================

	describe('Bundler Submission', () => {
		it('should return 502 when bundler submission fails', async () => {
			mockSendUserOperation.mockRejectedValue(new Error('Bundler rejected'));

			const event = createEvent({ user: { id: 'bundler-user-1' } });
			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(502);
			expect(data.error).toContain('Bundler submission failed');
		});

		it('should return 202 when receipt polling times out (UserOp may still be pending)', async () => {
			mockWaitForUserOperationReceipt.mockRejectedValue(new Error('Polling timeout'));

			const event = createEvent({ user: { id: 'bundler-user-2' } });
			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(202);
			expect(data.success).toBe(false);
			expect(data.userOpHash).toBe('0xUserOpHash123');
			expect(data.error).toContain('receipt not confirmed');
		});

		it('should return 422 when UserOp reverts on-chain', async () => {
			mockWaitForUserOperationReceipt.mockResolvedValue({
				txHash: '0xRevertedTx',
				success: false
			});

			const event = createEvent({ user: { id: 'bundler-user-3' } });
			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(422);
			expect(data.success).toBe(false);
			expect(data.error).toContain('reverted');
			expect(data.txHash).toBe('0xRevertedTx');
		});
	});

	// =========================================================================
	// Successful Flow
	// =========================================================================

	describe('Successful Flow', () => {
		it('should return 200 with txHash and userOpHash on success', async () => {
			const event = createEvent({ user: { id: 'success-user-1' } });

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.txHash).toBe('0xTxHash456');
			expect(data.userOpHash).toBe('0xUserOpHash123');
		});

		it('should pass signature to the full UserOp', async () => {
			const event = createEvent({ user: { id: 'success-user-2' } });

			await POST(event);

			// sendUserOperation receives the full UserOp with the client signature
			expect(mockSendUserOperation).toHaveBeenCalledWith(
				MOCK_PIMLICO_CLIENT,
				expect.objectContaining({
					signature: VALID_SIGNATURE,
					sender: VALID_USEROP.sender
				})
			);
		});

		it('should merge Pimlico sponsorship gas values into the UserOp', async () => {
			const event = createEvent({ user: { id: 'success-user-3' } });

			await POST(event);

			const submittedOp = mockSendUserOperation.mock.calls[0][1];
			// Gas fields come from Pimlico, not from client zeros
			expect(submittedOp.callGasLimit).toBe(300000n);
			expect(submittedOp.verificationGasLimit).toBe(200000n);
			expect(submittedOp.paymaster).toBe('0xPaymaster');
			expect(submittedOp.paymasterData).toBe('0xPMData');
		});

		it('should deserialize hex nonce to bigint', async () => {
			const event = createEvent({
				user: { id: 'success-user-4' },
				body: {
					userOp: { ...VALID_USEROP, nonce: '0xa' },
					signature: VALID_SIGNATURE
				}
			});

			await POST(event);

			const sponsoredOp = mockSponsorUserOperation.mock.calls[0][1];
			expect(sponsoredOp.nonce).toBe(10n);
		});
	});
});
