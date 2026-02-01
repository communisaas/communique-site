/**
 * Congress Member Votes API
 *
 * GET /api/congress/members/[bioguideId]/votes - Get member's voting history
 *
 * Path Parameters:
 * - bioguideId: Member's bioguide ID (e.g., "P000197" for Pelosi)
 *
 * Query Parameters:
 * - topic: Filter by policy area (e.g., "healthcare")
 * - limit: Max results (default: 50, max: 250)
 * - offset: Pagination offset
 * - congress: Congress number (default: current)
 *
 * Response: { votes: VoteRecord[], summary: VotingSummary }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rateLimiter } from '$lib/server/rate-limiter';
import {
	getMemberVoteHistory,
	getMember,
	type MemberVoteHistory,
	type VoteWithDisclosure,
	type VoteStats
} from '$lib/server/congress/votes';
import { getCurrentCongress } from '$lib/server/congress/client';

const MAX_LIMIT = 250;
const DEFAULT_LIMIT = 50;

export const GET: RequestHandler = async ({ params, url, getClientAddress }) => {
	const { bioguideId } = params;

	// Validate bioguideId format (alphanumeric, 5-7 characters)
	if (!bioguideId || !/^[A-Z]\d{5,6}$/i.test(bioguideId)) {
		return json(
			{
				error: 'Invalid bioguide ID format. Expected format: "P000197"'
			},
			{ status: 400 }
		);
	}

	// Rate limiting: 30 requests per minute per IP
	const clientIp = getClientAddress();
	const rateLimitResult = await rateLimiter.limit(`congress-votes:${clientIp}`, 30, 60 * 1000);

	if (!rateLimitResult.success) {
		return json(
			{
				error: 'Rate limit exceeded',
				retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
			},
			{
				status: 429,
				headers: {
					'Retry-After': String(Math.ceil((rateLimitResult.reset - Date.now()) / 1000))
				}
			}
		);
	}

	// Parse query parameters
	const topic = url.searchParams.get('topic');
	const limitParam = url.searchParams.get('limit');
	const offsetParam = url.searchParams.get('offset');
	const congressParam = url.searchParams.get('congress');

	const limit = Math.min(limitParam ? parseInt(limitParam, 10) : DEFAULT_LIMIT, MAX_LIMIT);
	const offset = offsetParam ? parseInt(offsetParam, 10) : 0;
	const congress = congressParam ? parseInt(congressParam, 10) : getCurrentCongress();

	try {
		// Fetch member's vote history
		const voteHistory = await getMemberVoteHistory(bioguideId.toUpperCase(), {
			congress,
			limit: limit + offset, // Fetch enough for pagination
			offset: 0 // We'll handle offset client-side for topic filtering
		});

		if (!voteHistory) {
			return json(
				{ error: `Member not found: ${bioguideId}` },
				{ status: 404 }
			);
		}

		// Filter by topic if provided
		let filteredVotes = voteHistory.votes;
		if (topic) {
			const topicLower = topic.toLowerCase();
			filteredVotes = voteHistory.votes.filter(
				(vote) =>
					vote.billTitle.toLowerCase().includes(topicLower) ||
					vote.description?.toLowerCase().includes(topicLower)
			);
		}

		// Apply pagination
		const paginatedVotes = filteredVotes.slice(offset, offset + limit);

		// Recalculate stats for filtered/paginated results
		const filteredStats = calculateFilteredStats(filteredVotes);

		return json({
			member: {
				bioguideId: voteHistory.memberId,
				name: voteHistory.memberName,
				party: voteHistory.party,
				state: voteHistory.state,
				district: voteHistory.district,
				chamber: voteHistory.chamber
			},
			votes: paginatedVotes.map(formatVoteResponse),
			summary: {
				...filteredStats,
				congress,
				lastUpdated: voteHistory.lastUpdated
			},
			meta: {
				topic: topic || null,
				limit,
				offset,
				total: filteredVotes.length,
				hasMore: offset + limit < filteredVotes.length
			}
		});
	} catch (error) {
		console.error(`[Congress Votes API] Error fetching votes for ${bioguideId}:`, error);

		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		if (errorMessage.includes('Rate limit')) {
			return json(
				{ error: 'Congress.gov API rate limit exceeded. Please try again later.' },
				{ status: 503 }
			);
		}

		return json({ error: 'Failed to fetch voting history' }, { status: 500 });
	}
};

/**
 * Format vote for API response
 */
function formatVoteResponse(vote: VoteWithDisclosure) {
	return {
		rollCallId: vote.rollCallId,
		billId: vote.billId,
		billTitle: vote.billTitle,
		date: vote.date,
		vote: vote.vote,
		result: vote.result,
		chamber: vote.chamber,
		question: vote.question,
		description: vote.description,
		// Progressive disclosure summaries
		l1Summary: vote.l1Summary,
		l2Summary: vote.l2Summary,
		l3RollCallUrl: vote.l3RollCallUrl
	};
}

/**
 * Calculate stats for filtered votes
 */
function calculateFilteredStats(votes: VoteWithDisclosure[]): VoteStats {
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

	const participated = stats.yeas + stats.nays + stats.present;
	stats.participationRate =
		stats.totalVotes > 0 ? Math.round((participated / stats.totalVotes) * 100) : 0;

	return stats;
}
