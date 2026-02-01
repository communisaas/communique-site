/**
 * Type definitions for Vote UI Components
 *
 * These types complement the backend types from $lib/server/congress/votes
 * and provide component-specific interfaces for UI consumption.
 */

/**
 * Vote position type
 */
export type VotePosition = 'yea' | 'nay' | 'not_voting' | 'present';

/**
 * Vote result type
 */
export type VoteResult = 'passed' | 'failed';

/**
 * Party affiliation type
 */
export type PartyAffiliation = 'D' | 'R' | 'I';

/**
 * Party breakdown for VoteContext component
 */
export interface PartyBreakdown {
	democratic: {
		yea: number;
		nay: number;
	};
	republican: {
		yea: number;
		nay: number;
	};
}

/**
 * Vote record for L2 VoteContext component
 *
 * Maps backend VoteWithDisclosure to UI-friendly structure with party breakdown
 */
export interface VoteRecord {
	/** Bill number (e.g., "H.R. 1234") */
	billNumber: string;
	/** Short title of the bill */
	billTitle: string;
	/** Date of the vote */
	voteDate: Date;
	/** Member's vote position */
	position: VotePosition;
	/** Outcome of the vote */
	result: VoteResult;
	/** Party-level vote breakdown */
	partyBreakdown: PartyBreakdown;
	/** L1 summary from backend */
	summary: string;
}

/**
 * Member information for roll call
 */
export interface RollCallMember {
	/** Full name of the member */
	name: string;
	/** Party affiliation */
	party: PartyAffiliation;
	/** State (2-letter code) */
	state: string;
	/** District number (House only) */
	district?: string;
}

/**
 * Individual member vote for RollCall component
 */
export interface RollCallVote {
	/** Member information */
	member: RollCallMember;
	/** Member's vote position */
	position: VotePosition;
}

/**
 * Helper type for VoteIndicator sizes
 */
export type VoteIndicatorSize = 'sm' | 'md';

/**
 * Helper type for sort direction in RollCall
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Helper type for sortable columns in RollCall
 */
export type SortableColumn = 'name' | 'party' | 'state';

/**
 * Helper type for party filters
 */
export type PartyFilter = 'all' | 'D' | 'R' | 'I';

/**
 * Helper type for position filters
 */
export type PositionFilter = 'all' | VotePosition;
