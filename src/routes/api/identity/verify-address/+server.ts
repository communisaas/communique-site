/**
 * Tier 2 Credential Issuance Endpoint
 *
 * Receives the district result (from a prior /api/address/verify geocoding call)
 * and issues a W3C VC 2.0 DistrictResidencyCredential.
 *
 * Flow:
 *  1. Validate authenticated user
 *  2. Validate input (district format "XX-NN" or "XX-AL")
 *  3. Issue DistrictResidencyCredential
 *  4. Compute credential hash
 *  5. Store DistrictCredential record in DB
 *  6. Update User record (trust_tier, district_verified, etc.) in a transaction
 *  7. Return credential JSON to client (for IndexedDB storage)
 *
 * Privacy: The plaintext address never reaches this endpoint. Only the geocoded
 * district identifier is received and stored as a SHA-256 hash on the User record.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/core/db';
import {
	issueDistrictCredential,
	hashCredential,
	hashDistrict
} from '$lib/core/identity/district-credential';
import { TIER_CREDENTIAL_TTL } from '$lib/core/identity/credential-policy';

// ============================================================================
// Input Validation
// ============================================================================

/** Matches "XX-NN" (state abbreviation + district number) or "XX-AL" (at-large). */
const DISTRICT_FORMAT = /^[A-Z]{2}-(\d{2}|AL)$/;

interface VerifyAddressInput {
	district: string;
	state_senate_district?: string;
	state_assembly_district?: string;
	verification_method: 'civic_api' | 'postal';
}

function validateInput(body: unknown): VerifyAddressInput {
	if (!body || typeof body !== 'object') {
		throw new Error('Request body must be a JSON object');
	}

	const b = body as Record<string, unknown>;

	if (typeof b.district !== 'string' || !DISTRICT_FORMAT.test(b.district)) {
		throw new Error(
			'Invalid district format. Expected "XX-NN" (e.g., "CA-12") or "XX-AL" for at-large districts.'
		);
	}

	if (
		b.verification_method !== 'civic_api' &&
		b.verification_method !== 'postal'
	) {
		throw new Error('verification_method must be "civic_api" or "postal"');
	}

	return {
		district: b.district as string,
		state_senate_district:
			typeof b.state_senate_district === 'string' ? b.state_senate_district : undefined,
		state_assembly_district:
			typeof b.state_assembly_district === 'string' ? b.state_assembly_district : undefined,
		verification_method: b.verification_method as 'civic_api' | 'postal'
	};
}

// ============================================================================
// Handler
// ============================================================================

export const POST: RequestHandler = async ({ request, locals }) => {
	// 1. Require authenticated session
	if (!locals.user) {
		return json({ success: false, error: 'Authentication required' }, { status: 401 });
	}

	const userId = locals.user.id;

	// 2. Parse & validate input
	let input: VerifyAddressInput;
	try {
		const body = await request.json();
		input = validateInput(body);
	} catch (err) {
		return json(
			{ success: false, error: err instanceof Error ? err.message : 'Invalid request body' },
			{ status: 400 }
		);
	}

	try {
		// Fetch user's did_key for the credential subject ID
		const user = await db.user.findUniqueOrThrow({
			where: { id: userId },
			select: { did_key: true, trust_tier: true }
		});

		// 3. Issue the VC
		const credential = await issueDistrictCredential({
			userId,
			didKey: user.did_key,
			congressional: input.district,
			stateSenate: input.state_senate_district,
			stateAssembly: input.state_assembly_district,
			verificationMethod: input.verification_method
		});

		// 4. Compute integrity hash
		const credentialHash = await hashCredential(credential);

		// 5. Compute privacy-preserving district hash
		const districtHash = await hashDistrict(input.district);

		// 6. Compute TTL-based expiration
		const now = new Date();
		const expiresAt = new Date(now.getTime() + TIER_CREDENTIAL_TTL[2]);

		// 7. Database transaction: insert DistrictCredential + update User
		await db.$transaction(async (tx) => {
			// Insert credential record
			await tx.districtCredential.create({
				data: {
					user_id: userId,
					credential_type: 'district_residency',
					congressional_district: input.district,
					state_senate_district: input.state_senate_district ?? null,
					state_assembly_district: input.state_assembly_district ?? null,
					verification_method: input.verification_method,
					issued_at: now,
					expires_at: expiresAt,
					credential_hash: credentialHash
				}
			});

			// Update user: upgrade trust tier (never downgrade), set district flags
			await tx.user.update({
				where: { id: userId },
				data: {
					trust_tier: Math.max(user.trust_tier, 2),
					district_verified: true,
					address_verified_at: now,
					address_verification_method: input.verification_method,
					district_hash: districtHash
				}
			});
		});

		// 8. Return credential to client for IndexedDB storage
		return json({
			success: true,
			credential,
			credentialHash
		});
	} catch (err) {
		console.error('[verify-address] Credential issuance failed:', err);
		return json(
			{
				success: false,
				error: 'Failed to issue district credential. Please try again.'
			},
			{ status: 500 }
		);
	}
};
