import { json } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const userId = url.searchParams.get('userId') || locals.user?.id;
	const limit = parseInt(url.searchParams.get('limit') || '50');

	if (!userId) {
		return json(
			{
				success: false,
				error: 'User ID required'
			},
			{ status: 400 }
		);
	}

	try {
		// Get recent delivery statuses for user's templates
		const deliveries = await db.template_campaign.findMany({
			where: {
				template: {
					userId: userId
				}
			},
			include: {
				template: {
					select: {
						id: true,
						title: true,
						userId: true
					}
				}
			},
			orderBy: {
				created_at: 'desc'
			},
			take: limit
		});

		// Transform to delivery status format
		const deliveryStatuses = deliveries.map((campaign) => {
			// Mock recipient info - in real implementation, this would come from representative lookup
			const recipientInfo = {
				representative_name: getRepresentativeName(campaign.id),
				office_type: Math.random() > 0.5 ? 'house' : ('senate' as 'house' | 'senate'),
				district: Math.random() > 0.3 ? Math.floor(Math.random() * 50 + 1).toString() : undefined,
				state: getRandomState()
			};

			// Mock tracking data based on status
			const trackingData =
				campaign.status === 'delivered'
					? {
							delivery_time: new Date(
								campaign.updated_at.getTime() + Math.random() * 60 * 60 * 1000
							).toISOString(),
							response_received: Math.random() > 0.7,
							response_type: Math.random() > 0.5 ? 'Acknowledged' : 'Read Receipt'
						}
					: undefined;

			return {
				campaign_id: campaign.id,
				template_id: campaign.template_id,
				template_title: campaign.template?.title || 'Unknown Template',
				status: campaign.status,
				created_at: campaign.created_at.toISOString(),
				updated_at: campaign.updated_at.toISOString(),
				delivery_attempts: campaign.delivery_attempts || 1,
				error_message: campaign.status === 'failed' ? getRandomErrorMessage() : undefined,
				recipient_info: recipientInfo,
				tracking_data: trackingData
			};
		});

		// Calculate metrics
		const totalDeliveries = deliveryStatuses.length;
		const delivered = deliveryStatuses.filter((d) => d.status === 'delivered').length;
		const pending = deliveryStatuses.filter((d) => d.status === 'pending').length;
		const failed = deliveryStatuses.filter((d) => d.status === 'failed').length;

		const metrics = {
			total_pending: pending,
			total_delivered: delivered,
			total_failed: failed,
			success_rate: totalDeliveries > 0 ? delivered / totalDeliveries : 0,
			avg_delivery_time: calculateAverageDeliveryTime(deliveryStatuses)
		};

		return json({
			success: true,
			deliveries: deliveryStatuses,
			metrics,
			total_count: totalDeliveries,
			timestamp: new Date().toISOString()
		});
	} catch (_error) {
		console.error('Error:' , _error);

		return json(
			{
				success: false,
				error: 'Failed to load delivery status',
				details: _error instanceof Error ? _error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

// Helper functions for mock data
function getRepresentativeName(campaignId: string): string {
	const names = [
		'Rep. Alexandria Ocasio-Cortez',
		'Sen. Bernie Sanders',
		'Rep. Nancy Pelosi',
		'Sen. Chuck Schumer',
		'Rep. Kevin McCarthy',
		'Sen. Mitch McConnell',
		'Rep. Ilhan Omar',
		'Sen. Elizabeth Warren',
		'Rep. AOC',
		'Sen. Ted Cruz'
	];

	// Deterministic selection based on campaign ID
	const hash = campaignId.split('').reduce((a, b) => {
		a = (a << 5) - a + b.charCodeAt(0);
		return a & a;
	}, 0);

	return names[Math.abs(hash) % names.length];
}

function getRandomState(): string {
	const states = ['CA', 'TX', 'NY', 'FL', 'PA', 'IL', 'OH', 'GA', 'NC', 'MI'];
	return states[Math.floor(Math.random() * states.length)];
}

function getRandomErrorMessage(): string {
	const errors = [
		'Recipient office temporarily unavailable',
		'Message size exceeded limits',
		'CWC API rate limit exceeded',
		'Invalid representative office code',
		'Network timeout during delivery'
	];
	return errors[Math.floor(Math.random() * errors.length)];
}

function calculateAverageDeliveryTime(deliveries: unknown[]): number {
	const deliveredItems = deliveries.filter(
		(d) => d.status === 'delivered' && d.tracking_data?.delivery_time
	);

	if (deliveredItems.length === 0) return 0;

	const totalTime = deliveredItems.reduce((sum, delivery) => {
		const created = new Date(delivery.created_at).getTime();
		const delivered = new Date(delivery.tracking_data.delivery_time).getTime();
		return sum + (delivered - created);
	}, 0);

	return totalTime / deliveredItems.length / (1000 * 60 * 60); // Convert to hours
}
