/**
 * Convert SegmentFilter conditions into Prisma where clauses.
 * All values are parameterized through Prisma — no raw SQL.
 */
import type { SegmentFilter, SegmentCondition } from '$lib/types/segment';

type PrismaWhere = Record<string, unknown>;

function buildConditionWhere(condition: SegmentCondition): PrismaWhere | null {
	switch (condition.field) {
		case 'tag': {
			const tagIds = Array.isArray(condition.value) ? condition.value : [condition.value];
			if (tagIds.length === 0) return null;
			if (condition.operator === 'includes') {
				return { tags: { some: { tagId: { in: tagIds } } } };
			}
			if (condition.operator === 'excludes') {
				return { tags: { none: { tagId: { in: tagIds } } } };
			}
			return null;
		}

		case 'verification': {
			const val = String(condition.value);
			if (val === 'verified') {
				return { verified: true, identityCommitment: { not: null } };
			}
			if (val === 'postal') {
				return {
					postalCode: { not: null },
					OR: [{ verified: false }, { identityCommitment: null }]
				};
			}
			if (val === 'unverified') {
				return {
					postalCode: null,
					OR: [{ verified: false }, { identityCommitment: null }]
				};
			}
			return null;
		}

		case 'engagementTier': {
			const tier = Number(condition.value);
			if (isNaN(tier) || tier < 0 || tier > 4) return null;
			// Engagement tier lives on CampaignAction, so filter supporters who have at least one action matching
			if (condition.operator === 'equals') {
				return { actions: { some: { engagementTier: tier } } };
			}
			if (condition.operator === 'gte') {
				return { actions: { some: { engagementTier: { gte: tier } } } };
			}
			if (condition.operator === 'lte') {
				return { actions: { some: { engagementTier: { lte: tier } } } };
			}
			return null;
		}

		case 'source': {
			const src = String(condition.value);
			if (condition.operator === 'equals') {
				return { source: src };
			}
			if (condition.operator === 'excludes') {
				return { source: { not: src } };
			}
			return null;
		}

		case 'emailStatus': {
			const status = String(condition.value);
			if (condition.operator === 'equals') {
				return { emailStatus: status };
			}
			if (condition.operator === 'excludes') {
				return { emailStatus: { not: status } };
			}
			return null;
		}

		case 'dateRange': {
			if (condition.operator === 'before' && condition.value) {
				return { createdAt: { lt: new Date(String(condition.value)) } };
			}
			if (condition.operator === 'after' && condition.value) {
				return { createdAt: { gt: new Date(String(condition.value)) } };
			}
			if (condition.operator === 'between' && typeof condition.value === 'object' && condition.value !== null) {
				const range = condition.value as { from?: string; to?: string };
				const clause: Record<string, Date> = {};
				if (range.from) clause.gte = new Date(range.from);
				if (range.to) clause.lte = new Date(range.to);
				if (Object.keys(clause).length === 0) return null;
				return { createdAt: clause };
			}
			return null;
		}

		case 'campaignParticipation': {
			const campaignId = String(condition.value);
			if (!campaignId) return null;
			if (condition.operator === 'participated') {
				return { actions: { some: { campaignId } } };
			}
			if (condition.operator === 'notParticipated') {
				return { actions: { none: { campaignId } } };
			}
			return null;
		}

		default:
			return null;
	}
}

/**
 * Build a Prisma where clause from a SegmentFilter.
 * Always scopes to the given orgId.
 */
export function buildSegmentWhere(orgId: string, filter: SegmentFilter): PrismaWhere {
	const conditionWheres = filter.conditions
		.map(buildConditionWhere)
		.filter((w): w is PrismaWhere => w !== null);

	const base: PrismaWhere = { orgId };

	if (conditionWheres.length === 0) return base;

	if (filter.logic === 'OR') {
		return { ...base, OR: conditionWheres };
	}

	// AND: merge all conditions
	return { ...base, AND: conditionWheres };
}
