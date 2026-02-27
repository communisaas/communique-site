/**
 * Position Registration Endpoint — Power Landscape (Cycle 37)
 *
 * POST: Register a support/oppose position on a template.
 * Requires authentication. Returns aggregate counts (no PII).
 *
 * Duplicate registrations return 200 with existing count (not 409).
 * Privacy: keyed on identity_commitment, not user_id.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/core/db';
import { registerPosition, getPositionCounts } from '$lib/services/positionService';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const session = locals.session;
		if (!session?.userId) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		const body = await request.json();
		const { templateId, stance, identityCommitment, districtCode } = body;

		// Validate required fields
		if (!templateId || typeof templateId !== 'string') {
			return json({ error: 'Missing required field: templateId' }, { status: 400 });
		}

		if (!stance || (stance !== 'support' && stance !== 'oppose')) {
			return json({ error: "stance must be 'support' or 'oppose'" }, { status: 400 });
		}

		if (!identityCommitment || typeof identityCommitment !== 'string') {
			return json({ error: 'Missing required field: identityCommitment' }, { status: 400 });
		}

		// Validate template exists
		const template = await prisma.template.findUnique({
			where: { id: templateId },
			select: { id: true }
		});

		if (!template) {
			return json({ error: 'Template not found' }, { status: 404 });
		}

		// Register position (upsert — duplicates return existing)
		const registration = await registerPosition({
			templateId,
			identityCommitment,
			stance,
			districtCode
		});

		// Always return fresh counts
		const count = await getPositionCounts(templateId);

		return json({
			registrationId: registration.id,
			isNew: registration.isNew,
			count
		});
	} catch (err) {
		console.error('[Position Registration] Error:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		const message = err instanceof Error ? err.message : 'Failed to register position';
		throw error(500, message);
	}
};
