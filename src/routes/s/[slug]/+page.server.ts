import type { PageServerLoad } from './$types';
import { prisma } from '$lib/core/db';

export const load: PageServerLoad = async ({ locals, parent }) => {
	// Get template and channel data from parent layout
	const parentData = await parent();

	// Load district-level aggregates for social proof (privacy-preserving)
	// NOTE: Messages are pseudonymous - we aggregate by district_hash (SHA-256), not user linkage
	let topDistricts: Array<{ district: string; count: number }> = [];

	if (parentData.template?.id) {
		try {
			// Aggregate messages by district hash (privacy-preserving - no user tracking)
			const messages = await prisma.message.findMany({
				where: {
					template_id: parentData.template.id, // Correct field name from schema
					delivery_status: 'delivered' // Use delivery_status instead of status
				},
				select: {
					district_hash: true // SHA-256 hash, not plaintext district
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

			// Top 3 district hashes by engagement
			// NOTE: We only show counts, not actual district names (privacy-preserving)
			topDistricts = Object.entries(districtCounts)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 3)
				.map(([districtHash, count]) => ({
					district: districtHash.substring(0, 8) + '...', // Show truncated hash for privacy
					count
				}));
		} catch (error) {
			console.error('Error loading district aggregates:', error);
			// Continue without district data rather than failing the page
		}
	}

	return {
		user: locals.user,
		// Template and channel are already loaded in layout
		template: parentData.template,
		channel: parentData.channel,
		topDistricts
	};
};
