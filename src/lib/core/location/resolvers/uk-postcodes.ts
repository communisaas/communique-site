/**
 * UK postcode -> parliamentary constituency resolver.
 * Uses postcodes.io (free, no auth required).
 */

const UK_POSTCODE_PATTERN = /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/;

export interface UKResolveResult {
	constituencyId: string;
	constituencyName: string;
	council: string;
	region: string;
}

/** Validate UK postcode format */
export function isValidUKPostcode(postcode: string): boolean {
	return UK_POSTCODE_PATTERN.test(postcode.trim());
}

/** Resolve a UK postcode to its parliamentary constituency */
export async function resolveUKPostcode(postcode: string): Promise<UKResolveResult> {
	if (!isValidUKPostcode(postcode)) {
		throw new Error('Invalid UK postcode format');
	}

	const normalized = postcode.trim().toUpperCase().replace(/\s+/g, '+');
	const response = await fetch(`https://api.postcodes.io/postcodes/${normalized}`, {
		headers: { Accept: 'application/json' },
		signal: AbortSignal.timeout(2_000)
	});

	if (!response.ok) {
		throw new Error(`postcodes.io returned ${response.status}`);
	}

	const data = await response.json();

	if (data.status !== 200 || !data.result) {
		throw new Error('Postcode not found');
	}

	const r = data.result;
	return {
		constituencyId: r.codes?.parliamentary_constituency ?? r.parliamentary_constituency,
		constituencyName: r.parliamentary_constituency ?? 'Unknown',
		council: r.admin_district ?? 'Unknown',
		region: r.region ?? 'Unknown'
	};
}
