import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createHmac, createHash, timingSafeEqual } from 'crypto';
import {
	generateIdentityHash,
	generateIdentityFingerprint,
	validateIdentityProof,
	isAgeEligible,
	type IdentityProof
} from '$lib/core/server/identity-hash';
import { prisma } from '$lib/core/db';
import { z } from 'zod';
import {
	computeIdentityCommitment,
	bindIdentityCommitment,
	getCommitmentFingerprint
} from '$lib/core/identity/identity-binding';

/**
 * Didit.me Webhook Handler
 *
 * Receives real-time verification status updates from Didit.me when users
 * complete identity verification.
 *
 * Webhook Documentation: https://docs.didit.me/reference/webhooks
 *
 * Flow:
 * 1. Didit.me sends webhook when verification status changes
 * 2. Verify HMAC signature for security
 * 3. Extract verified address data from webhook payload
 * 4. Return address data to client (client will encrypt and store)
 *
 * Event Types:
 * - status.updated: Verification status changed
 * - data.updated: KYC/POA data manually updated
 */

/**
 * Verify Didit webhook HMAC signature
 * Security: Prevents unauthorized webhook events
 * Uses constant-time comparison to prevent timing attacks
 */
function verifyWebhookSignature(
	body: string,
	signature: string | null,
	timestamp: string | null,
	secret: string
): boolean {
	if (!signature || !timestamp) {
		return false;
	}

	const payload = `${timestamp}.${body}`;
	const expectedSignature = createHmac('sha256', secret).update(payload).digest('hex');

	// SECURITY FIX: Use constant-time comparison to prevent timing attacks
	// Convert hex strings to Buffers for timingSafeEqual
	try {
		const signatureBuffer = Buffer.from(signature, 'hex');
		const expectedBuffer = Buffer.from(expectedSignature, 'hex');

		// Ensure buffers are same length before comparison
		if (signatureBuffer.length !== expectedBuffer.length) {
			return false;
		}

		return timingSafeEqual(signatureBuffer, expectedBuffer);
	} catch {
		// Handle invalid hex strings
		return false;
	}
}

/**
 * Didit webhook handler
 * Receives real-time verification status updates
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		// Read raw body for signature verification
		const body = await request.text();
		const signature = request.headers.get('x-didit-signature');
		const timestamp = request.headers.get('x-didit-timestamp');

		// Verify webhook authenticity
		const webhookSecret = process.env.DIDIT_WEBHOOK_SECRET;
		if (!webhookSecret) {
			console.error('DIDIT_WEBHOOK_SECRET not configured');
			throw error(500, 'Webhook configuration error');
		}
		if (!verifyWebhookSignature(body, signature, timestamp, webhookSecret)) {
			console.error('Invalid webhook signature');
			throw error(401, 'Invalid webhook signature');
		}

		// Parse and validate event data
		const DiditEventSchema = z.object({
			type: z.string(),
			data: z.object({
				status: z.string(),
				metadata: z
					.object({
						user_id: z.string().optional()
					})
					.passthrough()
					.optional(),
				session_id: z.string().optional(),
				decision: z
					.object({
						id_verification: z
							.object({
								date_of_birth: z.string(),
								document_number: z.string(),
								issuing_state: z.string(),
								document_type: z.string()
							})
							.passthrough()
							.optional()
					})
					.passthrough()
					.optional()
			})
		});

		let event;
		try {
			const parsed = JSON.parse(body);
			const result = DiditEventSchema.safeParse(parsed);
			if (!result.success) {
				console.error('[Didit Webhook] Invalid event structure:', result.error.flatten());
				throw error(400, 'Invalid webhook event structure');
			}
			event = result.data;
		} catch (parseError) {
			console.error('[Didit Webhook] Failed to parse event body:', parseError);
			throw error(400, 'Invalid JSON in webhook body');
		}

		const { type, data } = event;

		// Only process status.updated events
		if (type !== 'status.updated') {
			return json({ received: true, processed: false });
		}

		// Only process approved verifications
		if (data.status !== 'Approved') {
			return json({ received: true, processed: false, status: data.status });
		}

		// Extract user ID from session metadata
		const userId = data.metadata?.user_id;
		if (!userId) {
			console.error('Missing user_id in webhook metadata');
			throw error(400, 'Missing user_id in session metadata');
		}

		// Check if already processed (idempotency)
		const existingUser = await prisma.user.findUnique({
			where: { id: userId },
			select: { is_verified: true, verification_method: true }
		});

		if (existingUser?.is_verified && existingUser.verification_method === 'didit') {
			return json({
				received: true,
				processed: false,
				already_verified: true
			});
		}

		// Process verification result
		const verification = data.decision.id_verification;

		// Map Didit data to our IdentityProof structure
		const birthDate = new Date(verification.date_of_birth);
		const birthYear = birthDate.getFullYear();

		const documentTypeMap: Record<string, IdentityProof['documentType']> = {
			passport: 'passport',
			drivers_license: 'drivers_license',
			id_card: 'national_id'
		};

		const identityProof: IdentityProof = {
			passportNumber: verification.document_number,
			nationality: verification.issuing_state,
			birthYear,
			documentType: documentTypeMap[verification.document_type] || 'national_id'
		};

		// Validate proof structure
		validateIdentityProof(identityProof);

		// Age check
		if (!isAgeEligible(birthYear)) {
			await prisma.verificationAudit.create({
				data: {
					user_id: userId,
					method: 'didit',
					status: 'failed',
					failure_reason: 'age_below_18',
					metadata: { session_id: data.session_id, event_type: type }
				}
			});

			throw error(403, 'User must be 18 or older');
		}

		// Generate identity hash (Sybil resistance)
		const identityHash = generateIdentityHash(identityProof);
		const identityFingerprint = generateIdentityFingerprint(identityHash);

		// ISSUE-001: Generate identity commitment for cross-provider deduplication
		const identityCommitment = computeIdentityCommitment(
			identityProof.passportNumber,
			identityProof.nationality,
			identityProof.birthYear,
			identityProof.documentType
		);
		const commitmentFingerprint = getCommitmentFingerprint(identityCommitment);

		// Check for duplicate identity
		const duplicateUser = await prisma.user.findUnique({
			where: { identity_hash: identityHash }
		});

		if (duplicateUser && duplicateUser.id !== userId) {
			await prisma.verificationAudit.create({
				data: {
					user_id: userId,
					method: 'didit',
					status: 'failed',
					failure_reason: 'duplicate_identity',
					identity_hash: identityHash,
					identity_fingerprint: identityFingerprint,
					metadata: { session_id: data.session_id, event_type: type }
				}
			});

			throw error(409, 'Identity already verified with another account');
		}

		// Update user verification status
		await prisma.user.update({
			where: { id: userId },
			data: {
				is_verified: true,
				verification_method: 'didit',
				verified_at: new Date(),
				identity_hash: identityHash,
				identity_fingerprint: identityFingerprint,
				birth_year: birthYear
			}
		});

		// Log successful verification
		await prisma.verificationAudit.create({
			data: {
				user_id: userId,
				method: 'didit',
				status: 'success',
				identity_hash: identityHash,
				identity_fingerprint: identityFingerprint,
				metadata: {
					session_id: data.session_id,
					event_type: type,
					nationality: identityProof.nationality,
					document_type: identityProof.documentType,
					document_number_hash: createHash('sha256')
						.update(verification.document_number)
						.digest('hex')
						.substring(0, 16), // Store hash, not actual number
					commitment_fingerprint: commitmentFingerprint
				}
			}
		});

		// ISSUE-001: Bind identity commitment for cross-provider deduplication
		const bindingResult = await bindIdentityCommitment(userId, identityCommitment);

		if (bindingResult.linkedToExisting) {
			// User was merged into existing account
			console.log(
				`[Didit] User ${userId} merged into ${bindingResult.userId} via identity commitment`
			);

			return json({
				received: true,
				processed: true,
				verified: true,
				merged: true,
				mergedIntoUserId: bindingResult.userId
			});
		}

		return json({
			received: true,
			processed: true,
			verified: true
		});
	} catch (err) {
		console.error('Didit webhook processing error:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'Webhook processing failed');
	}
};
