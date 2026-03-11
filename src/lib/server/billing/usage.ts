/**
 * Usage counting and limit enforcement for org billing.
 *
 * Counts verified actions (CampaignAction.verified=true) and emails sent
 * (EmailBatch.sentCount) within the current billing period.
 *
 * For free-tier orgs (no Subscription record), the period is the current calendar month.
 */

import { db } from '$lib/core/db';
import { getPlanForOrg, type PlanLimits } from './plans';

export interface UsagePeriod {
	verifiedActions: number;
	emailsSent: number;
	periodStart: Date;
	periodEnd: Date;
	limits: PlanLimits;
}

export async function getOrgUsage(orgId: string): Promise<UsagePeriod> {
	const subscription = await db.subscription.findUnique({ where: { orgId } });
	const plan = getPlanForOrg(subscription);

	const periodStart = subscription?.current_period_start ?? startOfMonth();
	const periodEnd = subscription?.current_period_end ?? endOfMonth();

	const [verifiedActions, emailsSent] = await Promise.all([
		db.campaignAction.count({
			where: {
				campaign: { orgId },
				verified: true,
				createdAt: { gte: periodStart, lte: periodEnd }
			}
		}),
		db.emailBatch.aggregate({
			where: {
				blast: { orgId },
				sentAt: { gte: periodStart, lte: periodEnd }
			},
			_sum: { sentCount: true }
		})
	]);

	return {
		verifiedActions,
		emailsSent: emailsSent._sum.sentCount ?? 0,
		periodStart,
		periodEnd,
		limits: plan
	};
}

export function isOverLimit(usage: UsagePeriod): { actions: boolean; emails: boolean } {
	return {
		actions: usage.verifiedActions >= usage.limits.maxVerifiedActions,
		emails: usage.emailsSent >= usage.limits.maxEmails
	};
}

function startOfMonth(): Date {
	const d = new Date();
	d.setDate(1);
	d.setHours(0, 0, 0, 0);
	return d;
}

function endOfMonth(): Date {
	const d = new Date();
	d.setMonth(d.getMonth() + 1, 0);
	d.setHours(23, 59, 59, 999);
	return d;
}
