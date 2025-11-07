/**
 * Census Data Integration Types
 *
 * Types for integrating with US Census Bureau API and caching population data.
 */

export interface CensusPopulationResponse {
	fipsCode: string;
	name: string;
	population: number;
	year: number;
	state?: string;
	county?: string;
}

export interface CensusApiResponse {
	data: (string | number)[][];
	headers: string[];
}

export interface CensusError {
	code: string;
	message: string;
	details?: string;
}

export interface FipsLookupOptions {
	useCache?: boolean;
	year?: number; // Default: 2020 (most recent decennial census)
}

export interface DistrictLookupResult {
	district: string; // "TX-18"
	state: string; // "TX"
	stateName: string; // "Texas"
	representative?: {
		name: string;
		party: string;
		bioguideId?: string;
		office?: string;
		phone?: string;
		email?: string;
	};
	population?: number;
	seats?: number; // Number of House seats for the state
}
