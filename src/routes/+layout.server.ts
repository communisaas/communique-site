import type { LayoutServerLoad } from './$types';
import { db } from '$lib/core/db';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { user: null };
	}

	// Fetch user with representatives data
	try {
		const userWithRepresentatives = await db.user.findUnique({
			where: { id: locals.user.id },
			include: {
				representatives: {
					include: {
						representative: {
							select: {
								name: true,
								party: true,
								chamber: true,
								state: true,
								district: true,
								is_active: true
							}
						}
					},
					where: {
						is_active: true
					}
				}
			}
		});

		// Transform representatives data to simple format for frontend
		const representatives = userWithRepresentatives?.representatives?.map(ur => ({
			name: ur.representative.name,
			party: ur.representative.party,
			chamber: ur.representative.chamber,
			state: ur.representative.state,
			district: ur.representative.district
		})) || [];

		return {
			user: {
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
				verified_at: locals.user.verified_at,
				// Representatives data for template resolution
				representatives: representatives
			}
		};
	} catch (error) {
		console.error('Error fetching user representatives:', error);
		// Fallback to basic user data without representatives
		return {
			user: {
				id: locals.user.id,
				email: locals.user.email,
				name: locals.user.name,
				street: locals.user.street,
				city: locals.user.city,
				state: locals.user.state,
				zip: locals.user.zip,
				congressional_district: locals.user.congressional_district,
				is_verified: locals.user.is_verified || false,
				verification_method: locals.user.verification_method,
				verified_at: locals.user.verified_at,
				representatives: []
			}
		};
	}
};
