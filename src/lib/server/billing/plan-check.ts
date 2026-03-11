/**
 * Plan tier check for feature gating.
 * Used to enforce minimum plan requirements (e.g., A/B testing = Starter+).
 */

import { db } from '$lib/core/db';
import { PLAN_ORDER } from './plans';

type PlanSlug = (typeof PLAN_ORDER)[number];

export async function orgMeetsPlan(orgId: string, minimumPlan: PlanSlug): Promise<boolean> {
	const subscription = await db.subscription.findUnique({ where: { orgId } });
	const currentPlan = (subscription?.plan ?? 'free') as PlanSlug;
	return PLAN_ORDER.indexOf(currentPlan) >= PLAN_ORDER.indexOf(minimumPlan);
}
