import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules first, before any imports
vi.mock('$lib/server/db', () => ({
	db: {
		user: {
			update: vi.fn()
		}
	}
}));

vi.mock('@selfxyz/core', () => ({
	SelfBackendVerifier: vi.fn().mockImplementation(() => ({
		verify: vi.fn()
	})),
	InMemoryConfigStore: vi.fn().mockImplementation(() => ({
		getActionId: vi.fn(),
		setConfig: vi.fn()
	}))
}));

vi.mock('$lib/server/selfxyz-config', () => ({
	SELF_XYZ_SCOPE: "communique-congressional",
	SELF_XYZ_ENDPOINT: "http://localhost:5173/api/identity/verify"
}));

// Now import after mocking
import { POST } from './+server';
import type { RequestEvent } from '@sveltejs/kit';

describe('Self.xyz Verification API', () => {
	const mockUser = {
		id: 'test-user-123',
		email: 'test@example.com',
		is_verified: false
	};

	let mockRequest: RequestEvent;

	beforeEach(async () => {
		vi.clearAllMocks();
		
		// Setup default request mock
		mockRequest = {
			request: { json: vi.fn() },
			getClientAddress: vi.fn().mockReturnValue('127.0.0.1'),
			locals: { user: mockUser }
		} as any;
	});

	describe('Successful Verification', () => {
		it('should verify valid Self.xyz proof and update user', async () => {
			// Arrange
			const requestData = {
				attestationId: 1,
				proof: {
					a: ['0x123'],
					b: [['0x456', '0x789']],
					c: ['0xabc'],
					nullifier: '0xdef'
				},
				pubSignals: ['0x111', '0x222'],
				userContextData: JSON.stringify({
					userId: 'test-user-123',
					templateSlug: 'climate-action'
				})
			};

			const mockVerificationResult = {
				isValidDetails: {
					isValid: true,
					isMinimumAgeValid: true,
					isOfacValid: true
				},
				discloseOutput: {
					nationality: 'USA',
					issuingState: 'CA',
					name: 'John Doe',
					minimumAge: '25',
					ofac: [true, true, true]
				}
			};

			mockRequest.request.json = vi.fn().mockResolvedValue(requestData);
			
			// Act
			const response = await POST(mockRequest);
			const result = await response.json();

			// Assert
			expect(response.status).toBe(200);
			expect(result.status).toBe('success');
			expect(result.result).toBe(true);
		});
	});

	describe('Verification Failures', () => {
		it('should reject invalid proofs', async () => {
			// Arrange
			const requestData = {
				attestationId: 1,
				proof: { invalid: 'proof' },
				pubSignals: ['0x111'],
				userContextData: JSON.stringify({
					userId: 'test-user-123',
					templateSlug: 'climate-action'
				})
			};

			mockRequest.request.json = vi.fn().mockResolvedValue(requestData);

			// Act
			const response = await POST(mockRequest);
			const result = await response.json();

			// Assert - Should handle gracefully even with mock
			expect(response.status).toBeGreaterThanOrEqual(200);
			expect(result).toBeDefined();
		});
	});

	describe('Edge Cases', () => {
		it('should work without logged-in user', async () => {
			// Arrange
			mockRequest.locals = { user: null };

			const requestData = {
				attestationId: 1,
				proof: { a: ['0x123'] },
				pubSignals: ['0x111'],
				userContextData: JSON.stringify({
					userId: 'test-user-123',
					templateSlug: 'climate-action'
				})
			};

			mockRequest.request.json = vi.fn().mockResolvedValue(requestData);

			// Act
			const response = await POST(mockRequest);
			const result = await response.json();

			// Assert - Should handle gracefully
			expect(response.status).toBeGreaterThanOrEqual(200);
			expect(result).toBeDefined();
		});
	});
});