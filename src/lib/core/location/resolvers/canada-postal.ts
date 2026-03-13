/**
 * Canada postal code -> federal riding resolver.
 * Uses represent.opennorth.ca (free, open data).
 */

const CA_POSTAL_PATTERN = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/;

export interface CanadaResolveResult {
	ridingId: string;
	ridingName: string;
	province: string;
}

/** Validate Canadian postal code format */
export function isValidCanadaPostalCode(postalCode: string): boolean {
	return CA_POSTAL_PATTERN.test(postalCode.trim());
}

/** Resolve a Canadian postal code to its federal riding */
export async function resolveCanadaPostalCode(
	postalCode: string
): Promise<CanadaResolveResult> {
	if (!isValidCanadaPostalCode(postalCode)) {
		throw new Error('Invalid Canadian postal code format');
	}

	const normalized = postalCode.trim().toUpperCase().replace(/\s/g, '');
	const response = await fetch(
		`https://represent.opennorth.ca/postcodes/${normalized}/`,
		{
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(2_000)
		}
	);

	if (!response.ok) {
		throw new Error(`represent.opennorth.ca returned ${response.status}`);
	}

	const data = await response.json();

	// Find federal riding in boundaries_concordance or boundaries_centroid
	const federal =
		data.boundaries_centroid?.find(
			(b: { boundary_set_name: string }) =>
				b.boundary_set_name === 'Federal electoral district' ||
				b.boundary_set_name?.includes('Federal')
		) ||
		data.boundaries_concordance?.find(
			(b: { boundary_set_name: string }) =>
				b.boundary_set_name === 'Federal electoral district' ||
				b.boundary_set_name?.includes('Federal')
		);

	if (!federal) {
		throw new Error('No federal riding found for postal code');
	}

	return {
		ridingId: federal.external_id || federal.name,
		ridingName: federal.name,
		province: data.province || federal.metadata?.province || 'Unknown'
	};
}
