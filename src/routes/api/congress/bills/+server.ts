/**
 * Congress Bills API
 *
 * GET /api/congress/bills - Search bills with optional filters
 *
 * Query Parameters:
 * - congress: Congress number (e.g., 119)
 * - chamber: "house" or "senate"
 * - topic: Policy area filter (e.g., "climate", "healthcare")
 * - limit: Max results (default: 20, max: 100)
 * - offset: Pagination offset
 *
 * Response: { bills: Bill[], total: number, hasMore: boolean }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rateLimiter } from '$lib/server/rate-limiter';
import {
	searchBills as searchBillsFromFeed,
	getBillsCollection,
	type LegislativeBillDocument
} from '$lib/server/congress/feed';
import {
	fetchRecentBills,
	getCurrentCongress,
	type Bill
} from '$lib/server/congress/client';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

export const GET: RequestHandler = async ({ url, locals, getClientAddress }) => {
	// Rate limiting: 60 requests per minute per IP
	const clientIp = getClientAddress();
	const rateLimitResult = await rateLimiter.limit(`congress-bills:${clientIp}`, 60, 60 * 1000);

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
	const congressParam = url.searchParams.get('congress');
	const chamber = url.searchParams.get('chamber') as 'house' | 'senate' | null;
	const topic = url.searchParams.get('topic');
	const limitParam = url.searchParams.get('limit');
	const offsetParam = url.searchParams.get('offset');

	const congress = congressParam ? parseInt(congressParam, 10) : getCurrentCongress();
	const limit = Math.min(limitParam ? parseInt(limitParam, 10) : DEFAULT_LIMIT, MAX_LIMIT);
	const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

	// Validate chamber parameter
	if (chamber && chamber !== 'house' && chamber !== 'senate') {
		return json(
			{ error: 'Invalid chamber parameter. Must be "house" or "senate".' },
			{ status: 400 }
		);
	}

	try {
		let bills: (Bill | LegislativeBillDocument)[] = [];
		let total = 0;

		// If topic is provided, search from MongoDB cache first
		if (topic) {
			const cachedBills = await searchBillsFromFeed(topic, {
				congress,
				chamber: chamber || undefined,
				limit: limit + 1 // Fetch one extra to check hasMore
			});

			bills = cachedBills.slice(0, limit);
			total = cachedBills.length;
		} else {
			// Fetch from Congress.gov API
			const fetchedBills = await fetchRecentBills({
				congress,
				chamber: chamber || undefined,
				limit: limit + 1, // Fetch one extra to check hasMore
				offset
			});

			bills = fetchedBills.slice(0, limit);
			total = fetchedBills.length;
		}

		// Transform bills to consistent response format
		const formattedBills = bills.map((bill) => formatBillResponse(bill));

		return json({
			bills: formattedBills,
			total,
			hasMore: total > limit,
			meta: {
				congress,
				chamber: chamber || 'all',
				topic: topic || null,
				limit,
				offset
			}
		});
	} catch (error) {
		console.error('[Congress Bills API] Error:', error);

		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		// Check for specific error types
		if (errorMessage.includes('Rate limit')) {
			return json(
				{ error: 'Congress.gov API rate limit exceeded. Please try again later.' },
				{ status: 503 }
			);
		}

		if (errorMessage.includes('API key')) {
			return json(
				{ error: 'Congress API configuration error. Please contact support.' },
				{ status: 500 }
			);
		}

		return json({ error: 'Failed to fetch bills' }, { status: 500 });
	}
};

/**
 * Format bill to consistent API response
 */
function formatBillResponse(bill: Bill | LegislativeBillDocument) {
	// Check if it's a LegislativeBillDocument (has billId property)
	const isCachedBill = 'billId' in bill;

	return {
		id: isCachedBill ? (bill as LegislativeBillDocument).billId : generateBillId(bill as Bill),
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
		congressUrl: 'congressUrl' in bill ? bill.congressUrl : undefined,
		// Include L1 summary if available (from cached bills)
		summary: isCachedBill ? (bill as LegislativeBillDocument).l1Summary : undefined
	};
}

/**
 * Generate bill ID from Bill object
 */
function generateBillId(bill: Bill): string {
	const number = bill.number.replace(/\D/g, '');
	return `${bill.congress}-${bill.type}-${number}`;
}
