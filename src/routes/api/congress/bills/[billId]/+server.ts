/**
 * Congress Bill Details API
 *
 * GET /api/congress/bills/[billId] - Get bill details with L1 summary
 *
 * Path Parameters:
 * - billId: Bill ID in format "congress-type-number" (e.g., "119-hr-1234")
 *
 * Response: { bill: BillWithSummary, votes: VoteRecord[] }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rateLimiter } from '$lib/server/rate-limiter';
import { getBillById, generateL1Summary } from '$lib/server/congress/feed';
import { fetchBillById, type BillDetails } from '$lib/server/congress/client';
import { getVotesOnBill, type Vote } from '$lib/server/congress/votes';

export const GET: RequestHandler = async ({ params, getClientAddress }) => {
	const { billId } = params;

	// Validate billId format
	if (!billId || !/^\d+-[a-z]+-\d+$/i.test(billId)) {
		return json(
			{
				error: 'Invalid bill ID format. Expected format: "119-hr-1234"'
			},
			{ status: 400 }
		);
	}

	// Rate limiting: 30 requests per minute per IP
	const clientIp = getClientAddress();
	const rateLimitResult = await rateLimiter.limit(`congress-bill-detail:${clientIp}`, 30, 60 * 1000);

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

	try {
		// Try to get from MongoDB cache first
		let bill = await getBillById(billId);
		let votes: Vote[] = [];

		if (bill) {
			// Bill found in cache
			console.log(`[Congress Bill API] Cache hit for ${billId}`);

			// Fetch votes for this bill
			try {
				votes = await getVotesOnBill(billId);
			} catch (voteError) {
				console.warn(`[Congress Bill API] Failed to fetch votes for ${billId}:`, voteError);
				// Continue without votes
			}

			return json({
				bill: {
					id: bill.billId,
					number: bill.number,
					title: bill.title,
					sponsor: bill.sponsor,
					status: bill.status,
					congress: bill.congress,
					chamber: bill.chamber,
					type: bill.type,
					introducedDate: bill.introducedDate,
					latestActionDate: bill.latestActionDate,
					latestAction: bill.latestAction,
					policyArea: bill.policyArea,
					cosponsorsCount: bill.cosponsorsCount,
					congressUrl: bill.congressUrl,
					summary: bill.summary,
					fullTextUrl: bill.fullTextUrl,
					// Progressive disclosure summaries
					l1Summary: bill.l1Summary,
					l2Summary: bill.l2Summary,
					// Metadata
					lastSyncedAt: bill.lastSyncedAt
				},
				votes: formatVotes(votes),
				source: 'cache'
			});
		}

		// Not in cache, fetch from Congress.gov API
		console.log(`[Congress Bill API] Cache miss for ${billId}, fetching from API`);

		const apiBill = await fetchBillById(billId);

		// Generate L1 summary
		const l1Summary = generateL1Summary(apiBill);

		// Fetch votes
		try {
			votes = await getVotesOnBill(billId);
		} catch (voteError) {
			console.warn(`[Congress Bill API] Failed to fetch votes for ${billId}:`, voteError);
		}

		return json({
			bill: {
				id: billId,
				number: apiBill.number,
				title: apiBill.title,
				sponsor: apiBill.sponsor,
				status: apiBill.status,
				congress: apiBill.congress,
				chamber: apiBill.chamber,
				type: apiBill.type,
				introducedDate: apiBill.introducedDate,
				latestActionDate: apiBill.latestActionDate,
				latestAction: apiBill.latestAction,
				policyArea: apiBill.policyArea,
				cosponsorsCount: apiBill.cosponsorsCount,
				congressUrl: apiBill.congressUrl,
				summary: apiBill.summaries?.[0]?.text,
				// Progressive disclosure
				l1Summary,
				// Detailed information
				actions: apiBill.actions,
				cosponsors: apiBill.cosponsors,
				subjects: apiBill.subjects,
				committees: apiBill.committees,
				textVersions: apiBill.textVersions,
				relatedBills: apiBill.relatedBills
			},
			votes: formatVotes(votes),
			source: 'api'
		});
	} catch (error) {
		console.error(`[Congress Bill API] Error fetching bill ${billId}:`, error);

		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		if (errorMessage.includes('not found') || errorMessage.includes('Invalid bill ID')) {
			return json({ error: `Bill not found: ${billId}` }, { status: 404 });
		}

		if (errorMessage.includes('Rate limit')) {
			return json(
				{ error: 'Congress.gov API rate limit exceeded. Please try again later.' },
				{ status: 503 }
			);
		}

		return json({ error: 'Failed to fetch bill details' }, { status: 500 });
	}
};

/**
 * Format votes for API response
 */
function formatVotes(votes: Vote[]) {
	return votes.map((vote) => ({
		rollCallId: vote.rollCallId,
		billId: vote.billId,
		billTitle: vote.billTitle,
		date: vote.date,
		result: vote.result,
		chamber: vote.chamber,
		question: vote.question,
		description: vote.description
	}));
}
