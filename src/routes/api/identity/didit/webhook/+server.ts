import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createHash } from 'crypto';
import {
	generateIdentityHash,
	generateIdentityFingerprint,
	validateIdentityProof,
	type IdentityProof
} from '$lib/core/server/identity-hash';
import { prisma } from '$lib/core/db';
import {
	computeIdentityCommitment,
	bindIdentityCommitment,
	getCommitmentFingerprint
} from '$lib/core/identity/identity-binding';
import {
	validateWebhook,
	parseVerificationResult,
	isAgeEligible,
	type DiditWebhookEvent
} from '$lib/core/identity/didit-client';
import { generateIdentityCommitment } from '$lib/core/identity/shadow-atlas-handler';

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

// verifyWebhookSignature removed - now using validateWebhook from didit-client.ts

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

		// Verify webhook authenticity using SDK
		if (!validateWebhook(body, signature, timestamp)) {
			console.error('[Didit Webhook] Invalid webhook signature');
			throw error(401, 'Invalid webhook signature');
		}

		// Parse event payload
		let event: DiditWebhookEvent;
		try {
			event = JSON.parse(body) as DiditWebhookEvent;
		} catch (parseError) {
			console.error('[Didit Webhook] Failed to parse event body:', parseError);
			throw error(400, 'Invalid JSON in webhook body');
		}

		// Only process status.updated events
		if (event.type !== 'status.updated') {
			return json({ received: true, processed: false, event_type: event.type });
		}

		// Only process approved verifications
		if (event.data.status !== 'Approved') {
			return json({
				received: true,
				processed: false,
				status: event.data.status
			});
		}

		// Parse verification result using SDK
		let verificationResult;
		try {
			verificationResult = parseVerificationResult(event);
		} catch (parseError) {
			console.error('[Didit Webhook] Failed to parse verification result:', parseError);
			throw error(400, parseError instanceof Error ? parseError.message : 'Invalid verification data');
		}

		const { userId, documentNumber, nationality, birthYear, documentType, credentialHash, sessionId } =
			verificationResult;

		// Check if already processed (idempotency)
		const existingUser = await prisma.user.findUnique({
			where: { id: userId },
			select: { is_verified: true, verification_method: true }
		});

		if (existingUser?.is_verified && existingUser.verification_method === 'didit') {
			console.log(`[Didit Webhook] User ${userId} already verified, skipping`);
			return json({
				received: true,
				processed: false,
				already_verified: true
			});
		}

		// Map to internal document type
		const documentTypeMap: Record<string, IdentityProof['documentType']> = {
			passport: 'passport',
			drivers_license: 'drivers_license',
			id_card: 'national_id'
		};

		const identityProof: IdentityProof = {
			passportNumber: documentNumber,
			nationality,
			birthYear,
			documentType: documentTypeMap[documentType] || 'national_id'
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
					metadata: { session_id: sessionId, event_type: event.type }
				}
			});

			throw error(403, 'User must be 18 or older');
		}

		// Generate identity hash (Sybil resistance)
		const identityHash = generateIdentityHash(identityProof);
		const identityFingerprint = generateIdentityFingerprint(identityHash);

		// ISSUE-001: Generate identity commitment for cross-provider deduplication
		// Uses SHA-256 double-hash for Phase 1 (Phase 2 will use Poseidon from ZK circuit)
		const identityCommitment = computeIdentityCommitment(
			identityProof.passportNumber,
			identityProof.nationality,
			identityProof.birthYear,
			identityProof.documentType
		);
		const commitmentFingerprint = getCommitmentFingerprint(identityCommitment);

		// Generate Shadow Atlas identity commitment (Poseidon hash)
		// This will be used for ZK proof generation after user provides address
		const shadowAtlasCommitment = await generateIdentityCommitment({
			provider: 'didit.me',
			credentialHash,
			issuedAt: Date.now()
		});

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
					session_id: sessionId,
					event_type: event.type,
					nationality: identityProof.nationality,
					document_type: identityProof.documentType,
					document_number_hash: createHash('sha256')
						.update(documentNumber)
						.digest('hex')
						.substring(0, 16), // Store hash, not actual number
					commitment_fingerprint: commitmentFingerprint,
					shadow_atlas_commitment: shadowAtlasCommitment // Store for later Shadow Atlas registration
				}
			}
		});

		// TODO: Shadow Atlas Registration (Phase 1.4)
		// The Shadow Atlas registration requires congressional district, which requires:
		// 1. User provides their address (separate step after identity verification)
		// 2. Geocode address to lat/lng
		// 3. Call Shadow Atlas API with identity commitment + coordinates
		// 4. Store merkle_path in ShadowAtlasRegistration table
		//
		// For now, we store the shadowAtlasCommitment in verification audit metadata.
		// A separate endpoint will handle the address → Shadow Atlas registration flow.
		console.log(`[Didit Webhook] Identity verified, Shadow Atlas commitment generated: ${shadowAtlasCommitment.substring(0, 16)}...`);

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
