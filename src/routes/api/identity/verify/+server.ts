import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { selfVerifier } from '$lib/core/server/selfxyz-verifier';
import {
	generateIdentityHash,
	generateIdentityFingerprint,
	validateIdentityProof,
	isAgeEligible,
	type IdentityProof
} from '$lib/core/server/identity-hash';
import { prisma } from '$lib/core/db';
import { hashIPAddress } from '$lib/core/server/security';

/**
 * self.xyz Verification Callback
 * Called by frontend after user scans QR with Self app
 */
export const POST: RequestHandler = async ({ request, getClientAddress, locals }) => {
	try {
		// CVE-INTERNAL-003 FIX: Require authenticated session
		if (!locals.user) {
			throw error(401, 'Authentication required');
		}

		const { attestationId, proof, publicSignals, userContextData } = await request.json();

		// Validate required fields
		if (!proof || !publicSignals || !attestationId || !userContextData) {
			throw error(400, 'Missing required fields');
		}

		// Verify proof with self.xyz SDK
		const result = await selfVerifier.verify(attestationId, proof, publicSignals, userContextData);

		const { isValid, isMinimumAgeValid, isOfacValid } = result.isValidDetails;

		if (!isValid || !isMinimumAgeValid || !isOfacValid) {
			// Use authenticated user ID from session (not untrusted client input)
			const userId = locals.user.id;

			// Log failed verification
			await prisma.verificationAudit.create({
				data: {
					user_id: userId,
					method: 'self.xyz',
					status: 'failed',
					failure_reason: !isValid
						? 'invalid_proof'
						: !isMinimumAgeValid
							? 'age_below_18'
							: 'ofac_violation',
					ip_address_hash: hashIPAddress(getClientAddress()),
					metadata: {
						attestation_id: attestationId,
						age_valid: isMinimumAgeValid,
						ofac_valid: isOfacValid
					}
				}
			});

			throw error(403, 'Verification failed');
		}

		// Extract passport data from SDK response
		const { discloseOutput } = result;
		const credentialSubject = discloseOutput.credentialSubject;

		// Map SDK data to our IdentityProof structure
		const birthDate = new Date(credentialSubject.dateOfBirth);
		const birthYear = birthDate.getFullYear();

		const identityProof: IdentityProof = {
			passportNumber: credentialSubject.documentNumber,
			nationality: credentialSubject.nationality,
			birthYear,
			documentType: credentialSubject.documentType === 'P' ? 'passport' : 'national_id'
		};

		// Validate proof structure
		validateIdentityProof(identityProof);

		// Additional age check (redundant but safe)
		if (!isAgeEligible(birthYear)) {
			throw error(403, 'User must be 18 or older');
		}

		// Generate identity hash (Sybil resistance)
		const identityHash = generateIdentityHash(identityProof);
		const identityFingerprint = generateIdentityFingerprint(identityHash);
		const userId = locals.user.id;

		// Wrap all database operations in a transaction to prevent race conditions
		// This ensures atomic check-and-set for duplicate identity detection
		const duplicateDetected = await prisma.$transaction(async (tx) => {
			// Check for duplicate identity (within transaction for consistency)
			const existingUser = await tx.user.findUnique({
				where: { identity_hash: identityHash }
			});

			if (existingUser && existingUser.id !== userId) {
				// Log duplicate attempt
				await tx.verificationAudit.create({
					data: {
						user_id: userId,
						method: 'self.xyz',
						status: 'failed',
						failure_reason: 'duplicate_identity',
						identity_hash: identityHash,
						identity_fingerprint: identityFingerprint,
						ip_address_hash: hashIPAddress(getClientAddress())
					}
				});

				return true; // Signal duplicate detected
			}

			// Update user verification status
			await tx.user.update({
				where: { id: userId },
				data: {
					is_verified: true,
					verification_method: 'self.xyz',
					verified_at: new Date(),
					identity_hash: identityHash,
					identity_fingerprint: identityFingerprint,
					birth_year: birthYear
				}
			});

			// Log successful verification
			await tx.verificationAudit.create({
				data: {
					user_id: userId,
					method: 'self.xyz',
					status: 'success',
					identity_hash: identityHash,
					identity_fingerprint: identityFingerprint,
					ip_address_hash: hashIPAddress(getClientAddress()),
					metadata: {
						attestation_id: attestationId,
						nationality: identityProof.nationality,
						document_type: identityProof.documentType
					}
				}
			});

			return false; // No duplicate
		});

		// Throw HTTP error outside transaction to avoid Prisma wrapping it
		if (duplicateDetected) {
			throw error(409, 'Identity already verified with another account');
		}

		return json({
			status: 'success',
			result: true,
			verified: true
		});
	} catch (err) {
		console.error('Verification error:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err; // Re-throw SvelteKit errors
		}

		throw error(500, 'Verification processing failed');
	}
};
