/**
 * Australia postcode -> federal electorate resolver.
 * Uses AEC (Australian Electoral Commission) data.
 */

const AU_POSTCODE_PATTERN = /^\d{4}$/;

export interface AustraliaResolveResult {
	electorateId: string;
	electorateName: string;
	state: string;
}

/** Validate Australian postcode format */
export function isValidAustraliaPostcode(postcode: string): boolean {
	return AU_POSTCODE_PATTERN.test(postcode.trim());
}

/** Resolve an Australian postcode to its federal electorate */
export async function resolveAustraliaPostcode(
	postcode: string
): Promise<AustraliaResolveResult> {
	if (!isValidAustraliaPostcode(postcode)) {
		throw new Error('Invalid Australian postcode format');
	}

	const response = await fetch(
		`https://electorate.aec.gov.au/api/Electorates?postcode=${postcode.trim()}`,
		{
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(2_000)
		}
	);

	if (!response.ok) {
		throw new Error(`AEC API returned ${response.status}`);
	}

	const data = await response.json();

	// AEC returns array of electorates for a postcode
	const electorates = Array.isArray(data) ? data : data.electorates || data.results || [];

	if (electorates.length === 0) {
		throw new Error('No electorate found for postcode');
	}

	// Return first electorate (primary match)
	const electorate = electorates[0];
	return {
		electorateId: (electorate.id || electorate.name || '')
			.toLowerCase()
			.replace(/\s+/g, '-'),
		electorateName: electorate.name || electorate.electorate_name || 'Unknown',
		state: electorate.state || electorate.state_ab || 'Unknown'
	};
}
