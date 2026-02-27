import type { LayoutServerLoad } from './$types';
import { db } from '$lib/core/db';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	// Cache user data across navigations — only re-fetch when explicitly invalidated
	depends('data:user');

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
				// Graduated trust tier (0-5)
				trust_tier: locals.user.trust_tier ?? 0,
				// Verification status
				is_verified: locals.user.is_verified || false,
				verification_method: locals.user.verification_method,
				verified_at: locals.user.verified_at,
				// Passkey status (needed for PasskeyUpgrade component)
				passkey_credential_id: userWithRepresentatives?.passkey_credential_id ?? null,
				// Privacy-preserving district (hash only)
				district_hash: locals.user.district_hash,
				district_verified: locals.user.district_verified,
				// Wallet integration
				wallet_address: userWithRepresentatives?.wallet_address ?? null,
				wallet_type: userWithRepresentatives?.wallet_type ?? null,
				near_account_id: userWithRepresentatives?.near_account_id ?? null,
				near_derived_scroll_address: userWithRepresentatives?.near_derived_scroll_address ?? null,
				// Representatives data for template resolution
				representatives: representatives
			}
		};
	} catch (error) {
		console.error('[Layout] Failed to load representatives:', error instanceof Error ? error.message : String(error));
		// Fallback to basic user data without representatives
		return {
			user: {
				id: locals.user.id,
				email: locals.user.email,
				name: locals.user.name,
				avatar: locals.user.avatar,
				trust_tier: locals.user.trust_tier ?? 0,
				is_verified: locals.user.is_verified || false,
				verification_method: locals.user.verification_method,
				verified_at: locals.user.verified_at,
				passkey_credential_id: null, // Not available in fallback path
				district_hash: locals.user.district_hash,
				district_verified: locals.user.district_verified,
				// Wallet integration
				wallet_address: locals.user.wallet_address ?? null,
				wallet_type: locals.user.wallet_type ?? null,
				near_account_id: locals.user.near_account_id ?? null,
				near_derived_scroll_address: locals.user.near_derived_scroll_address ?? null,
				representatives: []
			}
		};
	}
};
