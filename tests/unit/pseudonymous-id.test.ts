import { describe, it, expect, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { SUBMISSION_ANONYMIZATION_SALT: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2' }
}));

import { computePseudonymousId } from '$lib/core/privacy/pseudonymous-id';
import { env } from '$env/dynamic/private';

describe('computePseudonymousId', () => {
	it('should return a 64-character hex string', () => {
		const result = computePseudonymousId('user-123');
		expect(result).toHaveLength(64);
		expect(result).toMatch(/^[0-9a-f]{64}$/);
	});

	it('should be deterministic (same userId produces same output)', () => {
		const result1 = computePseudonymousId('user-456');
		const result2 = computePseudonymousId('user-456');
		expect(result1).toBe(result2);
	});

	it('should produce different outputs for different userIds', () => {
		const result1 = computePseudonymousId('user-aaa');
		const result2 = computePseudonymousId('user-bbb');
		expect(result1).not.toBe(result2);
	});

	it('should throw error when salt is missing', () => {
		const originalSalt = vi.mocked(env).SUBMISSION_ANONYMIZATION_SALT;
		vi.mocked(env).SUBMISSION_ANONYMIZATION_SALT = '';

		expect(() => computePseudonymousId('user-789')).toThrow('SUBMISSION_ANONYMIZATION_SALT');

		vi.mocked(env).SUBMISSION_ANONYMIZATION_SALT = originalSalt;
	});

	it('should throw error when salt is less than 32 characters', () => {
		const originalSalt = vi.mocked(env).SUBMISSION_ANONYMIZATION_SALT;
		vi.mocked(env).SUBMISSION_ANONYMIZATION_SALT = 'tooshort';

		expect(() => computePseudonymousId('user-000')).toThrow('SUBMISSION_ANONYMIZATION_SALT');

		vi.mocked(env).SUBMISSION_ANONYMIZATION_SALT = originalSalt;
	});
});
