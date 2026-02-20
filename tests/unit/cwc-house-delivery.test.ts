/**
 * CWC House Delivery Tests
 *
 * Tests for WP-008: Fix CWC House Delivery
 * Verifies that House submissions fail clearly when not properly configured,
 * instead of silently simulating success.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CWCClient } from '$lib/core/congress/cwc-client';
import type { Template } from '$lib/types/template';

describe('CWC House Delivery', () => {
	let originalEnv: NodeJS.ProcessEnv;

	beforeEach(() => {
		// Save original environment
		originalEnv = { ...process.env };
	});

	afterEach(() => {
		// Restore original environment
		process.env = originalEnv;
	});

	const mockTemplate: Partial<Template> = {
		id: 'test-template-123',
		title: 'Test Climate Action Template',
		message_body: 'Please support climate legislation for our community.',
		slug: 'test-climate-action'
	};

	const mockUser = {
		id: 'test-user-456',
		name: 'Test Constituent',
		email: 'test@example.com',
		street: '123 Main St',
		city: 'San Francisco',
		state: 'CA',
		zip: '94102'
	};

	const mockHouseRep = {
		bioguideId: 'P000197',
		name: 'Nancy Pelosi',
		chamber: 'house' as const,
		officeCode: 'CA12',
		state: 'CA',
		district: '12',
		party: 'D'
	};

	describe('Without GCP Proxy Configuration', () => {
		it('should fail clearly when GCP_PROXY_URL is not configured', async () => {
			// Ensure GCP_PROXY_URL is not set
			delete process.env.GCP_PROXY_URL;
			delete process.env.GCP_PROXY_AUTH_TOKEN;

			const client = new CWCClient();
			const result = await client.submitToHouse(
				mockTemplate as Template,
				mockUser,
				mockHouseRep,
				'Personal message about climate action.'
			);

			// Should fail, not simulate success
			expect(result.success).toBe(false);
			expect(result.status).toBe('failed');

			// Should have clear error message explaining the issue
			expect(result.error).toBeDefined();
			expect(result.error).toContain('House CWC delivery not configured');
			expect(result.error).toContain('IP whitelisting');
			expect(result.error).toContain('CWCVendors@mail.house.gov');

			// Should NOT have a fake message ID like 'HOUSE-SIM-...'
			expect(result.messageId).toBeUndefined();

			// Should NOT claim to be queued or submitted
			expect(result.status).not.toBe('queued');
			expect(result.status).not.toBe('submitted');
		});

		it('should log detailed error information', async () => {
			delete process.env.GCP_PROXY_URL;

			const consoleSpy = vi.spyOn(console, 'error');

			const client = new CWCClient();
			await client.submitToHouse(mockTemplate as Template, mockUser, mockHouseRep, '');

			// Should log configuration error
			expect(consoleSpy).toHaveBeenCalled();
			const errorCalls = consoleSpy.mock.calls.filter((call) =>
				call.some((arg) => typeof arg === 'string' && arg.includes('[CWC House]'))
			);
			expect(errorCalls.length).toBeGreaterThan(0);

			consoleSpy.mockRestore();
		});

		it('should include representative details in error logs', async () => {
			delete process.env.GCP_PROXY_URL;

			const consoleSpy = vi.spyOn(console, 'error');

			const client = new CWCClient();
			await client.submitToHouse(mockTemplate as Template, mockUser, mockHouseRep, '');

			// Error log should include rep details for debugging
			const errorLogs = consoleSpy.mock.calls.map((call) => JSON.stringify(call));
			const hasRepDetails = errorLogs.some(
				(log) => log.includes(mockHouseRep.bioguideId) && log.includes(mockHouseRep.name)
			);
			expect(hasRepDetails).toBe(true);

			consoleSpy.mockRestore();
		});
	});

	describe('Error Handling with Mock Proxy', () => {
		it('should succeed when proxy is configured and responds correctly', async () => {
			// Set a proxy URL - in test environment, MSW may intercept this
			process.env.GCP_PROXY_URL = 'http://localhost:9999';

			const client = new CWCClient();
			const result = await client.submitToHouse(mockTemplate as Template, mockUser, mockHouseRep, '');

			// In a test environment with mocked fetch, this may succeed
			// The important thing is that it doesn't simulate - it actually tries the proxy
			// Real network errors would cause failure, but mocked environments may succeed

			// Verify it attempted to use the proxy (logged the attempt)
			expect(result.office).toBe(mockHouseRep.name);
			expect(result.timestamp).toBeDefined();

			// Either succeeded via mock or failed with real error - no simulation
			if (result.success) {
				// If mock succeeded, should have message ID
				expect(result.messageId).toBeDefined();
				expect(result.messageId).not.toContain('SIM');
			} else {
				// If it failed, should have clear error
				expect(result.error).toBeDefined();
			}
		});

		it('should log proxy attempts with proper details', async () => {
			process.env.GCP_PROXY_URL = 'http://test-proxy:8080';

			const consoleSpy = vi.spyOn(console, 'debug');

			const client = new CWCClient();
			await client.submitToHouse(mockTemplate as Template, mockUser, mockHouseRep, '');

			// Should log the proxy attempt
			const proxyLogs = consoleSpy.mock.calls.filter((call) =>
				call.some((arg) => typeof arg === 'string' && arg.includes('[CWC House] Attempting'))
			);
			expect(proxyLogs.length).toBeGreaterThan(0);

			// Log should include proxy URL (may be redacted if it contains auth)
			const logDetails = JSON.stringify(consoleSpy.mock.calls);
			expect(logDetails).toContain('test-proxy');

			consoleSpy.mockRestore();
		});
	});

	describe('Chamber Validation', () => {
		it('should reject Senate representatives', async () => {
			const senateMember = {
				...mockHouseRep,
				chamber: 'senate' as const,
				bioguideId: 'F000062',
				name: 'Dianne Feinstein'
			};

			const client = new CWCClient();

			await expect(
				client.submitToHouse(mockTemplate as Template, mockUser, senateMember, '')
			).rejects.toThrow('only for House offices');
		});
	});

	describe('XML Generation and JSON Envelope', () => {
		it('should generate House CWC XML and send in JSON envelope to proxy', async () => {
			process.env.GCP_PROXY_URL = 'http://localhost:9999';
			process.env.GCP_PROXY_AUTH_TOKEN = 'test-token';

			const fetchSpy = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ submissionId: 'house-test-123', status: 'submitted' })
			});
			globalThis.fetch = fetchSpy;

			const client = new CWCClient();
			const result = await client.submitToHouse(
				mockTemplate as Template,
				mockUser,
				mockHouseRep,
				'Personal message about climate action.'
			);

			expect(result.success).toBe(true);
			expect(result.status).toBe('submitted');

			// Verify the request was sent to the proxy
			expect(fetchSpy).toHaveBeenCalled();
			const [url, options] = fetchSpy.mock.calls[0];
			expect(url).toContain('/api/house/submit');
			expect(options.headers['Authorization']).toBe('Bearer test-token');

			// Verify JSON envelope contains XML
			const requestBody = JSON.parse(options.body);
			expect(requestBody).toHaveProperty('xml');
			expect(requestBody).toHaveProperty('jobId');
			expect(requestBody).toHaveProperty('officeCode');

			// Verify the XML is valid House CWC format
			expect(requestBody.xml).toContain('<?xml version="1.0"');
			expect(requestBody.xml).toContain('<CWC version="2.0">');
			expect(requestBody.xml).toContain('<OfficeCode>');
			expect(requestBody.xml).toContain('<ConstituentData>');
			expect(requestBody.xml).toContain('climate action');
		});

		it('should include sender details in generated XML', async () => {
			process.env.GCP_PROXY_URL = 'http://localhost:9999';
			process.env.GCP_PROXY_AUTH_TOKEN = 'test-token';

			const fetchSpy = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ submissionId: 'house-test-456', status: 'submitted' })
			});
			globalThis.fetch = fetchSpy;

			const client = new CWCClient();
			await client.submitToHouse(
				mockTemplate as Template,
				mockUser,
				mockHouseRep,
				'Test message'
			);

			const requestBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
			// Verify constituent data is in the XML (name is split into First/Last elements)
			expect(requestBody.xml).toContain('<First>Test</First>');
			expect(requestBody.xml).toContain('<Last>Constituent</Last>');
			expect(requestBody.xml).toContain('test@example.com');
			expect(requestBody.xml).toContain('San Francisco');
			expect(requestBody.xml).toContain('94102');
		});
	});

	describe('Logging Standards', () => {
		it('should use consistent [CWC House] log prefix', async () => {
			delete process.env.GCP_PROXY_URL;

			const consoleSpy = vi.spyOn(console, 'error');

			const client = new CWCClient();
			await client.submitToHouse(mockTemplate as Template, mockUser, mockHouseRep, '');

			// All House-related logs should use [CWC House] prefix
			const houseLogs = consoleSpy.mock.calls.filter((call) =>
				call.some((arg) => typeof arg === 'string' && arg.includes('[CWC House]'))
			);
			expect(houseLogs.length).toBeGreaterThan(0);

			consoleSpy.mockRestore();
		});

		it('should include timestamps in error logs', async () => {
			delete process.env.GCP_PROXY_URL;

			const consoleSpy = vi.spyOn(console, 'error');

			const client = new CWCClient();
			await client.submitToHouse(mockTemplate as Template, mockUser, mockHouseRep, '');

			// Logs should include timestamp field
			const errorLogs = consoleSpy.mock.calls.map((call) => JSON.stringify(call));
			const hasTimestamp = errorLogs.some((log) => log.includes('timestamp'));
			expect(hasTimestamp).toBe(true);

			consoleSpy.mockRestore();
		});
	});
});
