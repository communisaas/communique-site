import type { PageServerLoad } from './$types';
import { prisma } from '$lib/core/db';

/**
 * Privacy-preserving credential verification endpoint.
 *
 * Accepts a credential_hash from the email footer verify URL.
 * Displays: "This message was sent by a verified constituent of [district]"
 * Does NOT reveal user identity, email, or any PII.
 */
export const load: PageServerLoad = async ({ params }) => {
	const { hash } = params;

	if (!hash || hash.length < 8) {
		return { credential: null, error: 'Invalid verification link' };
	}

	try {
		const credential = await prisma.districtCredential.findFirst({
			where: { credential_hash: hash },
			select: {
				congressional_district: true,
				verification_method: true,
				issued_at: true,
				expires_at: true,
				revoked_at: true
			}
		});

		if (!credential) {
			return { credential: null, error: 'Credential not found' };
		}

		if (credential.revoked_at) {
			return { credential: null, error: 'This credential has been revoked' };
		}

		const isExpired = new Date() > credential.expires_at;

		return {
			credential: {
				district: credential.congressional_district,
				method: credential.verification_method,
				issuedAt: credential.issued_at.toISOString(),
				expired: isExpired
			},
			error: null
		};
	} catch (error) {
		console.error('[Verify] Credential lookup failed:', error instanceof Error ? error.message : String(error));
		return { credential: null, error: 'Verification temporarily unavailable' };
	}
};
