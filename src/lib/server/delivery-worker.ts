/**
 * Delivery Worker
 *
 * Background processor: decrypt witness -> look up reps -> CWC submit -> update status.
 * Called via platform.context.waitUntil() after submission creation.
 *
 * Flow:
 * 1. Update delivery_status to 'processing'
 * 2. Decrypt encrypted witness to extract deliveryAddress
 * 3. Look up congressional representatives via Shadow Atlas (pre-ingested, zero gov API calls)
 * 4. Fetch template for message body
 * 5. Submit to each representative via CWC (Senate direct, House via GCP proxy)
 * 6. Update Submission record with delivery results
 *
 * Error handling:
 * - Any unrecoverable error sets delivery_status='failed' with error message
 * - Per-representative errors are captured but don't block other deliveries
 * - No retry logic here (handled by submission-retry-queue)
 */

import type { PrismaClient } from '@prisma/client';
import { getConstituentResolver } from '$lib/server/tee';
import { getOfficials, type Official } from '$lib/core/shadow-atlas/client';
import { cwcClient } from '$lib/core/legislative/cwc-client';
import type { LegislativeOffice } from '$lib/core/legislative/types';
import type { CwcTemplate } from '$lib/types/template';
import type { EmailServiceUser } from '$lib/types/user';
import { dev } from '$app/environment';

interface DeliveryResult {
	success: boolean;
	results: Array<{
		office: string;
		chamber: string;
		status: string;
		messageId?: string;
		error?: string;
	}>;
}

export async function processSubmissionDelivery(
	submissionId: string,
	db: PrismaClient
): Promise<DeliveryResult> {
	const client = db;
	console.debug('[Delivery] Starting delivery for submission:', submissionId);

	try {
		// Step 1: Mark as processing
		await client.submission.update({
			where: { id: submissionId },
			data: { delivery_status: 'processing' }
		});

		// Step 2: Read submission
		const submission = await client.submission.findUnique({
			where: { id: submissionId },
			select: {
				id: true,
				template_id: true,
				encrypted_witness: true,
				witness_nonce: true,
				ephemeral_public_key: true,
				tee_key_id: true
			}
		});

		if (!submission) {
			throw new Error(`Submission not found: ${submissionId}`);
		}

		// Demo mode: simulate successful delivery without decryption or CWC API
		if (dev) {
			console.debug('[Delivery] Demo mode — simulating successful delivery for:', submissionId);
			await client.submission.update({
				where: { id: submissionId },
				data: {
					delivery_status: 'delivered',
					delivered_at: new Date(),
					cwc_submission_id: `demo-${submissionId.slice(0, 8)}`
				}
			});
			return {
				success: true,
				results: [{ office: 'Demo Office', chamber: 'demo', status: 'delivered', messageId: `demo-${submissionId.slice(0, 8)}` }]
			};
		}

		// Step 3: Resolve constituent data via TEE abstraction
		// MVP: in-process decryption. PII is function-scoped, never persisted in plaintext.
		// Future: NitroEnclaveResolver — PII never leaves enclave boundary.
		if (!submission.witness_nonce || !submission.ephemeral_public_key) {
			throw new Error('Missing encryption metadata (nonce or ephemeral key)');
		}

		const resolver = getConstituentResolver();
		const resolved = await resolver.resolve({
			ciphertext: submission.encrypted_witness,
			nonce: submission.witness_nonce,
			ephemeralPublicKey: submission.ephemeral_public_key
		});

		if (!resolved.success || !resolved.constituent) {
			throw new Error(resolved.error || 'Failed to resolve constituent data');
		}

		const deliveryAddress = {
			name: resolved.constituent.name,
			email: resolved.constituent.email,
			street: resolved.constituent.address.street,
			city: resolved.constituent.address.city,
			state: resolved.constituent.address.state,
			zip: resolved.constituent.address.zip,
			phone: resolved.constituent.phone,
			congressional_district: resolved.constituent.congressionalDistrict
		};

		console.debug('[Delivery] Resolved constituent data for:', {
			submissionId,
			state: deliveryAddress.state,
			district: deliveryAddress.congressional_district || 'unknown'
		});

		// Step 5: Look up representatives via Shadow Atlas (pre-ingested, zero gov API calls)
		const districtCode = deliveryAddress.congressional_district;
		if (!districtCode) {
			throw new Error('No congressional_district in delivery address — cannot route to representatives');
		}

		const saResponse = await getOfficials(districtCode);

		// Map Shadow Atlas officials to the shape the CWC client expects
		const representatives = saResponse.officials.map((o: Official) => ({
			bioguide_id: o.bioguide_id,
			name: o.name,
			party: o.party,
			state: o.state,
			district: o.chamber === 'senate' ? o.state : (o.district ?? districtCode.split('-')[1]),
			chamber: o.chamber,
			office_code: o.cwc_code ?? o.bioguide_id,
			is_voting_member: o.is_voting,
			delegate_type: o.delegate_type
		}));

		if (representatives.length === 0) {
			throw new Error(`No representatives found for district ${districtCode}`);
		}

		console.debug(
			'[Delivery] Found representatives via Shadow Atlas:',
			representatives.map((r: { name: string; chamber: string }) => `${r.name} (${r.chamber})`)
		);

		// Step 6: Fetch template for message body
		const template = await client.template.findUnique({
			where: { id: submission.template_id },
			select: {
				id: true,
				title: true,
				description: true,
				message_body: true,
				delivery_config: true
			}
		});

		if (!template) {
			throw new Error(`Template not found: ${submission.template_id}`);
		}

		// Narrowed select result satisfies CwcTemplate — no cast needed
		const cwcTemplate: CwcTemplate = template;

		// Step 7: Build CWC user from delivery address
		const cwcUser: EmailServiceUser = {
			id: submissionId,
			name: deliveryAddress.name || 'Constituent',
			email: deliveryAddress.email,
			street: deliveryAddress.street,
			city: deliveryAddress.city,
			state: deliveryAddress.state,
			zip: deliveryAddress.zip,
			phone: deliveryAddress.phone || null,
			congressional_district: deliveryAddress.congressional_district || null
		};

		// Step 8: Submit to each representative
		const results: DeliveryResult['results'] = [];
		const messageIds: string[] = [];

		for (const rep of representatives) {
			const office: LegislativeOffice = {
				bioguideId: rep.bioguide_id,
				name: rep.name,
				chamber: rep.chamber,
				officeCode: rep.office_code,
				state: rep.state,
				district: rep.district,
				party: rep.party
			};

			try {
				const message = cwcTemplate.message_body || cwcTemplate.description || '';

				// Pre-check: ~45% of Senate offices don't accept CWC.
				// Skip with a clear status instead of wasting an API call.
				if (rep.chamber === 'senate') {
					const cwcEnabled = await cwcClient.isSenateOfficeActive(rep.office_code);
					if (!cwcEnabled) {
						console.debug(`[Delivery] Senate office ${rep.office_code} (${rep.name}) does not accept CWC — skipping`);
						results.push({
							office: rep.name,
							chamber: rep.chamber,
							status: 'cwc_unavailable',
							error: `Senate office ${rep.name} does not accept CWC messages`
						});
						continue;
					}
				}

				const result = rep.chamber === 'senate'
					? await cwcClient.submitToSenate(cwcTemplate, cwcUser, office, message)
					: await cwcClient.submitToHouse(cwcTemplate, cwcUser, office, message);

				results.push({
					office: rep.name,
					chamber: rep.chamber,
					status: result.status,
					messageId: result.messageId,
					error: result.error
				});

				if (result.messageId) {
					messageIds.push(result.messageId);
				}
			} catch (err) {
				const errorMsg = err instanceof Error ? err.message : 'Unknown error';
				console.error(`[Delivery] Failed for ${rep.name}:`, errorMsg);
				results.push({
					office: rep.name,
					chamber: rep.chamber,
					status: 'failed',
					error: errorMsg
				});
			}
		}

		// Step 9: Determine overall status
		// Statuses: 'submitted' | 'queued' | 'failed' | 'rejected' | 'cwc_unavailable'.
		// 'cwc_unavailable' = Senate office doesn't accept CWC (expected, not a failure).
		// 'rejected' = terminal failure (e.g., validation error).
		const deliverable = results.filter((r) => r.status !== 'cwc_unavailable');
		const anySuccess = deliverable.some((r) => r.status === 'submitted' || r.status === 'queued');
		const allFailed = deliverable.length > 0
			? deliverable.every((r) => r.status === 'failed' || r.status === 'rejected')
			: results.length > 0; // all were cwc_unavailable → treat as failed

		const overallStatus = allFailed ? 'failed' : anySuccess ? 'delivered' : 'partial';

		// Collect per-representative errors for diagnostics (partial failures included)
		const failedResults = results.filter((r) => r.status === 'failed' || r.status === 'rejected');
		const errorSummary =
			failedResults.length > 0
				? failedResults.map((r) => `${r.office}: ${r.error || r.status}`).join('; ')
				: null;

		// Step 10: Update submission with delivery results
		await client.submission.update({
			where: { id: submissionId },
			data: {
				delivery_status: overallStatus,
				cwc_submission_id: messageIds.length > 0 ? messageIds.join(',') : null,
				delivered_at: anySuccess ? new Date() : null,
				delivery_error: errorSummary
			}
		});

		console.debug('[Delivery] Complete:', {
			submissionId,
			status: overallStatus,
			results: results.map((r) => `${r.office}: ${r.status}`)
		});

		return { success: !allFailed, results };
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : 'Unknown error';
		console.error('[Delivery] Fatal error:', { submissionId, error: errorMsg });

		// Update submission with error status
		try {
			await client.submission.update({
				where: { id: submissionId },
				data: {
					delivery_status: 'failed',
					delivery_error: errorMsg
				}
			});
		} catch (updateErr) {
			console.error('[Delivery] Failed to update error status:', updateErr);
		}

		return {
			success: false,
			results: [{ office: 'N/A', chamber: 'N/A', status: 'failed', error: errorMsg }]
		};
	}
}
