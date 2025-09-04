/**
 * Server-side proxy endpoint for VOTER Protocol certification
 * 
 * This endpoint handles the secure communication with VOTER Protocol API,
 * keeping API keys and sensitive configuration on the server side only.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

// VOTER Protocol configuration (server-side only)
const VOTER_API_URL = env.VOTER_API_URL || 'http://localhost:8000';
const VOTER_API_KEY = env.VOTER_API_KEY || '';
const ENABLE_CERTIFICATION = env.ENABLE_CERTIFICATION === 'true';

export const POST: RequestHandler = async ({ request }) => {
	// Check if certification is enabled
	if (!ENABLE_CERTIFICATION) {
		return json({ 
			success: true,
			message: 'Certification service disabled'
		});
	}

	try {
		const body = await request.json();
		const { userAddress, ...certificationData } = body;

		// Forward request to VOTER Protocol API
		const response = await fetch(`${VOTER_API_URL}/api/v1/certification/action`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-API-Key': VOTER_API_KEY,
				'X-User-Address': userAddress
			},
			body: JSON.stringify({
				action_type: certificationData.actionType,
				delivery_receipt: certificationData.deliveryReceipt,
				message_hash: certificationData.messageHash,
				timestamp: certificationData.timestamp,
				metadata: {
					recipient_email: certificationData.recipientEmail,
					recipient_name: certificationData.recipientName,
					subject: certificationData.subject,
					...certificationData.metadata
				}
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('[VOTER Proxy] Certification failed:', errorText);
			return json(
				{ 
					success: false, 
					error: `Certification failed: ${response.status}` 
				},
				{ status: response.status }
			);
		}

		const data = await response.json();
		
		return json({
			success: true,
			certificationHash: data.certification_hash,
			rewardAmount: data.reward_amount,
			reputationChange: data.reputation_change
		});

	} catch (error) {
		console.error('[VOTER Proxy] Error:', error);
		return json(
			{ 
				success: false, 
				error: error instanceof Error ? error.message : 'Internal server error' 
			},
			{ status: 500 }
		);
	}
};
