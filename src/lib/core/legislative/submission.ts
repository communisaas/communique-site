/**
 * Legislative Submission Handler
 *
 * Core business logic for accepting ZK proof submissions and routing them
 * through blockchain verification → CWC delivery.
 *
 * Control flow:
 * 1. Extract nullifier from public inputs (index 26 in three-tree array)
 * 2. Check nullifier uniqueness (atomic with database unique constraint)
 * 3. Store submission in Postgres with all proof data
 * 4. Queue blockchain submission (async, fire-and-forget)
 * 5. After verification, deliver to CWC via cwcClient.deliverToOffice()
 */

import { db } from '$lib/core/db';
import {
	verifyOnChain,
	PUBLIC_INPUT_INDEX,
	THREE_TREE_PUBLIC_INPUT_COUNT
} from '$lib/core/blockchain/district-gate-client';
import { queueForRetry } from '$lib/core/blockchain/submission-retry-queue';
import { computePseudonymousId } from '$lib/core/privacy/pseudonymous-id';
import { FEATURES } from '$lib/config/features';
import { cwcClient } from './cwc-client';

export interface SubmissionRequest {
	proof: string;
	publicInputs: string[];
	verifierDepth: number;
	encryptedMessage?: string;
	templateId: string;
	districtId: string;
	/** Encrypted witness for TEE-resolved CWC delivery */
	encryptedWitness?: string;
	witnessNonce?: string;
	ephemeralPublicKey?: string;
	teeKeyId?: string;
}

export interface SubmissionResult {
	submissionId: string;
	status: 'pending' | 'confirmed' | 'failed';
	nullifier: string;
}

/**
 * Handle a ZK proof submission.
 *
 * @param userId - Authenticated user ID from session
 * @param request - Submission request with proof and metadata
 * @throws Error with 'NULLIFIER_ALREADY_USED' message if duplicate
 */
export async function handleSubmission(
	userId: string,
	request: SubmissionRequest
): Promise<SubmissionResult> {
	const nullifier = request.publicInputs[PUBLIC_INPUT_INDEX.NULLIFIER];

	// Check nullifier uniqueness (unique constraint provides final enforcement)
	const existing = await db.submission.findFirst({
		where: { nullifier }
	});

	if (existing) {
		throw new Error('NULLIFIER_ALREADY_USED');
	}

	const pseudonymousId = computePseudonymousId(userId);

	const submission = await db.submission.create({
		data: {
			pseudonymous_id: pseudonymousId,
			proof_hex: request.proof,
			public_inputs: request.publicInputs,
			nullifier,
			template_id: request.templateId,
			action_id: request.publicInputs[PUBLIC_INPUT_INDEX.ACTION_DOMAIN],
			encrypted_message: request.encryptedMessage,
			delivery_status: 'pending',
			verification_status: 'pending',
			encrypted_witness: request.encryptedWitness || '',
			witness_nonce: request.witnessNonce || null,
			ephemeral_public_key: request.ephemeralPublicKey || null,
			tee_key_id: request.teeKeyId || null
		}
	});

	// Queue blockchain verification (fire-and-forget)
	queueBlockchainSubmission(submission.id, request).catch((error) => {
		console.error('[Submission] Blockchain queue error:', error);
	});

	return {
		submissionId: submission.id,
		status: 'pending',
		nullifier
	};
}

/**
 * Resolve constituent PII via TEE and deliver to CWC.
 * PII exists only in function-scoped variables — never persisted in plaintext.
 */
async function resolveAndDeliver(
	submissionId: string,
	request: SubmissionRequest,
	verificationTxHash: string
): Promise<void> {
	// Fetch encrypted witness from submission record
	const submission = await db.submission.findUnique({
		where: { id: submissionId },
		select: { encrypted_witness: true, witness_nonce: true, ephemeral_public_key: true }
	});

	if (!submission?.encrypted_witness || !submission.witness_nonce || !submission.ephemeral_public_key) {
		console.error('[Submission] Cannot deliver to CWC: missing encrypted witness data', { submissionId });
		return;
	}

	// Lazy import to avoid circular dependency — resolver is in $lib/server/tee/
	const { getConstituentResolver } = await import('$lib/server/tee');
	const resolver = getConstituentResolver();
	const resolved = await resolver.resolve({
		ciphertext: submission.encrypted_witness,
		nonce: submission.witness_nonce,
		ephemeralPublicKey: submission.ephemeral_public_key
	});

	if (!resolved.success || !resolved.constituent) {
		console.error('[Submission] Constituent resolution failed:', { submissionId, error: resolved.error });
		await db.submission.update({
			where: { id: submissionId },
			data: { delivery_status: 'delivery_failed', delivery_error: resolved.error || 'Constituent resolution failed' }
		});
		return;
	}

	await cwcClient.deliverToOffice(
		{
			submissionId,
			districtId: request.districtId,
			templateId: request.templateId,
			verificationTxHash
		},
		resolved.constituent
	);
}

/**
 * Asynchronously submit proof to Scroll blockchain for verification,
 * then deliver to CWC on success.
 */
async function queueBlockchainSubmission(
	submissionId: string,
	request: SubmissionRequest
): Promise<void> {
	try {
		await db.submission.update({
			where: { id: submissionId },
			data: { verification_status: 'queued' }
		});

		const result = await verifyOnChain({
			proof: request.proof,
			publicInputs: request.publicInputs,
			verifierDepth: request.verifierDepth
		});

		if (result.success && result.txHash) {
			await db.submission.update({
				where: { id: submissionId },
				data: {
					verification_status: 'verified',
					verification_tx_hash: result.txHash,
					verified_at: new Date()
				}
			});

			console.debug('[Submission] Blockchain verification successful:', {
				submissionId,
				txHash: result.txHash
			});

			// Deliver to CWC (fire-and-forget)
			if (FEATURES.CONGRESSIONAL) {
				resolveAndDeliver(submissionId, request, result.txHash).catch((error) => {
					console.error('[Submission] CWC delivery error:', error);
				});
			}
		} else {
			await db.submission.update({
				where: { id: submissionId },
				data: {
					verification_status: 'failed',
					delivery_error: result.error || 'Blockchain verification failed'
				}
			});

			console.error('[Submission] Blockchain verification failed:', {
				submissionId,
				error: result.error
			});
		}
	} catch (error) {
		console.error('[Submission] Blockchain submission error:', error);

		try {
			await queueForRetry(
				submissionId,
				request.proof,
				request.publicInputs,
				request.verifierDepth
			);
			await db.submission.update({
				where: { id: submissionId },
				data: {
					verification_status: 'queued_retry',
					delivery_error: error instanceof Error ? error.message : 'Unknown blockchain error'
				}
			});
		} catch (retryError) {
			console.error('[Submission] Retry queue error:', retryError);
			await db.submission.update({
				where: { id: submissionId },
				data: {
					verification_status: 'failed',
					delivery_error: error instanceof Error ? error.message : 'Unknown blockchain error'
				}
			});
		}
	}
}
