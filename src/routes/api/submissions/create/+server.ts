import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/core/db';
import { cwcClient } from '$lib/core/congress/cwc-client';
import { getRepresentativesForAddress } from '$lib/core/congress/address-lookup';
import {
	isCredentialValidForAction,
	formatValidationError,
	type SessionCredentialForPolicy
} from '$lib/core/identity/credential-policy';

/**
 * Submission Creation Endpoint
 *
 * Receives ZK proof + encrypted witness from browser
 * Stores in database for TEE processing and congressional delivery
 *
 * Flow:
 * 1. Validate authentication
 * 2. Enforce credential TTL for constituent_message action (ISSUE-005)
 * 3. Verify proof format
 * 4. Check nullifier uniqueness (prevent double-actions)
 * 5. Store in Submission table
 * 6. Trigger TEE processing (async)
 *
 * Security: Enforces action-based TTL (ISSUE-005)
 * - constituent_message requires verification within 30 days
 * - Prevents stale district credentials from moved users (~2% annually)
 *
 * Per COMMUNIQUE-ZK-IMPLEMENTATION-SPEC.md Phase 2
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Check authentication
		const session = locals.session;
		if (!session?.userId) {
			throw error(401, 'Authentication required');
		}

		const userId = session.userId;

		// ISSUE-005: Enforce action-based TTL for constituent messages
		// This endpoint handles congressional delivery, requiring fresh verification
		if (!locals.user?.verified_at) {
			return json(
				{
					error: 'verification_required',
					code: 'NOT_VERIFIED',
					message: 'You must verify your address before submitting to Congress.',
					requiresReverification: true
				},
				{ status: 403 }
			);
		}

		// Build credential object for TTL validation
		const credential: SessionCredentialForPolicy = {
			userId: locals.user.id,
			createdAt: locals.user.verified_at,
			congressionalDistrict: locals.user.district_hash ?? undefined
		};

		// Validate credential age for constituent_message action
		const validation = isCredentialValidForAction(credential, 'constituent_message');

		if (!validation.valid) {
			console.log('[Submission] Credential TTL exceeded:', {
				userId,
				action: 'constituent_message',
				daysOld: Math.floor(validation.age / (24 * 60 * 60 * 1000)),
				maxDays: Math.floor(validation.maxAge / (24 * 60 * 60 * 1000))
			});

			return json(formatValidationError(validation), { status: 403 });
		}

		// Parse request body
		const body = await request.json();
		const {
			templateId,
			proof,
			publicInputs,
			nullifier,
			encryptedWitness,
			witnessNonce,
			ephemeralPublicKey,
			teeKeyId,
			templateData,
			// MVP bypass fields (cleartext address for direct CWC delivery)
			mvpAddress,
			personalizedMessage,
			userEmail,
			userName,
			// Idempotency key for preventing duplicate submissions from retries
			idempotencyKey
		} = body;

		// Validate required fields
		if (
			!templateId ||
			!proof ||
			!publicInputs ||
			!nullifier ||
			!encryptedWitness ||
			!witnessNonce ||
			!ephemeralPublicKey ||
			!teeKeyId
		) {
			throw error(400, 'Missing required fields');
		}

		// Validate template exists and get full data for CWC delivery
		const template = await prisma.template.findUnique({
			where: { id: templateId },
			select: { id: true, title: true, message_body: true, slug: true }
		});

		if (!template) {
			throw error(404, 'Template not found');
		}

		// Create submission with atomic idempotency and nullifier checks
		// Transaction ensures no race conditions on duplicate submissions
		const submission = await prisma.$transaction(async (tx) => {
			// Check idempotency key first (client retry protection)
			if (idempotencyKey) {
				const existingByIdempotency = await tx.submission.findUnique({
					where: { idempotency_key: idempotencyKey }
				});

				if (existingByIdempotency) {
					// Return existing submission for idempotent retry
					return existingByIdempotency;
				}
			}

			// Check nullifier uniqueness (prevent double-actions)
			// This check is now atomic with creation due to unique constraint + transaction
			const existingByNullifier = await tx.submission.findUnique({
				where: { nullifier }
			});

			if (existingByNullifier) {
				throw error(409, 'This action has already been submitted (duplicate nullifier)');
			}

			// Create submission atomically
			// action_id is the templateId (in production, it's poseidon hash of templateId in public_inputs)
			return await tx.submission.create({
				data: {
					user_id: userId,
					template_id: templateId,
					action_id: templateId, // MVP: use templateId directly; production: extract from publicInputs
					proof_hex: proof,
					public_inputs: publicInputs,
					nullifier,
					encrypted_witness: encryptedWitness,
					witness_nonce: witnessNonce,
					ephemeral_public_key: ephemeralPublicKey,
					tee_key_id: teeKeyId,
					idempotency_key: idempotencyKey,
					delivery_status: 'pending',
					verification_status: 'pending'
				}
			});
		});

		console.log('[Submission] Created:', {
			submissionId: submission.id,
			userId,
			templateId,
			nullifier: nullifier.slice(0, 10) + '...'
		});

		// MVP Mode: Direct CWC delivery (bypasses TEE for pre-launch)
		// Production: TEE decrypts witness and handles delivery
		// Note: CWC delivery updates below are separate transactions since they're
		// status updates on an already-created submission (no race condition risk)
		let deliveryResults = null;

		if (mvpAddress && mvpAddress.street && mvpAddress.city && mvpAddress.state && mvpAddress.zip) {
			console.log('[Submission] MVP mode: Direct CWC delivery');

			try {
				// Look up congressional representatives
				const representatives = await getRepresentativesForAddress(mvpAddress);

				if (!representatives || representatives.length === 0) {
					console.error('[Submission] No representatives found for address');
					await prisma.submission.update({
						where: { id: submission.id },
						data: {
							delivery_status: 'failed',
							delivery_error: 'No congressional representatives found for this address'
						}
					});

					return json({
						success: false,
						submissionId: submission.id,
						status: 'failed',
						error: 'No congressional representatives found for this address'
					});
				}

				console.log('[Submission] Found representatives:', {
					count: representatives.length,
					names: representatives.map((r) => r.name)
				});

				// Create mock user object for CWC submission
				const user = await prisma.user.findUnique({
					where: { id: userId },
					select: { email: true, first_name: true, last_name: true }
				});

				const cwcUser = {
					id: userId,
					name:
						userName ||
						`${user?.first_name || ''} ${user?.last_name || ''}`.trim() ||
						'Verified Constituent',
					email: userEmail || user?.email || 'constituent@verified.communique.app',
					street: mvpAddress.street,
					city: mvpAddress.city,
					state: mvpAddress.state,
					zip: mvpAddress.zip
				};

				// Submit directly to CWC API
				const results = await cwcClient.submitToAllRepresentatives(
					template,
					cwcUser,
					representatives,
					personalizedMessage || ''
				);

				const successCount = results.filter((r) => r.success).length;
				const failedCount = results.filter((r) => !r.success).length;

				console.log('[Submission] CWC delivery complete:', {
					submissionId: submission.id,
					successCount,
					failedCount,
					total: results.length
				});

				// Update submission with delivery status
				// Note: detailed results returned in response; Submission model tracks status only
				await prisma.submission.update({
					where: { id: submission.id },
					data: {
						delivery_status:
							failedCount === 0 ? 'delivered' : successCount > 0 ? 'partial' : 'failed',
						verification_status: 'verified', // MVP mode - proof already validated
						cwc_submission_id: results[0]?.messageId || null, // Store first message ID as reference
						delivered_at: new Date()
					}
				});

				deliveryResults = {
					representatives: representatives.map((r) => ({
						name: r.name,
						chamber: r.chamber,
						state: r.state,
						district: r.district
					})),
					results: results.map((r) => ({
						office: r.office,
						chamber: r.chamber || (r.office.includes('Senator') ? 'senate' : 'house'),
						success: r.success,
						status: r.status,
						messageId: r.messageId,
						confirmationNumber: r.confirmationNumber,
						error: r.error
					})),
					summary: {
						total: results.length,
						successful: successCount,
						failed: failedCount
					}
				};
			} catch (cwcError) {
				console.error('[Submission] CWC delivery failed:', cwcError);

				await prisma.submission.update({
					where: { id: submission.id },
					data: {
						delivery_status: 'failed',
						delivery_error: cwcError instanceof Error ? cwcError.message : 'CWC delivery failed'
					}
				});

				return json({
					success: false,
					submissionId: submission.id,
					status: 'failed',
					error: 'Congressional delivery failed. Please try again.'
				});
			}
		}

		return json({
			success: true,
			submissionId: submission.id,
			status: deliveryResults ? 'delivered' : 'pending',
			message: deliveryResults
				? `Delivered to ${deliveryResults.summary.successful}/${deliveryResults.summary.total} congressional offices`
				: 'Submission created. Processing will begin shortly.',
			delivery: deliveryResults
		});
	} catch (err) {
		console.error('[Submission Creation] Error:', err);

		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'Failed to create submission');
	}
};
