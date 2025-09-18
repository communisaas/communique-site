/** VOTER Protocol Webhook Handler
 *
 * Receives notifications from VOTER Protocol about:
 * - Certification complete
 * - Rewards issued
 * - Reputation updated
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

const VOTER_API_KEY = env.VOTER_API_KEY || '';

interface WebhookPayload {
	event: string;
	data: WebhookData;
}

interface WebhookData {
	user_address?: string;
	certification_hash?: string;
	reward_amount?: number;
	reputation_change?: number;
	action_hash?: string;
	timestamp?: string;
}

// Type guards for webhook data
function isWebhookData(data: unknown): data is WebhookData {
	return (
		typeof data === 'object' &&
		data !== null &&
		(typeof (data as WebhookData).user_address === 'string' || (data as WebhookData).user_address === undefined) &&
		(typeof (data as WebhookData).certification_hash === 'string' || (data as WebhookData).certification_hash === undefined) &&
		(typeof (data as WebhookData).reward_amount === 'number' || (data as WebhookData).reward_amount === undefined) &&
		(typeof (data as WebhookData).reputation_change === 'number' || (data as WebhookData).reputation_change === undefined) &&
		(typeof (data as WebhookData).action_hash === 'string' || (data as WebhookData).action_hash === undefined) &&
		(typeof (data as WebhookData).timestamp === 'string' || (data as WebhookData).timestamp === undefined)
	);
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Verify webhook signature
		const signature = request.headers.get('X-Webhook-Signature');
		const apiKey = request.headers.get('X-API-Key');

		if (apiKey !== VOTER_API_KEY) {
			throw error(401, 'Invalid API key');
		}

		// TODO: Implement proper signature verification
		// For now, just check API key

		const payload: WebhookPayload = await request.json();

		console.log('[VOTER Webhook] Received:', payload.event, payload.data);

		// Handle different webhook events
		switch (payload.event) {
			case 'certification_complete':
				await handleCertificationComplete(payload.data);
				break;

			case 'reward_issued':
				await handleRewardIssued(payload.data);
				break;

			case 'reputation_updated':
				await handleReputationUpdated(payload.data);
				break;

			default:
				console.log('[VOTER Webhook] Unknown event:', payload.event);
		}

		return json({ received: true });
	} catch (_error) {
		console.error('[VOTER Webhook] Error:', _error);

		if (_error instanceof Response) {
			throw _error;
		}

		throw error(500, 'Webhook processing failed');
	}
};

async function handleCertificationComplete(data: unknown) {
	if (!isWebhookData(data)) {
		console.error('[Webhook] Invalid data format for certification complete:', data);
		return;
	}

	console.log('[Webhook] Certification complete:', data.certification_hash);

	// TODO: Update database with certification status
	// TODO: Notify user of successful certification

	// For now, just log
	if (data.user_address && data.reward_amount) {
		console.log(`User ${data.user_address} earned ${data.reward_amount} VOTER tokens`);
	}
}

async function handleRewardIssued(data: unknown) {
	if (!isWebhookData(data)) {
		console.error('[Webhook] Invalid data format for reward issued:', data);
		return;
	}

	console.log('[Webhook] Reward issued:', data.reward_amount);

	// TODO: Update user's reward balance
	// TODO: Show notification to user

	// For now, just log
	console.log(`Reward of ${data.reward_amount} issued to ${data.user_address}`);
}

async function handleReputationUpdated(data: unknown) {
	if (!isWebhookData(data)) {
		console.error('[Webhook] Invalid data format for reputation updated:', data);
		return;
	}

	console.log('[Webhook] Reputation updated for:', data.user_address);

	// TODO: Update user's reputation display
	// TODO: Cache new reputation score

	// For now, just log
	console.log(`Reputation change: ${data.reputation_change}`);
}
