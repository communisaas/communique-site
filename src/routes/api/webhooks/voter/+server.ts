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
import { prisma } from '$lib/core/db.js';
import type { Prisma } from '@prisma/client';

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
		(typeof (data as WebhookData).user_address === 'string' ||
			(data as WebhookData).user_address === undefined) &&
		(typeof (data as WebhookData).certification_hash === 'string' ||
			(data as WebhookData).certification_hash === undefined) &&
		(typeof (data as WebhookData).reward_amount === 'number' ||
			(data as WebhookData).reward_amount === undefined) &&
		(typeof (data as WebhookData).reputation_change === 'number' ||
			(data as WebhookData).reputation_change === undefined) &&
		(typeof (data as WebhookData).action_hash === 'string' ||
			(data as WebhookData).action_hash === undefined) &&
		(typeof (data as WebhookData).timestamp === 'string' ||
			(data as WebhookData).timestamp === undefined)
	);
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Verify webhook signature
		const signature_ = request.headers.get('X-Webhook-Signature');
		const apiKey = request.headers.get('X-API-Key');

		if (apiKey !== VOTER_API_KEY) {
			throw error(401, 'Invalid API key');
		}

		// TODO: Implement proper signature verification
		// For now, just check API key

		const payload: WebhookPayload = await request.json();

		console.log('[VOTER Webhook] Received:', payload._event, payload.data);

		// Handle different webhook events
		switch (payload._event) {
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
				console.log('[VOTER Webhook] Unknown event:', payload._event);
		}

		return json({ received: true });
	} catch (error) {
		console.error('Error occurred');

		if (_error instanceof Response) {
			throw error;
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

	// Find user by wallet address if available
	if (data.user_address) {
		const user = await prisma.user.findFirst({
			where: { wallet_address: data.user_address }
		});

		if (user) {
			// Create audit log for certification completion
			await prisma.auditLog.create({
				data: {
					user_id: user.id,
					action_type: 'verification',
					action_subtype: 'voter_certification_complete',
					audit_data: {
						certification_hash: data.certification_hash,
						reward_amount: data.reward_amount,
						action_hash: data.action_hash,
						timestamp: data.timestamp
					},
					certification_type: 'voter_protocol',
					certification_data: data as unknown as Prisma.JsonObject,
					reward_amount: data.reward_amount?.toString(),
					status: 'completed'
				}
			});
		}
	}

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

	// Find user by wallet address if available
	if (data.user_address) {
		const user = await prisma.user.findFirst({
			where: { wallet_address: data.user_address }
		});

		if (user) {
			// Create audit log for reward issuance
			await prisma.auditLog.create({
				data: {
					user_id: user.id,
					action_type: 'civic_action',
					action_subtype: 'reward_issued',
					audit_data: {
						reward_amount: data.reward_amount,
						action_hash: data.action_hash,
						timestamp: data.timestamp
					},
					reward_amount: data.reward_amount?.toString(),
					status: 'completed'
				}
			});
		}
	}

	console.log(`Reward of ${data.reward_amount} issued to ${data.user_address}`);
}

async function handleReputationUpdated(data: unknown) {
	if (!isWebhookData(data)) {
		console.error('[Webhook] Invalid data format for reputation updated:', data);
		return;
	}

	console.log('[Webhook] Reputation updated for:', data.user_address);

	// Find user by wallet address if available
	if (data.user_address) {
		const user = await prisma.user.findFirst({
			where: { wallet_address: data.user_address }
		});

		if (user && data.reputation_change) {
			// Create audit log for reputation update
			await prisma.auditLog.create({
				data: {
					user_id: user.id,
					action_type: 'reputation_change',
					action_subtype: 'external_update',
					audit_data: {
						reputation_change: data.reputation_change,
						action_hash: data.action_hash,
						timestamp: data.timestamp
					},
					score_before: user.trust_score,
					score_after: user.trust_score + data.reputation_change,
					change_amount: data.reputation_change,
					change_reason: 'external_voter_protocol_update',
					status: 'completed'
				}
			});

			// Update user's trust score
			await prisma.user.update({
				where: { id: user.id },
				data: {
					trust_score: Math.max(0, Math.min(100, user.trust_score + data.reputation_change))
				}
			});
		}
	}

	console.log(`Reputation change: ${data.reputation_change}`);
}
