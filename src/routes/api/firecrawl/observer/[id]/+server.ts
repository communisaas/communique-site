/**
 * Individual Observer API - Get, update, or delete a specific observer
 *
 * GET /api/firecrawl/observer/[id] - Get observer status and details
 * PATCH /api/firecrawl/observer/[id] - Update observer (pause/resume, change settings)
 * DELETE /api/firecrawl/observer/[id] - Delete observer
 *
 * GET Response:
 * - observerId: string
 * - url: string
 * - status: 'active' | 'paused' | 'error'
 * - selector?: string
 * - interval: number
 * - lastChecked?: Date
 * - lastChange?: Date
 * - changeHistory?: ChangeEvent[]
 *
 * PATCH Request:
 * - action?: 'pause' | 'resume' - Pause or resume the observer
 * - interval?: number - Update check interval
 * - webhookUrl?: string - Update webhook URL
 * - description?: string - Update description
 * - tags?: string[] - Update tags
 *
 * Rate Limiting: Verified users only
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getObserverStatus,
	pauseObserver,
	resumeObserver,
	updateObserver,
	deleteObserver,
	getObserverChanges
} from '$lib/server/firecrawl';

interface PatchBody {
	action?: 'pause' | 'resume';
	interval?: number;
	webhookUrl?: string;
	description?: string;
	tags?: string[];
}

export const GET: RequestHandler = async (event) => {
	// Auth check - require verified user
	const session = event.locals.session;
	if (!session?.userId) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	// Check verification status
	const user = event.locals.user;
	if (!user?.is_verified) {
		return json(
			{ error: 'Page observers require a verified account. Please verify your identity.' },
			{ status: 403 }
		);
	}

	const observerId = event.params.id;

	if (!observerId) {
		return json({ error: 'Observer ID is required' }, { status: 400 });
	}

	// Validate ObjectId format (24 hex characters)
	if (!/^[a-f\d]{24}$/i.test(observerId)) {
		return json({ error: 'Invalid observer ID format' }, { status: 400 });
	}

	// Check if history is requested
	const url = new URL(event.request.url);
	const includeHistory = url.searchParams.get('history') === 'true';
	const historyLimit = parseInt(url.searchParams.get('historyLimit') || '20', 10);

	console.log('[firecrawl-observer-api] Getting observer status:', {
		userId: session.userId,
		observerId,
		includeHistory
	});

	try {
		const observer = await getObserverStatus(observerId);

		// Get change history if requested
		let changeHistory;
		if (includeHistory) {
			changeHistory = await getObserverChanges(observerId, historyLimit);
		}

		console.log('[firecrawl-observer-api] Observer status retrieved:', {
			userId: session.userId,
			observerId,
			status: observer.status
		});

		return json({
			observerId: observer.observerId,
			url: observer.url,
			status: observer.status,
			selector: observer.selector,
			interval: observer.interval,
			webhookUrl: observer.webhookUrl,
			description: observer.description,
			tags: observer.tags,
			lastChecked: observer.lastChecked,
			lastChange: observer.lastChange,
			errorMessage: observer.errorMessage,
			createdAt: observer.createdAt,
			updatedAt: observer.updatedAt,
			...(includeHistory && { changeHistory })
		});
	} catch (error) {
		console.error('[firecrawl-observer-api] Error getting observer:', error);

		if (error instanceof Error && error.message.includes('not found')) {
			return json({ error: 'Observer not found' }, { status: 404 });
		}

		return json(
			{ error: error instanceof Error ? error.message : 'Failed to get observer' },
			{ status: 500 }
		);
	}
};

export const PATCH: RequestHandler = async (event) => {
	// Auth check - require verified user
	const session = event.locals.session;
	if (!session?.userId) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	// Check verification status
	const user = event.locals.user;
	if (!user?.is_verified) {
		return json(
			{ error: 'Page observers require a verified account. Please verify your identity.' },
			{ status: 403 }
		);
	}

	const observerId = event.params.id;

	if (!observerId) {
		return json({ error: 'Observer ID is required' }, { status: 400 });
	}

	// Validate ObjectId format
	if (!/^[a-f\d]{24}$/i.test(observerId)) {
		return json({ error: 'Invalid observer ID format' }, { status: 400 });
	}

	// Parse request body
	let body: PatchBody;
	try {
		body = (await event.request.json()) as PatchBody;
	} catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	console.log('[firecrawl-observer-api] Updating observer:', {
		userId: session.userId,
		observerId,
		action: body.action,
		hasUpdates: !!(body.interval || body.webhookUrl || body.description || body.tags)
	});

	try {
		// Handle pause/resume actions
		if (body.action === 'pause') {
			await pauseObserver(observerId);
			const updated = await getObserverStatus(observerId);
			return json({
				observerId: updated.observerId,
				status: updated.status,
				message: 'Observer paused'
			});
		}

		if (body.action === 'resume') {
			await resumeObserver(observerId);
			const updated = await getObserverStatus(observerId);
			return json({
				observerId: updated.observerId,
				status: updated.status,
				message: 'Observer resumed'
			});
		}

		// Handle other updates
		const updates: Parameters<typeof updateObserver>[1] = {};

		if (body.interval !== undefined) {
			if (body.interval < 15 || body.interval > 1440) {
				return json({ error: 'Interval must be between 15 and 1440 minutes' }, { status: 400 });
			}
			updates.interval = body.interval;
		}

		if (body.webhookUrl !== undefined) {
			if (body.webhookUrl) {
				try {
					new URL(body.webhookUrl);
				} catch {
					return json({ error: 'Invalid webhook URL format' }, { status: 400 });
				}
			}
			updates.webhookUrl = body.webhookUrl;
		}

		if (body.description !== undefined) {
			updates.description = body.description;
		}

		if (body.tags !== undefined) {
			updates.tags = body.tags;
		}

		// Check if there are any updates to apply
		if (Object.keys(updates).length === 0 && !body.action) {
			return json({ error: 'No updates provided' }, { status: 400 });
		}

		const updated = await updateObserver(observerId, updates);

		console.log('[firecrawl-observer-api] Observer updated:', {
			userId: session.userId,
			observerId
		});

		return json({
			observerId: updated.observerId,
			url: updated.url,
			status: updated.status,
			selector: updated.selector,
			interval: updated.interval,
			webhookUrl: updated.webhookUrl,
			description: updated.description,
			tags: updated.tags,
			updatedAt: updated.updatedAt,
			message: 'Observer updated'
		});
	} catch (error) {
		console.error('[firecrawl-observer-api] Error updating observer:', error);

		if (error instanceof Error && error.message.includes('not found')) {
			return json({ error: 'Observer not found' }, { status: 404 });
		}

		return json(
			{ error: error instanceof Error ? error.message : 'Failed to update observer' },
			{ status: 500 }
		);
	}
};

export const DELETE: RequestHandler = async (event) => {
	// Auth check - require verified user
	const session = event.locals.session;
	if (!session?.userId) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	// Check verification status
	const user = event.locals.user;
	if (!user?.is_verified) {
		return json(
			{ error: 'Page observers require a verified account. Please verify your identity.' },
			{ status: 403 }
		);
	}

	const observerId = event.params.id;

	if (!observerId) {
		return json({ error: 'Observer ID is required' }, { status: 400 });
	}

	// Validate ObjectId format
	if (!/^[a-f\d]{24}$/i.test(observerId)) {
		return json({ error: 'Invalid observer ID format' }, { status: 400 });
	}

	console.log('[firecrawl-observer-api] Deleting observer:', {
		userId: session.userId,
		observerId
	});

	try {
		await deleteObserver(observerId);

		console.log('[firecrawl-observer-api] Observer deleted:', {
			userId: session.userId,
			observerId
		});

		return json({
			observerId,
			message: 'Observer deleted successfully'
		});
	} catch (error) {
		console.error('[firecrawl-observer-api] Error deleting observer:', error);

		if (error instanceof Error && error.message.includes('not found')) {
			return json({ error: 'Observer not found' }, { status: 404 });
		}

		return json(
			{ error: error instanceof Error ? error.message : 'Failed to delete observer' },
			{ status: 500 }
		);
	}
};
