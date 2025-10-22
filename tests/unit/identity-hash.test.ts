import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
	generateIdentityHash,
	generateIdentityFingerprint,
	validateIdentityProof,
	isAgeEligible,
	type IdentityProof
} from '$lib/core/server/identity-hash';

// Set up test environment variable
beforeAll(() => {
	if (!process.env.IDENTITY_HASH_SALT) {
		process.env.IDENTITY_HASH_SALT =
			'1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890';
	}
});

describe('Identity Hash Generation', () => {
	const validProof: IdentityProof = {
		passportNumber: 'N1234567',
		nationality: 'US',
		birthYear: 1990,
		documentType: 'passport'
	};

	it('should generate deterministic hash', () => {
		const hash1 = generateIdentityHash(validProof);
		const hash2 = generateIdentityHash(validProof);
		expect(hash1).toBe(hash2);
	});

	it('should produce 64-character hex string', () => {
		const hash = generateIdentityHash(validProof);
		expect(hash).toHaveLength(64);
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});

	it('should normalize passport number case and spacing', () => {
		const proof1 = { ...validProof, passportNumber: 'N 1234-567' };
		const proof2 = { ...validProof, passportNumber: 'n1234567' };
		expect(generateIdentityHash(proof1)).toBe(generateIdentityHash(proof2));
	});

	it('should normalize nationality case', () => {
		const proof1 = { ...validProof, nationality: 'US' };
		const proof2 = { ...validProof, nationality: 'us' };
		expect(generateIdentityHash(proof1)).toBe(generateIdentityHash(proof2));
	});

	it('should produce different hashes for different passports', () => {
		const proof1 = { ...validProof, passportNumber: 'N1234567' };
		const proof2 = { ...validProof, passportNumber: 'N7654321' };
		expect(generateIdentityHash(proof1)).not.toBe(generateIdentityHash(proof2));
	});

	it('should produce different hashes for different birth years', () => {
		const proof1 = { ...validProof, birthYear: 1990 };
		const proof2 = { ...validProof, birthYear: 1991 };
		expect(generateIdentityHash(proof1)).not.toBe(generateIdentityHash(proof2));
	});

	it('should produce different hashes for different nationalities', () => {
		const proof1 = { ...validProof, nationality: 'US' };
		const proof2 = { ...validProof, nationality: 'CA' };
		expect(generateIdentityHash(proof1)).not.toBe(generateIdentityHash(proof2));
	});

	it('should produce different hashes for different document types', () => {
		const proof1 = { ...validProof, documentType: 'passport' as const };
		const proof2 = { ...validProof, documentType: 'drivers_license' as const };
		expect(generateIdentityHash(proof1)).not.toBe(generateIdentityHash(proof2));
	});

	it('should throw error if IDENTITY_HASH_SALT not configured', () => {
		const originalSalt = process.env.IDENTITY_HASH_SALT;
		delete process.env.IDENTITY_HASH_SALT;

		expect(() => generateIdentityHash(validProof)).toThrow(/IDENTITY_HASH_SALT/);

		// Restore
		process.env.IDENTITY_HASH_SALT = originalSalt;
	});
});

describe('Identity Fingerprint', () => {
	it('should extract first 16 characters', () => {
		const fullHash = '1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890';
		const fingerprint = generateIdentityFingerprint(fullHash);
		expect(fingerprint).toBe('1a2b3c4d5e6f7890');
		expect(fingerprint).toHaveLength(16);
	});

	it('should work with short hashes', () => {
		const shortHash = '123456';
		const fingerprint = generateIdentityFingerprint(shortHash);
		expect(fingerprint).toBe('123456');
	});
});

describe('Identity Proof Validation', () => {
	it('should accept valid proof', () => {
		const proof = {
			passportNumber: 'N1234567',
			nationality: 'US',
			birthYear: 1990,
			documentType: 'passport' as const
		};
		expect(() => validateIdentityProof(proof)).not.toThrow();
	});

	it('should accept all valid document types', () => {
		const documentTypes: Array<'passport' | 'drivers_license' | 'national_id' | 'state_id'> = [
			'passport',
			'drivers_license',
			'national_id',
			'state_id'
		];

		for (const docType of documentTypes) {
			const proof = {
				passportNumber: 'N1234567',
				nationality: 'US',
				birthYear: 1990,
				documentType: docType
			};
			expect(() => validateIdentityProof(proof)).not.toThrow();
		}
	});

	it('should reject missing fields', () => {
		expect(() => validateIdentityProof({})).toThrow();
		expect(() => validateIdentityProof({ passportNumber: 'N123' })).toThrow();
		expect(() =>
			validateIdentityProof({
				passportNumber: 'N123',
				nationality: 'US'
			})
		).toThrow();
	});

	it('should reject non-object proof', () => {
		expect(() => validateIdentityProof(null)).toThrow(/must be an object/);
		expect(() => validateIdentityProof('string')).toThrow(/must be an object/);
		expect(() => validateIdentityProof(123)).toThrow(/must be an object/);
	});

	it('should reject invalid passport number type', () => {
		const proof = {
			passportNumber: 123456, // Should be string
			nationality: 'US',
			birthYear: 1990,
			documentType: 'passport' as const
		};
		expect(() => validateIdentityProof(proof)).toThrow(/passportNumber/);
	});

	it('should reject invalid nationality type', () => {
		const proof = {
			passportNumber: 'N1234567',
			nationality: 123, // Should be string
			birthYear: 1990,
			documentType: 'passport' as const
		};
		expect(() => validateIdentityProof(proof)).toThrow(/nationality/);
	});

	it('should reject invalid birth year type', () => {
		const proof = {
			passportNumber: 'N1234567',
			nationality: 'US',
			birthYear: '1990', // Should be number
			documentType: 'passport' as const
		};
		expect(() => validateIdentityProof(proof)).toThrow(/birthYear/);
	});

	it('should reject invalid nationality format', () => {
		const invalidNationalities = ['USA', 'U', '12', 'U$', 'us1'];

		for (const nationality of invalidNationalities) {
			const proof = {
				passportNumber: 'N1234567',
				nationality,
				birthYear: 1990,
				documentType: 'passport' as const
			};
			expect(() => validateIdentityProof(proof)).toThrow(/ISO 3166-1/);
		}
	});

	it('should accept valid 2-letter nationality codes', () => {
		const validNationalities = ['US', 'CA', 'GB', 'FR', 'DE', 'JP'];

		for (const nationality of validNationalities) {
			const proof = {
				passportNumber: 'N1234567',
				nationality,
				birthYear: 1990,
				documentType: 'passport' as const
			};
			expect(() => validateIdentityProof(proof)).not.toThrow();
		}
	});

	it('should reject invalid birth year (too old)', () => {
		const proof = {
			passportNumber: 'N1234567',
			nationality: 'US',
			birthYear: 1800, // Too old
			documentType: 'passport' as const
		};
		expect(() => validateIdentityProof(proof)).toThrow(/birthYear/);
	});

	it('should reject invalid birth year (future)', () => {
		const currentYear = new Date().getFullYear();
		const proof = {
			passportNumber: 'N1234567',
			nationality: 'US',
			birthYear: currentYear + 1, // Future year
			documentType: 'passport' as const
		};
		expect(() => validateIdentityProof(proof)).toThrow(/birthYear/);
	});

	it('should accept current year as birth year', () => {
		const currentYear = new Date().getFullYear();
		const proof = {
			passportNumber: 'N1234567',
			nationality: 'US',
			birthYear: currentYear,
			documentType: 'passport' as const
		};
		expect(() => validateIdentityProof(proof)).not.toThrow();
	});

	it('should reject invalid document type', () => {
		const proof = {
			passportNumber: 'N1234567',
			nationality: 'US',
			birthYear: 1990,
			documentType: 'invalid_type' as const
		};
		expect(() => validateIdentityProof(proof)).toThrow(/documentType must be one of/);
	});
});

describe('Age Eligibility', () => {
	it('should accept users 18 or older', () => {
		const currentYear = new Date().getFullYear();
		expect(isAgeEligible(currentYear - 18)).toBe(true);
		expect(isAgeEligible(currentYear - 25)).toBe(true);
		expect(isAgeEligible(currentYear - 100)).toBe(true);
	});

	it('should reject users under 18', () => {
		const currentYear = new Date().getFullYear();
		expect(isAgeEligible(currentYear - 17)).toBe(false);
		expect(isAgeEligible(currentYear - 10)).toBe(false);
		expect(isAgeEligible(currentYear)).toBe(false);
	});

	it('should handle edge case at exactly 18 years', () => {
		const currentYear = new Date().getFullYear();
		const birthYear18YearsAgo = currentYear - 18;
		expect(isAgeEligible(birthYear18YearsAgo)).toBe(true);
	});

	it('should handle edge case at exactly 17 years', () => {
		const currentYear = new Date().getFullYear();
		const birthYear17YearsAgo = currentYear - 17;
		expect(isAgeEligible(birthYear17YearsAgo)).toBe(false);
	});
});

describe('Identity Hash Integration Tests', () => {
	it('should work end-to-end with validation and hashing', () => {
		const proof = {
			passportNumber: 'N1234567',
			nationality: 'US',
			birthYear: 1990,
			documentType: 'passport' as const
		};

		// Validate
		expect(() => validateIdentityProof(proof)).not.toThrow();

		// Hash
		const hash = generateIdentityHash(proof);
		expect(hash).toHaveLength(64);

		// Fingerprint
		const fingerprint = generateIdentityFingerprint(hash);
		expect(fingerprint).toHaveLength(16);

		// Age eligibility
		expect(isAgeEligible(proof.birthYear)).toBe(true);
	});

	it('should reject under-18 user end-to-end', () => {
		const currentYear = new Date().getFullYear();
		const proof = {
			passportNumber: 'N1234567',
			nationality: 'US',
			birthYear: currentYear - 17, // Under 18
			documentType: 'passport' as const
		};

		// Validation should pass (format is valid)
		expect(() => validateIdentityProof(proof)).not.toThrow();

		// But age eligibility should fail
		expect(isAgeEligible(proof.birthYear)).toBe(false);
	});
});
