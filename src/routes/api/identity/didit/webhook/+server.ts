import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createHmac, createHash } from 'crypto';
import {
	generateIdentityHash,
	generateIdentityFingerprint,
	validateIdentityProof,
	isAgeEligible,
	type IdentityProof
} from '$lib/core/server/identity-hash';
import { prisma } from '$lib/core/db';

/**
 * Verify Didit webhook HMAC signature
 * Security: Prevents unauthorized webhook events
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

	return signature === expectedSignature;
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
		if (
			!verifyWebhookSignature(body, signature, timestamp, process.env.DIDIT_WEBHOOK_SECRET!)
		) {
			console.error('Invalid webhook signature');
			throw error(401, 'Invalid webhook signature');
		}

		// Parse event data
		const event = JSON.parse(body);
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
						.substring(0, 16) // Store hash, not actual number
				}
			}
		});

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
