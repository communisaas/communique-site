import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	handleSubmission,
	type SubmissionRequest
} from '$lib/core/congressional/submission-handler';
import { FEATURES } from '$lib/config/features';
import { prisma } from '$lib/core/db';
import { getPlanForOrg } from '$lib/server/billing/plans';

/**
 * Congressional Submit Endpoint
 *
 * Accepts ZK proofs from browser and submits them to the blockchain for verification.
 * After verification succeeds, delivers the message to CWC (wired in submission-handler).
 *
 * Flow:
 * 1. Gate behind FEATURES.CONGRESSIONAL
 * 2. Authenticate user
 * 3. Validate billing plan (Starter+)
 * 4. Validates the proof structure
 * 5. Checks nullifier hasn't been used (prevent double-voting)
 * 6. Stores the submission in Postgres
 * 7. Queues blockchain submission (async)
 * 8. After blockchain verification, delivers to CWC (async, fire-and-forget)
 *
 * Design Invariants:
 * - Feature-gated: returns 404 when FEATURES.CONGRESSIONAL is false
 * - Billing-gated: requires Starter plan or above
 * - Nullifier uniqueness MUST be enforced before blockchain submission
 * - All submissions MUST be logged for audit trail
 * - Blockchain submission MUST be async (don't block response)
 * - CWC delivery MUST be async (don't block blockchain verification)
 * - Return 409 for duplicate nullifier
 *
 * Rate limit: 3 req/hour per user (configured in ROUTE_RATE_LIMITS)
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	// Feature gate — return 404 so the endpoint is invisible when disabled
	if (!FEATURES.CONGRESSIONAL) {
		return json({ error: 'Not found' }, { status: 404 });
	}

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

		// Validate districtId format (e.g., "CA-12" for House, "CA" for Senate)
		if (!body.districtId || !/^[A-Z]{2}(-\d{1,2})?$/.test(body.districtId)) {
			return json(
				{ error: 'districtId must be a valid congressional district (e.g., "CA-12" or "CA")' },
				{ status: 400 }
			);
		}

		// Billing gate: CWC delivery requires Starter plan or above.
		// Look up user's org membership to get the org's subscription.
		// Congressional delivery is an org-level feature — user must belong to a paid org.
		const membership = await prisma.orgMembership.findFirst({
			where: { userId: session.userId },
			select: {
				org: {
					select: {
						subscription: { select: { plan: true } }
					}
				}
			}
		});

		if (!membership) {
			return json(
				{ error: 'Congressional delivery requires an organization membership.' },
				{ status: 403 }
			);
		}

		const plan = getPlanForOrg(membership.org.subscription);
		if (plan.slug === 'free') {
			return json(
				{ error: 'Congressional delivery requires a Starter plan or above.' },
				{ status: 403 }
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
		console.error('[CongressionalSubmit] Submission error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
