import { json } from '@sveltejs/kit';
import { createApiError, type ApiResponse } from '$lib/types/errors';
import type { RequestHandler } from './$types';

interface N8NStatusUpdate {
	submissionId: string;
	workflowStage: 'verification' | 'consensus' | 'submission' | 'reward';
	status: 'started' | 'completed' | 'failed';
	data?: {
		deliveryCount?: number;
		cwcConfirmation?: string;
		verificationPassed?: boolean;
		consensusRequired?: boolean;
		rewardAmount?: string;
		error?: string;
	};
}

// Map N8N workflow stages to user-facing status
function mapWorkflowToStatus(update: N8NStatusUpdate): {
	status: 'sending' | 'routing' | 'delivered' | 'recorded' | 'failed';
	details?: string;
	deliveryCount?: number;
	canOverride?: boolean;
} {
	const { workflowStage, status, data } = update;

	// Handle failures at any stage
	if (status === 'failed') {
		return {
			status: 'failed',
			details: data?.error || 'Processing failed',
			canOverride: true
		};
	}

	// Map successful workflow progression
	switch (workflowStage) {
		case 'verification':
			if (status === 'started') {
				return {
					status: 'routing',
					details: 'Checking message quality',
					canOverride: true
				};
			}
			return {
				status: 'routing',
				details: data?.verificationPassed ? 'Verification passed' : 'Processing verification',
				canOverride: true
			};

		case 'consensus':
			// Don't show consensus to users - it happens behind the scenes
			return {
				status: 'routing',
				details: 'Finalizing delivery',
				canOverride: false
			};

		case 'submission':
			if (status === 'completed') {
				return {
					status: 'delivered',
					details: data?.cwcConfirmation
						? 'Via CWC confirmation: ' + data.cwcConfirmation
						: 'Delivered to Congress',
					deliveryCount: data?.deliveryCount,
					canOverride: false
				};
			}
			return {
				status: 'routing',
				details: 'Submitting to congressional offices',
				canOverride: false
			};

		case 'reward':
			if (status === 'completed') {
				return {
					status: 'recorded',
					details: 'Participation tracked',
					canOverride: false
				};
			}
			return {
				status: 'delivered',
				details: 'Calculating impact',
				canOverride: false
			};

		default:
			return {
				status: 'sending',
				details: 'Processing',
				canOverride: true
			};
	}
}

// Store for active WebSocket connections by submission ID
const activeConnections = new Map<string, Set<WebSocket>>();

// Broadcast status update to connected clients
function broadcastStatusUpdate(submissionId: string, statusUpdate: unknown) {
	const connections = activeConnections.get(submissionId);
	if (connections) {
		const message = JSON.stringify(statusUpdate);
		connections.forEach((ws) => {
			if (ws.readyState === WebSocket.OPEN) {
				try {
					ws.send(message);
				} catch {
					console.error('Error occurred');
					connections.delete(ws);
				}
			}
		});
	}
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Verify webhook secret (in production)
		const webhookSecret = request.headers.get('x-webhook-secret');
		if (!webhookSecret || webhookSecret !== process.env.N8N_WEBHOOK_SECRET) {
			const response: ApiResponse = {
				success: false,
				error: createApiError('authentication', 'AUTH_UNAUTHORIZED', 'Invalid webhook secret')
			};
			return json(response, { status: 401 });
		}

		const update: N8NStatusUpdate = await request.json();

		if (!update.submissionId || !update.workflowStage || !update.status) {
			const response: ApiResponse = {
				success: false,
				error: createApiError('validation', 'VALIDATION_REQUIRED', 'Missing required fields')
			};
			return json(response, { status: 400 });
		}

		// Map N8N workflow status to user-facing status
		const userStatus = mapWorkflowToStatus(update);

		// In a real implementation, you would:
		// 1. Update the submission status in your database
		// 2. Log the workflow progress
		// 3. Handle any business logic based on the status

		console.log(`Submission ${update.submissionId}: ${update.workflowStage} - ${update.status}`);

		// Broadcast to connected WebSocket clients
		broadcastStatusUpdate(update.submissionId, userStatus);

		const response: ApiResponse = {
			success: true,
			data: {
				received: true,
				userStatus
			}
		};

		return json(response);
	} catch {
		console.error('Error occurred');

		const response: ApiResponse = {
			success: false,
			error: createApiError('server', 'SERVER_INTERNAL', 'Failed to process webhook')
		};

		return json(response, { status: 500 });
	}
};

// Handle WebSocket connections for real-time status updates
export const GET: RequestHandler = async ({ _url, _request }) => {
	// This would be implemented with your WebSocket server
	// For SvelteKit, you might use a different approach like Server-Sent Events
	// or integrate with a WebSocket library

	const response: ApiResponse = {
		success: false,
		error: createApiError('server', 'SERVER_NOT_IMPLEMENTED', 'WebSocket endpoint not implemented')
	};

	return json(response, { status: 501 });
};
