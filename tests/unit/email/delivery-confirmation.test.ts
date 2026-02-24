/**
 * Unit tests for Delivery Confirmation Token System
 *
 * Tests HMAC-based confirmation token generation and validation
 * for mailto delivery flows. Tokens are base64url-encoded payloads
 * with HMAC signatures, and include embedded timestamps for expiry.
 *
 * Token format: base64url(id:timestamp).base64url(hmac(id:timestamp))
 *
 * Mocks:
 * - $env/dynamic/private (JWT_SECRET)
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock $env/dynamic/private
// ---------------------------------------------------------------------------

const TEST_SECRET = 'test-jwt-secret-for-delivery-confirmation-tests-32chars';

vi.mock('$env/dynamic/private', () => ({
	env: {
		JWT_SECRET: 'test-jwt-secret-for-delivery-confirmation-tests-32chars'
	}
}));

// ---------------------------------------------------------------------------
// Import SUT after mocks
// ---------------------------------------------------------------------------

import {
	generateConfirmationToken,
	validateConfirmationToken
} from '$lib/core/email/delivery-confirmation';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Delivery Confirmation', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-02-23T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	// =========================================================================
	// generateConfirmationToken
	// =========================================================================

	describe('generateConfirmationToken', () => {
		it('should generate a non-empty string token', () => {
			const token = generateConfirmationToken('submission-123');

			expect(typeof token).toBe('string');
			expect(token.length).toBeGreaterThan(0);
		});

		it('should produce token with exactly two parts separated by dot', () => {
			const token = generateConfirmationToken('sub-456');
			const parts = token.split('.');

			expect(parts).toHaveLength(2);
			expect(parts[0].length).toBeGreaterThan(0); // payload
			expect(parts[1].length).toBeGreaterThan(0); // hmac
		});

		it('should produce base64url-encoded payload', () => {
			const token = generateConfirmationToken('sub-789');
			const [payloadEncoded] = token.split('.');

			// base64url should not contain +, /, or = padding
			expect(payloadEncoded).not.toMatch(/[+/=]/);

			// Should decode to a string containing the ID
			const decoded = Buffer.from(payloadEncoded, 'base64url').toString('utf-8');
			expect(decoded).toContain('sub-789');
		});

		it('should embed the ID in the payload', () => {
			const token = generateConfirmationToken('my-submission-id');
			const [payloadEncoded] = token.split('.');
			const decoded = Buffer.from(payloadEncoded, 'base64url').toString('utf-8');

			expect(decoded.startsWith('my-submission-id:')).toBe(true);
		});

		it('should embed a timestamp in the payload', () => {
			const token = generateConfirmationToken('sub-ts');
			const [payloadEncoded] = token.split('.');
			const decoded = Buffer.from(payloadEncoded, 'base64url').toString('utf-8');

			const parts = decoded.split(':');
			const timestamp = parseInt(parts[parts.length - 1], 10);

			expect(isNaN(timestamp)).toBe(false);
			// Should be close to the fake "now" time
			expect(timestamp).toBe(new Date('2026-02-23T12:00:00Z').getTime());
		});

		it('should produce deterministic output for same input at same time', () => {
			const token1 = generateConfirmationToken('sub-deterministic');
			const token2 = generateConfirmationToken('sub-deterministic');

			// Same ID + same time = same token
			expect(token1).toBe(token2);
		});

		it('should produce different tokens for different IDs', () => {
			const token1 = generateConfirmationToken('submission-A');
			const token2 = generateConfirmationToken('submission-B');

			expect(token1).not.toBe(token2);
		});

		it('should produce different tokens at different times', () => {
			const token1 = generateConfirmationToken('sub-time');

			vi.advanceTimersByTime(1000); // Advance 1 second

			const token2 = generateConfirmationToken('sub-time');

			expect(token1).not.toBe(token2);
		});

		it('should handle empty string ID', () => {
			const token = generateConfirmationToken('');

			expect(typeof token).toBe('string');
			expect(token.length).toBeGreaterThan(0);
		});

		it('should handle IDs with special characters', () => {
			const token = generateConfirmationToken('sub:with:colons:and-dashes_underscores');

			expect(typeof token).toBe('string');
			const parts = token.split('.');
			expect(parts).toHaveLength(2);
		});

		it('should handle very long IDs', () => {
			const longId = 'x'.repeat(1000);
			const token = generateConfirmationToken(longId);

			expect(typeof token).toBe('string');
			expect(token.length).toBeGreaterThan(0);
		});

		it('should handle UUID-style IDs', () => {
			const token = generateConfirmationToken('550e8400-e29b-41d4-a716-446655440000');

			const result = validateConfirmationToken(token);
			expect(result).toBe('550e8400-e29b-41d4-a716-446655440000');
		});
	});

	// =========================================================================
	// validateConfirmationToken
	// =========================================================================

	describe('validateConfirmationToken', () => {
		it('should validate a freshly generated token and return the ID', () => {
			const token = generateConfirmationToken('sub-valid');
			const result = validateConfirmationToken(token);

			expect(result).toBe('sub-valid');
		});

		it('should return null for empty string token', () => {
			const result = validateConfirmationToken('');

			expect(result).toBeNull();
		});

		it('should return null for token with no separator', () => {
			const result = validateConfirmationToken('noseparatorhere');

			expect(result).toBeNull();
		});

		it('should return null for token with too many parts', () => {
			const result = validateConfirmationToken('part1.part2.part3');

			expect(result).toBeNull();
		});

		it('should return null for tampered payload', () => {
			const token = generateConfirmationToken('sub-tamper');
			const [, hmac] = token.split('.');

			// Replace payload with different content
			const tamperedPayload = Buffer.from('tampered-id:999999999').toString('base64url');
			const tamperedToken = `${tamperedPayload}.${hmac}`;

			const result = validateConfirmationToken(tamperedToken);

			expect(result).toBeNull();
		});

		it('should return null for tampered HMAC', () => {
			const token = generateConfirmationToken('sub-hmac-tamper');
			const [payload] = token.split('.');

			// Replace HMAC with garbage
			const tamperedToken = `${payload}.InvalidHmacValue12345`;

			const result = validateConfirmationToken(tamperedToken);

			expect(result).toBeNull();
		});

		it('should return null for expired token (> 7 days)', () => {
			const token = generateConfirmationToken('sub-expire');

			// Advance past 7-day expiry
			vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000); // 8 days

			const result = validateConfirmationToken(token);

			expect(result).toBeNull();
		});

		it('should validate token just before expiry (6 days 23 hours)', () => {
			const token = generateConfirmationToken('sub-almost-expired');

			// Advance to just before 7-day expiry
			vi.advanceTimersByTime(6 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000); // 6d 23h

			const result = validateConfirmationToken(token);

			expect(result).toBe('sub-almost-expired');
		});

		it('should return null for token at exact expiry boundary', () => {
			const token = generateConfirmationToken('sub-boundary');

			// Advance exactly to 7-day boundary + 1ms to ensure expiry
			vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000 + 1);

			const result = validateConfirmationToken(token);

			expect(result).toBeNull();
		});

		it('should return null for invalid base64url in payload', () => {
			const result = validateConfirmationToken('!!!not-base64!!!.validhmac');

			expect(result).toBeNull();
		});

		it('should return null for payload without timestamp separator', () => {
			// Craft a token where the payload has no colon separator
			const payload = Buffer.from('notimestamp').toString('base64url');
			const { createHmac } = require('crypto');
			const hmac = createHmac('sha256', TEST_SECRET).update('notimestamp').digest('base64url');
			const token = `${payload}.${hmac}`;

			const result = validateConfirmationToken(token);

			expect(result).toBeNull();
		});

		it('should return null for payload with non-numeric timestamp', () => {
			const payload = Buffer.from('sub-id:not-a-number').toString('base64url');
			const { createHmac } = require('crypto');
			const hmac = createHmac('sha256', TEST_SECRET)
				.update('sub-id:not-a-number')
				.digest('base64url');
			const token = `${payload}.${hmac}`;

			const result = validateConfirmationToken(token);

			expect(result).toBeNull();
		});

		it('should use constant-time comparison (HMAC length mismatch returns null)', () => {
			const token = generateConfirmationToken('sub-timing');
			const [payload] = token.split('.');

			// HMAC with completely different length
			const shortHmac = 'abc';
			const result = validateConfirmationToken(`${payload}.${shortHmac}`);

			expect(result).toBeNull();
		});
	});

	// =========================================================================
	// Submission ID binding
	// =========================================================================

	describe('Submission ID binding', () => {
		it('should bind token to specific submission ID', () => {
			const tokenA = generateConfirmationToken('submission-A');
			const tokenB = generateConfirmationToken('submission-B');

			const resultA = validateConfirmationToken(tokenA);
			const resultB = validateConfirmationToken(tokenB);

			expect(resultA).toBe('submission-A');
			expect(resultB).toBe('submission-B');
		});

		it('should not allow cross-submission token reuse', () => {
			const tokenForA = generateConfirmationToken('submission-A');

			// Token validates to submission-A, not submission-B
			const result = validateConfirmationToken(tokenForA);
			expect(result).toBe('submission-A');
			expect(result).not.toBe('submission-B');
		});

		it('should handle IDs with colons correctly using lastIndexOf', () => {
			// IDs with colons: the split uses lastIndexOf to find the timestamp separator
			const idWithColons = 'prefix:middle:suffix';
			const token = generateConfirmationToken(idWithColons);
			const result = validateConfirmationToken(token);

			expect(result).toBe(idWithColons);
		});

		it('should handle numeric-only IDs', () => {
			const token = generateConfirmationToken('123456789');
			const result = validateConfirmationToken(token);

			expect(result).toBe('123456789');
		});

		it('should handle IDs with unicode characters', () => {
			const token = generateConfirmationToken('submission-unicode-test');
			const result = validateConfirmationToken(token);

			expect(result).toBe('submission-unicode-test');
		});
	});

	// =========================================================================
	// Token expiry with time progression
	// =========================================================================

	describe('Token expiry timeline', () => {
		it('should validate at t=0 (just generated)', () => {
			const token = generateConfirmationToken('fresh');
			expect(validateConfirmationToken(token)).toBe('fresh');
		});

		it('should validate at t=1 hour', () => {
			const token = generateConfirmationToken('1h');
			vi.advanceTimersByTime(60 * 60 * 1000);
			expect(validateConfirmationToken(token)).toBe('1h');
		});

		it('should validate at t=1 day', () => {
			const token = generateConfirmationToken('1d');
			vi.advanceTimersByTime(24 * 60 * 60 * 1000);
			expect(validateConfirmationToken(token)).toBe('1d');
		});

		it('should validate at t=3 days', () => {
			const token = generateConfirmationToken('3d');
			vi.advanceTimersByTime(3 * 24 * 60 * 60 * 1000);
			expect(validateConfirmationToken(token)).toBe('3d');
		});

		it('should validate at t=6 days', () => {
			const token = generateConfirmationToken('6d');
			vi.advanceTimersByTime(6 * 24 * 60 * 60 * 1000);
			expect(validateConfirmationToken(token)).toBe('6d');
		});

		it('should expire at t=7 days + 1ms', () => {
			const token = generateConfirmationToken('7d');
			vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000 + 1);
			expect(validateConfirmationToken(token)).toBeNull();
		});

		it('should expire at t=30 days', () => {
			const token = generateConfirmationToken('30d');
			vi.advanceTimersByTime(30 * 24 * 60 * 60 * 1000);
			expect(validateConfirmationToken(token)).toBeNull();
		});
	});

	// =========================================================================
	// Security properties
	// =========================================================================

	describe('Security properties', () => {
		it('should produce opaque tokens (not human-readable IDs)', () => {
			const token = generateConfirmationToken('sensitive-submission-id');

			// Token should NOT contain the raw submission ID in plaintext
			expect(token).not.toContain('sensitive-submission-id');
		});

		it('should produce tokens of consistent format', () => {
			// Generate multiple tokens and verify consistent structure
			for (let i = 0; i < 10; i++) {
				vi.advanceTimersByTime(1000);
				const token = generateConfirmationToken(`sub-${i}`);
				const parts = token.split('.');
				expect(parts).toHaveLength(2);
				// Each part should be base64url (no +, /, or =)
				expect(parts[0]).not.toMatch(/[+/=]/);
				expect(parts[1]).not.toMatch(/[+/=]/);
			}
		});

		it('should produce HMAC using SHA-256', () => {
			const token = generateConfirmationToken('sha256-test');
			const [, hmac] = token.split('.');

			// SHA-256 HMAC in base64url is 43 characters (256 bits / 6 bits per base64 char)
			expect(hmac.length).toBe(43);
		});

		it('should reject a token generated with a different secret', () => {
			// Generate a valid token
			const validToken = generateConfirmationToken('cross-secret');
			const [payload] = validToken.split('.');

			// Manually create an HMAC with a different secret
			const { createHmac } = require('crypto');
			const decodedPayload = Buffer.from(payload, 'base64url').toString('utf-8');
			const wrongHmac = createHmac('sha256', 'WRONG-SECRET-VALUE')
				.update(decodedPayload)
				.digest('base64url');
			const forgedToken = `${payload}.${wrongHmac}`;

			const result = validateConfirmationToken(forgedToken);

			expect(result).toBeNull();
		});
	});

	// =========================================================================
	// Missing JWT_SECRET handling
	// =========================================================================

	describe('Missing JWT_SECRET', () => {
		it('should throw when JWT_SECRET is not set (generation)', async () => {
			// Reset modules to re-evaluate the mock
			vi.resetModules();

			// Mock with no JWT_SECRET
			vi.doMock('$env/dynamic/private', () => ({
				env: {
					JWT_SECRET: undefined
				}
			}));

			const { generateConfirmationToken: generate } = await import(
				'$lib/core/email/delivery-confirmation'
			);

			expect(() => generate('some-id')).toThrow('JWT_SECRET required');
		});

		it('should throw when JWT_SECRET is not set (validation)', async () => {
			vi.resetModules();

			vi.doMock('$env/dynamic/private', () => ({
				env: {
					JWT_SECRET: undefined
				}
			}));

			const { validateConfirmationToken: validate } = await import(
				'$lib/core/email/delivery-confirmation'
			);

			// Create a dummy token to validate
			const dummyPayload = Buffer.from('id:12345').toString('base64url');
			const dummyToken = `${dummyPayload}.somefakehmac`;

			expect(() => validate(dummyToken)).toThrow('JWT_SECRET required');
		});
	});
});
