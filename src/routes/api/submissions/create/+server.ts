import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma, getRequestClient } from '$lib/core/db';
import {
	isCredentialValidForAction,
	formatValidationError,
	type SessionCredentialForPolicy
} from '$lib/core/identity/credential-policy';
import { computePseudonymousId } from '$lib/core/privacy/pseudonymous-id';
import { processSubmissionDelivery } from '$lib/server/delivery-worker';

/**
 * Submission Creation Endpoint
 *
 * Receives ZK proof + encrypted witness from browser.
 * Stores in database; TEE decrypts witness and handles congressional delivery.
 *
 * Flow:
 * 1. Validate authentication
 * 2. Enforce credential TTL for constituent_message action (ISSUE-005)
 * 3. Verify proof format
 * 4. Check nullifier uniqueness (prevent double-actions)
 * 5. Store in Submission table
 * 6. TEE processes encrypted witness → CWC delivery (async)
 *
 * Security:
 * - Action-based TTL (ISSUE-005): constituent_message requires verification within 30 days
 * - Chain = source of truth: verification_status set only after on-chain confirmation (BR5-003)
 * - User PII is in encrypted witness, never in plaintext request fields
 */
export const POST: RequestHandler = async ({ request, locals, platform }) => {
	try {
		// Check authentication
		const session = locals.session;
		if (!session?.userId) {
			throw error(401, 'Authentication required');
		}

		const userId = session.userId;

		// ISSUE-005: Enforce action-based TTL for constituent messages
		// This endpoint handles congressional delivery, requiring fresh verification
		if (!locals.user?.verified_at) {
			return json(
				{
					error: 'verification_required',
					code: 'NOT_VERIFIED',
					message: 'You must verify your address before submitting to Congress.',
					requiresReverification: true
				},
				{ status: 403 }
			);
		}

		// Build credential object for TTL validation
		const credential: SessionCredentialForPolicy = {
			userId: locals.user.id,
			createdAt: locals.user.verified_at,
			congressionalDistrict: locals.user.district_hash ?? undefined
		};

		// Validate credential age for constituent_message action
		const validation = isCredentialValidForAction(credential, 'constituent_message');

		if (!validation.valid) {
			console.log('[Submission] Credential TTL exceeded:', {
				userId,
				action: 'constituent_message',
				daysOld: Math.floor(validation.age / (24 * 60 * 60 * 1000)),
				maxDays: Math.floor(validation.maxAge / (24 * 60 * 60 * 1000))
			});

			return json(formatValidationError(validation), { status: 403 });
		}

		// Parse request body
		const body = await request.json();
		const {
			templateId,
			proof,
			publicInputs,
			nullifier,
			encryptedWitness,
			witnessNonce,
			ephemeralPublicKey,
			teeKeyId,
			// Idempotency key for preventing duplicate submissions from retries
			idempotencyKey
		} = body;

		// Validate required fields
		if (
			!templateId ||
			!proof ||
			!publicInputs ||
			!nullifier ||
			!encryptedWitness ||
			!witnessNonce ||
			!ephemeralPublicKey ||
			!teeKeyId
		) {
			throw error(400, 'Missing required fields');
		}

		// Validate template exists
		const template = await prisma.template.findUnique({
			where: { id: templateId },
			select: { id: true }
		});

		if (!template) {
			throw error(404, 'Template not found');
		}

		// Create submission with atomic idempotency and nullifier checks
		// Transaction ensures no race conditions on duplicate submissions
		const submission = await prisma.$transaction(async (tx) => {
			// Check idempotency key first (client retry protection)
			if (idempotencyKey) {
				const existingByIdempotency = await tx.submission.findUnique({
					where: { idempotency_key: idempotencyKey }
				});

				if (existingByIdempotency) {
					// Return existing submission for idempotent retry
					return existingByIdempotency;
				}
			}

			// Check nullifier uniqueness (prevent double-actions)
			// This check is now atomic with creation due to unique constraint + transaction
			const existingByNullifier = await tx.submission.findUnique({
				where: { nullifier }
			});

			if (existingByNullifier) {
				throw error(409, 'This action has already been submitted (duplicate nullifier)');
			}

			// Compute pseudonymous ID via HMAC-SHA256(salt, userId)
			// Breaks the link between authenticated identity and on-chain proof submission
			const pseudonymousId = computePseudonymousId(userId);

			// Create submission atomically
			// action_id is the templateId (in production, it's poseidon hash of templateId in public_inputs)
			return await tx.submission.create({
				data: {
					pseudonymous_id: pseudonymousId,
					template_id: templateId,
					action_id: templateId, // TODO: extract action domain from publicInputs[ACTION_DOMAIN]
					proof_hex: proof,
					public_inputs: publicInputs,
					nullifier,
					encrypted_witness: encryptedWitness,
					witness_nonce: witnessNonce,
					ephemeral_public_key: ephemeralPublicKey,
					tee_key_id: teeKeyId,
					idempotency_key: idempotencyKey,
					delivery_status: 'pending',
					verification_status: 'pending'
				}
			});
		});

		console.log('[Submission] Created:', {
			submissionId: submission.id,
			pseudonymousId: submission.pseudonymous_id.slice(0, 12) + '...',
			templateId,
			nullifier: nullifier.slice(0, 10) + '...'
		});

		// Promote user to Tier 3 (ZK-verified) if currently lower
		// Fire-and-forget: don't block the submission response
		prisma.user
			.updateMany({
				where: { id: userId, trust_tier: { lt: 3 } },
				data: { trust_tier: 3 }
			})
			.then((result: { count: number }) => {
				if (result.count > 0) {
					console.log('[Submission] User promoted to trust_tier 3:', userId);
				}
			})
			.catch((err: unknown) => {
				console.error('[Submission] Trust tier promotion failed:', err);
			});

		// Trigger background CWC delivery
		// Decrypts witness, looks up representatives, submits to CWC API
		// delivery_status transitions: pending → processing → delivered | failed | partial
		// Capture the concrete PrismaClient NOW (while still in request context).
		// After response is sent, waitUntil runs outside ALS scope — the proxy
		// would throw "No request-scoped PrismaClient found".
		const db = getRequestClient();
		const deliveryPromise = processSubmissionDelivery(submission.id, db).catch((err) =>
			console.error('[Submission] Background delivery failed:', err)
		);

		if (platform?.context?.waitUntil) {
			// Cloudflare Workers: keep isolate alive until delivery completes
			platform.context.waitUntil(deliveryPromise);
		}
		// Non-CF environments (dev): promise runs fire-and-forget

		return json({
			success: true,
			submissionId: submission.id,
			status: 'pending',
			message: 'Submission created. Processing will begin shortly.'
		});
	} catch (err) {
		console.error('[Submission Creation] Error:', err);

		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'Failed to create submission');
	}
};
