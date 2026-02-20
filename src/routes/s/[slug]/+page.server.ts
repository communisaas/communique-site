import type { PageServerLoad } from './$types';
import { prisma } from '$lib/core/db';

export const load: PageServerLoad = async ({ locals, parent }) => {
	// Get template and channel data from parent layout
	const parentData = await parent();

	// Load district-level aggregates for social proof (privacy-preserving)
	// NOTE: Messages are pseudonymous - we aggregate by district_hash (SHA-256), not user linkage
	let topDistricts: Array<{ district: string; count: number }> = [];
	let totalDistricts = 0;
	let totalStates = 0;
	let userDistrictCount = 0;
	let userDistrictCode: string | null = null;

	if (parentData.template?.id) {
		try {
			// Aggregate messages by district hash (privacy-preserving - no user tracking)
			const messages = await prisma.message.findMany({
				where: {
					template_id: parentData.template.id,
					delivery_status: 'delivered'
				},
				select: {
					district_hash: true
				}
			});

			// Count by district hash (privacy-preserving aggregate)
			const districtCounts = messages.reduce(
				(acc, msg) => {
					const districtHash = msg.district_hash;
					if (districtHash) {
						acc[districtHash] = (acc[districtHash] || 0) + 1;
					}
					return acc;
				},
				{} as Record<string, number>
			);

			totalDistricts = Object.keys(districtCounts).length;

			// Top 3 district hashes by engagement
			topDistricts = Object.entries(districtCounts)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 3)
				.map(([districtHash, count]) => ({
					district: districtHash.substring(0, 8) + '...',
					count
				}));

			// Personalized "in YOUR district" — only for authenticated users with district_hash
			const userDistrictHash = locals.user?.district_hash;
			if (userDistrictHash && districtCounts[userDistrictHash]) {
				userDistrictCount = districtCounts[userDistrictHash];
			}
		} catch (error) {
			console.error('Error loading district aggregates:', error);
		}

		// Resolve user's district code for human-readable display
		if (locals.user?.id && locals.user?.district_hash) {
			try {
				const userRep = await prisma.user_representatives.findFirst({
					where: { user_id: locals.user.id, is_active: true },
					select: { representative_id: true }
				});
				if (userRep) {
					const rep = await prisma.representative.findUnique({
						where: { id: userRep.representative_id },
						select: { state: true, district: true }
					});
					if (rep?.state && rep?.district) {
						userDistrictCode = `${rep.state}-${rep.district}`;
					}
				}
			} catch {
				// Non-critical — proceed without district code
			}
		}

		// Estimate total states from representative data (one-time aggregate, not user-linked)
		try {
			const stateResult = await prisma.representative.findMany({
				where: { is_active: true },
				select: { state: true },
				distinct: ['state']
			});
			totalStates = stateResult.length;
		} catch {
			// Non-critical
		}
	}

	return {
		user: locals.user,
		template: parentData.template,
		channel: parentData.channel,
		topDistricts,
		totalDistricts,
		totalStates: totalStates || 50, // Fallback
		userDistrictCount,
		userDistrictCode
	};
};
