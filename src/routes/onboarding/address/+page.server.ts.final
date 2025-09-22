import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ _locals }) => {
	// Ensure user is authenticated
	if (!locals.user) {
		throw redirect(302, '/');
	}

	// If user already has an address, redirect them away
	const hasAddress = locals.user.street && locals.user.city && locals.user.state && locals.user.zip;
	if (hasAddress) {
		throw redirect(302, '/profile');
	}

	return {
		user: locals.user
	};
};
