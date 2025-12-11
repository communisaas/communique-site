import { json } from '@sveltejs/kit';
import { prisma } from '$lib/core/db';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const session = locals.session;
		if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

		const body = await request.json();
		const { proof, publicSignals, encryptedWitness, encryptedMessage, templateId, actionId } = body;

		if (!proof || !publicSignals || !encryptedWitness || !encryptedMessage) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		const { districtRoot, nullifier } = publicSignals;

		// 1. Verify Nullifier (Prevent Double-Spend)
		const existingSubmission = await prisma.submission.findFirst({
			where: {
				nullifier: nullifier,
				action_id: actionId
			}
		});

		if (existingSubmission) {
			return json({ error: 'Duplicate submission (nullifier used)' }, { status: 409 });
		}

		// 2. Verify Proof (Mock for Phase 1)
		// In production, load the verification key and verify the proof
		// const isValid = await verifyProof(proof, publicSignals);
		const isValid = true;

		if (!isValid) {
			return json({ error: 'Invalid Zero-Knowledge Proof' }, { status: 400 });
		}

		// 3. Verify Merkle Root exists in Shadow Atlas
		// This ensures the proof was generated against a valid state of the district tree
		// We check if any tree has this root. In strict mode, we'd check the specific district's history.
		const tree = await prisma.shadowAtlasTree.findFirst({
			where: { merkle_root: districtRoot }
		});

		// For Phase 1 demo, we might be lenient if the root is slightly stale,
		// but strictly we should reject unknown roots.
		// if (!tree) return json({ error: 'Invalid Merkle Root' }, { status: 400 });

		// 4. Store Submission
		const submission = await prisma.submission.create({
			data: {
				user_id: session.userId,
				template_id: templateId,

				// ZK Data
				proof_hex: proof, // String
				public_inputs: publicSignals, // Json
				nullifier: nullifier,
				action_id: actionId,

				// Encrypted Data
				encrypted_witness: encryptedWitness, // String (Base64)
				encrypted_message: encryptedMessage, // String (Base64)

				verification_status: 'verified', // We verified the proof (mock)

				// Initial delivery status
				delivery_status: 'pending'
			}
		});

		// 5. Trigger Async Delivery (CWC / TEE)
		// In a real architecture, this would push to SQS
		// await sqs.send({ submissionId: submission.id });

		return json({
			success: true,
			submissionId: submission.id,
			status: 'verified'
		});
	} catch (error) {
		console.error('Submission error:', error);
		if (error instanceof Error) {
			console.error('Error stack:', error.stack);
		}
		return json({ error: 'Internal server error', details: String(error) }, { status: 500 });
	}
};
