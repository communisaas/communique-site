import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	// Ensure user is authenticated
	if (!locals.user) {
		throw redirect(303, '/auth/login?redirect=/templates/create');
	}
	
	return {
		user: locals.user
	};
};