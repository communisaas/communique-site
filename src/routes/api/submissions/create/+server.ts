import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/core/db';

/**
 * Submission Creation Endpoint
 *
 * Receives ZK proof + encrypted witness from browser
 * Stores in database for TEE processing and congressional delivery
 *
 * Flow:
 * 1. Validate authentication
 * 2. Verify proof format
 * 3. Check nullifier uniqueness (prevent double-actions)
 * 4. Store in Submission table
 * 5. Trigger TEE processing (async)
 *
 * Per COMMUNIQUE-ZK-IMPLEMENTATION-SPEC.md Phase 2
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
		const {
			templateId,
			proof,
			publicInputs,
			nullifier,
			encryptedWitness,
			witnessNonce,
			ephemeralPublicKey,
			teeKeyId,
			templateData
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
			select: { id: true, title: true }
		});

		if (!template) {
			throw error(404, 'Template not found');
		}

		// Check nullifier uniqueness (prevent double-actions)
		const existingSubmission = await prisma.submission.findFirst({
			where: { nullifier }
		});

		if (existingSubmission) {
			throw error(409, 'This action has already been submitted (duplicate nullifier)');
		}

		// Create submission
		const submission = await prisma.submission.create({
			data: {
				user_id: userId,
				template_id: templateId,
				proof_hex: proof,
				public_inputs: publicInputs,
				nullifier,
				encrypted_witness: encryptedWitness,
				witness_nonce: witnessNonce,
				ephemeral_public_key: ephemeralPublicKey,
				tee_key_id: teeKeyId,
				delivery_status: 'pending',
				verification_status: 'pending'
			}
		});

		console.log('[Submission] Created:', {
			submissionId: submission.id,
			userId,
			templateId,
			nullifier: nullifier.slice(0, 10) + '...'
		});

		// TODO: Trigger async TEE processing
		// - Send encrypted witness to AWS Nitro Enclave
		// - TEE decrypts, verifies proof, delivers to CWC
		// - Update submission.delivery_status and submission.verification_status

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
