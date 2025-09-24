import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adapterRegistry } from '$lib/core/legislative';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const countryCode = url.searchParams.get('country');

		if (countryCode) {
			// Get capabilities for specific country
			const adapter = await adapterRegistry.getAdapter(countryCode);
			if (adapter) {
				const [systemInfo, capabilities] = await Promise.all([
					adapter.getSystemInfo(),
					adapter.getCapabilities()
				]);

				return json({
					success: true,
					country: countryCode.toUpperCase(),
					adapter: adapter.name,
					system: systemInfo,
					capabilities
				});
			}

			return json({
				success: false,
				error: `No adapter available for country: ${countryCode}`
			});
		}

		// Get all supported countries and their capabilities
		const supportedCountries = await adapterRegistry.getSupportedCountries();
		const allCapabilities = await adapterRegistry.getCapabilities();

		return json({
			success: true,
			supported_countries: supportedCountries,
			capabilities: allCapabilities
		});
	} catch {
		return json(
			{
				success: false,
				error: _error ? 'Unknown error' : 'Failed to get legislative capabilities'
			},
			{ status: 500 }
		);
	}
};
