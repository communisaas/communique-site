import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ _locals }) => {
	// Ensure user is authenticated
	if (!locals.user) {
		throw redirect(302, '/');
	}

	// If user already has profile info, redirect them away
	// (We'll check if they have role/organization filled in)
	// For now, always allow profile completion to update info

	return {
		user: locals.user
	};
};
