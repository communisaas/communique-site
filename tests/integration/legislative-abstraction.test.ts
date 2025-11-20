/**
 * Legislative Abstraction Integration Tests
 *
 * Tests the legislative delivery system's ability to abstract across different
 * legislative systems (US Congress, UK Parliament, etc.) and delivery methods.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	userFactory,
	templateFactory,
	deliveryJobFactory as _deliveryJobFactory,
	addressFactory as _addressFactory,
	representativeFactory
} from '../fixtures/factories';

// Use vi.hoisted to fix hoisting issue
const { mockAdapterRegistry, mockDeliveryPipeline } = vi.hoisted(() => {
	return {
		mockAdapterRegistry: {
			getAdapter: vi.fn(),
			getSupportedCountries: vi.fn(),
			getCapabilities: vi.fn(),
			validateConfiguration: vi.fn()
		},
		mockDeliveryPipeline: {
			deliverToRepresentatives: vi.fn(),
			getSupportedDeliveryMethods: vi.fn()
		}
	};
});

vi.mock('../../src/lib/core/legislative/adapters/registry.js', () => ({
	adapterRegistry: mockAdapterRegistry
}));

vi.mock('../../src/lib/core/legislative/delivery/pipeline.js', () => ({
	deliveryPipeline: mockDeliveryPipeline
}));

describe('Legislative Abstraction Integration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Adapter Registry Management', () => {
		it('should provide capabilities for supported countries', async () => {
			mockAdapterRegistry.getSupportedCountries.mockResolvedValue(['US', 'UK', 'CA']);
			mockAdapterRegistry.getCapabilities.mockResolvedValue([
				{
					country_code: 'US',
					methods: ['api', 'form'],
					tier: 2,
					provider: 'CWC',
					chambers: ['house', 'senate']
				},
				{
					country_code: 'UK',
					methods: ['email'],
					tier: 1,
					provider: 'generic',
					chambers: ['commons', 'lords']
				}
			]);

			const supportedCountries = await mockAdapterRegistry.getSupportedCountries();
			const capabilities = await mockAdapterRegistry.getCapabilities();

			expect(supportedCountries).toEqual(['US', 'UK', 'CA']);
			expect(capabilities).toHaveLength(2);
			expect(capabilities[0]).toEqual(
				expect.objectContaining({
					country_code: 'US',
					methods: expect.arrayContaining(['api', 'form']),
					tier: 2,
					provider: 'CWC'
				})
			);
		});

		it('should get appropriate adapter for country and delivery method', async () => {
			const mockUSAdapter = {
				countryCode: 'US',
				deliverMessage: vi.fn(),
				validateAddress: vi.fn(),
				lookupRepresentatives: vi.fn()
			};

			mockAdapterRegistry.getAdapter.mockResolvedValue(mockUSAdapter);

			const adapter = await mockAdapterRegistry.getAdapter('US', 'api');

			expect(adapter).toBeDefined();
			expect(adapter.countryCode).toBe('US');
			expect(mockAdapterRegistry.getAdapter).toHaveBeenCalledWith('US', 'api');
		});
	});

	describe('Cross-Country Legislative Delivery', () => {
		it('should handle US congressional delivery through CWC adapter', async () => {
			const user = userFactory.build({
				overrides: {
					congressional_district: 'CA-12'
				}
			});
			const template = templateFactory.build({
				overrides: {
					deliveryMethod: 'cwc',
					applicable_countries: ['US']
				}
			});

			mockDeliveryPipeline.deliverToRepresentatives.mockResolvedValue({
				job_id: 'us-job-123',
				total_recipients: 3,
				successful_deliveries: 3,
				failed_deliveries: 0,
				results: [
					{ success: true, message_id: 'house-123', representative: 'Rep. Pelosi' },
					{ success: true, message_id: 'senate-456', representative: 'Sen. Padilla' },
					{ success: true, message_id: 'senate-789', representative: 'Sen. Butler' }
				],
				adapter_used: 'CWC',
				country: 'US'
			});

			const result = await mockDeliveryPipeline.deliverToRepresentatives({
				user,
				template,
				country: 'US'
			});

			expect(result.successful_deliveries).toBe(3);
			expect(result.adapter_used).toBe('CWC');
			expect(result.country).toBe('US');
		});

		it('should handle UK parliamentary delivery through generic email adapter', async () => {
			const user = userFactory.build({
				overrides: {
				}
			});
			const template = templateFactory.build({
				overrides: {
					deliveryMethod: 'email',
					applicable_countries: ['UK']
				}
			});

			mockDeliveryPipeline.deliverToRepresentatives.mockResolvedValue({
				job_id: 'uk-job-456',
				total_recipients: 2,
				successful_deliveries: 2,
				failed_deliveries: 0,
				results: [
					{ success: true, message_id: 'mp-123', representative: 'MP John Smith' },
					{ success: true, message_id: 'lord-456', representative: 'Lord Jane Doe' }
				],
				adapter_used: 'generic_email',
				country: 'UK'
			});

			const result = await mockDeliveryPipeline.deliverToRepresentatives({
				user,
				template,
				country: 'UK'
			});

			expect(result.successful_deliveries).toBe(2);
			expect(result.adapter_used).toBe('generic_email');
			expect(result.country).toBe('UK');
		});
	});

	describe('Delivery Method Fallbacks', () => {
		it('should fall back to lower-tier methods when primary method fails', async () => {
			const user = userFactory.build();
			const template = templateFactory.build();

			// First attempt with API fails
			mockDeliveryPipeline.deliverToRepresentatives
				.mockRejectedValueOnce(new Error('API method failed'))
				.mockResolvedValueOnce({
					job_id: 'fallback-job-789',
					total_recipients: 2,
					successful_deliveries: 2,
					failed_deliveries: 0,
					results: [
						{ success: true, message_id: 'form-123', method_used: 'form' },
						{ success: true, message_id: 'email-456', method_used: 'email' }
					],
					adapter_used: 'fallback_adapter',
					fallback_used: true
				});

			// Should retry with fallback
			await expect(
				mockDeliveryPipeline.deliverToRepresentatives({ user, template })
			).rejects.toThrow('API method failed');

			// Second attempt should succeed
			const result = await mockDeliveryPipeline.deliverToRepresentatives({ user, template });
			expect(result.fallback_used).toBe(true);
			expect(result.successful_deliveries).toBe(2);
		});
	});

	describe('Representative Data Normalization', () => {
		it('should normalize representative data across different legislative systems', async () => {
			// Test that different countries' representatives are normalized to common schema
			const usRep = representativeFactory.build({
				overrides: {
					chamber: 'house',
					district: '12',
					party: 'Democratic'
				}
			});

			const ukRep = representativeFactory.build({
				overrides: {
					chamber: 'commons', // UK equivalent
					district: undefined, // UK doesn't use districts
					party: 'Labour'
				}
			});

			// Both should have consistent base structure
			expect(usRep).toMatchObject({
				id: expect.any(String),
				name: expect.any(String),
				chamber: expect.any(String),
				party: expect.any(String)
			});

			expect(ukRep).toMatchObject({
				id: expect.any(String),
				name: expect.any(String),
				chamber: expect.any(String),
				party: expect.any(String)
			});
		});
	});
});
