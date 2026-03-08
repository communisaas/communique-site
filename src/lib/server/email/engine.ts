import { db } from '$lib/core/db';
import { sendEmail } from './ses';
import {
	compileEmail,
	buildTierContext,
	type MergeContext,
	type VerificationBlock
} from './compiler';
import { buildUnsubscribeUrl } from './unsubscribe';
import { computeVerificationPacket, computeOrgVerificationPacket } from '$lib/server/campaigns/verification';

const BATCH_SIZE = 100;

const TIER_LABELS: Record<number, string> = {
	0: 'New',
	1: 'Active',
	2: 'Established',
	3: 'Veteran',
	4: 'Pillar'
};

export interface RecipientFilter {
	tagIds?: string[];
	verified?: 'any' | 'verified' | 'unverified';
	tierMinimum?: number; // CampaignAction engagement tier minimum
	emailStatus?: string;
}

/**
 * Query supporters matching the filter criteria.
 * Only includes supporters with emailStatus === 'subscribed'.
 */
export async function resolveRecipients(
	orgId: string,
	filter: RecipientFilter | null
): Promise<
	Array<{
		id: string;
		email: string;
		name: string | null;
		postalCode: string | null;
		verified: boolean;
		identityCommitment: string | null;
	}>
> {
	const where: Record<string, unknown> = {
		orgId,
		emailStatus: 'subscribed'
	};

	if (filter) {
		if (filter.verified === 'verified') {
			where.verified = true;
			where.identityCommitment = { not: null };
		} else if (filter.verified === 'unverified') {
			where.OR = [{ verified: false }, { identityCommitment: null }];
		}

		if (filter.tagIds && filter.tagIds.length > 0) {
			where.tags = { some: { tagId: { in: filter.tagIds } } };
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const supporters = await db.supporter.findMany({
		where: where as any,
		select: {
			id: true,
			email: true,
			name: true,
			postalCode: true,
			verified: true,
			identityCommitment: true
		},
		orderBy: { createdAt: 'asc' }
	});

	return supporters;
}

/**
 * Count supporters matching filter criteria (for real-time preview).
 */
export async function countRecipients(
	orgId: string,
	filter: RecipientFilter | null
): Promise<number> {
	const where: Record<string, unknown> = {
		orgId,
		emailStatus: 'subscribed'
	};

	if (filter) {
		if (filter.verified === 'verified') {
			where.verified = true;
			where.identityCommitment = { not: null };
		} else if (filter.verified === 'unverified') {
			where.OR = [{ verified: false }, { identityCommitment: null }];
		}

		if (filter.tagIds && filter.tagIds.length > 0) {
			where.tags = { some: { tagId: { in: filter.tagIds } } };
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return db.supporter.count({ where: where as any });
}

/**
 * Build the verification block from a packet.
 */
function buildVerificationBlock(
	packet: { total: number; verified: number; verifiedPct: number; districtCount: number; tiers: Array<{ tier: number; label: string; count: number }> },
	totalRecipients: number
): VerificationBlock {
	// Build tier summary from non-zero, non-suppressed tiers (descending order by tier level)
	const tierParts = [...packet.tiers]
		.filter((t) => t.count > 0)
		.sort((a, b) => b.tier - a.tier)
		.map((t) => `${t.count} ${t.label}`);

	return {
		totalRecipients,
		verifiedCount: packet.verified,
		verifiedPct: packet.verifiedPct,
		districtCount: packet.districtCount,
		tierSummary: tierParts.join(', ')
	};
}

/**
 * Derive verification status from supporter fields.
 */
function deriveVerificationStatus(
	verified: boolean,
	identityCommitment: string | null,
	postalCode: string | null
): 'verified' | 'postal-resolved' | 'imported' {
	if (verified && identityCommitment) return 'verified';
	if (postalCode) return 'postal-resolved';
	return 'imported';
}

/**
 * Split a name string into first/last parts.
 */
function splitName(name: string | null): { firstName: string; lastName: string } {
	if (!name) return { firstName: 'Supporter', lastName: '' };
	const parts = name.trim().split(/\s+/);
	if (parts.length === 1) return { firstName: parts[0], lastName: '' };
	return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/**
 * Send an email blast: load recipients, compile per-recipient emails, send via SES in batches.
 */
export async function sendBlast(blastId: string): Promise<void> {
	// 1. Load blast
	const blast = await db.emailBlast.findUnique({ where: { id: blastId } });
	if (!blast || blast.status !== 'draft') return;

	// Mark as sending
	await db.emailBlast.update({
		where: { id: blastId },
		data: { status: 'sending' }
	});

	try {
		// 2. Resolve recipients
		const filter = blast.recipientFilter as RecipientFilter | null;
		const recipients = await resolveRecipients(blast.orgId, filter);

		// Update total recipients
		await db.emailBlast.update({
			where: { id: blastId },
			data: { totalRecipients: recipients.length }
		});

		if (recipients.length === 0) {
			await db.emailBlast.update({
				where: { id: blastId },
				data: { status: 'sent', sentAt: new Date(), totalSent: 0 }
			});
			return;
		}

		// 3. Compute verification context
		let packet;
		if (blast.campaignId) {
			packet = await computeVerificationPacket(blast.campaignId, blast.orgId);
		} else {
			packet = await computeOrgVerificationPacket(blast.orgId);
		}

		const verificationBlock = buildVerificationBlock(packet, recipients.length);

		// Store verification context on blast
		await db.emailBlast.update({
			where: { id: blastId },
			data: {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			verificationContext: verificationBlock as any
			}
		});

		// 4. Split into batches
		const batches: typeof recipients[] = [];
		for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
			batches.push(recipients.slice(i, i + BATCH_SIZE));
		}

		// 5. Create batch records
		const batchRecords = await Promise.all(
			batches.map((_, idx) =>
				db.emailBatch.create({
					data: {
						blastId,
						batchIndex: idx,
						status: 'pending'
					}
				})
			)
		);

		let totalSent = 0;
		let totalBounced = 0;

		// 6. Process each batch
		for (let i = 0; i < batches.length; i++) {
			const batch = batches[i];
			const batchRecord = batchRecords[i];

			await db.emailBatch.update({
				where: { id: batchRecord.id },
				data: { status: 'sending' }
			});

			let batchSent = 0;
			let batchFailed = 0;
			let lastError: string | null = null;

			for (const recipient of batch) {
				const { firstName, lastName } = splitName(recipient.name);
				const verificationStatus = deriveVerificationStatus(
					recipient.verified,
					recipient.identityCommitment,
					recipient.postalCode
				);

				const merge: MergeContext = {
					firstName,
					lastName,
					email: recipient.email,
					postalCode: recipient.postalCode,
					verificationStatus,
					tierLabel: null,
					tierContext: buildTierContext(verificationStatus)
				};

				const unsubscribeUrl = buildUnsubscribeUrl(recipient.id, blast.orgId);
				const htmlBody = compileEmail(blast.bodyHtml, merge, verificationBlock, unsubscribeUrl);
				const result = await sendEmail(
					recipient.email,
					blast.fromEmail,
					blast.fromName,
					blast.subject,
					htmlBody,
					unsubscribeUrl
				);

				if (result.success) {
					batchSent++;
				} else {
					batchFailed++;
					lastError = result.error ?? 'Unknown error';
				}
			}

			await db.emailBatch.update({
				where: { id: batchRecord.id },
				data: {
					status: batchFailed === batch.length ? 'failed' : 'sent',
					sentCount: batchSent,
					failedCount: batchFailed,
					error: lastError,
					sentAt: new Date()
				}
			});

			totalSent += batchSent;
			totalBounced += batchFailed;
		}

		// 7. Finalize blast
		await db.emailBlast.update({
			where: { id: blastId },
			data: {
				status: 'sent',
				totalSent,
				totalBounced,
				sentAt: new Date()
			}
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		await db.emailBlast.update({
			where: { id: blastId },
			data: { status: 'failed' }
		});
		console.error(`[email-engine] Blast ${blastId} failed:`, message);
	}
}
