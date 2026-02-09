/**
 * Action Domain Builder Unit Tests
 *
 * Validates deterministic action domain computation, BN254 field element
 * compliance, input validation, and cross-jurisdiction correctness.
 */

import { describe, it, expect } from 'vitest';
import {
	buildActionDomain,
	isValidActionDomain,
	type ActionDomainParams
} from '$lib/core/zkp/action-domain-builder';

const BN254_MODULUS =
	21888242871839275222246405745257275088548364400416034343698204186575808495617n;

describe('buildActionDomain', () => {
	const baseParams: ActionDomainParams = {
		country: 'US',
		jurisdictionType: 'federal',
		recipientSubdivision: 'US-CA',
		templateId: 'climate-action-2026',
		sessionId: '119th-congress'
	};

	it('produces a valid BN254 field element', () => {
		const domain = buildActionDomain(baseParams);

		expect(domain).toMatch(/^0x[0-9a-f]{64}$/);
		expect(BigInt(domain)).toBeLessThan(BN254_MODULUS);
		expect(BigInt(domain)).toBeGreaterThanOrEqual(0n);
	});

	it('is deterministic — same params produce same domain', () => {
		const domain1 = buildActionDomain(baseParams);
		const domain2 = buildActionDomain({ ...baseParams });

		expect(domain1).toBe(domain2);
	});

	it('different countries produce different domains', () => {
		const domainUS = buildActionDomain(baseParams);
		const domainGB = buildActionDomain({ ...baseParams, country: 'GB' });

		expect(domainUS).not.toBe(domainGB);
	});

	it('different jurisdiction types produce different domains', () => {
		const domainFederal = buildActionDomain(baseParams);
		const domainState = buildActionDomain({ ...baseParams, jurisdictionType: 'state' });

		expect(domainFederal).not.toBe(domainState);
	});

	it('different recipient subdivisions produce different domains', () => {
		const domainCA = buildActionDomain(baseParams);
		const domainNY = buildActionDomain({ ...baseParams, recipientSubdivision: 'US-NY' });

		expect(domainCA).not.toBe(domainNY);
	});

	it('different templates produce different domains', () => {
		const domain1 = buildActionDomain(baseParams);
		const domain2 = buildActionDomain({ ...baseParams, templateId: 'healthcare-reform' });

		expect(domain1).not.toBe(domain2);
	});

	it('different sessions produce different domains', () => {
		const domain1 = buildActionDomain(baseParams);
		const domain2 = buildActionDomain({ ...baseParams, sessionId: '120th-congress' });

		expect(domain1).not.toBe(domain2);
	});

	it('handles all jurisdiction types', () => {
		const types = ['federal', 'state', 'local', 'international'] as const;
		const domains = new Set<string>();

		for (const jurisdictionType of types) {
			const domain = buildActionDomain({ ...baseParams, jurisdictionType });
			expect(BigInt(domain)).toBeLessThan(BN254_MODULUS);
			domains.add(domain);
		}

		expect(domains.size).toBe(4);
	});

	it('handles international jurisdiction', () => {
		const domain = buildActionDomain({
			country: 'BE',
			jurisdictionType: 'international',
			recipientSubdivision: 'EU',
			templateId: 'digital-markets-act',
			sessionId: '2024-2029'
		});

		expect(domain).toMatch(/^0x[0-9a-f]{64}$/);
		expect(BigInt(domain)).toBeLessThan(BN254_MODULUS);
	});

	it('handles local jurisdiction', () => {
		const domain = buildActionDomain({
			country: 'US',
			jurisdictionType: 'local',
			recipientSubdivision: 'US-CA-san-francisco',
			templateId: 'housing-density',
			sessionId: '2026-board'
		});

		expect(domain).toMatch(/^0x[0-9a-f]{64}$/);
		expect(BigInt(domain)).toBeLessThan(BN254_MODULUS);
	});
});

describe('buildActionDomain validation', () => {
	it('rejects empty country', () => {
		expect(() =>
			buildActionDomain({
				country: '',
				jurisdictionType: 'federal',
				recipientSubdivision: 'national',
				templateId: 'test',
				sessionId: 'test'
			})
		).toThrow('country is required');
	});

	it('rejects non-2-char country code', () => {
		expect(() =>
			buildActionDomain({
				country: 'USA',
				jurisdictionType: 'federal',
				recipientSubdivision: 'national',
				templateId: 'test',
				sessionId: 'test'
			})
		).toThrow('must be 2-character ISO code');
	});

	it('rejects invalid jurisdiction type', () => {
		expect(() =>
			buildActionDomain({
				country: 'US',
				jurisdictionType: 'municipal' as any,
				recipientSubdivision: 'national',
				templateId: 'test',
				sessionId: 'test'
			})
		).toThrow('jurisdictionType must be one of');
	});

	it('rejects empty recipientSubdivision', () => {
		expect(() =>
			buildActionDomain({
				country: 'US',
				jurisdictionType: 'federal',
				recipientSubdivision: '',
				templateId: 'test',
				sessionId: 'test'
			})
		).toThrow('recipientSubdivision is required');
	});

	it('rejects empty templateId', () => {
		expect(() =>
			buildActionDomain({
				country: 'US',
				jurisdictionType: 'federal',
				recipientSubdivision: 'national',
				templateId: '',
				sessionId: 'test'
			})
		).toThrow('templateId is required');
	});

	it('rejects empty sessionId', () => {
		expect(() =>
			buildActionDomain({
				country: 'US',
				jurisdictionType: 'federal',
				recipientSubdivision: 'national',
				templateId: 'test',
				sessionId: ''
			})
		).toThrow('sessionId is required');
	});
});

describe('isValidActionDomain', () => {
	it('validates correct field elements', () => {
		const domain = buildActionDomain({
			country: 'US',
			jurisdictionType: 'federal',
			recipientSubdivision: 'US-CA',
			templateId: 'test',
			sessionId: 'test'
		});

		expect(isValidActionDomain(domain)).toBe(true);
	});

	it('rejects values >= BN254 modulus', () => {
		const tooLarge = '0x' + BN254_MODULUS.toString(16);
		expect(isValidActionDomain(tooLarge)).toBe(false);
	});

	it('accepts zero', () => {
		expect(isValidActionDomain('0x' + '0'.repeat(64))).toBe(true);
	});

	it('accepts modulus - 1', () => {
		const maxValid = '0x' + (BN254_MODULUS - 1n).toString(16).padStart(64, '0');
		expect(isValidActionDomain(maxValid)).toBe(true);
	});

	it('rejects invalid hex', () => {
		expect(isValidActionDomain('not-hex')).toBe(false);
	});

	it('works without 0x prefix', () => {
		const domain = buildActionDomain({
			country: 'US',
			jurisdictionType: 'federal',
			recipientSubdivision: 'US-CA',
			templateId: 'test',
			sessionId: 'test'
		});

		expect(isValidActionDomain(domain.slice(2))).toBe(true);
	});
});
