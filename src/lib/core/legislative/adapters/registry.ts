import type { LegislativeAdapter } from './base';
import { USCongressAdapter } from './us-congress';
import { UKParliamentAdapter } from './uk-parliament';
import { GenericLegislativeAdapter } from './generic';
import { env } from '$env/dynamic/private';

export class AdapterRegistry {
	private adapters = new Map<string, LegislativeAdapter>();
	private initialized = false;

	async initialize() {
		if (this.initialized) return;

		// Register US Congress adapter
		const cwcApiKey = env.CWC_API_KEY || '';
		this.adapters.set('US', new USCongressAdapter(cwcApiKey));

		// Register UK Parliament adapter
		this.adapters.set('UK', new UKParliamentAdapter());
		this.adapters.set('GB', new UKParliamentAdapter()); // Alternative code

		// Can add more specific adapters here
		// this.adapters.set('CA', new CanadianParliamentAdapter());
		// this.adapters.set('AU', new AustralianParliamentAdapter());

		this.initialized = true;
	}

	async getAdapter(country_code: string): Promise<LegislativeAdapter | null> {
		await this.initialize();
		const code = country_code.toUpperCase();

		// Check for specific adapter
		const specificAdapter = this.adapters.get(code);
		if (specificAdapter) return specificAdapter;

		// Fall back to generic adapter for unknown countries
		const countryName = this.getCountryName(code);
		return new GenericLegislativeAdapter(code, countryName);
	}

	private getCountryName(code: string): string {
		const countryNames: Record<string, string> = {
			CA: 'Canada',
			AU: 'Australia',
			DE: 'Germany',
			FR: 'France',
			JP: 'Japan',
			IN: 'India',
			BR: 'Brazil',
			MX: 'Mexico'
		};

		return countryNames[code] || code;
	}

	async getSupportedCountries(): Promise<string[]> {
		await this.initialize();
		return Array.from(this.adapters.keys());
	}

	async getCapabilities() {
		await this.initialize();
		const capabilities = [];

		for (const [country, adapter] of this.adapters) {
			const capability = await adapter.getCapabilities();
			capabilities.push(capability);
		}

		return capabilities;
	}
}

export const adapterRegistry = new AdapterRegistry();
