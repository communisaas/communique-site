/**
 * Congress.gov Vote History API
 *
 * Provides vote history for representatives with progressive disclosure:
 * - L1: Vote stance (yea/nay)
 * - L2: Context (bill title, result)
 * - L3: Full roll call details
 *
 * Flow: Address -> District -> Representative -> Votes
 *
 * API Endpoints Used:
 * - /member/{bioguideId} - Get member details
 * - /member/{stateCode} - Get members by state
 * - /house-vote/{congress}/{session} - List House roll call votes
 * - /house-vote/{congress}/{session}/{voteNumber} - Get specific vote details
 * - /house-vote/{congress}/{session}/{voteNumber}/members - Get member votes
 *
 * Note: Senate vote endpoints are still in development (as of Jan 2025).
 *
 * Rate Limits: 5,000 requests per hour (with API key)
 *
 * Phase 2E Implementation
 *
 * @module congress/votes
 */

import { createHash } from 'crypto';
import type { Collection, ObjectId } from 'mongodb';
import { getDatabase } from '../mongodb';
import { COLLECTIONS } from '../mongodb/schema';
import { getCurrentCongress, getRateLimitStatus } from './client';

// ============================================================================
// Configuration
// ============================================================================

const CONGRESS_API_BASE = 'https://api.congress.gov/v3';
const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;

/** Cache TTL for member data (24 hours) */
const MEMBER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Cache TTL for vote history (1 hour - votes update frequently during sessions) */
const VOTE_CACHE_TTL_MS = 60 * 60 * 1000;

/** Default number of votes to fetch */
const DEFAULT_VOTE_LIMIT = 50;

/** Maximum votes per request */
const MAX_VOTES_PER_REQUEST = 250;

/** Collection name for member vote cache */
export const MEMBER_VOTES_COLLECTION = 'member_votes';

/** Collection name for member cache */
export const MEMBERS_COLLECTION = 'congress_members';

// Rate limiting (shared with client.ts)
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;
const DEFAULT_TIMEOUT = 30000;

// ============================================================================
// Types - Public API
// ============================================================================

/**
 * Individual vote record
 */
export interface Vote {
	/** Roll call identifier (e.g., "118-H-123") */
	rollCallId: string;
	/** Bill ID in format congress-type-number (e.g., "118-hr-1234") */
	billId: string;
	/** Short title of the bill */
	billTitle: string;
	/** Date of the vote */
	date: Date;
	/** Member's vote position */
	vote: 'yea' | 'nay' | 'not_voting' | 'present';
	/** Outcome of the vote */
	result: 'passed' | 'failed';
	/** Chamber where vote occurred */
	chamber: 'house' | 'senate';
	/** Vote question (e.g., "On Passage", "On Motion to Recommit") */
	question?: string;
	/** Vote description/context */
	description?: string;
}

/**
 * Vote with progressive disclosure levels
 */
export interface VoteWithDisclosure extends Vote {
	/** L1: One-line stance summary */
	l1Summary: string;
	/** L2: Context with bill info and result */
	l2Summary?: string;
	/** L3: Full roll call reference ID */
	l3RollCallUrl?: string;
}

/**
 * Member (representative) information
 */
export interface Member {
	/** Bioguide ID (unique identifier) */
	bioguideId: string;
	/** Full name */
	name: string;
	/** Party affiliation */
	party: 'D' | 'R' | 'I' | string;
	/** State (2-letter code) */
	state: string;
	/** District number (for House members) */
	district?: number;
	/** Chamber */
	chamber: 'house' | 'senate';
	/** Official website */
	website?: string;
	/** Photo URL */
	photoUrl?: string;
	/** Office address */
	officeAddress?: string;
	/** Phone number */
	phone?: string;
	/** Terms served */
	terms?: MemberTerm[];
}

/**
 * Member term information
 */
export interface MemberTerm {
	/** Congress number */
	congress: number;
	/** Chamber for this term */
	chamber: 'house' | 'senate';
	/** Start date */
	startYear: number;
	/** End date */
	endYear?: number;
	/** State */
	state: string;
	/** District (for House) */
	district?: number;
}

/**
 * Complete vote history for a member
 */
export interface MemberVoteHistory {
	/** Bioguide ID */
	memberId: string;
	/** Member's full name */
	memberName: string;
	/** Party affiliation */
	party: string;
	/** State */
	state: string;
	/** District (for House members) */
	district?: number;
	/** Chamber */
	chamber: 'house' | 'senate';
	/** List of votes */
	votes: VoteWithDisclosure[];
	/** Vote statistics */
	voteStats: VoteStats;
	/** When this data was last updated */
	lastUpdated: Date;
}

/**
 * Vote statistics summary
 */
export interface VoteStats {
	/** Total votes recorded */
	totalVotes: number;
	/** Yea votes */
	yeas: number;
	/** Nay votes */
	nays: number;
	/** Not voting instances */
	notVoting: number;
	/** Present votes */
	present: number;
	/** Participation rate (percentage) */
	participationRate: number;
	/** Party loyalty rate (percentage, if calculable) */
	partyLoyaltyRate?: number;
}

/**
 * Options for fetching vote history
 */
export interface VoteHistoryOptions {
	/** Congress number (defaults to current) */
	congress?: number;
	/** Maximum number of votes to fetch */
	limit?: number;
	/** Offset for pagination */
	offset?: number;
	/** Filter to specific bill type */
	billType?: 'hr' | 's' | 'hjres' | 'sjres';
	/** Only include votes after this date */
	fromDate?: Date;
	/** Only include votes before this date */
	toDate?: Date;
}

// ============================================================================
// MongoDB Document Types
// ============================================================================

/**
 * MongoDB document for cached member data
 */
export interface MemberDocument {
	_id?: ObjectId;
	/** Bioguide ID */
	bioguideId: string;
	/** Hash for deduplication */
	bioguideIdHash: string;
	/** Full member data */
	member: Member;
	/** Congress number */
	congress: number;
	/** Cache metadata */
	createdAt: Date;
	updatedAt: Date;
	expiresAt: Date;
}

/**
 * MongoDB document for cached vote history
 */
export interface MemberVoteHistoryDocument {
	_id?: ObjectId;
	/** Compound key: bioguideId-congress */
	cacheKey: string;
	/** Hash for deduplication */
	cacheKeyHash: string;
	/** Member ID */
	bioguideId: string;
	/** Congress number */
	congress: number;
	/** Vote history data */
	voteHistory: MemberVoteHistory;
	/** Number of votes cached */
	voteCount: number;
	/** Cache metadata */
	createdAt: Date;
	updatedAt: Date;
	expiresAt: Date;
}

// ============================================================================
// Internal Types (API Response)
// ============================================================================

interface CongressApiMember {
	bioguideId: string;
	name: string;
	firstName?: string;
	lastName?: string;
	directOrderName?: string;
	invertedOrderName?: string;
	partyName?: string;
	party?: string;
	state: string;
	district?: number;
	terms?: {
		item: Array<{
			chamber: string;
			congress: number;
			startYear: number;
			endYear?: number;
			memberType?: string;
			stateCode?: string;
			stateName?: string;
			district?: number;
		}>;
	};
	officialWebsiteUrl?: string;
	depiction?: {
		imageUrl?: string;
	};
	addressInformation?: {
		officeAddress?: string;
		phoneNumber?: string;
	};
}

interface CongressApiVote {
	rollNumber: number;
	congress: number;
	session: number;
	chamber: string;
	date: string;
	question?: string;
	description?: string;
	result?: string;
	bill?: {
		number: number;
		type: string;
		title?: string;
		url?: string;
	};
	memberVotes?: Array<{
		member: {
			bioguideId: string;
			name: string;
		};
		vote: string;
	}>;
}

interface CongressApiMemberVote {
	rollNumber: number;
	congress: number;
	session: number;
	chamber: string;
	date: string;
	question?: string;
	description?: string;
	result?: string;
	vote?: string;
	bill?: {
		number: number;
		type: string;
		congress: number;
		title?: string;
	};
}

// ============================================================================
// MongoDB Collection Access
// ============================================================================

let membersCollection: Collection<MemberDocument> | null = null;
let voteHistoryCollection: Collection<MemberVoteHistoryDocument> | null = null;

/**
 * Get the members collection
 */
async function getMembersCollection(): Promise<Collection<MemberDocument>> {
	if (membersCollection) return membersCollection;

	const db = await getDatabase();
	membersCollection = db.collection<MemberDocument>(MEMBERS_COLLECTION);

	// Ensure indexes
	await ensureMemberIndexes(membersCollection);

	return membersCollection;
}

/**
 * Get the vote history collection
 */
async function getVoteHistoryCollection(): Promise<Collection<MemberVoteHistoryDocument>> {
	if (voteHistoryCollection) return voteHistoryCollection;

	const db = await getDatabase();
	voteHistoryCollection = db.collection<MemberVoteHistoryDocument>(MEMBER_VOTES_COLLECTION);

	// Ensure indexes
	await ensureVoteHistoryIndexes(voteHistoryCollection);

	return voteHistoryCollection;
}

/**
 * Ensure indexes on members collection
 */
async function ensureMemberIndexes(collection: Collection<MemberDocument>): Promise<void> {
	try {
		await collection.createIndex({ bioguideIdHash: 1 }, { unique: true });
		await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
		await collection.createIndex({ 'member.state': 1, 'member.district': 1 });
		await collection.createIndex({ congress: 1 });
		console.log('[Congress Votes] Indexes ensured on members collection');
	} catch (error) {
		// Index creation errors are usually fine (already exists)
		console.log('[Congress Votes] Member index creation note:', error);
	}
}

/**
 * Ensure indexes on vote history collection
 */
async function ensureVoteHistoryIndexes(
	collection: Collection<MemberVoteHistoryDocument>
): Promise<void> {
	try {
		await collection.createIndex({ cacheKeyHash: 1 }, { unique: true });
		await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
		await collection.createIndex({ bioguideId: 1, congress: 1 });
		await collection.createIndex({ updatedAt: -1 });
		console.log('[Congress Votes] Indexes ensured on vote history collection');
	} catch (error) {
		console.log('[Congress Votes] Vote history index creation note:', error);
	}
}

// ============================================================================
// API Request Helper
// ============================================================================

/**
 * Make a request to Congress.gov API with retry logic
 */
async function congressVoteRequest<T>(endpoint: string, retryCount = 0): Promise<T> {
	if (!CONGRESS_API_KEY) {
		throw new Error(
			'CONGRESS_API_KEY environment variable is not set. ' +
				'Get your API key at https://api.congress.gov/sign-up/'
		);
	}

	const url = new URL(`${CONGRESS_API_BASE}${endpoint}`);
	url.searchParams.set('api_key', CONGRESS_API_KEY);
	url.searchParams.set('format', 'json');

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

		const response = await fetch(url.toString(), {
			method: 'GET',
			headers: {
				Accept: 'application/json'
			},
			signal: controller.signal
		});

		clearTimeout(timeoutId);

		// Handle rate limiting
		if (response.status === 429) {
			const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
			const delay = Math.min(retryAfter * 1000, 120000);

			if (retryCount < MAX_RETRIES) {
				console.warn(
					`[Congress Votes] Rate limited, retrying after ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`
				);
				await new Promise((resolve) => setTimeout(resolve, delay));
				return congressVoteRequest<T>(endpoint, retryCount + 1);
			}

			throw new Error(`Rate limited after ${MAX_RETRIES} retries`);
		}

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Congress API error (${response.status}): ${errorText}`);
		}

		return (await response.json()) as T;
	} catch (error) {
		if (retryCount < MAX_RETRIES && error instanceof Error) {
			const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);

			console.warn(
				`[Congress Votes] Request failed, retrying after ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES}):`,
				error.message
			);

			await new Promise((resolve) => setTimeout(resolve, delay));
			return congressVoteRequest<T>(endpoint, retryCount + 1);
		}

		throw error;
	}
}

// ============================================================================
// Member Functions
// ============================================================================

/**
 * Get a member by their bioguide ID
 *
 * @param bioguideId - Member's bioguide ID
 * @returns Member information
 */
export async function getMember(bioguideId: string): Promise<Member | null> {
	// Check cache first
	const collection = await getMembersCollection();
	const bioguideIdHash = createHash('sha256').update(bioguideId).digest('hex');

	const cached = await collection.findOne({
		bioguideIdHash,
		expiresAt: { $gt: new Date() }
	});

	if (cached) {
		console.log(`[Congress Votes] Cache hit for member ${bioguideId}`);
		return cached.member;
	}

	// Fetch from API
	console.log(`[Congress Votes] Fetching member ${bioguideId} from API`);

	try {
		const response = await congressVoteRequest<{ member: CongressApiMember }>(
			`/member/${bioguideId}`
		);

		if (!response.member) {
			return null;
		}

		const member = transformMember(response.member);

		// Cache the result
		const now = new Date();
		await collection.updateOne(
			{ bioguideIdHash },
			{
				$set: {
					bioguideId,
					bioguideIdHash,
					member,
					congress: getCurrentCongress(),
					updatedAt: now,
					expiresAt: new Date(now.getTime() + MEMBER_CACHE_TTL_MS)
				},
				$setOnInsert: {
					createdAt: now
				}
			},
			{ upsert: true }
		);

		return member;
	} catch (error) {
		console.error(`[Congress Votes] Failed to fetch member ${bioguideId}:`, error);
		return null;
	}
}

/**
 * Get House member by state and district
 *
 * @param state - Two-letter state code
 * @param district - District number
 * @returns Member representing that district
 *
 * @example
 * const rep = await getMemberByDistrict('CA', 12);
 */
export async function getMemberByDistrict(state: string, district: number): Promise<Member | null> {
	const stateUpper = state.toUpperCase();
	const congress = getCurrentCongress();

	// Check cache first
	const collection = await getMembersCollection();
	const cached = await collection.findOne({
		'member.state': stateUpper,
		'member.district': district,
		'member.chamber': 'house',
		congress,
		expiresAt: { $gt: new Date() }
	});

	if (cached) {
		console.log(`[Congress Votes] Cache hit for ${stateUpper}-${district}`);
		return cached.member;
	}

	// Fetch from API - get current House members for state
	console.log(`[Congress Votes] Fetching House member for ${stateUpper}-${district}`);

	try {
		const response = await congressVoteRequest<{ members: CongressApiMember[] }>(
			`/member/${stateUpper}?currentMember=true&limit=250`
		);

		if (!response.members || response.members.length === 0) {
			console.warn(`[Congress Votes] No members found for state ${stateUpper}`);
			return null;
		}

		// Find the member with matching district
		const apiMember = response.members.find((m) => {
			// Check current term for district
			const currentTerm = m.terms?.item?.find(
				(t) => t.chamber?.toLowerCase() === 'house of representatives' && t.district === district
			);
			return currentTerm !== undefined;
		});

		if (!apiMember) {
			console.warn(`[Congress Votes] No House member found for ${stateUpper}-${district}`);
			return null;
		}

		const member = transformMember(apiMember);
		member.district = district;
		member.chamber = 'house';

		// Cache the result
		const now = new Date();
		const bioguideIdHash = createHash('sha256').update(member.bioguideId).digest('hex');

		await collection.updateOne(
			{ bioguideIdHash },
			{
				$set: {
					bioguideId: member.bioguideId,
					bioguideIdHash,
					member,
					congress,
					updatedAt: now,
					expiresAt: new Date(now.getTime() + MEMBER_CACHE_TTL_MS)
				},
				$setOnInsert: {
					createdAt: now
				}
			},
			{ upsert: true }
		);

		return member;
	} catch (error) {
		console.error(`[Congress Votes] Failed to fetch member for ${stateUpper}-${district}:`, error);
		return null;
	}
}

/**
 * Get senators for a state
 *
 * @param state - Two-letter state code
 * @returns Array of senators (typically 2)
 */
export async function getSenatorsByState(state: string): Promise<Member[]> {
	const stateUpper = state.toUpperCase();
	const congress = getCurrentCongress();

	// Check cache first
	const collection = await getMembersCollection();
	const cached = await collection
		.find({
			'member.state': stateUpper,
			'member.chamber': 'senate',
			congress,
			expiresAt: { $gt: new Date() }
		})
		.toArray();

	if (cached.length >= 2) {
		console.log(`[Congress Votes] Cache hit for ${stateUpper} senators`);
		return cached.map((c) => c.member);
	}

	// Fetch from API
	console.log(`[Congress Votes] Fetching senators for ${stateUpper}`);

	try {
		const response = await congressVoteRequest<{ members: CongressApiMember[] }>(
			`/member/${stateUpper}?currentMember=true&limit=250`
		);

		if (!response.members) {
			return [];
		}

		// Filter to current senators
		const senators = response.members
			.filter((m) => {
				const currentTerm = m.terms?.item?.find(
					(t) => t.chamber?.toLowerCase() === 'senate' && (!t.endYear || t.endYear >= new Date().getFullYear())
				);
				return currentTerm !== undefined;
			})
			.map((m) => {
				const member = transformMember(m);
				member.chamber = 'senate';
				return member;
			});

		// Cache the results
		const now = new Date();
		for (const member of senators) {
			const bioguideIdHash = createHash('sha256').update(member.bioguideId).digest('hex');

			await collection.updateOne(
				{ bioguideIdHash },
				{
					$set: {
						bioguideId: member.bioguideId,
						bioguideIdHash,
						member,
						congress,
						updatedAt: now,
						expiresAt: new Date(now.getTime() + MEMBER_CACHE_TTL_MS)
					},
					$setOnInsert: {
						createdAt: now
					}
				},
				{ upsert: true }
			);
		}

		return senators;
	} catch (error) {
		console.error(`[Congress Votes] Failed to fetch senators for ${stateUpper}:`, error);
		return [];
	}
}

// ============================================================================
// Vote History Functions
// ============================================================================

/**
 * Get vote history for a member
 *
 * Progressive disclosure:
 * - L1: Vote stance (yea/nay) with one-line summary
 * - L2: Bill title and result
 * - L3: Full roll call URL for detailed breakdown
 *
 * @param memberId - Member's bioguide ID
 * @param options - Query options
 * @returns Vote history with statistics
 *
 * @example
 * // Get recent votes for a representative
 * const history = await getMemberVoteHistory('A000370', { limit: 20 });
 *
 * // Get votes from specific Congress
 * const history = await getMemberVoteHistory('A000370', { congress: 117 });
 */
export async function getMemberVoteHistory(
	memberId: string,
	options: VoteHistoryOptions = {}
): Promise<MemberVoteHistory | null> {
	const { congress = getCurrentCongress(), limit = DEFAULT_VOTE_LIMIT, offset = 0 } = options;

	const cacheKey = `${memberId}-${congress}`;
	const cacheKeyHash = createHash('sha256').update(cacheKey).digest('hex');

	// Check cache first
	const collection = await getVoteHistoryCollection();
	const cached = await collection.findOne({
		cacheKeyHash,
		expiresAt: { $gt: new Date() }
	});

	if (cached && cached.voteCount >= limit) {
		console.log(`[Congress Votes] Cache hit for ${memberId} votes`);

		// Apply pagination to cached results
		const paginatedVotes = cached.voteHistory.votes.slice(offset, offset + limit);

		return {
			...cached.voteHistory,
			votes: paginatedVotes
		};
	}

	// Get member info first
	const member = await getMember(memberId);
	if (!member) {
		console.warn(`[Congress Votes] Member ${memberId} not found`);
		return null;
	}

	// Fetch votes from API
	// Note: Congress.gov API doesn't have a direct /member/{id}/votes endpoint.
	// We fetch recent House/Senate roll call votes and filter for this member.
	console.log(`[Congress Votes] Fetching votes for ${memberId} (Congress ${congress})`);

	try {
		// Determine current session (1 for odd years, 2 for even years)
		const currentYear = new Date().getFullYear();
		const session = currentYear % 2 === 1 ? 1 : 2;

		// Fetch roll call votes from the appropriate chamber
		// House votes endpoint: /house-vote/{congress}/{session}
		// Note: Senate votes endpoint is still in development
		const chamberEndpoint = member.chamber === 'house' ? 'house-vote' : 'house-vote'; // Senate not yet available

		const votesResponse = await congressVoteRequest<{
			votes?: Array<{
				rollNumber: number;
				congress: number;
				session: number;
				date: string;
				result?: string;
				question?: string;
				description?: string;
				bill?: {
					number: number;
					type: string;
					title?: string;
				};
				url?: string;
			}>;
		}>(`/${chamberEndpoint}/${congress}/${session}?limit=${Math.min(limit + offset, MAX_VOTES_PER_REQUEST)}&offset=0`);

		if (!votesResponse.votes || votesResponse.votes.length === 0) {
			return createEmptyVoteHistory(member);
		}

		// For each roll call, fetch member-specific vote
		const memberVotes: CongressApiMemberVote[] = [];

		for (const vote of votesResponse.votes.slice(0, Math.min(limit + offset, 50))) {
			try {
				// Fetch member votes for this roll call
				const memberVoteResponse = await congressVoteRequest<{
					members?: Array<{
						bioguideId: string;
						name: string;
						vote: string;
						party: string;
						state: string;
					}>;
				}>(`/${chamberEndpoint}/${congress}/${session}/${vote.rollNumber}/members`);

				// Find this member's vote
				const memberVote = memberVoteResponse.members?.find(
					m => m.bioguideId.toUpperCase() === memberId.toUpperCase()
				);

				if (memberVote) {
					memberVotes.push({
						rollNumber: vote.rollNumber,
						congress: vote.congress,
						session: vote.session,
						chamber: member.chamber === 'house' ? 'House' : 'Senate',
						date: vote.date,
						question: vote.question,
						description: vote.description,
						result: vote.result,
						vote: memberVote.vote,
						bill: vote.bill ? {
							...vote.bill,
							congress: vote.congress
						} : undefined
					});
				}
			} catch (memberVoteError) {
				// Skip this vote if we can't fetch member details
				console.warn(`[Congress Votes] Couldn't fetch member vote for roll ${vote.rollNumber}:`, memberVoteError);
			}
		}

		if (memberVotes.length === 0) {
			return createEmptyVoteHistory(member);
		}

		// Use the fetched member votes
		const votesData = memberVotes;

		// Transform votes with progressive disclosure
		const votes: VoteWithDisclosure[] = votesData.map((v) =>
			transformVoteWithDisclosure(v, congress)
		);

		// Calculate statistics
		const voteStats = calculateVoteStats(votes);

		const voteHistory: MemberVoteHistory = {
			memberId: member.bioguideId,
			memberName: member.name,
			party: member.party,
			state: member.state,
			district: member.district,
			chamber: member.chamber,
			votes,
			voteStats,
			lastUpdated: new Date()
		};

		// Cache the result
		const now = new Date();
		await collection.updateOne(
			{ cacheKeyHash },
			{
				$set: {
					cacheKey,
					cacheKeyHash,
					bioguideId: memberId,
					congress,
					voteHistory,
					voteCount: votes.length,
					updatedAt: now,
					expiresAt: new Date(now.getTime() + VOTE_CACHE_TTL_MS)
				},
				$setOnInsert: {
					createdAt: now
				}
			},
			{ upsert: true }
		);

		// Return paginated results
		return {
			...voteHistory,
			votes: votes.slice(offset, offset + limit)
		};
	} catch (error) {
		console.error(`[Congress Votes] Failed to fetch votes for ${memberId}:`, error);
		return null;
	}
}

/**
 * Get all votes cast on a specific bill
 *
 * @param billId - Bill ID in format "congress-type-number" (e.g., "118-hr-1234")
 * @returns Array of votes on that bill
 *
 * @example
 * const votes = await getVotesOnBill('118-hr-1');
 */
export async function getVotesOnBill(billId: string): Promise<Vote[]> {
	// Parse bill ID
	const match = billId.match(/^(\d+)-([a-z]+)-(\d+)$/i);
	if (!match) {
		throw new Error(`Invalid bill ID format: ${billId}. Expected format: "118-hr-1234"`);
	}

	const [, congressStr, type, number] = match;
	const congress = parseInt(congressStr, 10);

	console.log(`[Congress Votes] Fetching votes for bill ${billId}`);

	try {
		// Get bill actions to find roll call votes
		const billResponse = await congressVoteRequest<{
			bill: {
				actions?: {
					item: Array<{
						actionDate: string;
						text: string;
						recordedVotes?: Array<{
							rollNumber: number;
							chamber: string;
							congress: number;
							session: number;
							url: string;
						}>;
					}>;
				};
			};
		}>(`/bill/${congress}/${type}/${number}?limit=1`);

		if (!billResponse.bill?.actions?.item) {
			return [];
		}

		const votes: Vote[] = [];

		// Extract recorded votes from actions
		for (const action of billResponse.bill.actions.item) {
			if (action.recordedVotes) {
				for (const rv of action.recordedVotes) {
					// Fetch full roll call details
					const rollCallVote = await fetchRollCallVote(
						rv.congress,
						rv.chamber.toLowerCase() as 'house' | 'senate',
						rv.session,
						rv.rollNumber
					);

					if (rollCallVote) {
						votes.push(rollCallVote);
					}
				}
			}
		}

		return votes;
	} catch (error) {
		console.error(`[Congress Votes] Failed to fetch votes for bill ${billId}:`, error);
		return [];
	}
}

/**
 * Fetch a specific roll call vote
 *
 * Note: Congress.gov API v3 uses /house-vote/ endpoint for House roll calls.
 * Senate vote endpoint is still in development.
 */
async function fetchRollCallVote(
	congress: number,
	chamber: 'house' | 'senate',
	session: number,
	rollNumber: number
): Promise<Vote | null> {
	try {
		// House votes: /house-vote/{congress}/{session}/{voteNumber}
		// Senate votes: Not yet available in API (as of 2025)
		if (chamber === 'senate') {
			console.warn(`[Congress Votes] Senate vote API not yet available for roll call ${rollNumber}`);
			return null;
		}

		const response = await congressVoteRequest<{
			vote?: {
				rollNumber: number;
				congress: number;
				session: number;
				chamber: string;
				date: string;
				result?: string;
				question?: string;
				description?: string;
				bill?: {
					number: number;
					type: string;
					title?: string;
					congress: number;
				};
				totals?: {
					yea: number;
					nay: number;
					present: number;
					notVoting: number;
				};
			};
		}>(`/house-vote/${congress}/${session}/${rollNumber}`);

		if (!response.vote) {
			return null;
		}

		const vote = response.vote;
		return {
			rollCallId: `${congress}-H-${vote.rollNumber}`,
			billId: vote.bill
				? `${vote.bill.congress || congress}-${vote.bill.type?.toLowerCase() || 'hr'}-${vote.bill.number}`
				: `${congress}-unknown`,
			billTitle: vote.bill?.title || vote.description || 'Unknown Bill',
			date: new Date(vote.date),
			vote: 'yea', // This is a summary vote record
			result: normalizeResult(vote.result),
			chamber: 'house',
			question: vote.question,
			description: vote.description
		};
	} catch (error) {
		console.warn(
			`[Congress Votes] Failed to fetch roll call ${congress}-${chamber}-${session}-${rollNumber}:`,
			error
		);
		return null;
	}
}

// ============================================================================
// Transform Functions
// ============================================================================

/**
 * Transform API member to internal Member type
 */
function transformMember(apiMember: CongressApiMember): Member {
	const name =
		apiMember.directOrderName ||
		apiMember.name ||
		`${apiMember.firstName || ''} ${apiMember.lastName || ''}`.trim();

	// Determine chamber from most recent term
	const terms = apiMember.terms?.item || [];
	const currentTerm = terms.sort((a, b) => b.startYear - a.startYear)[0];
	const chamber: 'house' | 'senate' =
		currentTerm?.chamber?.toLowerCase().includes('senate') ? 'senate' : 'house';

	return {
		bioguideId: apiMember.bioguideId,
		name,
		party: normalizeParty(apiMember.partyName || apiMember.party),
		state: apiMember.state,
		district: apiMember.district || currentTerm?.district,
		chamber,
		website: apiMember.officialWebsiteUrl,
		photoUrl: apiMember.depiction?.imageUrl,
		officeAddress: apiMember.addressInformation?.officeAddress,
		phone: apiMember.addressInformation?.phoneNumber,
		terms: terms.map((t) => ({
			congress: t.congress,
			chamber: t.chamber?.toLowerCase().includes('senate') ? 'senate' : 'house',
			startYear: t.startYear,
			endYear: t.endYear,
			state: t.stateCode || t.stateName || apiMember.state,
			district: t.district
		}))
	};
}

/**
 * Normalize party name to abbreviation
 */
function normalizeParty(party?: string): 'D' | 'R' | 'I' | string {
	if (!party) return 'I';
	const partyLower = party.toLowerCase();
	if (partyLower.includes('democrat')) return 'D';
	if (partyLower.includes('republican')) return 'R';
	if (partyLower.includes('independent')) return 'I';
	return party.charAt(0).toUpperCase();
}

/**
 * Transform API vote to internal Vote type
 */
function transformVote(apiVote: CongressApiVote, congress: number): Vote {
	const chamber: 'house' | 'senate' =
		apiVote.chamber?.toLowerCase() === 'senate' ? 'senate' : 'house';
	const chamberCode = chamber === 'house' ? 'H' : 'S';

	return {
		rollCallId: `${congress}-${chamberCode}-${apiVote.rollNumber}`,
		billId: apiVote.bill
			? `${apiVote.bill.type?.toLowerCase() || 'hr'}-${congress}-${apiVote.bill.number}`
			: `${congress}-unknown`,
		billTitle: apiVote.bill?.title || apiVote.description || 'Unknown Bill',
		date: new Date(apiVote.date),
		vote: 'yea', // This is a summary vote, individual votes come from memberVotes
		result: normalizeResult(apiVote.result),
		chamber,
		question: apiVote.question,
		description: apiVote.description
	};
}

/**
 * Transform API member vote to VoteWithDisclosure
 */
function transformVoteWithDisclosure(
	apiVote: CongressApiMemberVote,
	congress: number
): VoteWithDisclosure {
	const chamber: 'house' | 'senate' =
		apiVote.chamber?.toLowerCase() === 'senate' ? 'senate' : 'house';
	const chamberCode = chamber === 'house' ? 'H' : 'S';

	const vote = normalizeVotePosition(apiVote.vote);
	const result = normalizeResult(apiVote.result);

	const billId = apiVote.bill
		? `${apiVote.bill.congress || congress}-${apiVote.bill.type?.toLowerCase() || 'hr'}-${apiVote.bill.number}`
		: `${congress}-unknown`;

	const billTitle = apiVote.bill?.title || apiVote.description || 'Unknown Bill';

	// Generate L1 summary: stance with one-line impact
	const voteWord = vote === 'yea' ? 'Voted YES' : vote === 'nay' ? 'Voted NO' : 'Did not vote';
	const resultWord = result === 'passed' ? 'passed' : 'failed';
	const l1Summary = `${voteWord} on ${truncateTitle(billTitle, 60)}`;

	// Generate L2 summary: more context
	const l2Summary = `${voteWord} on "${billTitle}". The measure ${resultWord}.`;

	// L3: Full roll call URL
	const l3RollCallUrl = `https://www.congress.gov/roll-call-vote/${congress}/${chamber}/${apiVote.session || 1}/${apiVote.rollNumber}`;

	return {
		rollCallId: `${congress}-${chamberCode}-${apiVote.rollNumber}`,
		billId,
		billTitle,
		date: new Date(apiVote.date),
		vote,
		result,
		chamber,
		question: apiVote.question,
		description: apiVote.description,
		l1Summary,
		l2Summary,
		l3RollCallUrl
	};
}

/**
 * Normalize vote position string
 */
function normalizeVotePosition(vote?: string): 'yea' | 'nay' | 'not_voting' | 'present' {
	if (!vote) return 'not_voting';
	const voteLower = vote.toLowerCase();
	if (voteLower.includes('yea') || voteLower.includes('aye') || voteLower === 'yes') return 'yea';
	if (voteLower.includes('nay') || voteLower.includes('no')) return 'nay';
	if (voteLower.includes('present')) return 'present';
	return 'not_voting';
}

/**
 * Normalize vote result string
 */
function normalizeResult(result?: string): 'passed' | 'failed' {
	if (!result) return 'failed';
	const resultLower = result.toLowerCase();
	if (
		resultLower.includes('pass') ||
		resultLower.includes('agreed') ||
		resultLower.includes('adopted')
	) {
		return 'passed';
	}
	return 'failed';
}

/**
 * Truncate title to specified length
 */
function truncateTitle(title: string, maxLength: number): string {
	if (title.length <= maxLength) return title;
	return title.substring(0, maxLength - 3) + '...';
}

// ============================================================================
// Statistics Functions
// ============================================================================

/**
 * Calculate vote statistics from a list of votes
 */
function calculateVoteStats(votes: VoteWithDisclosure[]): VoteStats {
	const stats: VoteStats = {
		totalVotes: votes.length,
		yeas: 0,
		nays: 0,
		notVoting: 0,
		present: 0,
		participationRate: 0
	};

	for (const vote of votes) {
		switch (vote.vote) {
			case 'yea':
				stats.yeas++;
				break;
			case 'nay':
				stats.nays++;
				break;
			case 'not_voting':
				stats.notVoting++;
				break;
			case 'present':
				stats.present++;
				break;
		}
	}

	// Calculate participation rate (voted yea, nay, or present vs total)
	const participated = stats.yeas + stats.nays + stats.present;
	stats.participationRate =
		stats.totalVotes > 0 ? Math.round((participated / stats.totalVotes) * 100) : 0;

	return stats;
}

/**
 * Create empty vote history for a member
 */
function createEmptyVoteHistory(member: Member): MemberVoteHistory {
	return {
		memberId: member.bioguideId,
		memberName: member.name,
		party: member.party,
		state: member.state,
		district: member.district,
		chamber: member.chamber,
		votes: [],
		voteStats: {
			totalVotes: 0,
			yeas: 0,
			nays: 0,
			notVoting: 0,
			present: 0,
			participationRate: 0
		},
		lastUpdated: new Date()
	};
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Clear expired vote history cache
 */
export async function clearExpiredVoteCache(): Promise<number> {
	const collection = await getVoteHistoryCollection();
	const result = await collection.deleteMany({
		expiresAt: { $lt: new Date() }
	});

	console.log(`[Congress Votes] Cleared ${result.deletedCount} expired vote cache entries`);
	return result.deletedCount;
}

/**
 * Get cache statistics
 */
export async function getVoteCacheStats(): Promise<{
	membersCached: number;
	voteHistoriesCached: number;
	oldestCache?: Date;
	newestCache?: Date;
}> {
	const membersCol = await getMembersCollection();
	const votesCol = await getVoteHistoryCollection();

	const [memberCount, voteCount, oldest, newest] = await Promise.all([
		membersCol.countDocuments(),
		votesCol.countDocuments(),
		votesCol.findOne({}, { sort: { createdAt: 1 }, projection: { createdAt: 1 } }),
		votesCol.findOne({}, { sort: { createdAt: -1 }, projection: { createdAt: 1 } })
	]);

	return {
		membersCached: memberCount,
		voteHistoriesCached: voteCount,
		oldestCache: oldest?.createdAt,
		newestCache: newest?.createdAt
	};
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Health check for vote history API
 */
export async function healthCheck(): Promise<boolean> {
	try {
		// Test API connectivity
		const response = await congressVoteRequest<{ members: CongressApiMember[] }>(
			'/member/CA?limit=1&currentMember=true'
		);

		console.log('[Congress Votes] Health check passed');
		return response.members !== undefined;
	} catch (error) {
		console.error('[Congress Votes] Health check failed:', error);
		return false;
	}
}
