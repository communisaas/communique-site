/**
 * Submission Retry Queue (Wave 15a)
 *
 * Database-backed retry queue for failed blockchain submissions.
 * Failed verifyOnChain calls are queued here and retried with exponential backoff.
 *
 * Retry schedule: 30s, 60s, 120s, 240s → give up after 4 attempts.
 *
 * Idempotency: Uses nullifier as dedup key. If nullifier is already recorded
 * on-chain (checked via isNullifierUsed), the retry is skipped.
 */

import { prisma } from '$lib/core/db';
import { verifyOnChain, isNullifierUsed, isCircuitOpen, PUBLIC_INPUT_INDEX } from './district-gate-client';

const MAX_RETRIES = 4;
const BACKOFF_BASE_MS = 30_000; // 30s, 60s, 120s, 240s

/**
 * Queue a failed submission for retry.
 *
 * @param submissionId - Database submission ID
 * @param proof - Hex-encoded proof
 * @param publicInputs - 31 field element strings (three-tree circuit)
 * @param verifierDepth - Circuit depth
 */
export async function queueForRetry(
	submissionId: string,
	proof: string,
	publicInputs: string[],
	verifierDepth: number
): Promise<void> {
	const nullifier = publicInputs[PUBLIC_INPUT_INDEX.NULLIFIER];
	const nextRetryAt = new Date(Date.now() + BACKOFF_BASE_MS);

	await prisma.submissionRetry.upsert({
		where: { submission_id: submissionId },
		create: {
			submission_id: submissionId,
			nullifier,
			proof_hex: proof,
			public_inputs: publicInputs,
			verifier_depth: verifierDepth,
			retry_count: 0,
			next_retry_at: nextRetryAt,
			status: 'pending'
		},
		update: {
			// Don't reset retry_count on re-queue — preserve attempt history
			next_retry_at: nextRetryAt,
			status: 'pending'
		}
	});

	console.debug('[RetryQueue] Queued submission for retry:', {
		submissionId,
		nullifier: nullifier.slice(0, 12) + '...',
		nextRetryAt: nextRetryAt.toISOString()
	});
}

/**
 * Process pending retries. Call from a background cron job (every 30s).
 *
 * @returns Number of retries processed
 */
export async function processRetryQueue(): Promise<number> {
	// Wave 15R fix (M-01): Don't process retries when circuit breaker is open
	if (isCircuitOpen()) {
		console.debug('[RetryQueue] Circuit breaker open, skipping retry batch');
		return 0;
	}

	const pendingRetries = await prisma.submissionRetry.findMany({
		where: {
			status: 'pending',
			next_retry_at: { lte: new Date() }
		},
		orderBy: { next_retry_at: 'asc' },
		take: 10 // Process max 10 per batch
	});

	let processed = 0;

	for (const retry of pendingRetries) {
		try {
			// Idempotency: check if nullifier is already on-chain
			const actionDomain =
				(retry.public_inputs as string[])[PUBLIC_INPUT_INDEX.ACTION_DOMAIN];
			const alreadyUsed = await isNullifierUsed(actionDomain, retry.nullifier);

			if (alreadyUsed) {
				// Already on-chain — mark as succeeded and update submission
				await prisma.$transaction([
					prisma.submissionRetry.update({
						where: { id: retry.id },
						data: { status: 'succeeded' }
					}),
					prisma.submission.update({
						where: { id: retry.submission_id },
						data: { verification_status: 'verified' }
					})
				]);
				console.debug('[RetryQueue] Nullifier already on-chain, marking success:', retry.submission_id);
				processed++;
				continue;
			}

			// Attempt retry
			const result = await verifyOnChain({
				proof: retry.proof_hex,
				publicInputs: retry.public_inputs as string[],
				verifierDepth: retry.verifier_depth
			});

			if (result.success) {
				await prisma.$transaction([
					prisma.submissionRetry.update({
						where: { id: retry.id },
						data: { status: 'succeeded' }
					}),
					prisma.submission.update({
						where: { id: retry.submission_id },
						data: {
							verification_status: 'verified',
							verification_tx_hash: result.txHash,
							verified_at: new Date()
						}
					})
				]);
				console.debug('[RetryQueue] Retry succeeded:', retry.submission_id);
			} else {
				const newRetryCount = retry.retry_count + 1;

				if (newRetryCount >= MAX_RETRIES) {
					// Exhausted retries
					await prisma.$transaction([
						prisma.submissionRetry.update({
							where: { id: retry.id },
							data: { status: 'exhausted', retry_count: newRetryCount }
						}),
						prisma.submission.update({
							where: { id: retry.submission_id },
							data: {
								verification_status: 'failed',
								delivery_error: `Exhausted ${MAX_RETRIES} retries. Last error: ${result.error}`
							}
						})
					]);
					console.error('[RetryQueue] Retries exhausted:', retry.submission_id);
				} else {
					// Schedule next retry with exponential backoff
					const delayMs = BACKOFF_BASE_MS * Math.pow(2, newRetryCount);
					await prisma.submissionRetry.update({
						where: { id: retry.id },
						data: {
							retry_count: newRetryCount,
							next_retry_at: new Date(Date.now() + delayMs),
							last_error: result.error
						}
					});
					console.debug('[RetryQueue] Scheduled retry:', {
						submissionId: retry.submission_id,
						attempt: newRetryCount + 1,
						nextIn: `${delayMs / 1000}s`
					});
				}
			}

			processed++;
		} catch (err) {
			console.error('[RetryQueue] Error processing retry:', retry.id, err);
		}
	}

	return processed;
}
