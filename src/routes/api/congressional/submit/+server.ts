import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	handleSubmission,
	type SubmissionRequest
} from '$lib/core/congressional/submission-handler';

/**
 * Congressional Submit Endpoint
 *
 * Accepts ZK proofs from browser and submits them to the blockchain for verification.
 *
 * Flow:
 * 1. Validates the proof structure
 * 2. Checks nullifier hasn't been used (prevent double-voting)
 * 3. Stores the submission in Postgres
 * 4. Queues blockchain submission (async)
 *
 * Design Invariants:
 * - Nullifier uniqueness MUST be enforced before blockchain submission
 * - All submissions MUST be logged for audit trail
 * - Blockchain submission MUST be async (don't block response)
 * - Return 409 for duplicate nullifier
 *
 * Per COMMUNIQUE-ZK-IMPLEMENTATION-SPEC.md Phase 3
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const session = locals.session;
	if (!session?.userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = (await request.json()) as SubmissionRequest;

		// Validate request structure
		if (!body.proof || !body.publicInputs || !body.templateId) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		if (!Array.isArray(body.publicInputs) || body.publicInputs.length !== 31) {
			return json(
				{ error: 'publicInputs must be array of 31 elements (three-tree circuit public outputs)' },
				{ status: 400 }
			);
		}

		if (!body.verifierDepth || ![18, 20, 22, 24].includes(body.verifierDepth)) {
			return json(
				{ error: 'verifierDepth must be 18, 20, 22, or 24' },
				{ status: 400 }
			);
		}

		const result = await handleSubmission(session.userId, body);

		return json({
			success: true,
			data: {
				submissionId: result.submissionId,
				status: result.status,
				nullifier: result.nullifier
			}
		});
	} catch (error) {
		if (error instanceof Error && error.message === 'NULLIFIER_ALREADY_USED') {
			return json({ error: 'This proof has already been submitted' }, { status: 409 });
		}
		console.error('Submission error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
