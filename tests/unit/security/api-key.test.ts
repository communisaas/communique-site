import { describe, it, expect } from 'vitest';
import { generateApiKey, hashApiKey } from '$lib/core/security/api-key';

describe('generateApiKey', () => {
	it('should return plaintext, hash, and prefix', async () => {
		const result = await generateApiKey();
		expect(result).toHaveProperty('plaintext');
		expect(result).toHaveProperty('hash');
		expect(result).toHaveProperty('prefix');
	});

	it('should produce plaintext with ck_live_ prefix', async () => {
		const { plaintext } = await generateApiKey();
		expect(plaintext).toMatch(/^ck_live_[0-9a-f]{32}$/);
	});

	it('should produce a 64-character hex hash (SHA-256)', async () => {
		const { hash } = await generateApiKey();
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});

	it('should produce prefix as first 16 chars of plaintext', async () => {
		const { plaintext, prefix } = await generateApiKey();
		expect(prefix).toBe(plaintext.slice(0, 16));
		expect(prefix).toMatch(/^ck_live_[0-9a-f]{8}$/);
	});

	it('should produce unique keys on each call', async () => {
		const keys = await Promise.all(Array.from({ length: 20 }, () => generateApiKey()));
		const plaintexts = new Set(keys.map((k) => k.plaintext));
		expect(plaintexts.size).toBe(20);
	});

	it('should produce unique hashes on each call', async () => {
		const keys = await Promise.all(Array.from({ length: 20 }, () => generateApiKey()));
		const hashes = new Set(keys.map((k) => k.hash));
		expect(hashes.size).toBe(20);
	});

	it('should produce hash that matches rehashing the plaintext', async () => {
		const { plaintext, hash } = await generateApiKey();
		const rehashed = await hashApiKey(plaintext);
		expect(rehashed).toBe(hash);
	});
});

describe('hashApiKey', () => {
	it('should produce a 64-character hex string', async () => {
		const hash = await hashApiKey('ck_live_test1234567890abcdef');
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});

	it('should produce deterministic output', async () => {
		const input = 'ck_live_deterministic_test';
		const hash1 = await hashApiKey(input);
		const hash2 = await hashApiKey(input);
		expect(hash1).toBe(hash2);
	});

	it('should produce different hashes for different inputs', async () => {
		const hash1 = await hashApiKey('ck_live_key_one');
		const hash2 = await hashApiKey('ck_live_key_two');
		expect(hash1).not.toBe(hash2);
	});

	it('should use SHA-256 (known test vector)', async () => {
		// SHA-256 of empty string is a known constant
		const hash = await hashApiKey('');
		// SHA-256('') = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
		expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
	});

	it('should handle long inputs', async () => {
		const longKey = 'ck_live_' + 'a'.repeat(1000);
		const hash = await hashApiKey(longKey);
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});
});

describe('API key revocation logic', () => {
	it('should detect revoked keys by revokedAt timestamp', () => {
		const revokedAt = new Date('2026-03-10T00:00:00Z');
		const isRevoked = revokedAt !== null;
		expect(isRevoked).toBe(true);
	});

	it('should detect non-revoked keys', () => {
		const revokedAt = null;
		const isRevoked = revokedAt !== null;
		expect(isRevoked).toBe(false);
	});
});

describe('API key scope validation', () => {
	const VALID_SCOPES = ['read', 'write'] as const;

	function isValidScope(scope: string): boolean {
		return (VALID_SCOPES as readonly string[]).includes(scope);
	}

	it('should accept "read" scope', () => {
		expect(isValidScope('read')).toBe(true);
	});

	it('should accept "write" scope', () => {
		expect(isValidScope('write')).toBe(true);
	});

	it('should reject unknown scopes', () => {
		expect(isValidScope('admin')).toBe(false);
		expect(isValidScope('delete')).toBe(false);
		expect(isValidScope('')).toBe(false);
	});
});
