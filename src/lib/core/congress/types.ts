/**
 * Type Adapter for CWC (Communicating With Congress) Integration
 *
 * This module bridges the type mismatch between:
 * - address-lookup.ts: Returns representatives with snake_case fields
 * - cwc-client.ts: Expects CongressionalOffice with camelCase fields
 *
 * CRITICAL: The address-lookup module returns `office_code` set to `bioguideId`,
 * which is WRONG for CWC submissions. The CWC API requires properly formatted
 * office codes:
 * - House: H{STATE}{DISTRICT} (e.g., HCA13 for CA-13)
 * - Senate: S{STATE}{01-03} (e.g., SCA01 for CA senator)
 *
 * This adapter uses CWCGenerator.generateOfficeCode() to create the correct format.
 *
 * @see MULTI-TARGET-MVP-IMPLEMENTATION.md (Phase 0, Fix 0.1)
 */

import { CWCGenerator } from './cwc-generator';

/**
 * Representative data structure returned by address-lookup.ts
 *
 * Uses snake_case field names as returned by the Congress.gov API
 * and our address lookup service.
 */
export interface Representative {
	/** Bioguide identifier (e.g., "P000197" for Pelosi) */
	bioguide_id: string;

	/** Full name (e.g., "Nancy Pelosi") */
	name: string;

	/** Political party (e.g., "Democratic", "Republican") */
	party: string;

	/** Two-letter state abbreviation (e.g., "CA") */
	state: string;

	/** Congressional district number, zero-padded (e.g., "11", "00" for at-large/senate) */
	district: string;

	/** Legislative chamber */
	chamber: 'house' | 'senate';

	/**
	 * Office code for CWC submissions.
	 *
	 * WARNING: address-lookup.ts currently sets this to bioguide_id (WRONG).
	 * The toCongressionalOffice() function regenerates this correctly using
	 * CWCGenerator.generateOfficeCode().
	 */
	office_code: string;

	/** Whether this member has voting privileges (false for DC/territory delegates) */
	is_voting_member?: boolean;

	/** Type of non-voting member, if applicable */
	delegate_type?: 'delegate' | 'resident_commissioner';

	/** ISO date string for when current term ends */
	term_end?: string;
}

/**
 * CongressionalOffice data structure expected by cwc-client.ts
 *
 * Uses camelCase field names as expected by the CWC client
 * and XML generation code.
 */
export interface CongressionalOffice {
	/** Bioguide identifier (e.g., "P000197" for Pelosi) */
	bioguideId: string;

	/** Full name (e.g., "Nancy Pelosi") */
	name: string;

	/** Political party (e.g., "Democratic", "Republican") */
	party: string;

	/** Two-letter state abbreviation (e.g., "CA") */
	state: string;

	/** Congressional district number, zero-padded (e.g., "11", "00" for at-large/senate) */
	district: string;

	/** Legislative chamber */
	chamber: 'house' | 'senate';

	/**
	 * Properly formatted office code for CWC API.
	 *
	 * Format:
	 * - House: H{STATE}{DISTRICT} (e.g., "HCA13" for CA-13)
	 * - Senate: S{STATE}{01-03} (e.g., "SCA01" for CA senator)
	 */
	officeCode: string;
}

/**
 * Convert a Representative (snake_case) to a CongressionalOffice (camelCase)
 * with properly generated office code.
 *
 * This function:
 * 1. Converts field names from snake_case to camelCase
 * 2. Generates the correct CWC office code using CWCGenerator.generateOfficeCode()
 *
 * @param rep - Representative data from address-lookup.ts
 * @returns CongressionalOffice data suitable for cwc-client.ts
 *
 * @example
 * ```typescript
 * const rep = await getRepresentativesForAddress(address);
 * const office = toCongressionalOffice(rep[0]);
 * // office.officeCode will be "HCA13" instead of "P000197"
 * ```
 */
export function toCongressionalOffice(rep: Representative): CongressionalOffice {
	// Create the intermediate format expected by CWCGenerator.generateOfficeCode()
	// This matches the UserRepresentative interface in cwc-generator.ts
	const repForCodeGen = {
		bioguideId: rep.bioguide_id,
		name: rep.name,
		party: rep.party,
		state: rep.state,
		district: rep.district,
		chamber: rep.chamber,
		officeCode: '' // Will be generated - this field is not used for generation
	};

	return {
		bioguideId: rep.bioguide_id,
		name: rep.name,
		party: rep.party,
		state: rep.state,
		district: rep.district,
		chamber: rep.chamber,
		officeCode: CWCGenerator.generateOfficeCode(repForCodeGen)
	};
}

/**
 * Convert an array of Representatives to CongressionalOffices.
 *
 * Batch converter for processing all of a user's representatives
 * from address lookup into the format expected by the CWC client.
 *
 * @param reps - Array of Representative data from address-lookup.ts
 * @returns Array of CongressionalOffice data suitable for cwc-client.ts
 *
 * @example
 * ```typescript
 * const rawReps = await getRepresentativesForAddress(address);
 * const offices = toCongressionalOffices(rawReps);
 * await cwcClient.submitToAllRepresentatives(template, user, offices, message);
 * ```
 */
export function toCongressionalOffices(reps: Representative[]): CongressionalOffice[] {
	return reps.map(toCongressionalOffice);
}
