/**
 * Demo Address Verification
 *
 * POST /demo/verify-address — Simulates address verification for the demo user.
 * Bumps trust_tier to 2 (Constituent) and stores a district hash.
 *
 * In production this is handled by the real self.xyz / Didit NFC passport flow
 * which cryptographically verifies the user's address and extracts district info.
 */
import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import { db } from '$lib/core/db';
import { createHash } from 'crypto';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!dev && env.DEMO_MODE !== 'true') {
		throw error(404, 'Not found');
	}

	if (!locals.user?.id) {
		throw error(401, 'Not authenticated');
	}

	const body = await request.json().catch(() => ({}));
	const address = (body as Record<string, unknown>).address as string | undefined;

	// Generate a deterministic district hash from the address (or a default)
	const raw = `demo-district:${locals.user.id}:${address || 'demo-address'}`;
	const districtHash = createHash('sha256').update(raw).digest('hex').slice(0, 16);

	await db.user.update({
		where: { id: locals.user.id },
		data: {
			trust_tier: Math.max(locals.user.trust_tier ?? 0, 2),
			district_hash: districtHash,
			verified_at: locals.user.verified_at ?? new Date()
		}
	});

	return json({
		success: true,
		trust_tier: 2,
		district_hash: districtHash
	});
};
