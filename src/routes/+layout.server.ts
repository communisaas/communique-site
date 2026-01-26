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
		const representatives =
			userWithRepresentatives?.representatives?.map((ur) => ({
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
				avatar: locals.user.avatar,
				// Verification status
				is_verified: locals.user.is_verified || false,
				verification_method: locals.user.verification_method,
				verified_at: locals.user.verified_at,
				// Privacy-preserving district (hash only)
				district_hash: locals.user.district_hash,
				district_verified: locals.user.district_verified,
				// Representatives data for template resolution
				representatives: representatives
			}
		};
	} catch {
		console.error('Error occurred');
		// Fallback to basic user data without representatives
		return {
			user: {
				id: locals.user.id,
				email: locals.user.email,
				name: locals.user.name,
				avatar: locals.user.avatar,
				is_verified: locals.user.is_verified || false,
				verification_method: locals.user.verification_method,
				verified_at: locals.user.verified_at,
				district_hash: locals.user.district_hash,
				district_verified: locals.user.district_verified,
				representatives: []
			}
		};
	}
};
