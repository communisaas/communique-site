/**
 * Delivery Worker
 *
 * Background processor: decrypt witness -> look up reps -> CWC submit -> update status.
 * Called via platform.context.waitUntil() after submission creation.
 *
 * Flow:
 * 1. Update delivery_status to 'processing'
 * 2. Decrypt encrypted witness to extract deliveryAddress
 * 3. Look up congressional representatives for address
 * 4. Fetch template for message body
 * 5. Submit to each representative via CWC (Senate direct, House via GCP proxy)
 * 6. Update Submission record with delivery results
 *
 * Error handling:
 * - Any unrecoverable error sets delivery_status='failed' with error message
 * - Per-representative errors are captured but don't block other deliveries
 * - No retry logic here (that's Wave 5D territory)
 */

import type { PrismaClient } from '@prisma/client';
import { decryptWitness, type EncryptedWitnessPayload } from '$lib/server/witness-decryption';
import { getRepresentativesForAddress } from '$lib/core/congress/address-lookup';
import { cwcClient, type CongressionalOffice } from '$lib/core/congress/cwc-client';
import type { CwcTemplate } from '$lib/types/template';
import type { EmailServiceUser } from '$lib/types/user';

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
	console.log('[Delivery] Starting delivery for submission:', submissionId);

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

		// Step 3: Decrypt witness
		if (!submission.witness_nonce || !submission.ephemeral_public_key) {
			throw new Error('Missing encryption metadata (nonce or ephemeral key)');
		}

		const encrypted: EncryptedWitnessPayload = {
			ciphertext: submission.encrypted_witness,
			nonce: submission.witness_nonce,
			ephemeralPublicKey: submission.ephemeral_public_key
		};

		const witness = await decryptWitness(encrypted);

		// Step 4: Extract delivery address from decrypted witness
		const deliveryAddress = witness.deliveryAddress as
			| {
					name: string;
					email: string;
					street: string;
					city: string;
					state: string;
					zip: string;
					phone?: string;
					congressional_district?: string;
			  }
			| undefined;

		if (!deliveryAddress) {
			throw new Error('No delivery address in decrypted witness');
		}

		if (!deliveryAddress.street || !deliveryAddress.city || !deliveryAddress.state || !deliveryAddress.zip) {
			throw new Error('Incomplete delivery address: missing required fields (street, city, state, or zip)');
		}

		console.log('[Delivery] Decrypted delivery address for:', {
			submissionId,
			state: deliveryAddress.state,
			district: deliveryAddress.congressional_district || 'unknown'
		});

		// Step 5: Look up representatives
		const representatives = await getRepresentativesForAddress({
			street: deliveryAddress.street,
			city: deliveryAddress.city,
			state: deliveryAddress.state,
			zip: deliveryAddress.zip
		});

		if (!representatives || representatives.length === 0) {
			throw new Error('No representatives found for address');
		}

		console.log(
			'[Delivery] Found representatives:',
			representatives.map((r) => `${r.name} (${r.chamber})`)
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
			const office: CongressionalOffice = {
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

				let result;
				if (rep.chamber === 'senate') {
					result = await cwcClient.submitToSenate(
						cwcTemplate,
						cwcUser,
						office,
						message
					);
				} else {
					result = await cwcClient.submitToHouse(
						cwcTemplate,
						cwcUser,
						office,
						message
					);
				}

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
		// CWC returns 'submitted' | 'queued' | 'failed' | 'rejected'.
		// 'rejected' is a terminal failure (e.g., office not accepting messages),
		// so treat it the same as 'failed' when computing overall status.
		const anySuccess = results.some((r) => r.status === 'submitted' || r.status === 'queued');
		const allFailed = results.every((r) => r.status === 'failed' || r.status === 'rejected');

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

		console.log('[Delivery] Complete:', {
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
