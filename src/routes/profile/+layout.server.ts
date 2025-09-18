import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ locals }) => {
	// Check if user is authenticated
	if (!locals.user) {
		throw redirect(302, '/');
	}

	// Pass user data including address fields for profile completion calculation
	return {
		user: {
			id: locals.user.id,
			name: locals.user.name,
			email: locals.user.email,
			avatar: locals.user.avatar || null,
			street: locals.user.street,
			city: locals.user.city,
			state: locals.user.state,
			zip: locals.user.zip
		}
	};
};
