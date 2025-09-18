import type { NormalizedAddress } from '$lib/types/location';
import type { Jurisdiction, Office } from '$lib/types/jurisdiction';

export interface JurisdictionProvider {
	id: string; // e.g., 'US', 'CA', 'EU'
	// Address normalization and geocoding
	normalizeAddress(input: Partial<NormalizedAddress> | string): Promise<NormalizedAddress>;
	// Address → jurisdictions
	addressToJurisdictions(address: NormalizedAddress): Promise<Jurisdiction[]>;
	// Jurisdiction → offices
	listOffices(
		jurisdictionId: string,
		filters?: { role?: string; chamber?: string }
	): Promise<Office[]>;
}

// Basic US-only stub that adapts current services
export class USJurisdictionProvider implements JurisdictionProvider {
	id = 'US';

	async normalizeAddress(input: Partial<NormalizedAddress> | string): Promise<NormalizedAddress> {
		if (typeof input === 'string') {
			// Very simple parser; production should use a robust library/service
			const parts = input.split(',').map((p) => p.trim());
			const last = parts[parts.length - 1] || '';
			const stateZipMatch = last.match(/([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/);
			return {
				countryCode: 'US',
				admin1: stateZipMatch?.[1],
				postalCode: stateZipMatch?.[2],
				admin3: parts.length > 1 ? parts[parts.length - 2] : undefined,
				street: parts.slice(0, -2).join(', ')
			};
		}
		return { countryCode: 'US', ...input } as NormalizedAddress;
	}

	async addressToJurisdictions(address: NormalizedAddress): Promise<Jurisdiction[]> {
		// Map to state and congressional district jurisdictions where possible
		const { addressLookupService } = await import('$lib/core/congress/address-lookup');
		if (!address.admin1 || !address.postalCode || !address.street || !address.admin3) {
			return [
				{
					id: `US-${address.admin1 ?? 'XX'}`,
					country_code: 'US',
					type: 'state',
					name: address.admin1,
					admin1: address.admin1,
					created_at: new Date(),
					updated_at: new Date()
				}
			];
		}
		const reps = await addressLookupService.lookupRepsByAddress({
			street: address.street,
			city: address.admin3,
			state: address.admin1,
			zip: address.postalCode
		});
		return [
			{
				id: `US-${reps.district.state}`,
				country_code: 'US',
				type: 'state',
				name: reps.district.state,
				admin1: reps.district.state,
				created_at: new Date(),
				updated_at: new Date()
			},
			{
				id: `US-${reps.district.state}-${reps.district.district}`,
				country_code: 'US',
				type: 'district',
				name: `${reps.district.state}-${reps.district.district}`,
				admin1: reps.district.state,
				created_at: new Date(),
				updated_at: new Date()
			}
		];
	}

	async listOffices(jurisdictionId: string): Promise<Office[]> {
		// For now, derive congressional offices using district patterns
		const parts = jurisdictionId.split('-');
		if (parts.length === 3) {
			const state = parts[1];
			const district = parts[2];
			return [
				{
					id: `${state}${district}H`,
					jurisdiction_id: jurisdictionId,
					role: 'representative',
					chamber: 'house',
					title: `US Representative ${state}-${district}`,
					is_active: true,
					created_at: new Date(),
					updated_at: new Date()
				}
			];
		}
		if (parts.length === 2) {
			const state = parts[1];
			return [
				{
					id: `${state}S1`,
					jurisdiction_id: jurisdictionId,
					role: 'senator',
					chamber: 'senate',
					title: `US Senator (Senior) ${state}`,
					is_active: true,
					created_at: new Date(),
					updated_at: new Date()
				},
				{
					id: `${state}S2`,
					jurisdiction_id: jurisdictionId,
					role: 'senator',
					chamber: 'senate',
					title: `US Senator (Junior) ${state}`,
					is_active: true,
					created_at: new Date(),
					updated_at: new Date()
				}
			];
		}
		return [];
	}
}
