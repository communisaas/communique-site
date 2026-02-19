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
import { generateUserEntropy } from '$lib/core/identity/user-secret-derivation';
import { deriveAuthorityLevel } from '$lib/core/identity/authority-level';
import { encryptEntropy, decryptEntropy } from '$lib/core/server/security';
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

		// BR6-004: Validate vendor_data userId against VerificationSession binding.
		// The init endpoint stores the Didit session_id as `challenge` in VerificationSession,
		// linking it to the authenticated userId. This prevents spoofed vendor_data.
		if (sessionId && sessionId !== 'unknown') {
			const verificationSession = await prisma.verificationSession.findFirst({
				where: {
					challenge: sessionId,
					method: 'didit',
					status: 'pending',
				},
				select: { id: true, user_id: true },
			});

			if (verificationSession) {
				if (verificationSession.user_id !== userId) {
					console.error(
						`[Didit Webhook] SECURITY: vendor_data userId (${userId}) does not match ` +
						`VerificationSession userId (${verificationSession.user_id}) for session ${sessionId}`
					);
					throw error(403, 'Verification session userId mismatch');
				}

				// Mark session as verified
				await prisma.verificationSession.update({
					where: { id: verificationSession.id },
					data: { status: 'verified' },
				});
			} else {
				console.warn(
					`[Didit Webhook] No matching VerificationSession for Didit session ${sessionId}. ` +
					`Session may have expired (5min TTL) or been cleaned up.`
				);
				// Don't reject — session may have expired but webhook is still valid
				// The HMAC signature validation is the primary security gate
			}
		}

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
		});

		// BR6-003: Wrap all DB operations in transaction to prevent race conditions.
		// Mirrors self.xyz verify pattern — atomic check-and-set for duplicate identity.
		const duplicateDetected = await prisma.$transaction(async (tx) => {
			// Check for duplicate identity (within transaction for consistency)
			const duplicateUser = await tx.user.findUnique({
				where: { identity_hash: identityHash }
			});

			if (duplicateUser && duplicateUser.id !== userId) {
				await tx.verificationAudit.create({
					data: {
						user_id: userId,
						method: 'didit',
						status: 'failed',
						failure_reason: 'duplicate_identity',
						identity_hash: identityHash,
						identity_fingerprint: identityFingerprint,
						metadata: { session_id: sessionId, event_type: event.type }
					}
				});

				return true; // Signal duplicate detected
			}

			// Wave 14R: Fetch current user for trust_score AND existing entropy (idempotency)
			const currentUser = await tx.user.findUnique({
				where: { id: userId },
				select: { trust_score: true, encrypted_entropy: true }
			});

			// Wave 14R fix (C-2): Only generate entropy once per user.
			// BR6-001: Decrypt existing or generate fresh, then encrypt before storing.
			const userEntropy = currentUser?.encrypted_entropy
				? decryptEntropy(currentUser.encrypted_entropy)
				: generateUserEntropy();

			// Wave 14R fix (H-1): Pass document_type for accurate authority differentiation
			// passport → L4, drivers_license/national_id → L3
			const authorityLevel = deriveAuthorityLevel({
				identity_commitment: identityCommitment,
				trust_score: currentUser?.trust_score ?? 0,
				verification_method: 'didit',
				document_type: identityProof.documentType
			});

			// Update user verification status
			await tx.user.update({
				where: { id: userId },
				data: {
					is_verified: true,
					verification_method: 'didit',
					verified_at: new Date(),
					identity_hash: identityHash,
					identity_fingerprint: identityFingerprint,
					birth_year: birthYear,
					document_type: identityProof.documentType,
					encrypted_entropy: encryptEntropy(userEntropy),
					authority_level: authorityLevel
				}
			});

			// Log successful verification
			await tx.verificationAudit.create({
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

			return false; // No duplicate
		});

		// Throw HTTP error outside transaction to avoid Prisma wrapping it
		if (duplicateDetected) {
			throw error(409, 'Identity already verified with another account');
		}

		// Shadow Atlas registration is handled separately after address collection:
		// 1. This webhook stores shadowAtlasCommitment in verification audit metadata
		// 2. User provides address in a separate step (AddressCollectionForm)
		// 3. Client calls registerTwoTree() -> POST /api/shadow-atlas/register
		// The split is intentional: identity verification doesn't require address disclosure.
		console.log(`[Didit Webhook] Identity verified, Shadow Atlas commitment stored: ${shadowAtlasCommitment.substring(0, 16)}...`);

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
