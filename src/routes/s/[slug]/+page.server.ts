import type { PageServerLoad } from './$types';
import { prisma } from '$lib/core/db';

export const load: PageServerLoad = async ({ locals, parent }) => {
	// Get template and channel data from parent layout
	const parentData = await parent();

	// Load district-level aggregates for social proof (privacy-preserving)
	let topDistricts: Array<{ district: string; count: number }> = [];

	if (parentData.template?.id) {
		try {
			// Aggregate submissions by congressional district
			const submissions = await prisma.submission.findMany({
				where: {
					template_id: parentData.template.id,
					status: 'sent'
				},
				select: {
					user: {
						select: {
							congressional_district: true
						}
					}
				}
			});

			// Count by district (privacy-preserving aggregate)
			const districtCounts = submissions.reduce(
				(acc, sub) => {
					const district = sub.user?.congressional_district;
					if (district) {
						acc[district] = (acc[district] || 0) + 1;
					}
					return acc;
				},
				{} as Record<string, number>
			);

			// Top 3 districts by engagement
			topDistricts = Object.entries(districtCounts)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 3)
				.map(([district, count]) => ({ district, count }));
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
