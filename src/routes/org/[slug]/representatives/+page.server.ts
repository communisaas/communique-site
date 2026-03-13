import { db } from '$lib/core/db';
import { requireRole } from '$lib/server/org';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { org, membership } = await parent();
	requireRole(membership.role, 'viewer');

	// Find distinct countries used by this org's campaigns
	const campaigns = await db.campaign.findMany({
		where: { orgId: org.id },
		select: { targetCountry: true },
		distinct: ['targetCountry']
	});

	const countryCodes = campaigns
		.map((c) => c.targetCountry)
		.filter((c): c is string => c !== null && c !== 'US');

	// Load international reps for those countries (global table)
	const representatives =
		countryCodes.length > 0
			? await db.internationalRepresentative.findMany({
					where: { countryCode: { in: countryCodes } },
					orderBy: [
						{ countryCode: 'asc' },
						{ constituencyName: 'asc' },
						{ name: 'asc' }
					],
					take: 200
				})
			: [];

	return {
		representatives: representatives.map((r) => ({
			id: r.id,
			name: r.name,
			party: r.party,
			constituencyId: r.constituencyId,
			constituencyName: r.constituencyName,
			chamber: r.chamber,
			office: r.office,
			phone: r.phone,
			email: r.email,
			websiteUrl: r.websiteUrl,
			countryCode: r.countryCode
		}))
	};
};
