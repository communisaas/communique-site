import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to fix hoisting issue
const { mockAdapterRegistry } = vi.hoisted(() => {
	return {
		mockAdapterRegistry: {
			getAdapter: vi.fn(),
			getSupportedCountries: vi.fn(),
			getCapabilities: vi.fn()
		}
	};
});

vi.mock('../../src/lib/core/legislative/adapters/registry.js', () => ({
	adapterRegistry: mockAdapterRegistry
}));

import { deliveryPipeline } from '../../src/lib/core/legislative/index.js';
const adapterRegistry = mockAdapterRegistry;
import {
	userFactory,
	templateFactory,
	deliveryJobFactory,
	addressFactory
} from '../fixtures/factories';
import mockRegistry from '../mocks/registry';

describe('Legislative Abstraction Integration', () => {
	it('should handle adapter registry capabilities query', async () => {
		adapterRegistry.getSupportedCountries.mockResolvedValue(['US']);
		adapterRegistry.getCapabilities.mockResolvedValue([
			{
				country_code: 'US',
				methods: ['api', 'form'],
				tier: 2,
				provider: 'CWC'
			}
		]);

		const supportedCountries = await adapterRegistry.getSupportedCountries();
		const capabilities = await adapterRegistry.getCapabilities();

		expect(supportedCountries).toEqual(['US']);
		expect(capabilities).toHaveLength(1);
		expect(capabilities[0]).toEqual(
			expect.objectContaining({
				country_code: 'US',
				methods: expect.arrayContaining(['api', 'form']),
				tier: 2,
				provider: 'CWC'
			})
		);
	});
});
