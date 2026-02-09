/**
 * Pseudonymous ID Generation
 *
 * Computes a deterministic pseudonymous identifier from a user ID,
 * breaking the direct link between authenticated identity and on-chain
 * proof submissions.
 *
 * Uses HMAC-SHA256 (keyed hash) rather than plain SHA-256 for:
 * - Cryptographic strength: HMAC is designed for keyed hashing
 * - Side-channel resistance: Constant-time comparison possible
 * - Standard compliance: NIST SP 800-107 approved
 *
 * Threat model:
 * - Protects against: DB dump without environment variables
 * - Protects against: Subpoena of Submission table alone
 * - Does NOT protect against: Insider with both DB + salt access
 *   (this is pseudonymization, not anonymization — by design,
 *    reputation tracking requires stable pseudonymous identity)
 */

import { createHmac } from 'crypto';
import { env } from '$env/dynamic/private';

/**
 * Compute a deterministic pseudonymous ID from a user ID.
 *
 * @param userId - Authenticated user ID from session
 * @returns 64-character hex string (HMAC-SHA256 output)
 * @throws Error if SUBMISSION_ANONYMIZATION_SALT not configured or too short
 */
export function computePseudonymousId(userId: string): string {
	const salt = env.SUBMISSION_ANONYMIZATION_SALT;
	if (!salt || salt.length < 32) {
		throw new Error(
			'SUBMISSION_ANONYMIZATION_SALT must be configured and at least 32 characters. ' +
				'Generate with: openssl rand -hex 32'
		);
	}

	return createHmac('sha256', salt).update(userId).digest('hex');
}
