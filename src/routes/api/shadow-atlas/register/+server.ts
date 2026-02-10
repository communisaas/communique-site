/**
 * Shadow Atlas Registration Endpoint (Two-Tree Architecture)
 *
 * Registers a user's precomputed leaf hash with Shadow Atlas Tree 1.
 * The leaf is Poseidon2_H3(user_secret, cell_id, registration_salt),
 * computed entirely in the browser. This endpoint sees ONLY the leaf hash.
 *
 * FLOW:
 * 1. Receive precomputed leaf hash from browser
 * 2. Validate OAuth session
 * 3. Call voter-protocol Shadow Atlas POST /v1/register with { leaf }
 * 4. Store registration metadata in Postgres (leaf hash, leafIndex, timestamp)
 * 5. Return Tree 1 Merkle proof to client
 *
 * PRIVACY: This endpoint does NOT receive or store:
 * - user_secret (private key material)
 * - cell_id (Census tract FIPS code)
 * - registration_salt (random value)
 * - address data (stored only in browser IndexedDB)
 *
 * SPEC REFERENCE: WAVE-17-19-IMPLEMENTATION-PLAN.md Section 17c
 * SPEC REFERENCE: COMMUNIQUE-INTEGRATION-SPEC.md Section 2.1
 */

import { json } from '@sveltejs/kit';
import { prisma } from '$lib/core/db';
import type { RequestHandler } from './$types';
import { registerLeaf } from '$lib/core/shadow-atlas/client';

/** BN254 scalar field modulus */
const BN254_MODULUS =
	21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const session = locals.session;

		if (!session) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await request.json();
		const { leaf } = body;

		// Validate leaf is present and hex-formatted
		if (!leaf || typeof leaf !== 'string') {
			return json(
				{ error: 'Missing required field: leaf (hex-encoded field element)' },
				{ status: 400 }
			);
		}

		if (!/^(0x)?[0-9a-fA-F]+$/.test(leaf)) {
			return json(
				{ error: 'Invalid leaf format: must be hex-encoded' },
				{ status: 400 }
			);
		}

		// Validate leaf is within BN254 field
		try {
			const leafBigint = BigInt(leaf.startsWith('0x') ? leaf : '0x' + leaf);
			if (leafBigint === 0n) {
				return json({ error: 'Zero leaf not allowed' }, { status: 400 });
			}
			if (leafBigint >= BN254_MODULUS) {
				return json({ error: 'Leaf exceeds BN254 field modulus' }, { status: 400 });
			}
		} catch {
			return json({ error: 'Invalid leaf value' }, { status: 400 });
		}

		// Check if user is already registered
		const existingRegistration = await prisma.shadowAtlasRegistration.findUnique({
			where: { user_id: session.userId },
		});

		if (existingRegistration) {
			// Derive pathIndices from leafIndex (bit decomposition, depth=20)
			const depth = (existingRegistration.merkle_path as string[]).length;
			const pathIndices = Array.from({ length: depth }, (_, i) =>
				(existingRegistration.leaf_index >> i) & 1,
			);

			return json({
				leafIndex: existingRegistration.leaf_index,
				userRoot: existingRegistration.merkle_root,
				userPath: existingRegistration.merkle_path as string[],
				pathIndices,
				alreadyRegistered: true,
			});
		}

		// Call Shadow Atlas registration API
		let registrationResult;
		try {
			registrationResult = await registerLeaf(leaf);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			console.error('[Shadow Atlas] Registration API call failed:', msg);
			return json(
				{ error: 'Shadow Atlas registration unavailable' },
				{ status: 503 }
			);
		}

		// Store registration metadata in Postgres
		// NOTE: We store the leaf hash (not private inputs) and the Merkle proof
		await prisma.shadowAtlasRegistration.create({
			data: {
				user_id: session.userId,
				congressional_district: 'two-tree', // District comes from Tree 2, not registration
				identity_commitment: leaf, // The leaf hash (operator never sees private inputs)
				leaf_index: registrationResult.leafIndex,
				merkle_root: registrationResult.userRoot,
				merkle_path: registrationResult.userPath,
				credential_type: 'two-tree',
				cell_id: null, // PRIVACY: cell_id never sent to this endpoint
				verification_method: 'self.xyz',
				verification_id: session.userId, // Link to auth session
				verification_timestamp: new Date(),
				registration_status: 'registered',
				expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6 months
			},
		});

		return json({
			leafIndex: registrationResult.leafIndex,
			userRoot: registrationResult.userRoot,
			userPath: registrationResult.userPath,
			pathIndices: registrationResult.pathIndices,
		});
	} catch (error) {
		console.error('[Shadow Atlas] Registration error:', error);
		return json(
			{ error: 'Internal server error' },
			{ status: 500 }
		);
	}
};
