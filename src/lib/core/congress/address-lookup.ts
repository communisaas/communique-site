import { normalizeState } from '$lib/utils/states';
import { CONGRESS_API_KEY, CWC_API_KEY, NODE_ENV } from '$env/static/private';

interface Address {
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
	bioguideId: string;
	name: string;
	party: string;
	state: string;
	district: string;
	chamber: 'house' | 'senate';
	phone?: string;
	email?: string;
	officeCode: string; // For CWC submissions
}

interface UserReps {
	house: Representative;
	senate: Representative[]; // Always 2 senators per state
	district: CongressionalDistrict;
}

export class AddressLookupService {
	private congressApiKey: string;

	constructor() {
		// Use CONGRESS_API_KEY which is the valid Congress.gov API key
		this.congressApiKey = CONGRESS_API_KEY || CWC_API_KEY || '';
		// Only throw _error if we're in production and the key is missing
		if (!this.congressApiKey && NODE_ENV === 'production') {
			console.warn(
				'CONGRESS_API_KEY environment variable is missing - Congress features will be disabled'
			);
		}
	}

	/**
	 * Main function: Address → User's Representatives
	 * This is called during user onboarding
	 */
	async lookupRepsByAddress(address: Address): Promise<UserReps> {
		// Step 1: Address → Congressional District
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
	private async addressToDistrict(address: Address): Promise<CongressionalDistrict> {
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
		} catch (_err) {
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
				const cd = districts[0]?.CD119;
				if (cd === '98') {
					// DC delegate special case → at-large
					return { state: state.toUpperCase(), district: '00' };
				}
				return {
					state: state.toUpperCase(),
					district: String(cd).padStart(2, '0')
				};
			}
			return { state: state.toUpperCase(), district: '00' };
		} catch (_e) {
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
		} catch (_error) {
			console.error('ZIP district lookup failed:', _error);
			return {
				state: state.toUpperCase(),
				district: '01' // Final fallback
			};
		}
	}

	/**
	 * Get House representative for a specific district
	 */
	private async getHouseRep(state: string, district: string): Promise<Representative> {
		try {
			// Normalize state to handle both abbreviations and full names
			const { abbreviation: stateAbbr, fullName: stateFullName } = normalizeState(state);

			// Fetch all members with pagination (Congress has 535 members)
			const allMembers = await this.fetchAllMembers();

			// Filter for House member from the specific state and district
			const districtNumber = parseInt(district.replace(/^0+/, ''), 10); // Remove leading zeros and convert to number

			console.log(
				`Looking for representative: ${stateAbbr}/${stateFullName} district ${districtNumber}`
			);

			const houseRep = allMembers.find((member: unknown) => {
				// District is at the top level, not in terms
				const memberDistrict = member.district;
				// State can be full name or abbreviation in the API response
				const isMatch =
					(member.state === stateAbbr || member.state === stateFullName) &&
					memberDistrict === districtNumber;

				if (isMatch) {
					console.log('Found match!', member.name, member.state, member.district);
				}

				return isMatch;
			});

			if (!houseRep) {
				console.error(`No House representative found for ${stateAbbr}-${districtNumber}`);
				throw new Error(`No House representative found for ${stateAbbr}-${districtNumber}`);
			}

			return this.formatRepresentative(houseRep, 'house');
		} catch (_error) {
			console.error('Failed to get House rep:', _error);
			// Return placeholder data
			return {
				bioguideId: `${state}${district}H`,
				name: `Representative for ${state}-${district}`,
				party: 'Unknown',
				state,
				district,
				chamber: 'house',
				officeCode: `${state}${district}H`
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
				.filter((member: unknown) => {
					const latestTerm = member.terms?.item?.[0] || member.terms?.[0];
					const isSenator = latestTerm?.chamber === 'Senate' || (!member.district && latestTerm); // Senators don't have districts
					return isSenator && (member.state === stateAbbr || member.state === stateFullName);
				})
				.slice(0, 2) // Should be exactly 2 senators
				.map((senator: unknown) => this.formatRepresentative(senator, 'senate'));

			if (senators.length === 0) {
				// Return placeholder senators
				return [
					{
						bioguideId: `${state}S1`,
						name: `Senior Senator for ${state}`,
						party: 'Unknown',
						state,
						district: '00',
						chamber: 'senate',
						officeCode: `${state}S1`
					},
					{
						bioguideId: `${state}S2`,
						name: `Junior Senator for ${state}`,
						party: 'Unknown',
						state,
						district: '00',
						chamber: 'senate',
						officeCode: `${state}S2`
					}
				];
			}

			return senators;
		} catch (_error) {
			// Return placeholder senators
			return [
				{
					bioguideId: `${state}S1`,
					name: `Senior Senator for ${state}`,
					party: 'Unknown',
					state,
					district: '00',
					chamber: 'senate',
					officeCode: `${state}S1`
				},
				{
					bioguideId: `${state}S2`,
					name: `Junior Senator for ${state}`,
					party: 'Unknown',
					state,
					district: '00',
					chamber: 'senate',
					officeCode: `${state}S2`
				}
			];
		}
	}

	/**
	 * Format representative data from Congress.gov API
	 */
	/**
	 * Fetch all members from Congress API with pagination
	 */
	private async fetchAllMembers(): Promise<any[]> {
		const allMembers: unknown[] = [];
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
			const members = data.members || [];
			console.log(`Fetched ${members.length} members at offset ${offset}`);
			allMembers.push(...members);

			// Check if we've fetched all members
			if (members.length < limit) {
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

	private formatRepresentative(member: unknown, chamber: 'house' | 'senate'): Representative {
		// Handle both direct fields and nested term data
		const currentTerm = member.terms?.item?.[0] || member.terms?.[0] || {};

		// Format name from "Last, First Middle" to "First Middle Last"
		let formattedName = member.name || '';
		if (formattedName.includes(',')) {
			const [last, firstMiddle] = formattedName.split(',').map((s: string) => s.trim());
			formattedName = `${firstMiddle} ${last}`;
		} else if (member.firstName || member.lastName) {
			formattedName = `${member.firstName || ''} ${member.lastName || ''}`.trim();
		}
		formattedName = formattedName || 'Unknown';

		return {
			bioguideId: member.bioguideId || '',
			name: formattedName,
			party: member.partyName || currentTerm.party || 'Unknown',
			state: member.state || currentTerm.state || '',
			district: chamber === 'senate' ? '00' : String(member.district || '01').padStart(2, '0'),
			chamber,
			officeCode: member.bioguideId || ''
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
				const url = `https://api.data.gov/congress/v3/member/${rep.bioguideId}?api_key=${this.congressApiKey}&format=json`;

				const response = await fetch(url);

				if (!response.ok) {
					errors.push(`Cannot validate representative ${rep.name} (${rep.bioguideId})`);
					continue;
				}

				const data = await response.json();
				const member = data.member;

				if (!member?.currentMember) {
					errors.push(`Representative ${rep.name} is no longer serving`);
				}
			}
		} catch (_error) {
			errors.push(`Validation failed: ${_error}`);
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}
}

// Export singleton instance
export const addressLookup = new AddressLookupService();
