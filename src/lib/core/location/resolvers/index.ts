/**
 * Unified district resolver dispatcher.
 * Routes to country-specific resolver based on country code.
 */

import { resolveUKPostcode } from './uk-postcodes';
import { resolveCanadaPostalCode } from './canada-postal';
import { resolveAustraliaPostcode } from './australia-aec';

export interface ResolverResult {
	districtId: string;
	districtName: string;
	districtType: string;
	country: string;
	extra?: Record<string, string>;
}

/** Resolve a postal code / postcode to its legislative district for a given country */
export async function resolveDistrict(
	countryCode: string,
	input: string
): Promise<ResolverResult> {
	const code = countryCode.toUpperCase();

	switch (code) {
		case 'GB': {
			const result = await resolveUKPostcode(input);
			return {
				districtId: result.constituencyId,
				districtName: result.constituencyName,
				districtType: 'uk-constituency',
				country: 'GB',
				extra: { council: result.council, region: result.region }
			};
		}
		case 'CA': {
			const result = await resolveCanadaPostalCode(input);
			return {
				districtId: result.ridingId,
				districtName: result.ridingName,
				districtType: 'ca-riding',
				country: 'CA',
				extra: { province: result.province }
			};
		}
		case 'AU': {
			const result = await resolveAustraliaPostcode(input);
			return {
				districtId: result.electorateId,
				districtName: result.electorateName,
				districtType: 'au-electorate',
				country: 'AU',
				extra: { state: result.state }
			};
		}
		case 'US':
			throw new Error(
				'US resolution uses Shadow Atlas (lookupDistrict/lookupAllDistricts), not this dispatcher'
			);
		default:
			throw new Error(`Unsupported country code: ${code}. Supported: GB, CA, AU`);
	}
}

export { resolveUKPostcode, isValidUKPostcode } from './uk-postcodes';
export { resolveCanadaPostalCode, isValidCanadaPostalCode } from './canada-postal';
export { resolveAustraliaPostcode, isValidAustraliaPostcode } from './australia-aec';
