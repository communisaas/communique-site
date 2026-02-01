/**
 * Congress.gov Alignment Scoring
 *
 * Calculates alignment between a representative's voting record
 * and a user's policy positions on specific topics.
 *
 * Scoring Methodology:
 * - Each vote is weighted by issue relevance (keyword match)
 * - Recent votes weighted more heavily (recency decay)
 * - Key votes (passage/final) weighted more than procedural
 * - Returns normalized score [0-100] with confidence level
 *
 * @module congress/alignment
 */

import type { Vote, VoteWithDisclosure, MemberVoteHistory } from './votes';
import { getMemberVoteHistory, getMember, type Member } from './votes';
import { fetchBillDetails, type BillDetails, type BillType } from './client';

// ============================================================================
// Configuration
// ============================================================================

/** Maximum age for highly-weighted votes (2 years) */
const RECENCY_FULL_WEIGHT_MS = 2 * 365 * 24 * 60 * 60 * 1000;

/** Votes older than this receive minimum weight (4 years) */
const RECENCY_MINIMUM_MS = 4 * 365 * 24 * 60 * 60 * 1000;

/** Minimum votes required for high confidence */
const HIGH_CONFIDENCE_THRESHOLD = 10;

/** Minimum votes required for medium confidence */
const MEDIUM_CONFIDENCE_THRESHOLD = 3;

// ============================================================================
// Types
// ============================================================================

/**
 * User's position on a topic
 */
export interface PolicyPosition {
	/** Topic identifier (e.g., "healthcare", "climate") */
	topic: string;
	/** User's stance: support legislation in this area or oppose */
	stance: 'support' | 'oppose';
	/** Keywords to match in bill titles/subjects */
	keywords: string[];
	/** Importance weight (1-10, default 5) */
	importance?: number;
}

/**
 * A single vote's contribution to alignment
 */
export interface VoteAlignment {
	/** Vote that was analyzed */
	vote: VoteWithDisclosure;
	/** Topic this vote was matched to */
	matchedTopic: string;
	/** Whether vote aligned with user's position */
	aligned: boolean;
	/** Weight applied to this vote */
	weight: number;
	/** Explanation of alignment */
	explanation: string;
}

/**
 * Alignment score for a specific topic
 */
export interface TopicAlignment {
	/** Topic name */
	topic: string;
	/** Alignment score for this topic [0-100] */
	score: number;
	/** Number of votes analyzed */
	voteCount: number;
	/** Aligned votes / total votes */
	alignmentRatio: number;
	/** Key votes that determined this score */
	keyVotes: VoteAlignment[];
}

/**
 * Overall alignment result
 */
export interface AlignmentResult {
	/** Representative's bioguide ID */
	memberId: string;
	/** Representative's name */
	memberName: string;
	/** Party affiliation */
	party: string;
	/** State */
	state: string;
	/** Chamber */
	chamber: 'house' | 'senate';
	/** Overall alignment score [0-100] */
	overallScore: number;
	/** Confidence in the score */
	confidence: 'high' | 'medium' | 'low';
	/** Per-topic breakdown */
	topicAlignments: TopicAlignment[];
	/** Total votes analyzed */
	totalVotesAnalyzed: number;
	/** Human-readable summary */
	summary: string;
	/** When this was calculated */
	calculatedAt: Date;
}

/**
 * Options for alignment calculation
 */
export interface AlignmentOptions {
	/** Congress number to analyze (defaults to current) */
	congress?: number;
	/** Maximum votes to analyze per topic */
	maxVotesPerTopic?: number;
	/** Include detailed vote breakdown */
	includeVoteDetails?: boolean;
}

// ============================================================================
// Topic Keyword Mappings
// ============================================================================

/**
 * Predefined keyword mappings for common policy topics
 * Extensible - callers can provide their own keywords
 */
export const TOPIC_KEYWORDS: Record<string, string[]> = {
	healthcare: [
		'health', 'medicare', 'medicaid', 'affordable care', 'aca',
		'prescription drug', 'hospital', 'medical', 'insurance coverage',
		'mental health', 'public health'
	],
	climate: [
		'climate', 'environment', 'clean energy', 'renewable', 'emissions',
		'carbon', 'green new deal', 'paris agreement', 'epa', 'pollution',
		'solar', 'wind energy', 'fossil fuel'
	],
	education: [
		'education', 'school', 'student loan', 'college', 'university',
		'pell grant', 'teacher', 'curriculum', 'higher education'
	],
	immigration: [
		'immigration', 'border', 'visa', 'asylum', 'citizenship',
		'daca', 'dreamer', 'deportation', 'ice', 'refugee'
	],
	economy: [
		'tax', 'budget', 'deficit', 'spending', 'fiscal', 'inflation',
		'minimum wage', 'employment', 'jobs', 'trade', 'tariff'
	],
	defense: [
		'defense', 'military', 'veteran', 'ndaa', 'armed forces',
		'pentagon', 'national security', 'dod'
	],
	technology: [
		'technology', 'tech', 'ai', 'artificial intelligence', 'privacy',
		'data', 'cybersecurity', 'broadband', 'internet', 'chips'
	],
	housing: [
		'housing', 'affordable housing', 'rent', 'mortgage', 'homeless',
		'hud', 'section 8', 'fair housing'
	],
	'criminal-justice': [
		'criminal justice', 'police', 'prison', 'sentencing', 'bail',
		'incarceration', 'reform', 'law enforcement'
	],
	'civil-rights': [
		'civil rights', 'voting rights', 'discrimination', 'equality',
		'lgbtq', 'gender', 'racial justice', 'dei'
	]
};

// ============================================================================
// Core Alignment Functions
// ============================================================================

/**
 * Calculate alignment between a representative and user's policy positions
 *
 * @param memberId - Bioguide ID of the representative
 * @param positions - User's policy positions
 * @param options - Calculation options
 * @returns Alignment result with scores and breakdown
 *
 * @example
 * const alignment = await calculateAlignment('A000370', [
 *   { topic: 'healthcare', stance: 'support', keywords: [] },
 *   { topic: 'climate', stance: 'support', keywords: [] }
 * ]);
 * console.log(`Alignment: ${alignment.overallScore}%`);
 */
export async function calculateAlignment(
	memberId: string,
	positions: PolicyPosition[],
	options: AlignmentOptions = {}
): Promise<AlignmentResult> {
	const { maxVotesPerTopic = 20, includeVoteDetails = true } = options;

	console.log(`[Alignment] Calculating for member ${memberId} on ${positions.length} topics`);

	// Get member info
	const member = await getMember(memberId);
	if (!member) {
		throw new Error(`Member not found: ${memberId}`);
	}

	// Get vote history
	const voteHistory = await getMemberVoteHistory(memberId, {
		congress: options.congress,
		limit: 100 // Fetch enough votes to cover multiple topics
	});

	if (!voteHistory || voteHistory.votes.length === 0) {
		return createEmptyResult(member, positions);
	}

	// Calculate alignment for each topic
	const topicAlignments: TopicAlignment[] = [];
	let totalWeightedScore = 0;
	let totalWeight = 0;
	let totalVotesAnalyzed = 0;

	for (const position of positions) {
		const topicResult = calculateTopicAlignment(
			voteHistory.votes,
			position,
			maxVotesPerTopic,
			includeVoteDetails
		);

		topicAlignments.push(topicResult);

		// Weight by importance and vote count
		const positionWeight = (position.importance || 5) / 5;
		const voteWeight = Math.min(topicResult.voteCount / HIGH_CONFIDENCE_THRESHOLD, 1);
		const combinedWeight = positionWeight * voteWeight;

		totalWeightedScore += topicResult.score * combinedWeight;
		totalWeight += combinedWeight;
		totalVotesAnalyzed += topicResult.voteCount;
	}

	// Calculate overall score
	const overallScore = totalWeight > 0
		? Math.round(totalWeightedScore / totalWeight)
		: 50; // Neutral if no data

	// Determine confidence
	const confidence = determineConfidence(totalVotesAnalyzed, positions.length);

	// Generate summary
	const summary = generateSummary(member, overallScore, topicAlignments, confidence);

	return {
		memberId: member.bioguideId,
		memberName: member.name,
		party: member.party,
		state: member.state,
		chamber: member.chamber,
		overallScore,
		confidence,
		topicAlignments,
		totalVotesAnalyzed,
		summary,
		calculatedAt: new Date()
	};
}

/**
 * Calculate alignment for a single topic
 */
function calculateTopicAlignment(
	votes: VoteWithDisclosure[],
	position: PolicyPosition,
	maxVotes: number,
	includeDetails: boolean
): TopicAlignment {
	// Build keyword list
	const keywords = [
		...position.keywords,
		...(TOPIC_KEYWORDS[position.topic.toLowerCase()] || [])
	].map(k => k.toLowerCase());

	if (keywords.length === 0) {
		// Fallback: use topic name as keyword
		keywords.push(position.topic.toLowerCase());
	}

	// Find matching votes
	const matchingVotes = votes
		.filter(vote => voteMatchesTopic(vote, keywords))
		.slice(0, maxVotes);

	if (matchingVotes.length === 0) {
		return {
			topic: position.topic,
			score: 50, // Neutral if no matching votes
			voteCount: 0,
			alignmentRatio: 0,
			keyVotes: []
		};
	}

	// Calculate alignment for each vote
	const voteAlignments: VoteAlignment[] = [];
	let totalWeightedAlignment = 0;
	let totalWeight = 0;

	for (const vote of matchingVotes) {
		const weight = calculateVoteWeight(vote);
		const aligned = isVoteAligned(vote, position.stance);
		const explanation = generateVoteExplanation(vote, position, aligned);

		if (includeDetails) {
			voteAlignments.push({
				vote,
				matchedTopic: position.topic,
				aligned,
				weight,
				explanation
			});
		}

		totalWeightedAlignment += aligned ? weight : 0;
		totalWeight += weight;
	}

	const alignmentRatio = totalWeight > 0 ? totalWeightedAlignment / totalWeight : 0;
	const score = Math.round(alignmentRatio * 100);

	return {
		topic: position.topic,
		score,
		voteCount: matchingVotes.length,
		alignmentRatio,
		keyVotes: voteAlignments.slice(0, 5) // Top 5 for display
	};
}

/**
 * Check if a vote matches a topic based on keywords
 */
function voteMatchesTopic(vote: VoteWithDisclosure, keywords: string[]): boolean {
	const searchText = [
		vote.billTitle,
		vote.description,
		vote.question
	].filter(Boolean).join(' ').toLowerCase();

	return keywords.some(keyword => searchText.includes(keyword));
}

/**
 * Calculate weight for a vote based on type and recency
 */
function calculateVoteWeight(vote: VoteWithDisclosure): number {
	let weight = 1.0;

	// Recency factor
	const ageMs = Date.now() - vote.date.getTime();
	if (ageMs < RECENCY_FULL_WEIGHT_MS) {
		weight *= 1.0; // Full weight for recent votes
	} else if (ageMs < RECENCY_MINIMUM_MS) {
		// Linear decay from 1.0 to 0.5
		const ratio = (ageMs - RECENCY_FULL_WEIGHT_MS) / (RECENCY_MINIMUM_MS - RECENCY_FULL_WEIGHT_MS);
		weight *= 1.0 - (ratio * 0.5);
	} else {
		weight *= 0.5; // Minimum weight for old votes
	}

	// Vote type factor (passage votes are more significant)
	const question = (vote.question || '').toLowerCase();
	if (question.includes('passage') || question.includes('final')) {
		weight *= 1.5; // Key votes
	} else if (question.includes('procedur') || question.includes('motion to')) {
		weight *= 0.7; // Procedural votes
	}

	return weight;
}

/**
 * Determine if a vote aligns with user's stance
 *
 * Logic:
 * - User supports topic + voted yea on passage = aligned
 * - User supports topic + voted nay on passage = misaligned
 * - User opposes topic + voted nay on passage = aligned
 * - User opposes topic + voted yea on passage = misaligned
 */
function isVoteAligned(vote: VoteWithDisclosure, userStance: 'support' | 'oppose'): boolean {
	const votedFor = vote.vote === 'yea';

	if (userStance === 'support') {
		return votedFor; // User supports, so voting yes = aligned
	} else {
		return !votedFor; // User opposes, so voting no = aligned
	}
}

/**
 * Generate human-readable explanation for a vote's alignment
 */
function generateVoteExplanation(
	vote: VoteWithDisclosure,
	position: PolicyPosition,
	aligned: boolean
): string {
	const voteAction = vote.vote === 'yea' ? 'voted YES' :
		vote.vote === 'nay' ? 'voted NO' : 'did not vote';

	const alignmentWord = aligned ? 'aligns with' : 'conflicts with';
	const stanceWord = position.stance === 'support' ? 'support for' : 'opposition to';

	return `${voteAction} on "${truncate(vote.billTitle, 50)}" — ${alignmentWord} your ${stanceWord} ${position.topic} issues`;
}

/**
 * Determine confidence level based on data quality
 */
function determineConfidence(
	totalVotes: number,
	topicCount: number
): 'high' | 'medium' | 'low' {
	const votesPerTopic = totalVotes / Math.max(topicCount, 1);

	if (votesPerTopic >= HIGH_CONFIDENCE_THRESHOLD) {
		return 'high';
	} else if (votesPerTopic >= MEDIUM_CONFIDENCE_THRESHOLD) {
		return 'medium';
	}
	return 'low';
}

/**
 * Generate human-readable summary
 */
function generateSummary(
	member: Member,
	overallScore: number,
	topicAlignments: TopicAlignment[],
	confidence: 'high' | 'medium' | 'low'
): string {
	const partyLabel = member.party === 'D' ? 'Democrat' :
		member.party === 'R' ? 'Republican' : 'Independent';

	const alignmentLevel = overallScore >= 70 ? 'strongly aligns' :
		overallScore >= 50 ? 'partially aligns' :
		overallScore >= 30 ? 'partially conflicts' : 'strongly conflicts';

	const topAligned = topicAlignments
		.filter(t => t.score >= 70 && t.voteCount > 0)
		.map(t => t.topic);

	const topConflicts = topicAlignments
		.filter(t => t.score < 30 && t.voteCount > 0)
		.map(t => t.topic);

	let summary = `${member.name} (${partyLabel}, ${member.state}) ${alignmentLevel} with your positions `;
	summary += `(${overallScore}% alignment, ${confidence} confidence). `;

	if (topAligned.length > 0) {
		summary += `Strong alignment on: ${topAligned.join(', ')}. `;
	}
	if (topConflicts.length > 0) {
		summary += `Potential conflicts on: ${topConflicts.join(', ')}.`;
	}

	return summary.trim();
}

/**
 * Create empty result for member with no vote data
 */
function createEmptyResult(member: Member, positions: PolicyPosition[]): AlignmentResult {
	return {
		memberId: member.bioguideId,
		memberName: member.name,
		party: member.party,
		state: member.state,
		chamber: member.chamber,
		overallScore: 50,
		confidence: 'low',
		topicAlignments: positions.map(p => ({
			topic: p.topic,
			score: 50,
			voteCount: 0,
			alignmentRatio: 0,
			keyVotes: []
		})),
		totalVotesAnalyzed: 0,
		summary: `${member.name} has no available voting record for the selected topics.`,
		calculatedAt: new Date()
	};
}

/**
 * Truncate string to specified length
 */
function truncate(str: string, maxLength: number): string {
	if (str.length <= maxLength) return str;
	return str.substring(0, maxLength - 3) + '...';
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Calculate alignment for multiple representatives
 * Useful for comparing candidates or tracking delegation
 *
 * @param memberIds - Array of bioguide IDs
 * @param positions - User's policy positions
 * @param options - Calculation options
 * @returns Array of alignment results, sorted by score
 */
export async function calculateAlignmentBatch(
	memberIds: string[],
	positions: PolicyPosition[],
	options: AlignmentOptions = {}
): Promise<AlignmentResult[]> {
	console.log(`[Alignment] Batch calculation for ${memberIds.length} members`);

	const results: AlignmentResult[] = [];

	// Process sequentially to respect rate limits
	for (const memberId of memberIds) {
		try {
			const result = await calculateAlignment(memberId, positions, options);
			results.push(result);
		} catch (error) {
			console.warn(`[Alignment] Failed for ${memberId}:`, error);
			// Continue with other members
		}
	}

	// Sort by score descending
	return results.sort((a, b) => b.overallScore - a.overallScore);
}

/**
 * Get alignment for user's congressional delegation (Rep + 2 Senators)
 *
 * @param state - Two-letter state code
 * @param district - Congressional district number (for House rep)
 * @param positions - User's policy positions
 * @returns Alignment results for all three representatives
 */
export async function getDelegationAlignment(
	state: string,
	district: number,
	positions: PolicyPosition[],
	options: AlignmentOptions = {}
): Promise<{
	representative?: AlignmentResult;
	senators: AlignmentResult[];
}> {
	const { getMemberByDistrict, getSenatorsByState } = await import('./votes');

	console.log(`[Alignment] Getting delegation alignment for ${state}-${district}`);

	// Get members
	const [rep, senators] = await Promise.all([
		getMemberByDistrict(state, district),
		getSenatorsByState(state)
	]);

	// Calculate alignments
	let repAlignment: AlignmentResult | undefined;
	const senatorAlignments: AlignmentResult[] = [];

	if (rep) {
		try {
			repAlignment = await calculateAlignment(rep.bioguideId, positions, options);
		} catch (error) {
			console.warn(`[Alignment] Failed for rep ${rep.bioguideId}:`, error);
		}
	}

	for (const senator of senators) {
		try {
			const alignment = await calculateAlignment(senator.bioguideId, positions, options);
			senatorAlignments.push(alignment);
		} catch (error) {
			console.warn(`[Alignment] Failed for senator ${senator.bioguideId}:`, error);
		}
	}

	return {
		representative: repAlignment,
		senators: senatorAlignments
	};
}
