import { error, fail } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { getRateLimiter } from '$lib/core/security/rate-limiter';
import { getOrgUsage, isOverLimit } from '$lib/server/billing/usage';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const campaign = await db.campaign.findFirst({
		where: { id: params.slug, status: 'ACTIVE' },
		include: {
			org: { select: { name: true, slug: true, avatar: true } },
			_count: { select: { actions: { where: { verified: true } } } }
		}
	});

	if (!campaign) {
		throw error(404, 'Campaign not found');
	}

	// Parallel queries for stats
	const [totalActions, districtCounts, tierDist] = await Promise.all([
		// Total action count (all, not just verified) for social proof
		db.campaignAction.count({
			where: { campaignId: campaign.id }
		}),
		// Unique districts for geographic spread
		db.campaignAction.groupBy({
			by: ['districtHash'],
			where: { campaignId: campaign.id, verified: true, districtHash: { not: null } },
			_count: true
		}),
		// Tier distribution for social proof
		db.campaignAction.groupBy({
			by: ['engagementTier'],
			where: { campaignId: campaign.id, verified: true },
			_count: true,
			orderBy: { engagementTier: 'asc' }
		})
	]);

	return {
		campaign: {
			id: campaign.id,
			title: campaign.title,
			body: campaign.body,
			type: campaign.type,
			orgName: campaign.org.name,
			orgSlug: campaign.org.slug,
			orgAvatar: campaign.org.avatar,
			targets: campaign.targets as Array<{ name: string; email: string; title?: string; district?: string }> | null
		},
		stats: {
			verifiedActions: campaign._count.actions,
			totalActions,
			uniqueDistricts: districtCounts.length,
			tierDistribution: tierDist.map(t => ({
				tier: t.engagementTier,
				count: t._count
			}))
		}
	};
};

export const actions: Actions = {
	default: async ({ request, params, getClientAddress }) => {
		// Look up the campaign (must be ACTIVE)
		const campaign = await db.campaign.findFirst({
			where: { id: params.slug, status: 'ACTIVE' },
			select: {
				id: true,
				orgId: true,
				type: true,
				title: true
			}
		});

		if (!campaign) {
			return fail(404, { error: 'Campaign not found or inactive' });
		}

		// Rate limit: 10 submissions per minute per IP per campaign
		const ip = getClientAddress();
		const rlKey = `ratelimit:campaign:${params.slug}:${ip}`;
		const rl = await getRateLimiter().check(rlKey, { maxRequests: 10, windowMs: 60_000 });
		if (!rl.allowed) {
			return fail(429, { error: 'Too many submissions. Please try again later.' });
		}

		// Plan limit check — enforce billing tier action caps
		const usage = await getOrgUsage(campaign.orgId);
		if (isOverLimit(usage).actions) {
			return fail(403, { error: 'This campaign has reached its action limit for the current billing period.' });
		}

		const formData = await request.formData();
		const email = formData.get('email')?.toString().trim().toLowerCase();
		const name = formData.get('name')?.toString().trim();
		const postalCode = formData.get('postalCode')?.toString().trim() || null;
		const message = formData.get('message')?.toString().trim() || null;

		if (!email) {
			return fail(400, { error: 'Email is required' });
		}

		if (!name) {
			return fail(400, { error: 'Name is required' });
		}

		// Basic email validation
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return fail(400, { error: 'Please enter a valid email address' });
		}

		// Find or create supporter (dedup on orgId + email)
		let supporter = await db.supporter.findUnique({
			where: { orgId_email: { orgId: campaign.orgId, email } }
		});

		if (!supporter) {
			supporter = await db.supporter.create({
				data: {
					orgId: campaign.orgId,
					email,
					name,
					postalCode,
					source: 'campaign'
				}
			});
		} else {
			// Update fields if not already set
			const updates: Record<string, string> = {};
			if (name && !supporter.name) updates.name = name;
			if (postalCode && !supporter.postalCode) updates.postalCode = postalCode;

			if (Object.keys(updates).length > 0) {
				await db.supporter.update({
					where: { id: supporter.id },
					data: updates
				});
			}
		}

		// Compute districtHash server-side with a salt (not client-controllable).
		// The salt prevents rainbow-table reversal of the ~42K US ZIP code space.
		let districtHash: string | null = null;
		if (postalCode) {
			const salt = process.env.DISTRICT_HASH_SALT || 'commons-district-v1';
			const encoder = new TextEncoder();
			const hashBuffer = await crypto.subtle.digest(
				'SHA-256',
				encoder.encode(`${salt}:${postalCode.toLowerCase()}`)
			);
			const hashArray = Array.from(new Uint8Array(hashBuffer));
			districtHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
		}

		// Compute messageHash if a message was provided
		let messageHash: string | null = null;
		if (message) {
			const encoder = new TextEncoder();
			const data = encoder.encode(message);
			const hashBuffer = await crypto.subtle.digest('SHA-256', data);
			const hashArray = Array.from(new Uint8Array(hashBuffer));
			messageHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
		}

		// Deduplicate: one action per supporter per campaign
		const existingAction = await db.campaignAction.findFirst({
			where: { campaignId: campaign.id, supporterId: supporter.id }
		});

		if (existingAction) {
			const actionCount = await db.campaignAction.count({
				where: { campaignId: campaign.id, verified: true }
			});
			return {
				success: true,
				actionCount,
				supporterName: name,
				alreadySubmitted: true
			};
		}

		// Create the campaign action
		// Verified if postal code was provided (district hash computed server-side above)
		const verified = !!postalCode;

		await db.campaignAction.create({
			data: {
				campaignId: campaign.id,
				supporterId: supporter.id,
				verified,
				engagementTier: verified ? 1 : 0,
				districtHash,
				messageHash
			}
		});

		// Get updated counts
		const [verifiedCount, totalCount] = await Promise.all([
			db.campaignAction.count({
				where: { campaignId: campaign.id, verified: true }
			}),
			db.campaignAction.count({
				where: { campaignId: campaign.id }
			})
		]);

		return {
			success: true,
			actionCount: verifiedCount,
			totalCount,
			supporterName: name,
			verified
		};
	}
};
