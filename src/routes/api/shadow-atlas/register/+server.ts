/**
 * Shadow Atlas Registration Endpoint
 *
 * Registers a user's identity commitment with voter-protocol's Shadow Atlas.
 * This endpoint now acts as a proxy to the production Shadow Atlas API instead
 * of building local Merkle trees.
 *
 * FLOW:
 * 1. Receive identity commitment from client (from generateIdentityCommitment())
 * 2. Call voter-protocol Shadow Atlas API for district lookup + Merkle proof
 * 3. Store registration in ShadowAtlasRegistration table
 * 4. Return Merkle proof data to client for ZK proof generation
 *
 * REMOVED (WS1.2):
 * - Local Merkle tree building (computeMerkleRoot, computeMerklePath)
 * - ShadowAtlasTree storage (now uses voter-protocol's depth-20 trees)
 * - Depth-12 compatibility layer (circuits require depth-20)
 */

import { json } from '@sveltejs/kit';
import { prisma } from '$lib/core/db';
import type { RequestHandler } from './$types';
import { lookupDistrict } from '$lib/core/shadow-atlas/client';

export const POST: RequestHandler = async ({ request, locals }) => {
	console.log('Shadow Atlas registration endpoint called');

	try {
		const session = locals.session;
		console.log('Session:', session);

		if (!session) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await request.json();
		const { identityCommitment, lat, lng } = body;

		// Validate required fields
		if (!identityCommitment) {
			return json(
				{ error: 'Missing required field: identityCommitment' },
				{ status: 400 }
			);
		}

		if (typeof lat !== 'number' || typeof lng !== 'number') {
			return json(
				{ error: 'Missing or invalid required fields: lat, lng must be numbers' },
				{ status: 400 }
			);
		}

		// Parse identity commitment as bigint (accepts hex string or decimal string)
		let commitmentBigint: bigint;
		try {
			if (typeof identityCommitment === 'string') {
				commitmentBigint = identityCommitment.startsWith('0x')
					? BigInt(identityCommitment)
					: BigInt(identityCommitment);
			} else if (typeof identityCommitment === 'bigint') {
				commitmentBigint = identityCommitment;
			} else {
				return json(
					{ error: 'Invalid identityCommitment format. Must be hex string or bigint.' },
					{ status: 400 }
				);
			}
		} catch (error) {
			console.error('Failed to parse identityCommitment:', error);
			return json(
				{ error: 'Failed to parse identityCommitment as bigint' },
				{ status: 400 }
			);
		}

		// Lookup district and Merkle proof from voter-protocol Shadow Atlas
		console.log(`Looking up district for coordinates: lat=${lat}, lng=${lng}`);
		let districtLookup;
		try {
			districtLookup = await lookupDistrict(lat, lng);
		} catch (error) {
			console.error('Shadow Atlas lookup failed:', error);
			return json(
				{
					error: 'Failed to lookup district',
					details: error instanceof Error ? error.message : String(error)
				},
				{ status: 503 }
			);
		}

		const { district, merkleProof } = districtLookup;
		console.log(`District found: ${district.id} (${district.name})`);

		// Use transaction to ensure consistency
		const result = await prisma.$transaction(async (tx) => {
			// 1. Verify user exists (defensive check for test isolation)
			const userExists = await tx.user.findUnique({
				where: { id: session.userId },
				select: { id: true }
			});

			if (!userExists) {
				throw new Error(
					`User ${session.userId} not found - cannot register for Shadow Atlas`
				);
			}

			// 2. Check if user is already registered
			const existingRegistration = await tx.shadowAtlasRegistration.findUnique({
				where: { user_id: session.userId }
			});

			if (existingRegistration) {
				// If already registered, return existing registration
				console.log(`User ${session.userId} already registered, returning existing data`);
				return {
					districtId: existingRegistration.congressional_district,
					districtName: district.name, // Use fresh name from API
					leafIndex: existingRegistration.leaf_index,
					merkleRoot: existingRegistration.merkle_root,
					merklePath: existingRegistration.merkle_path as string[]
				};
			}

			// 3. Create new registration record
			// NOTE: We store the Merkle proof data for client-side ZK proof generation
			// The leaf index comes from the voter-protocol API response
			const registration = await tx.shadowAtlasRegistration.create({
				data: {
					user_id: session.userId,
					congressional_district: district.id,
					identity_commitment: commitmentBigint.toString(),
					leaf_index: 0, // TODO: Extract from merkleProof.leaf position once API provides it
					merkle_root: merkleProof.root,
					merkle_path: merkleProof.siblings, // Array of hex strings
					verification_method: 'self.xyz', // Default for Phase 1
					verification_id: 'mock-verification-id', // TODO: Link to actual verification session
					verification_timestamp: new Date(),
					registration_status: 'registered',
					expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) // 6 months
				}
			});

			console.log(`Created new registration for user ${session.userId}`);

			return {
				districtId: district.id,
				districtName: district.name,
				leafIndex: registration.leaf_index,
				merkleRoot: registration.merkle_root,
				merklePath: registration.merkle_path as string[]
			};
		});

		console.log('Registration successful');
		return json(result);
	} catch (error) {
		console.error('Shadow Atlas registration error:', error);
		if (error instanceof Error) {
			console.error('Error stack:', error.stack);
		}
		return json(
			{
				error: 'Internal server error',
				details: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
};
