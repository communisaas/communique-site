import { normalizeState } from '$lib/utils/states';
import { env } from '$env/dynamic/private';

interface AddressData {
	street: string;
	city: string;
	state: string;
	zip: string;
}

interface CongressionalDistrict {
	state: string;
	district: string; // "01", "02", etc. Senate uses "00"
}

interface Representative {
	bioguide_id: string;
	name: string;
	party: string;
	state: string;
	district: string;
	chamber: 'house' | 'senate';
	phone?: string;
	email?: string;
	office_code: string; // For CWC submissions
}

// Congress.gov API types
interface CongressMemberTerm {
	chamber?: string;
	party?: string;
	state?: string;
	startYear?: number;
	endYear?: number;
}

interface CongressMember {
	bioguideId?: string; // Congress API uses camelCase
	bioguide_id?: string; // Support snake_case for backwards compatibility
	name?: string;
	partyName?: string;
	firstName?: string;
	lastName?: string;
	state?: string;
	district?: number;
	currentMember?: boolean;
	terms?:
		| {
				item?: CongressMemberTerm[];
		  }
		| CongressMemberTerm[];
}

// Type guard for CongressMember
function isCongressMember(obj: unknown): obj is CongressMember {
	return (
		typeof obj === 'object' &&
		obj !== null &&
		(typeof (obj as CongressMember).bioguideId === 'string' ||
			typeof (obj as CongressMember).bioguide_id === 'string' ||
			typeof (obj as CongressMember).name === 'string')
	);
}

interface UserReps {
	house: Representative;
	senate: Representative[]; // Always 2 senators per state
	district: CongressionalDistrict;
}

export class Address {
	private congressApiKey: string;

	constructor() {
		// Use CONGRESS_API_KEY which is the valid Congress.gov API key
		this.congressApiKey = env.CONGRESS_API_KEY || env.CWC_API_KEY || '';
		// Only warn if we're in production and the key is missing
		if (!this.congressApiKey && env.NODE_ENV === 'production') {
			console.warn(
				'CONGRESS_API_KEY environment variable is missing - Congress features will be disabled'
			);
		}
	}

	/**
	 * Main function: Address  → User's Representatives
	 * This is called during user onboarding
	 */
	async lookupRepsByAddress(address: AddressData): Promise<UserReps> {
		// Step 1: Address  → Congressional District
		const district = await this.addressToDistrict(address);

		// Step 2: District → Representatives
		const [houseRep, senators] = await Promise.all([
			this.getHouseRep(district.state, district.district),
			this.getSenators(district.state)
		]);

		return {
			house: houseRep,
			senate: senators,
			district
		};
	}

	/**
	 * Convert address to congressional district
	 * Primary: Census Bureau Geocoding API; Fallback: ZIP→district
	 */
	private async addressToDistrict(address: AddressData): Promise<CongressionalDistrict> {
		try {
			const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.zip}`;
			const url = `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${encodeURIComponent(fullAddress)}&benchmark=4&vintage=4&format=json`;

			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`Census geocoding API error: ${response.status}`);
			}

			const data = await response.json();
			const match = data?.result?.addressMatches?.[0];
			if (!match) {
				// No match; fallback to ZIP-based
				return this.zipToDistrict(address.zip, address.state);
			}

			const district = this.extractDistrictFromCensus(match.geographies, address.state);
			return district;
		} catch (error) {
			// Fallback to ZIP-based lookup
			return this.zipToDistrict(address.zip, address.state);
		}
	}

	/**
	 * Extract congressional district from Census Bureau geocoding response
	 */
	private extractDistrictFromCensus(
		geographies: Record<string, unknown>,
		state: string
	): CongressionalDistrict {
		try {
			const districts = geographies?.['119th Congressional Districts'];
			if (Array.isArray(districts) && districts.length > 0) {
				const districtObj = districts[0];

				// Try CD119 field first (standard format)
				let cd = districtObj?.CD119;

				// Fallback: DC and some territories use GEOID where last 2 digits = district
				if (cd === undefined && districtObj?.GEOID) {
					const geoid = String(districtObj.GEOID);
					cd = geoid.slice(-2); // Last 2 digits
				}

				if (cd === '98') {
					// DC delegate special case → at-large
					return { state: state.toUpperCase(), district: '00' };
				}

				if (cd !== undefined) {
					return {
						state: state.toUpperCase(),
						district: String(cd).padStart(2, '0')
					};
				}
			}
			// Fallback to at-large for any state without a numbered district
			return { state: state.toUpperCase(), district: '00' };
		} catch (error) {
			return { state: state.toUpperCase(), district: '01' };
		}
	}

	/**
	 * Fallback: ZIP code to district lookup using real data
	 * Uses OpenSourceActivismTech ZIP-district mapping
	 */
	private async zipToDistrict(zip: string, state: string): Promise<CongressionalDistrict> {
		try {
			const { zipDistrictLookup } = await import('$lib/services/zipDistrictLookup');
			const result = await zipDistrictLookup.lookupDistrict(zip, state);

			return {
				state: result.state,
				district: result.district
			};
		} catch (error) {
			console.error('Error occurred');
			return {
				state: state.toUpperCase(),
				district: '01' // Final fallback
			};
		}
	}

	/**
	 * Get House _representative for a specific district
	 */
	private async getHouseRep(state: string, district: string): Promise<Representative> {
		try {
			// Normalize state to handle both abbreviations and full names
			const { abbreviation: stateAbbr, fullName: stateFullName } = normalizeState(state);

			// Fetch all members with pagination (Congress has 535 members)
			const allMembers = await this.fetchAllMembers();

			// Handle at-large districts (AL, 00) and regular numbered districts
			let districtNumber: number | null = null;

			if (district === 'AL' || district === '00') {
				// At-large districts: DC, VT, WY, AK, MT, DE, ND, SD
				// These are represented as district 0 or no district number in Congress API
				districtNumber = 0;
			} else {
				// Regular numbered districts: remove leading zeros and parse
				const stripped = district.replace(/^0+/, '');
				districtNumber = stripped ? parseInt(stripped, 10) : 0;
			}

			const houseRep = allMembers.find((member: CongressMember) => {
				// District is at the top level, not in terms
				const memberDistrict = member.district;
				// State can be full name or abbreviation in the API response
				const stateMatches = member.state === stateAbbr || member.state === stateFullName;

				// For at-large districts (0), also match undefined district (non-voting delegates)
				const districtMatches =
					memberDistrict === districtNumber ||
					(districtNumber === 0 && memberDistrict === undefined);

				return stateMatches && districtMatches;
			});

			if (!houseRep) {
				console.error(`No House representative found for ${stateAbbr}-${districtNumber}`);
				throw new Error(`No House representative found for ${stateAbbr}-${districtNumber}`);
			}

			return this.formatRepresentative(houseRep, 'house');
		} catch (error) {
			console.error('Error fetching House representative:', error);
			// Return placeholder data
			return {
				bioguide_id: `${state}${district}H`,
				name: `Representative for ${state}-${district}`,
				party: 'Unknown',
				state,
				district,
				chamber: 'house',
				office_code: `${state}${district}H`
			};
		}
	}

	/**
	 * Get both senators for a state
	 */
	private async getSenators(state: string): Promise<Representative[]> {
		try {
			// Normalize state to handle both abbreviations and full names
			const { abbreviation: stateAbbr, fullName: stateFullName } = normalizeState(state);

			// Fetch all members with pagination
			const allMembers = await this.fetchAllMembers();

			console.log(`Looking for senators from ${stateAbbr}/${stateFullName}`);

			// Filter for senators from the specific state
			const senators = allMembers
				.filter((member: CongressMember) => {
					const termsArray = Array.isArray(member.terms) ? member.terms : member.terms?.item;
					const latestTerm = termsArray?.[0];
					// Only match if chamber is explicitly 'Senate' (not just missing district)
					const isSenator = latestTerm?.chamber === 'Senate';
					return isSenator && (member.state === stateAbbr || member.state === stateFullName);
				})
				.slice(0, 2) // Should be exactly 2 senators
				.map((senator: CongressMember) => this.formatRepresentative(senator, 'senate'));

			if (senators.length === 0) {
				// Return placeholder senators
				return [
					{
						bioguide_id: `${state}S1`,
						name: `Senior Senator for ${state}`,
						party: 'Unknown',
						state,
						district: '00',
						chamber: 'senate',
						office_code: `${state}S1`
					},
					{
						bioguide_id: `${state}S2`,
						name: `Junior Senator for ${state}`,
						party: 'Unknown',
						state,
						district: '00',
						chamber: 'senate',
						office_code: `${state}S2`
					}
				];
			}

			return senators;
		} catch (error) {
			// Return placeholder senators
			return [
				{
					bioguide_id: `${state}S1`,
					name: `Senior Senator for ${state}`,
					party: 'Unknown',
					state,
					district: '00',
					chamber: 'senate',
					office_code: `${state}S1`
				},
				{
					bioguide_id: `${state}S2`,
					name: `Junior Senator for ${state}`,
					party: 'Unknown',
					state,
					district: '00',
					chamber: 'senate',
					office_code: `${state}S2`
				}
			];
		}
	}

	/**
	 * Format _representative data from Congress.gov API
	 */
	/**
	 * Fetch all members from Congress API with pagination
	 */
	private async fetchAllMembers(): Promise<CongressMember[]> {
		const allMembers: CongressMember[] = [];
		let offset = 0;
		const limit = 250; // Max allowed by API

		console.log('Fetching all Congress members with pagination...');

		while (true) {
			const url = `https://api.congress.gov/v3/member?api_key=${this.congressApiKey}&format=json&currentMember=true&limit=${limit}&offset=${offset}`;

			console.log(`Fetching members offset ${offset}...`);
			const response = await fetch(url, {
				headers: {
					'User-Agent': 'Communique/1.0',
					Accept: 'application/json'
				}
			});

			if (!response.ok) {
				console.error(`Congress API error at offset ${offset}:`, response.status);
				throw new Error(`Congress API error: ${response.status}`);
			}

			const data = await response.json();
			const members = (data.members || []) as unknown[];
			console.log(`Fetched ${members.length} members at offset ${offset}`);

			// Filter and validate members before adding
			const validMembers = members.filter(isCongressMember);
			allMembers.push(...validMembers);

			// Check if we've fetched all members
			if (validMembers.length < limit) {
				break; // No more members to fetch
			}

			offset += limit;

			// Safety check to prevent infinite loop (Congress has ~535 members)
			if (offset > 1000) {
				break;
			}
		}

		console.log(`Total members fetched: ${allMembers.length}`);
		return allMembers;
	}

	private formatRepresentative(
		member: CongressMember,
		chamber: 'house' | 'senate'
	): Representative {
		// Handle both direct fields and nested term data
		const termsArray = Array.isArray(member.terms) ? member.terms : member.terms?.item;
		const currentTerm = termsArray?.[0] || {};

		// Format name from "Last, First Middle" to "First Middle Last"
		let formattedName = member.name || '';
		if (formattedName.includes(',')) {
			const [last, firstMiddle] = formattedName.split(',').map((s: string) => s.trim());
			formattedName = `${firstMiddle} ${last}`;
		} else if (member.firstName || member.lastName) {
			formattedName = `${member.firstName || ''} ${member.lastName || ''}`.trim();
		}
		formattedName = formattedName || 'Unknown';

		// Congress API returns camelCase bioguideId, fallback to snake_case for compatibility
		const bioguideId = member.bioguideId || member.bioguide_id || '';

		return {
			bioguide_id: bioguideId,
			name: formattedName,
			party: member.partyName || currentTerm?.party || 'Unknown',
			state: member.state || currentTerm?.state || '',
			district: chamber === 'senate' ? '00' : String(member.district || '01').padStart(2, '0'),
			chamber,
			office_code: bioguideId
		};
	}

	/**
	 * Validate that representatives are current and active
	 */
	async validateReps(reps: UserReps): Promise<{ valid: boolean; errors: string[] }> {
		const errors: string[] = [];

		try {
			// Check if all reps are still current
			const allReps = [reps.house, ...reps.senate];

			for (const rep of allReps) {
				const url = `https://api.data.gov/congress/v3/member/${rep.bioguide_id}?api_key=${this.congressApiKey}&format=json`;

				const response = await fetch(url);

				if (!response.ok) {
					errors.push(`Cannot validate _representative ${rep.name} (${rep.bioguide_id})`);
					continue;
				}

				const data = await response.json();
				const member = data.member;

				if (!member?.currentMember) {
					errors.push(`Representative ${rep.name} is no longer serving`);
				}
			}
		} catch (error) {
			errors.push('Validation failed: API error');
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}
}

// Export singleton instance
export const addressLookupService = new Address();

// Convenience function for ZIP-based _representative lookup
export async function addressLookup(zip: string): Promise<Representative[]> {
	try {
		// Create minimal address object for lookup
		const address: AddressData = {
			street: '',
			city: '',
			state: '', // Will be inferred from ZIP if possible
			zip
		};

		// For ZIP-only lookup, we need to extract state from ZIP or use a different approach
		// Let's use the ZIP district lookup to get the state first
		const { zipDistrictLookup } = await import('$lib/services/zipDistrictLookup');
		const districtInfo = await zipDistrictLookup.lookupDistrict(zip, '');

		// Update address with the state
		address.state = districtInfo.state;

		// Get all representatives for this address
		const userReps = await addressLookupService.lookupRepsByAddress(address);

		// Return as flat array of representatives
		return [userReps.house, ...userReps.senate];
	} catch (error) {
		console.error('Error occurred');
		// Return empty array on failure
		return [];
	}
}

/**
 * Get representatives for a complete address (street, city, state, zip)
 * This is the function used by the CWC submission endpoint
 */
export async function getRepresentativesForAddress(address: AddressData): Promise<Representative[]> {
	try {
		const userReps = await addressLookupService.lookupRepsByAddress(address);
		return [userReps.house, ...userReps.senate];
	} catch (error) {
		console.error('Error getting representatives for address:', error);
		throw new Error(`Failed to get representatives: ${error.message}`);
	}
}
