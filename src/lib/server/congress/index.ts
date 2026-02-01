/**
 * Congress.gov Legislative Intelligence
 *
 * API client and feed ingestion for Congress.gov legislative data.
 * Enables proactive legislative monitoring with progressive disclosure.
 *
 * Features:
 * - Real-time bill tracking from Congress.gov API
 * - Voyage AI embeddings (voyage-law-2 for legal text)
 * - Progressive disclosure: L1 one-line impact, L2 key provisions, L3 full analysis
 * - MongoDB caching with vector search support
 *
 * Phase 2E Implementation
 *
 * @module congress
 *
 * @example
 * // Fetch recent bills
 * import { fetchRecentBills } from '$lib/server/congress';
 * const bills = await fetchRecentBills({ chamber: 'house', limit: 10 });
 *
 * @example
 * // Run feed ingestion
 * import { ingestLegislativeFeed } from '$lib/server/congress';
 * const stats = await ingestLegislativeFeed({
 *   generateEmbeddings: true,
 *   generateL1Summaries: true
 * });
 *
 * @example
 * // Search cached bills
 * import { searchBills } from '$lib/server/congress';
 * const results = await searchBills('healthcare', { limit: 10 });
 */

// ============================================================================
// Client Exports - API Access
// ============================================================================

export {
	// Core functions
	fetchRecentBills,
	fetchBillDetails,
	fetchBillById,
	searchBills as searchBillsApi,
	getBillsUpdatedSince,
	getCurrentCongress,

	// Rate limiting
	getRateLimitStatus,

	// Health check
	healthCheck,

	// Types
	type Bill,
	type BillDetails,
	type BillSummary,
	type BillAction,
	type BillCosponsor,
	type RelatedBill,
	type BillCommittee,
	type TextVersion,
	type BillType,
	type FetchRecentBillsOptions
} from './client';

// ============================================================================
// Feed Exports - Ingestion & Storage
// ============================================================================

export {
	// Ingestion
	ingestLegislativeFeed,

	// Query functions
	getBillById,
	searchBills,
	getBillsByPolicyArea,

	// Statistics
	getFeedStats,

	// Collection access
	getBillsCollection,
	BILLS_COLLECTION,

	// L1 summary generation
	generateL1Summary,

	// Types
	type LegislativeBillDocument,
	type IngestionStats,
	type IngestionOptions
} from './feed';

// ============================================================================
// Vote History Exports - Representative Voting Records
// ============================================================================

export {
	// Member functions
	getMember,
	getMemberByDistrict,
	getSenatorsByState,

	// Vote history functions
	getMemberVoteHistory,
	getVotesOnBill,

	// Cache management
	clearExpiredVoteCache,
	getVoteCacheStats,

	// Health check
	healthCheck as voteHealthCheck,

	// Collection names
	MEMBER_VOTES_COLLECTION,
	MEMBERS_COLLECTION,

	// Types
	type Vote,
	type VoteWithDisclosure,
	type Member,
	type MemberTerm,
	type MemberVoteHistory,
	type VoteStats,
	type VoteHistoryOptions,
	type MemberDocument,
	type MemberVoteHistoryDocument
} from './votes';
