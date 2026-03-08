import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { loadOrgContext, requireRole } from '$lib/server/org';
import { countRecipients, sendBlast, type RecipientFilter } from '$lib/server/email/engine';
import {
	compileEmail,
	buildTierContext,
	type MergeContext,
	type VerificationBlock
} from '$lib/server/email/compiler';
import { sanitizeEmailBody } from '$lib/server/email/sanitize';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { org } = await parent();

	const [campaigns, tags, subscribedCount] = await Promise.all([
		db.campaign.findMany({
			where: { orgId: org.id },
			select: { id: true, title: true, status: true },
			orderBy: { updatedAt: 'desc' }
		}),
		db.tag.findMany({
			where: { orgId: org.id },
			select: { id: true, name: true },
			orderBy: { name: 'asc' }
		}),
		db.supporter.count({
			where: { orgId: org.id, emailStatus: 'subscribed' }
		})
	]);

	return {
		campaigns: campaigns.map((c) => ({
			id: c.id,
			title: c.title,
			status: c.status
		})),
		tags,
		subscribedCount
	};
};

function parseFilter(formData: FormData): RecipientFilter {
	const tagIds = formData.getAll('tagIds').map(String).filter(Boolean);
	const verified = formData.get('verified')?.toString() || 'any';
	return {
		tagIds: tagIds.length > 0 ? tagIds : undefined,
		verified: verified as 'any' | 'verified' | 'unverified'
	};
}

export const actions: Actions = {
	count: async ({ request, params, locals }) => {
		if (!locals.user) {
			throw redirect(302, `/auth/google?returnTo=/org/${params.slug}/emails/compose`);
		}
		const { org, membership } = await loadOrgContext(params.slug, locals.user.id);
		requireRole(membership.role, 'editor');

		const formData = await request.formData();
		const filter = parseFilter(formData);
		const count = await countRecipients(org.id, filter);

		return { count };
	},

	preview: async ({ request, params, locals }) => {
		if (!locals.user) {
			throw redirect(302, `/auth/google?returnTo=/org/${params.slug}/emails/compose`);
		}
		const { org, membership } = await loadOrgContext(params.slug, locals.user.id);
		requireRole(membership.role, 'editor');

		const formData = await request.formData();
		const subject = formData.get('subject')?.toString().trim() || '(No subject)';
		const rawBodyHtml = formData.get('bodyHtml')?.toString() || '';
		const bodyHtml = sanitizeEmailBody(rawBodyHtml);

		const sampleMerge: MergeContext = {
			firstName: 'Jane',
			lastName: 'Doe',
			email: 'jane@example.com',
			postalCode: '90210',
			verificationStatus: 'verified',
			tierLabel: 'Established',
			tierContext: buildTierContext('verified')
		};

		const sampleVerification: VerificationBlock = {
			totalRecipients: 150,
			verifiedCount: 45,
			verifiedPct: 30,
			districtCount: 8,
			tierSummary: '3 Pillars, 12 Veterans, 30 Established'
		};

		const compiledHtml = compileEmail(bodyHtml, sampleMerge, sampleVerification, 'https://commons.email/unsubscribe/sample/token');

		return { previewHtml: compiledHtml, previewSubject: subject };
	},

	send: async ({ request, params, locals, platform }) => {
		if (!locals.user) {
			throw redirect(302, `/auth/google?returnTo=/org/${params.slug}/emails/compose`);
		}
		const { org, membership } = await loadOrgContext(params.slug, locals.user.id);
		requireRole(membership.role, 'editor');

		const formData = await request.formData();
		const subject = formData.get('subject')?.toString().trim();
		const rawBodyHtml = formData.get('bodyHtml')?.toString();
		const rawFromName = formData.get('fromName')?.toString().trim() || org.name;
		// Strip control characters (CRLF injection) and angle brackets (display name spoofing)
		const fromName = rawFromName.replace(/[\x00-\x1f\x7f<>"]/g, '').slice(0, 64);
		if (!fromName) {
			return fail(400, { error: 'From name is required' });
		}
		// Force from email to org slug — prevent local-part spoofing
		const fromEmail = `${org.slug}@commons.email`;
		const campaignId = formData.get('campaignId')?.toString() || null;

		if (!subject) {
			return fail(400, { error: 'Subject is required' });
		}
		if (!rawBodyHtml) {
			return fail(400, { error: 'Email body is required' });
		}
		const bodyHtml = sanitizeEmailBody(rawBodyHtml);

		// Validate campaignId belongs to org if provided
		if (campaignId) {
			const campaign = await db.campaign.findFirst({
				where: { id: campaignId, orgId: org.id }
			});
			if (!campaign) {
				return fail(400, { error: 'Invalid campaign selection' });
			}
		}

		const filter = parseFilter(formData);

		// Count recipients before creating blast
		const recipientCount = await countRecipients(org.id, filter);
		if (recipientCount === 0) {
			return fail(400, { error: 'No recipients match your filters. Adjust filters and try again.' });
		}

		// Create blast
		const blast = await db.emailBlast.create({
			data: {
				orgId: org.id,
				campaignId,
				subject,
				bodyHtml,
				fromName,
				fromEmail,
				status: 'draft',
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			recipientFilter: filter as any,
				totalRecipients: recipientCount
			}
		});

		// Send pipeline runs async -- use waitUntil on CF Workers to keep alive
		const blastPromise = sendBlast(blast.id).catch((err) => {
			console.error(`[email-engine] Blast ${blast.id} async error:`, err);
		});
		if (platform?.ctx?.waitUntil) {
			platform.ctx.waitUntil(blastPromise);
		}

		throw redirect(302, `/org/${params.slug}/emails`);
	}
};
