import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		user: locals.user
			? {
					id: locals.user.id,
					email: locals.user.email,
					name: locals.user.name,
					// Address info for congressional routing
					street: locals.user.street,
					city: locals.user.city,
					state: locals.user.state,
					zip: locals.user.zip,
					congressional_district: locals.user.congressional_district,
					// Verification status
					is_verified: locals.user.is_verified || false,
					verification_method: locals.user.verification_method,
					verified_at: locals.user.verified_at
				}
			: null
	};
};
