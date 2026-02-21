/**
 * Demo Identity Verification
 *
 * POST /demo/verify-identity — Simulates identity verification for the demo user.
 * Sets identity_commitment so deriveTrustTier() returns Tier 3.
 * Returns the commitment as a valid BN254 field element so the client can
 * bootstrap a session credential for real ZK proof generation.
 *
 * In production this would be handled by self.xyz or Didit NFC passport scanning.
 */
import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import { db } from '$lib/core/db';
import { createHash } from 'crypto';
import type { RequestHandler } from './$types';

// BN254 scalar field modulus
const BN254_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export const POST: RequestHandler = async ({ locals }) => {
	if (!dev && env.DEMO_MODE !== 'true') {
		throw error(404, 'Not found');
	}

	if (!locals.user?.id) {
		throw error(401, 'Not authenticated');
	}

	// Generate a deterministic but valid BN254 field element as identity commitment.
	// Uses double SHA-256 mod BN254 (same pipeline as production computeIdentityCommitment).
	const raw = `demo-identity:${locals.user.id}:${locals.user.email || 'demo'}`;
	const inner = createHash('sha256').update(raw).digest();
	const outer = createHash('sha256').update(inner).digest('hex');
	const commitment = (BigInt('0x' + outer) % BN254_MODULUS).toString(16).padStart(64, '0');

	await db.user.update({
		where: { id: locals.user.id },
		data: {
			identity_commitment: commitment,
			trust_tier: 3,
			is_verified: true,
			verified_at: new Date(),
			verification_method: 'demo'
		}
	});

	return json({
		success: true,
		trust_tier: 3,
		identity_commitment: '0x' + commitment
	});
};
