import { normalizeState } from '$lib/utils/states';
import { env } from '$env/dynamic/private';

// Fallback to process.env for test environment compatibility
// SvelteKit's $env/dynamic/private doesn't work correctly in vitest
const getEnvVar = (key: string): string => {
	return env?.[key] || process.env[key] || '';
};

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
	is_voting_member?: boolean; // False for DC delegate, territory delegates/commissioners
	delegate_type?: 'delegate' | 'resident_commissioner'; // Type of non-voting member
	term_end?: string; // ISO date string for when current term ends
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
	senate: Representative[]; // Always 2 senators per state (empty for DC/territories)
	district: CongressionalDistrict;
	special_status?: {
		type: 'dc' | 'territory';
		message: string;
		has_senators: boolean;
		has_voting_representative: boolean;
	};
}

/**
 * Fallback data for DC and territory delegates
 * Updated as of 119th Congress (2025-2027)
 * Source: https://www.house.gov/representatives
 */
const DELEGATE_FALLBACK_DATA: Record<string, Representative> = {
	DC: {
		bioguide_id: 'N000147',
		name: 'Eleanor Holmes Norton',
		party: 'Democratic',
		state: 'DC',
		district: '00',
		chamber: 'house',
		office_code: 'N000147',
		is_voting_member: false,
		delegate_type: 'delegate',
		term_end: '2027-01-03' // 119th Congress ends
	},
	PR: {
		bioguide_id: 'G000619',
		name: 'Pablo José Hernández Rivera',
		party: 'New Progressive',
		state: 'PR',
		district: '00',
		chamber: 'house',
		office_code: 'G000619',
		is_voting_member: false,
		delegate_type: 'resident_commissioner',
		term_end: '2029-01-03' // 4-year term ending in 2029
	},
	VI: {
		bioguide_id: 'P000620',
		name: 'Stacey Plaskett',
		party: 'Democratic',
		state: 'VI',
		district: '00',
		chamber: 'house',
		office_code: 'P000620',
		is_voting_member: false,
		delegate_type: 'delegate',
		term_end: '2027-01-03'
	},
	GU: {
		bioguide_id: 'M001160',
		name: 'James Moylan',
		party: 'Republican',
		state: 'GU',
		district: '00',
		chamber: 'house',
		office_code: 'M001160',
		is_voting_member: false,
		delegate_type: 'delegate',
		term_end: '2027-01-03'
	},
	AS: {
		bioguide_id: 'R000600',
		name: 'Aumua Amata Coleman Radewagen',
		party: 'Republican',
		state: 'AS',
		district: '00',
		chamber: 'house',
		office_code: 'R000600',
		is_voting_member: false,
		delegate_type: 'delegate',
		term_end: '2027-01-03'
	},
	MP: {
		bioguide_id: 'S001177',
		name: 'Gregorio Kilili Camacho Sablan',
		party: 'Democratic',
		state: 'MP',
		district: '00',
		chamber: 'house',
		office_code: 'S001177',
		is_voting_member: false,
		delegate_type: 'delegate',
		term_end: '2027-01-03'
	}
};

/**
 * User-facing messages for DC and territory representation
 */
const SPECIAL_STATUS_MESSAGES = {
	DC: 'As a Washington, DC resident, you have a non-voting delegate in the House of Representatives who can introduce legislation and participate in committees, but cannot vote on final passage of bills. DC does not have representation in the Senate.',
	PR: 'As a Puerto Rico resident, you have a Resident Commissioner in the House of Representatives who serves a 4-year term. The Resident Commissioner can introduce legislation and participate in committees, but cannot vote on final passage of bills. Puerto Rico does not have representation in the Senate.',
	VI: 'As a U.S. Virgin Islands resident, you have a non-voting delegate in the House of Representatives who can introduce legislation and participate in committees, but cannot vote on final passage of bills. The territory does not have representation in the Senate.',
	GU: 'As a Guam resident, you have a non-voting delegate in the House of Representatives who can introduce legislation and participate in committees, but cannot vote on final passage of bills. Guam does not have representation in the Senate.',
	AS: 'As an American Samoa resident, you have a non-voting delegate in the House of Representatives who can introduce legislation and participate in committees, but cannot vote on final passage of bills. American Samoa does not have representation in the Senate.',
	MP: 'As a Northern Mariana Islands resident, you have a non-voting delegate in the House of Representatives who can introduce legislation and participate in committees, but cannot vote on final passage of bills. The territory does not have representation in the Senate.'
};

export class Address {
	// Getter for lazy evaluation - ensures env vars are read at call time
	// This is critical for test environments where env vars may be set after module import
	private get congressApiKey(): string {
		const key = getEnvVar('CONGRESS_API_KEY') || getEnvVar('CWC_API_KEY');
		// Only warn if we're in production and the key is missing
		if (!key && getEnvVar('NODE_ENV') === 'production') {
			console.warn(
				'CONGRESS_API_KEY environment variable is missing - Congress features will be disabled'
			);
		}
		return key;
	}

	private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
	private readonly MAX_RETRIES = 3;
	private readonly RETRY_DELAY = 1000; // 1 second

	/**
	 * Execute fetch with timeout and retry logic
	 */
	private async fetchWithTimeout(
		url: string,
		options: RequestInit = {},
		timeout: number = this.DEFAULT_TIMEOUT
	): Promise<Response> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		try {
			const response = await fetch(url, {
				...options,
				signal: controller.signal
			});
			clearTimeout(timeoutId);
			return response;
		} catch (error) {
			clearTimeout(timeoutId);
			if (error instanceof Error && error.name === 'AbortError') {
				const timeoutError = new Error(`Request timeout after ${timeout}ms: ${url}`);
				console.error('[Address Lookup] Timeout:', timeoutError.message);
				throw timeoutError;
			}
			throw error;
		}
	}

	/**
	 * Execute fetch with retry logic for transient failures
	 */
	private async fetchWithRetry(
		url: string,
		options: RequestInit = {},
		timeout: number = this.DEFAULT_TIMEOUT
	): Promise<Response> {
		let lastError: Error | null = null;

		for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
			try {
				const response = await this.fetchWithTimeout(url, options, timeout);

				// Don't retry on client errors (4xx except 429)
				if (response.status >= 400 && response.status < 500 && response.status !== 429) {
					return response;
				}

				// Retry on server errors (5xx) or rate limiting (429)
				if (response.status === 429 || response.status >= 500) {
					if (attempt < this.MAX_RETRIES - 1) {
						const delay = this.RETRY_DELAY * Math.pow(2, attempt);
						console.warn(
							`[Address Lookup] Request failed with status ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${this.MAX_RETRIES})`
						);
						await this.sleep(delay);
						continue;
					}
				}

				return response;
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));

				// Don't retry on timeout if it's the last attempt
				if (attempt === this.MAX_RETRIES - 1) {
					console.error(`[Address Lookup] Request failed after ${this.MAX_RETRIES} attempts:`, lastError.message);
					throw lastError;
				}

				// Exponential backoff for retries
				const delay = this.RETRY_DELAY * Math.pow(2, attempt);
				console.warn(
					`[Address Lookup] Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${this.MAX_RETRIES}): ${lastError.message}`
				);
				await this.sleep(delay);
			}
		}

		throw lastError || new Error('Request failed after retries');
	}

	/**
	 * Sleep utility for retry delays
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Check if state/territory is DC or a US territory without full representation
	 */
	private isDCOrTerritory(state: string): boolean {
		const territoryStates = ['DC', 'PR', 'VI', 'GU', 'AS', 'MP'];
		return territoryStates.includes(state.toUpperCase());
	}

	/**
	 * Main function: Address  → User's Representatives
	 * This is called during user onboarding
	 */
	async lookupRepsByAddress(address: AddressData): Promise<UserReps> {
		// Step 1: Address  → Congressional District
		const district = await this.addressToDistrict(address);

		// Step 2: Check if this is DC or a territory
		const isDCOrTerritory = this.isDCOrTerritory(district.state);

		if (isDCOrTerritory) {
			// DC and territories: delegate only, no senators
			const delegate = await this.getDelegate(district.state);
			const statusType = district.state === 'DC' ? 'dc' : 'territory';

			return {
				house: delegate,
				senate: [], // No senators for DC/territories
				district,
				special_status: {
					type: statusType,
					message: SPECIAL_STATUS_MESSAGES[district.state as keyof typeof SPECIAL_STATUS_MESSAGES] || '',
					has_senators: false,
					has_voting_representative: false
				}
			};
		}

		// Step 3: District → Representatives (normal states)
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

			const response = await this.fetchWithRetry(url);
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
	 * Get delegate for DC or US territory
	 * First tries to fetch from Congress API, falls back to hardcoded data
	 */
	private async getDelegate(state: string): Promise<Representative> {
		try {
			// Normalize state to handle both abbreviations and full names
			const { abbreviation: stateAbbr } = normalizeState(state);

			// Fetch all members with pagination
			const allMembers = await this.fetchAllMembers();

			// Find the delegate/commissioner for this territory
			// Delegates have district = undefined or 0 for their territory
			const delegate = allMembers.find((member: CongressMember) => {
				const stateMatches = member.state === stateAbbr;
				// For delegates, district is typically undefined
				const isDelegate = member.district === undefined || member.district === 0;
				return stateMatches && isDelegate;
			});

			if (delegate) {
				const rep = this.formatRepresentative(delegate, 'house');
				// Mark as non-voting delegate
				rep.is_voting_member = false;
				rep.delegate_type = stateAbbr === 'PR' ? 'resident_commissioner' : 'delegate';
				return rep;
			}

			// If not found in API, use fallback data
			console.warn(`Delegate not found in API for ${stateAbbr}, using fallback data`);
			return this.getDelegateFallback(stateAbbr);
		} catch (error) {
			console.error(`Error fetching delegate for ${state}:`, error);
			// Return fallback data
			return this.getDelegateFallback(state);
		}
	}

	/**
	 * Get fallback delegate data for DC/territories
	 */
	private getDelegateFallback(state: string): Representative {
		const { abbreviation: stateAbbr } = normalizeState(state);
		const fallback = DELEGATE_FALLBACK_DATA[stateAbbr];

		if (fallback) {
			return { ...fallback }; // Return copy to prevent mutation
		}

		// Ultimate fallback for unknown territory
		return {
			bioguide_id: `${stateAbbr}D00`,
			name: `Delegate for ${stateAbbr}`,
			party: 'Unknown',
			state: stateAbbr,
			district: '00',
			chamber: 'house',
			office_code: `${stateAbbr}D00`,
			is_voting_member: false,
			delegate_type: 'delegate'
		};
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
	 * Find the current/active term for a member
	 * The current term is the one without an endYear or with the most recent startYear
	 */
	private getCurrentTerm(member: CongressMember): CongressMemberTerm | undefined {
		const termsArray = Array.isArray(member.terms) ? member.terms : member.terms?.item;
		if (!termsArray || termsArray.length === 0) return undefined;

		// Find term without endYear (current) or with highest startYear
		return termsArray.reduce(
			(current: CongressMemberTerm | undefined, term: CongressMemberTerm) => {
				// Prefer terms without endYear (still serving)
				if (!term.endYear) return term;
				// Otherwise use term with highest startYear
				if (
					!current ||
					(term.startYear && (!current.startYear || term.startYear > current.startYear))
				) {
					return term;
				}
				return current;
			},
			undefined
		);
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
					const currentTerm = this.getCurrentTerm(member);
					// Only match if current term chamber is explicitly 'Senate'
					const isSenator = currentTerm?.chamber === 'Senate';
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
			const response = await this.fetchWithRetry(url, {
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
		// Use current term (not just first term) for accurate data
		const currentTerm = this.getCurrentTerm(member) || {};

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

		// Normalize state to abbreviation for consistent output
		const rawState = member.state || currentTerm?.state || '';
		const { abbreviation: normalizedState } = normalizeState(rawState);

		// Detect if this is a non-voting delegate (DC or territories)
		const isTerritory = this.isDCOrTerritory(normalizedState);
		const isDelegate = isTerritory && chamber === 'house';

		return {
			bioguide_id: bioguideId,
			name: formattedName,
			party: member.partyName || currentTerm?.party || 'Unknown',
			state: normalizedState || rawState,
			district: chamber === 'senate' ? '00' : String(member.district || '01').padStart(2, '0'),
			chamber,
			office_code: bioguideId,
			is_voting_member: isDelegate ? false : true,
			delegate_type: isDelegate ? (normalizedState === 'PR' ? 'resident_commissioner' : 'delegate') : undefined
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

				const response = await this.fetchWithRetry(url);

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
export async function getRepresentativesForAddress(
	address: AddressData
): Promise<Representative[]> {
	try {
		const userReps = await addressLookupService.lookupRepsByAddress(address);
		return [userReps.house, ...userReps.senate];
	} catch (error) {
		console.error('Error getting representatives for address:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		throw new Error(`Failed to get representatives: ${errorMessage}`);
	}
}
