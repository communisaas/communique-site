/**
 * Congress Members API
 *
 * GET /api/congress/members - Search members by district or name
 *
 * Query Parameters:
 * - state: Two-letter state code (e.g., "CA")
 * - district: District number (e.g., "12")
 * - name: Search by member name (e.g., "pelosi")
 * - chamber: "house" or "senate" (optional filter)
 *
 * Response: { members: Member[] }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rateLimiter } from '$lib/server/rate-limiter';
import {
	getMemberByDistrict,
	getSenatorsByState,
	getMember,
	type Member
} from '$lib/server/congress/votes';

export const GET: RequestHandler = async ({ url, getClientAddress }) => {
	// Rate limiting: 60 requests per minute per IP
	const clientIp = getClientAddress();
	const rateLimitResult = await rateLimiter.limit(`congress-members:${clientIp}`, 60, 60 * 1000);

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
	const state = url.searchParams.get('state')?.toUpperCase();
	const district = url.searchParams.get('district');
	const name = url.searchParams.get('name');
	const chamber = url.searchParams.get('chamber') as 'house' | 'senate' | null;

	// Validate parameters - at least one search criterion required
	if (!state && !name) {
		return json(
			{
				error: 'At least one search parameter required: state, name'
			},
			{ status: 400 }
		);
	}

	// Validate state code format
	if (state && !/^[A-Z]{2}$/.test(state)) {
		return json(
			{ error: 'Invalid state code. Must be a two-letter abbreviation (e.g., "CA").' },
			{ status: 400 }
		);
	}

	// Validate chamber parameter
	if (chamber && chamber !== 'house' && chamber !== 'senate') {
		return json(
			{ error: 'Invalid chamber parameter. Must be "house" or "senate".' },
			{ status: 400 }
		);
	}

	try {
		const members: Member[] = [];

		// Search by state and district
		if (state && district) {
			const districtNum = parseInt(district, 10);

			if (isNaN(districtNum) || districtNum < 0) {
				return json(
					{ error: 'Invalid district number. Must be a non-negative integer.' },
					{ status: 400 }
				);
			}

			// Get House representative for the district
			if (!chamber || chamber === 'house') {
				const houseRep = await getMemberByDistrict(state, districtNum);
				if (houseRep) {
					members.push(houseRep);
				}
			}

			// Get Senators for the state
			if (!chamber || chamber === 'senate') {
				const senators = await getSenatorsByState(state);
				members.push(...senators);
			}
		}
		// Search by state only (get all members from state)
		else if (state) {
			// Get senators
			if (!chamber || chamber === 'senate') {
				const senators = await getSenatorsByState(state);
				members.push(...senators);
			}

			// For House, we can't easily list all districts without additional API calls
			// The frontend should use the address-lookup endpoint for district discovery
			if (chamber === 'house') {
				return json(
					{
						error: 'To find House representatives, please provide a district number or use the address-lookup endpoint.'
					},
					{ status: 400 }
				);
			}
		}
		// Search by name
		else if (name) {
			// Name search requires fetching from Congress.gov API
			// This is a simplified implementation - for full text search,
			// we'd need to index members in MongoDB
			return json(
				{
					error: 'Name search is not yet implemented. Please search by state and district.',
					suggestion: 'Use /api/congress/address-lookup with an address to find your representatives.'
				},
				{ status: 501 }
			);
		}

		// Format response
		const formattedMembers = members.map(formatMemberResponse);

		return json({
			members: formattedMembers,
			meta: {
				state: state || null,
				district: district || null,
				chamber: chamber || 'all',
				count: formattedMembers.length
			}
		});
	} catch (error) {
		console.error('[Congress Members API] Error:', error);

		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		if (errorMessage.includes('Rate limit')) {
			return json(
				{ error: 'Congress.gov API rate limit exceeded. Please try again later.' },
				{ status: 503 }
			);
		}

		return json({ error: 'Failed to fetch members' }, { status: 500 });
	}
};

/**
 * Format member for API response
 */
function formatMemberResponse(member: Member) {
	return {
		bioguideId: member.bioguideId,
		name: member.name,
		party: member.party,
		state: member.state,
		district: member.district,
		chamber: member.chamber,
		website: member.website,
		photoUrl: member.photoUrl,
		officeAddress: member.officeAddress,
		phone: member.phone,
		terms: member.terms?.map((term) => ({
			congress: term.congress,
			chamber: term.chamber,
			startYear: term.startYear,
			endYear: term.endYear,
			state: term.state,
			district: term.district
		}))
	};
}
