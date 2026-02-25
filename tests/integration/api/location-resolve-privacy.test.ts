/**
 * Privacy Audit Tests — POST /api/location/resolve
 *
 * Contract tests enforcing privacy guarantees of the coordinate-based
 * dual-path location resolution architecture. Ensures:
 * - Address fields are always rejected
 * - Responses never leak address data
 * - Cell IDs are never logged to console
 * - Zod schema strips unknown fields
 * - Endpoint has no database dependency
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '../../../src/routes/api/location/resolve/+server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('$lib/core/shadow-atlas/client', () => ({
	lookupDistrict: vi.fn().mockResolvedValue({
		district: { id: 'DC-AL', name: 'District of Columbia At-Large' }
	}),
	getOfficials: vi.fn().mockResolvedValue({
		officials: [],
		district_code: 'DC-AL',
		state: 'DC',
		special_status: null
	})
}));

function createMockEvent(body: Record<string, unknown>) {
	return {
		request: new Request('http://localhost/api/location/resolve', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		locals: { user: { id: 'privacy-test-user' } },
		url: new URL('http://localhost/api/location/resolve'),
		params: {},
		platform: undefined,
		route: { id: '/api/location/resolve' }
	} as any;
}

const VALID_BASE = {
	lat: 38.9072,
	lng: -77.0369,
	signal_type: 'verified' as const,
	confidence: 0.85,
	district_code: 'DC-AL'
};

// ---------------------------------------------------------------------------
// Privacy Guard — Address Field Rejection
// ---------------------------------------------------------------------------

describe('Privacy Guard — Address Field Rejection', () => {
	const ADDRESS_FIELDS = ['street', 'city', 'address', 'zipCode', 'zip_code'];

	for (const field of ADDRESS_FIELDS) {
		it(`rejects request containing "${field}"`, async () => {
			const event = createMockEvent({ ...VALID_BASE, [field]: 'test-value' });
			const response = await POST(event);
			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.error).toContain('Address fields must not be sent');
		});
	}

	it('rejects request containing multiple address fields', async () => {
		const event = createMockEvent({
			...VALID_BASE,
			street: '123 Main',
			city: 'DC'
		});
		const response = await POST(event);
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toContain('Address fields must not be sent');
	});
});

// ---------------------------------------------------------------------------
// Privacy Guard — Extended Address Fields
// ---------------------------------------------------------------------------

describe('Privacy Guard — Extended Address Fields', () => {
	const EXTENDED_FIELDS = [
		'postal_code',
		'zip',
		'home_address',
		'addr',
		'state_name'
	];

	for (const field of EXTENDED_FIELDS) {
		it(`documents behavior for extended field "${field}"`, async () => {
			const event = createMockEvent({ ...VALID_BASE, [field]: 'test-value' });
			const response = await POST(event);

			if (response.status === 400) {
				const body = await response.json();
				expect(body.error).toContain('Address fields must not be sent');
			} else {
				// Field was NOT rejected — Zod strips it, but document the finding
				expect(response.status).toBe(200);
				const body = await response.json();
				expect(body).not.toHaveProperty(field);
				console.warn(
					`[PRIVACY FINDING] Extended address field "${field}" is silently accepted (stripped by Zod). ` +
						'Consider adding it to the address field blocklist.'
				);
			}
		});
	}
});

// ---------------------------------------------------------------------------
// Response Privacy — No Address Leakage
// ---------------------------------------------------------------------------

describe('Response Privacy — No Address Leakage', () => {
	it('response does not contain any address-like keys', async () => {
		const event = createMockEvent(VALID_BASE);
		const response = await POST(event);
		expect(response.status).toBe(200);

		const body = await response.json();
		const FORBIDDEN_KEYS = [
			'street',
			'city',
			'address',
			'zipCode',
			'correctedAddress',
			'originalAddress',
			'fullAddress'
		];

		for (const key of FORBIDDEN_KEYS) {
			expect(body).not.toHaveProperty(key);
		}
	});

	it('response keys match the expected privacy-safe schema', async () => {
		const event = createMockEvent(VALID_BASE);
		const response = await POST(event);
		expect(response.status).toBe(200);

		const body = await response.json();
		const EXPECTED_KEYS = [
			'resolved',
			'district',
			'officials',
			'special_status',
			'zk_eligible',
			'confidence',
			'signal_type',
			'district_source'
		];

		const actualKeys = Object.keys(body);
		for (const key of EXPECTED_KEYS) {
			expect(actualKeys).toContain(key);
		}

		// Only cell_id is allowed as an optional extra key
		const extraKeys = actualKeys.filter(
			(k) => !EXPECTED_KEYS.includes(k) && k !== 'cell_id'
		);
		expect(extraKeys).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Console Privacy — No Cell ID Logging
// ---------------------------------------------------------------------------

describe('Console Privacy — No Cell ID Logging', () => {
	const CELL_ID = '360610001001000';
	let logSpy: ReturnType<typeof vi.spyOn>;
	let warnSpy: ReturnType<typeof vi.spyOn>;
	let errorSpy: ReturnType<typeof vi.spyOn>;
	let debugSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
	});

	afterEach(() => {
		logSpy.mockRestore();
		warnSpy.mockRestore();
		errorSpy.mockRestore();
		debugSpy.mockRestore();
	});

	it('does not log cell_id to any console method', async () => {
		const event = createMockEvent({
			...VALID_BASE,
			cell_id: CELL_ID
		});
		await POST(event);

		for (const spy of [logSpy, warnSpy, errorSpy, debugSpy]) {
			for (const call of spy.mock.calls) {
				const serialized = call.map(String).join(' ');
				expect(serialized).not.toContain(CELL_ID);
			}
		}
	});
});

// ---------------------------------------------------------------------------
// Zod Schema Strictness
// ---------------------------------------------------------------------------

describe('Zod Schema Strictness', () => {
	it('strips unknown fields and does not include them in the response', async () => {
		const event = createMockEvent({
			...VALID_BASE,
			secret_field: 'should-be-stripped'
		});
		const response = await POST(event);
		expect(response.status).toBe(200);

		const body = await response.json();
		expect(body.resolved).toBe(true);
		expect(body).not.toHaveProperty('secret_field');
	});
});

// ---------------------------------------------------------------------------
// No Database Dependency
// ---------------------------------------------------------------------------

describe('No Database Dependency', () => {
	it('endpoint source does not reference database or trust tier operations', () => {
		const endpointPath = resolve(
			__dirname,
			'../../../src/routes/api/location/resolve/+server.ts'
		);
		const source = readFileSync(endpointPath, 'utf-8');

		// Strip comments before checking for forbidden patterns
		const codeOnly = source
			.replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
			.replace(/\/\/.*/g, '');             // line comments

		expect(codeOnly).not.toMatch(/prisma/i);
		expect(codeOnly).not.toMatch(/import.*db/);
		expect(codeOnly).not.toMatch(/user\.update/);
		expect(codeOnly).not.toMatch(/trust_tier/);
	});
});
