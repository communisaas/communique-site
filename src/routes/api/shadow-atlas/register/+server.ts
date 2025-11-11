import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/core/db';
import {
	storeSessionCredential,
	calculateExpirationDate
} from '$lib/core/identity/session-credentials';
import type { SessionCredential } from '$lib/core/identity/session-credentials';

/**
 * Shadow Atlas Registration Endpoint
 *
 * Registers user's identity commitment in district Merkle tree
 * Returns merkle_path for browser-based ZK proof generation
 *
 * Flow:
 * 1. Verify user is authenticated and identity-verified
 * 2. Call voter-protocol Shadow Atlas API to register
 * 3. Store merkle_path in database (ShadowAtlasRegistration)
 * 4. Cache credential in IndexedDB for 6 months
 *
 * Per COMMUNIQUE-ZK-IMPLEMENTATION-SPEC.md Phase 1.3
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Check authentication
		const session = locals.session;
		if (!session?.userId) {
			throw error(401, 'Authentication required');
		}

		const userId = session.userId;

		// Parse request body
		const body = await request.json();
		const { identityCommitment, congressionalDistrict, verificationMethod, verificationId } = body;

		// Validate required fields
		if (!identityCommitment || !congressionalDistrict || !verificationMethod || !verificationId) {
			throw error(400, 'Missing required fields');
		}

		// Validate verification method
		if (verificationMethod !== 'self.xyz' && verificationMethod !== 'didit') {
			throw error(400, 'Invalid verification method');
		}

		// Validate congressional district format (e.g., "CA-12", "NY-15")
		const districtRegex = /^[A-Z]{2}-\d{1,2}$/;
		if (!districtRegex.test(congressionalDistrict)) {
			throw error(400, 'Invalid congressional district format');
		}

		// Verify user is identity-verified
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				is_verified: true,
				verification_method: true,
				identity_hash: true
			}
		});

		if (!user || !user.is_verified) {
			throw error(403, 'Identity verification required');
		}

		// Check if user already has registration
		const existingRegistration = await prisma.shadowAtlasRegistration.findUnique({
			where: { user_id: userId }
		});

		if (existingRegistration && existingRegistration.registration_status === 'registered') {
			// Check if expired
			const now = new Date();
			if (existingRegistration.expires_at > now) {
				// Return existing registration
				return json({
					success: true,
					data: {
						leafIndex: existingRegistration.leaf_index,
						merklePath: existingRegistration.merkle_path as string[],
						merkleRoot: existingRegistration.merkle_root,
						districtSize: 4096,
						expiresAt: existingRegistration.expires_at.toISOString(),
						status: 'already_registered'
					}
				});
			}
		}

		// TODO: Call voter-protocol Shadow Atlas API
		// For now, we'll use mock data since voter-protocol team is building the Merkle tree
		// In production, this will call: POST https://api.voter-protocol.org/shadow-atlas/register

		const mockResponse = await registerWithShadowAtlas({
			identityCommitment,
			congressionalDistrict,
			verificationMethod,
			verificationId
		});

		if (!mockResponse.success) {
			throw error(500, mockResponse.error || 'Shadow Atlas registration failed');
		}

		// Calculate expiration (6 months from now)
		const expiresAt = calculateExpirationDate();
		const now = new Date();

		// Store in database
		const registration = await prisma.shadowAtlasRegistration.upsert({
			where: { user_id: userId },
			update: {
				identity_commitment: identityCommitment,
				congressional_district: congressionalDistrict,
				leaf_index: mockResponse.leafIndex,
				merkle_root: mockResponse.merkleRoot,
				merkle_path: mockResponse.merklePath,
				verification_method: verificationMethod,
				verification_id: verificationId,
				verification_timestamp: now,
				registration_status: 'registered',
				registered_at: now,
				expires_at: expiresAt,
				updated_at: now
			},
			create: {
				user_id: userId,
				identity_commitment: identityCommitment,
				congressional_district: congressionalDistrict,
				leaf_index: mockResponse.leafIndex,
				merkle_root: mockResponse.merkleRoot,
				merkle_path: mockResponse.merklePath,
				verification_method: verificationMethod,
				verification_id: verificationId,
				verification_timestamp: now,
				registration_status: 'registered',
				registered_at: now,
				expires_at: expiresAt
			}
		});

		// Prepare session credential for IndexedDB caching (client-side)
		const sessionCredential: SessionCredential = {
			userId,
			identityCommitment,
			leafIndex: registration.leaf_index,
			merklePath: mockResponse.merklePath,
			merkleRoot: registration.merkle_root,
			congressionalDistrict,
			verificationMethod,
			createdAt: now,
			expiresAt
		};

		// Return registration data (frontend will cache in IndexedDB)
		return json({
			success: true,
			data: {
				leafIndex: registration.leaf_index,
				merklePath: mockResponse.merklePath,
				merkleRoot: registration.merkle_root,
				districtSize: 4096,
				expiresAt: expiresAt.toISOString(),
				sessionCredential // Client will cache this
			}
		});
	} catch (err) {
		console.error('[Shadow Atlas Registration] Error:', err);

		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'Shadow Atlas registration failed');
	}
};

// ============================================================================
// Mock Shadow Atlas API (Replace with real API when voter-protocol deploys)
// ============================================================================

interface RegisterRequest {
	identityCommitment: string;
	congressionalDistrict: string;
	verificationMethod: string;
	verificationId: string;
}

interface RegisterResponse {
	success: boolean;
	leafIndex: number;
	merklePath: string[];
	merkleRoot: string;
	error?: string;
}

/**
 * Mock Shadow Atlas registration
 * TODO: Replace with real voter-protocol API call
 *
 * Real implementation will:
 * 1. POST to https://api.voter-protocol.org/shadow-atlas/register
 * 2. Receive leafIndex, merklePath (12 hashes), merkleRoot
 * 3. Handle rate limiting, retries, error responses
 */
async function registerWithShadowAtlas(request: RegisterRequest): Promise<RegisterResponse> {
	// MOCK IMPLEMENTATION - Remove when voter-protocol API is ready
	// This generates deterministic mock data for testing

	console.log('[Shadow Atlas API - MOCK] Registering:', {
		district: request.congressionalDistrict,
		commitment: request.identityCommitment.slice(0, 10) + '...'
	});

	// Simulate API latency
	await new Promise((resolve) => setTimeout(resolve, 500));

	// Generate mock leaf index (deterministic from identity commitment)
	const hash = await crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(request.identityCommitment)
	);
	const hashArray = new Uint8Array(hash);
	const leafIndex = (hashArray[0] << 8) | hashArray[1]; // 0-65535
	const districtLeafIndex = leafIndex % 4096; // 0-4095 (4096 leaves per district)

	// Generate mock Merkle path (12 sibling hashes for 4096-leaf tree)
	// In production, Shadow Atlas computes this from actual district tree
	const merklePath: string[] = [];
	for (let i = 0; i < 12; i++) {
		const siblingHash = Array.from({ length: 64 }, () =>
			Math.floor(Math.random() * 16).toString(16)
		).join('');
		merklePath.push('0x' + siblingHash);
	}

	// Generate mock Merkle root
	const rootHash = Array.from({ length: 64 }, () =>
		Math.floor(Math.random() * 16).toString(16)
	).join('');
	const merkleRoot = '0x' + rootHash;

	console.log('[Shadow Atlas API - MOCK] Registration complete:', {
		leafIndex: districtLeafIndex,
		merklePathLength: merklePath.length,
		merkleRoot: merkleRoot.slice(0, 10) + '...'
	});

	return {
		success: true,
		leafIndex: districtLeafIndex,
		merklePath,
		merkleRoot
	};

	// TODO: Real implementation (when voter-protocol deploys):
	/*
	const response = await fetch('https://api.voter-protocol.org/shadow-atlas/register', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${process.env.VOTER_API_KEY}`
		},
		body: JSON.stringify({
			identity_commitment: request.identityCommitment,
			congressional_district: request.congressionalDistrict,
			verification: {
				method: request.verificationMethod,
				verification_id: request.verificationId
			}
		})
	});

	if (!response.ok) {
		const errorData = await response.json();
		return {
			success: false,
			leafIndex: 0,
			merklePath: [],
			merkleRoot: '',
			error: errorData.message || 'Shadow Atlas API error'
		};
	}

	const data = await response.json();
	return {
		success: true,
		leafIndex: data.leaf_index,
		merklePath: data.merkle_path,
		merkleRoot: data.merkle_root
	};
	*/
}
