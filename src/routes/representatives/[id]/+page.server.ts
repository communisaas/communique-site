import type { PageServerLoad } from './$types';
import { getMember, getMemberVoteHistory } from '$lib/server/congress/votes';
import { error } from '@sveltejs/kit';

/**
 * Representative Profile - Server Data Loading
 *
 * Loads representative information and recent voting history.
 * Demonstrates progressive disclosure pattern with Vote components.
 */
export const load: PageServerLoad = async ({ params }) => {
	const { id } = params;

	try {
		// Fetch member and their vote history in parallel
		const [member, voteHistory] = await Promise.all([
			getMember(id),
			getMemberVoteHistory(id, { limit: 20 })
		]);

		if (!member) {
			throw error(404, {
				message: 'Representative not found',
				detail: `No representative found with ID: ${id}`
			});
		}

		return {
			member,
			voteHistory: voteHistory || null
		};
	} catch (e) {
		console.error('[representatives/[id]] Load failed:', e);

		// If it's already an error with a status, rethrow it
		if (e && typeof e === 'object' && 'status' in e) {
			throw e;
		}

		// Otherwise, throw a generic server error
		throw error(500, {
			message: 'Failed to load representative data',
			detail: e instanceof Error ? e.message : 'Unknown error occurred'
		});
	}
};
