import { prisma } from '$lib/core/db';
import {
	verifyOnChain,
	PUBLIC_INPUT_INDEX,
	THREE_TREE_PUBLIC_INPUT_COUNT
} from '$lib/core/blockchain/district-gate-client';
import { queueForRetry } from '$lib/core/blockchain/submission-retry-queue';
import { computePseudonymousId } from '$lib/core/privacy/pseudonymous-id';

/**
 * Congressional Submission Request
 *
 * Proof structure from browser-generated ZK proof (three-tree circuit):
 * - proof: Hex-encoded proof bytes from Noir/UltraHonk circuit
 * - publicInputs: Array of 31 field elements (three-tree circuit public outputs)
 *   Key indices: [0]=userRoot, [1]=cellMapRoot, [26]=nullifier, [27]=actionDomain,
 *   [28]=authorityLevel, [29]=engagementRoot, [30]=engagementTier
 * - verifierDepth: Circuit depth (18 | 20 | 22 | 24)
 * - encryptedMessage: Optional encrypted message content (XChaCha20-Poly1305)
 * - templateId: Template ID for linking to message template
 * - districtId: Congressional district (e.g., "CA-12")
 */
export interface SubmissionRequest {
	proof: string;
	publicInputs: string[];
	verifierDepth: number;
	encryptedMessage?: string;
	templateId: string;
	districtId: string;
}

/**
 * Submission Result
 *
 * Response after successful submission storage:
 * - submissionId: Database ID for tracking
 * - status: Current processing status
 * - nullifier: Unique nullifier for this proof (prevents double-actions)
 */
export interface SubmissionResult {
	submissionId: string;
	status: 'pending' | 'confirmed' | 'failed';
	nullifier: string;
}

/**
 * Handle Congressional Submission
 *
 * Core business logic for accepting and storing ZK proof submissions.
 *
 * Control Flow:
 * 1. Extract nullifier from public inputs (index 26 in three-tree array)
 * 2. Check nullifier uniqueness (atomic with database constraints)
 * 3. Store submission in Postgres with all proof data
 * 4. Queue blockchain submission (async, fire-and-forget)
 *
 * Per-Chamber Nullifier Scoping (Wave 14e, G-08):
 * Each chamber (House/Senate) gets a different action domain via recipientSubdivision
 * in the action domain builder (e.g., "US-CA" for Senate, "US-CA-12" for House).
 * This means different nullifiers per chamber — users can message both independently.
 * Callers must invoke this function once per chamber with the correct proof.
 *
 * Invariants:
 * - Nullifier uniqueness enforced by database unique constraint
 * - Blockchain submission happens asynchronously (doesn't block response)
 * - All errors are logged for audit trail
 *
 * @param userId - Authenticated user ID from session
 * @param request - Submission request with proof and metadata
 * @returns Submission result with ID and status
 * @throws Error with 'NULLIFIER_ALREADY_USED' message if duplicate
 */
export async function handleSubmission(
	userId: string,
	request: SubmissionRequest
): Promise<SubmissionResult> {
	// Extract nullifier from public inputs (index 26 in 31-element three-tree array)
	const nullifier = request.publicInputs[PUBLIC_INPUT_INDEX.NULLIFIER];

	// Check if nullifier already exists (prevents double-actions)
	// This query races with the create below, but unique constraint provides final enforcement
	const existing = await prisma.submission.findFirst({
		where: { nullifier }
	});

	if (existing) {
		throw new Error('NULLIFIER_ALREADY_USED');
	}

	// Compute pseudonymous ID via HMAC-SHA256(salt, userId)
	// Breaks the link between authenticated identity and on-chain proof submission
	const pseudonymousId = computePseudonymousId(userId);

	// Create submission record
	// The Submission model already exists in schema.prisma (lines 1037-1092)
	// We're mapping our request structure to the existing schema fields
	const submission = await prisma.submission.create({
		data: {
			pseudonymous_id: pseudonymousId,
			proof_hex: request.proof,
			public_inputs: request.publicInputs,
			nullifier,
			template_id: request.templateId,
			action_id: request.publicInputs[PUBLIC_INPUT_INDEX.ACTION_DOMAIN], // Action domain from circuit public inputs
			encrypted_message: request.encryptedMessage,
			delivery_status: 'pending',
			verification_status: 'pending',
			// Encrypted witness fields (optional for Phase 1)
			encrypted_witness: '', // Not used in congressional submit (different from full submission)
			witness_nonce: null,
			ephemeral_public_key: null,
			tee_key_id: null
		}
	});

	// Queue blockchain submission (fire and forget for now)
	// This runs async and updates the submission status when complete
	queueBlockchainSubmission(submission.id, request).catch((error) => {
		console.error('[SubmissionHandler] Blockchain queue error:', error);
	});

	return {
		submissionId: submission.id,
		status: 'pending',
		nullifier
	};
}

/**
 * Queue Blockchain Submission
 *
 * Asynchronously submits proof to Scroll blockchain for verification.
 * Updates submission record with blockchain status.
 *
 * Control Flow:
 * 1. Mark submission as 'queued' in database
 * 2. Call blockchain client to verify on-chain
 * 3. Update submission with transaction hash and status
 *
 * Error Handling:
 * - Errors are logged but don't propagate to client
 * - Submission record is updated with failure status
 * - Allows retry via background job if needed
 *
 * @param submissionId - Database submission ID
 * @param request - Original submission request with proof data
 */
async function queueBlockchainSubmission(
	submissionId: string,
	request: SubmissionRequest
): Promise<void> {
	try {
		// Mark as queued (intermediate state before blockchain call)
		await prisma.submission.update({
			where: { id: submissionId },
			data: { verification_status: 'queued' }
		});

		// Submit to blockchain for verification (31-element public inputs)
		const result = await verifyOnChain({
			proof: request.proof,
			publicInputs: request.publicInputs,
			verifierDepth: request.verifierDepth
		});

		if (result.success && result.txHash) {
			// Update with successful verification
			await prisma.submission.update({
				where: { id: submissionId },
				data: {
					verification_status: 'verified',
					verification_tx_hash: result.txHash,
					verified_at: new Date()
				}
			});

			console.debug('[SubmissionHandler] Blockchain verification successful:', {
				submissionId,
				txHash: result.txHash
			});
		} else {
			// Update with failure status
			await prisma.submission.update({
				where: { id: submissionId },
				data: {
					verification_status: 'failed',
					delivery_error: result.error || 'Blockchain verification failed'
				}
			});

			console.error('[SubmissionHandler] Blockchain verification failed:', {
				submissionId,
				error: result.error
			});
		}
	} catch (error) {
		console.error('[SubmissionHandler] Blockchain submission error:', error);

		// Wave 15a: Queue for retry instead of immediately marking failed
		try {
			await queueForRetry(
				submissionId,
				request.proof,
				request.publicInputs,
				request.verifierDepth
			);
			await prisma.submission.update({
				where: { id: submissionId },
				data: {
					verification_status: 'queued_retry',
					delivery_error: error instanceof Error ? error.message : 'Unknown blockchain error'
				}
			});
		} catch (retryError) {
			// If even the retry queue fails, mark as failed
			console.error('[SubmissionHandler] Retry queue error:', retryError);
			await prisma.submission.update({
				where: { id: submissionId },
				data: {
					verification_status: 'failed',
					delivery_error: error instanceof Error ? error.message : 'Unknown blockchain error'
				}
			});
		}
	}
}
