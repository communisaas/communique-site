/**
 * Firecrawl Change Tracking Observer
 *
 * Since Firecrawl doesn't have a persistent /watch endpoint, we implement observers as:
 * 1. MongoDB stores the observer config and scrape history
 * 2. Periodic scrapes with changeTracking format detect changes
 * 3. The `tag` parameter provides per-observer history tracking on Firecrawl's side
 * 4. Webhooks are triggered manually when changes are detected
 *
 * Features:
 * - Page monitoring via Change Tracking format on /scrape
 * - CSS selector-based content targeting
 * - Webhook notifications for changes
 * - MongoDB persistence for observer configs
 * - Change history tracking
 */

import { ObjectId } from 'mongodb';
import { getDatabase } from '../mongodb';
import type { Collection } from 'mongodb';

// ============================================================================
// Types
// ============================================================================

/**
 * Observer status
 */
export type ObserverStatus = 'active' | 'paused' | 'error';

/**
 * Type of change detected
 */
export type ChangeType = 'added' | 'removed' | 'modified';

/**
 * Options for creating an observer
 */
export interface ObserverOptions {
	/** URL of the page to monitor */
	url: string;
	/** CSS selector to watch for changes (optional - monitors entire page if not specified) */
	selector?: string;
	/** Check interval in minutes (default: 60) */
	interval?: number;
	/** Optional webhook URL for change notifications */
	webhookUrl?: string;
	/** Optional description for the observer */
	description?: string;
	/** Optional tags for categorization */
	tags?: string[];
}

/**
 * A single change event
 */
export interface ChangeEvent {
	/** Timestamp when change was detected */
	timestamp: Date;
	/** Previous content (if available) */
	previousContent?: string;
	/** New content after change */
	newContent?: string;
	/** Type of change */
	changeType: ChangeType;
	/** Optional diff summary */
	diffSummary?: string;
	/** Git-style diff text */
	diffText?: string;
}

/**
 * Result from observer operations
 */
export interface ObserverResult {
	/** Unique observer identifier */
	observerId: string;
	/** URL being monitored */
	url: string;
	/** Current status */
	status: ObserverStatus;
	/** CSS selector being watched (if any) */
	selector?: string;
	/** Check interval in minutes */
	interval: number;
	/** Webhook URL for notifications (if any) */
	webhookUrl?: string;
	/** Description */
	description?: string;
	/** Tags for categorization */
	tags?: string[];
	/** Last time the page was checked */
	lastChecked?: Date;
	/** Last time a change was detected */
	lastChange?: Date;
	/** History of detected changes */
	changeHistory?: ChangeEvent[];
	/** Error message if status is 'error' */
	errorMessage?: string;
	/** Created timestamp */
	createdAt: Date;
	/** Updated timestamp */
	updatedAt: Date;
}

/**
 * MongoDB document for observer persistence
 */
interface ObserverDocument {
	_id?: ObjectId;
	/** URL being monitored */
	url: string;
	/** URL hash for deduplication */
	urlHash: string;
	/** Domain extracted from URL */
	domain: string;
	/** CSS selector being watched */
	selector?: string;
	/** Check interval in minutes */
	interval: number;
	/** Webhook URL for notifications */
	webhookUrl?: string;
	/** Description */
	description?: string;
	/** Tags for categorization */
	tags: string[];
	/** Current status */
	status: ObserverStatus;
	/** Last content snapshot (for local diff comparison) */
	lastContent?: string;
	/** Last time the page was checked */
	lastChecked?: Date;
	/** Last time a change was detected */
	lastChange?: Date;
	/** History of detected changes (limited to last 50) */
	changeHistory: ChangeEvent[];
	/** Error message if status is 'error' */
	errorMessage?: string;
	/** Cache metadata */
	createdAt: Date;
	updatedAt: Date;
	/** Optional TTL - observers don't expire by default */
	expiresAt?: Date;
}

/**
 * Firecrawl Change Tracking response structure
 */
interface ChangeTrackingResponse {
	previousScrapeAt: string | null;
	changeStatus: 'new' | 'same' | 'changed' | 'removed';
	visibility: 'visible' | 'hidden';
	diff?: {
		text: string;
		json?: {
			files: Array<{
				from: string | null;
				to: string | null;
				chunks: Array<{
					content: string;
					changes: Array<{
						type: string;
						normal?: boolean;
						ln?: number;
						ln1?: number;
						ln2?: number;
						content: string;
					}>;
				}>;
			}>;
		};
	};
	json?: Record<string, { previous: unknown; current: unknown }>;
}

/**
 * Firecrawl scrape response
 */
interface FirecrawlScrapeResponse {
	success: boolean;
	data?: {
		markdown?: string;
		html?: string;
		changeTracking?: ChangeTrackingResponse;
	};
	error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev/v1';
const COLLECTION_NAME = 'page_observers';
const DEFAULT_INTERVAL_MINUTES = 60;
const MAX_CHANGE_HISTORY = 50;

// ============================================================================
// Collection Accessor
// ============================================================================

/**
 * Get the Page Observers collection
 */
async function getObserversCollection(): Promise<Collection<ObserverDocument>> {
	const db = await getDatabase();
	return db.collection<ObserverDocument>(COLLECTION_NAME);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate URL hash for deduplication
 */
function generateUrlHash(url: string, selector?: string): string {
	const { createHash } = require('crypto');
	const normalized = `${url.toLowerCase().replace(/\/$/, '')}|${selector || ''}`;
	return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
	try {
		const parsed = new URL(url);
		return parsed.hostname.replace(/^www\./, '');
	} catch {
		return url;
	}
}

/**
 * Convert MongoDB document to ObserverResult
 */
function documentToResult(doc: ObserverDocument): ObserverResult {
	return {
		observerId: doc._id!.toString(),
		url: doc.url,
		status: doc.status,
		selector: doc.selector,
		interval: doc.interval,
		webhookUrl: doc.webhookUrl,
		description: doc.description,
		tags: doc.tags,
		lastChecked: doc.lastChecked,
		lastChange: doc.lastChange,
		changeHistory: doc.changeHistory,
		errorMessage: doc.errorMessage,
		createdAt: doc.createdAt,
		updatedAt: doc.updatedAt
	};
}

/**
 * Determine change type from Firecrawl's changeStatus
 */
function mapChangeStatus(status: ChangeTrackingResponse['changeStatus']): ChangeType | null {
	switch (status) {
		case 'changed':
			return 'modified';
		case 'new':
			return 'added';
		case 'removed':
			return 'removed';
		case 'same':
		default:
			return null;
	}
}

// ============================================================================
// Firecrawl Scrape with Change Tracking
// ============================================================================

/**
 * Scrape a URL with change tracking enabled
 *
 * Uses the /scrape endpoint with changeTracking format to detect changes.
 * The `tag` parameter creates a separate history per observer.
 */
async function scrapeWithChangeTracking(
	url: string,
	observerId: string,
	selector?: string
): Promise<{
	success: boolean;
	markdown?: string;
	changeTracking?: ChangeTrackingResponse;
	error?: string;
}> {
	const apiKey = process.env.FIRECRAWL_API_KEY;

	if (!apiKey) {
		return { success: false, error: 'Firecrawl API key not configured' };
	}

	const apiUrl = `${FIRECRAWL_BASE_URL}/scrape`;

	// Build request body with change tracking format
	const body: Record<string, unknown> = {
		url,
		formats: ['markdown', 'changeTracking'],
		changeTrackingOptions: {
			modes: ['git-diff'],
			tag: observerId // Use observer ID as tag for history isolation
		}
	};

	// Add selector targeting if provided
	if (selector) {
		body.includeTags = [selector];
	}

	console.log('[firecrawl-observer] Scraping with change tracking:', {
		url,
		observerId,
		hasSelector: !!selector
	});

	try {
		const response = await fetch(apiUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify(body)
		});

		// Handle rate limiting
		if (response.status === 429) {
			const retryAfter = response.headers.get('Retry-After');
			console.warn('[firecrawl-observer] Rate limited, retry after:', retryAfter);
			return {
				success: false,
				error: `Rate limited. Retry after ${retryAfter || 'unknown'} seconds.`
			};
		}

		if (!response.ok) {
			const errorText = await response.text().catch(() => 'Unable to read error response');
			console.error('[firecrawl-observer] Scrape error:', response.status, errorText);
			return {
				success: false,
				error: `Firecrawl scrape error (${response.status}): ${errorText}`
			};
		}

		const data: FirecrawlScrapeResponse = await response.json();

		if (!data.success) {
			return {
				success: false,
				error: data.error || 'Scrape returned success: false'
			};
		}

		return {
			success: true,
			markdown: data.data?.markdown,
			changeTracking: data.data?.changeTracking
		};
	} catch (error) {
		console.error('[firecrawl-observer] Scrape request error:', error);
		return {
			success: false,
			error: `Request failed: ${error instanceof Error ? error.message : String(error)}`
		};
	}
}

/**
 * Send webhook notification for detected changes
 */
async function sendWebhookNotification(
	webhookUrl: string,
	observerId: string,
	url: string,
	change: ChangeEvent
): Promise<void> {
	try {
		console.log('[firecrawl-observer] Sending webhook notification:', {
			observerId,
			webhookUrl,
			changeType: change.changeType
		});

		const response = await fetch(webhookUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				type: 'observer.change',
				observerId,
				url,
				timestamp: change.timestamp.toISOString(),
				changeType: change.changeType,
				diffSummary: change.diffSummary,
				diffText: change.diffText
			})
		});

		if (!response.ok) {
			console.warn('[firecrawl-observer] Webhook notification failed:', response.status);
		}
	} catch (error) {
		console.error('[firecrawl-observer] Webhook notification error:', error);
	}
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Create a new page observer
 *
 * Monitors a web page for changes using Firecrawl's change tracking feature.
 * Changes are tracked in MongoDB and can trigger webhook notifications.
 *
 * @param options - Observer configuration
 * @returns ObserverResult with the new observer details
 *
 * @example
 * const observer = await createObserver({
 *   url: 'https://company.com/leadership',
 *   selector: '.executive-team',
 *   interval: 30,
 *   webhookUrl: 'https://my-app.com/webhooks/leadership-changes'
 * });
 * console.log(observer.observerId);
 */
export async function createObserver(options: ObserverOptions): Promise<ObserverResult> {
	console.log('[firecrawl-observer] createObserver called:', {
		url: options.url,
		selector: options.selector,
		interval: options.interval ?? DEFAULT_INTERVAL_MINUTES
	});

	const collection = await getObserversCollection();
	const urlHash = generateUrlHash(options.url, options.selector);
	const now = new Date();

	// Check if observer already exists for this URL/selector combination
	const existing = await collection.findOne({ urlHash });
	if (existing) {
		console.log('[firecrawl-observer] Observer already exists:', existing._id);
		return documentToResult(existing);
	}

	// Create MongoDB document (observer state is managed locally, not on Firecrawl)
	const doc: ObserverDocument = {
		url: options.url,
		urlHash,
		domain: extractDomain(options.url),
		selector: options.selector,
		interval: options.interval ?? DEFAULT_INTERVAL_MINUTES,
		webhookUrl: options.webhookUrl,
		description: options.description,
		tags: options.tags ?? [],
		status: 'active',
		changeHistory: [],
		createdAt: now,
		updatedAt: now
	};

	const result = await collection.insertOne(doc);
	doc._id = result.insertedId;

	// Perform initial scrape to establish baseline (first scrape will be 'new')
	const observerId = doc._id.toString();
	const { success, markdown, error } = await scrapeWithChangeTracking(
		options.url,
		observerId,
		options.selector
	);

	if (success && markdown) {
		// Store initial content
		await collection.updateOne(
			{ _id: doc._id },
			{
				$set: {
					lastContent: markdown,
					lastChecked: new Date(),
					updatedAt: new Date()
				}
			}
		);
	} else if (error) {
		console.warn('[firecrawl-observer] Initial scrape failed:', error);
		// Observer is still created, but mark error status
		await collection.updateOne(
			{ _id: doc._id },
			{
				$set: {
					status: 'error' as ObserverStatus,
					errorMessage: error,
					updatedAt: new Date()
				}
			}
		);
	}

	console.log('[firecrawl-observer] Observer created:', {
		observerId
	});

	// Refresh and return
	const updatedDoc = await collection.findOne({ _id: doc._id });
	return documentToResult(updatedDoc || doc);
}

/**
 * Check an observer for changes
 *
 * Performs a scrape with change tracking and records any detected changes.
 * This should be called periodically based on the observer's interval.
 *
 * @param observerId - Observer ID to check
 * @returns Array of detected changes (empty if no changes)
 */
export async function checkObserver(observerId: string): Promise<ChangeEvent[]> {
	console.log('[firecrawl-observer] checkObserver called:', observerId);

	const collection = await getObserversCollection();
	let objectId: ObjectId;

	try {
		objectId = new ObjectId(observerId);
	} catch {
		throw new Error(`Invalid observer ID: ${observerId}`);
	}

	const doc = await collection.findOne({ _id: objectId });

	if (!doc) {
		throw new Error(`Observer not found: ${observerId}`);
	}

	if (doc.status === 'paused') {
		console.log('[firecrawl-observer] Observer is paused, skipping check');
		return [];
	}

	// Scrape with change tracking
	const { success, markdown, changeTracking, error } = await scrapeWithChangeTracking(
		doc.url,
		observerId,
		doc.selector
	);

	const now = new Date();

	if (!success) {
		// Update error status
		await collection.updateOne(
			{ _id: objectId },
			{
				$set: {
					status: 'error' as ObserverStatus,
					errorMessage: error,
					lastChecked: now,
					updatedAt: now
				}
			}
		);
		console.error('[firecrawl-observer] Check failed:', error);
		return [];
	}

	// Process change tracking response
	const changes: ChangeEvent[] = [];

	if (changeTracking) {
		const changeType = mapChangeStatus(changeTracking.changeStatus);

		if (changeType) {
			const changeEvent: ChangeEvent = {
				timestamp: now,
				changeType,
				previousContent: doc.lastContent,
				newContent: markdown,
				diffText: changeTracking.diff?.text,
				diffSummary: changeTracking.diff?.text
					? `${changeTracking.diff.text.split('\n').length} lines changed`
					: undefined
			};

			changes.push(changeEvent);

			// Send webhook if configured
			if (doc.webhookUrl) {
				await sendWebhookNotification(doc.webhookUrl, observerId, doc.url, changeEvent);
			}

			// Update document with change
			await collection.updateOne(
				{ _id: objectId },
				{
					$set: {
						status: 'active' as ObserverStatus,
						errorMessage: undefined,
						lastContent: markdown,
						lastChecked: now,
						lastChange: now,
						updatedAt: now
					},
					$push: {
						changeHistory: {
							$each: [changeEvent],
							$slice: -MAX_CHANGE_HISTORY
						}
					}
				}
			);

			console.log('[firecrawl-observer] Change detected:', {
				observerId,
				changeType,
				changeStatus: changeTracking.changeStatus
			});
		} else {
			// No change detected
			await collection.updateOne(
				{ _id: objectId },
				{
					$set: {
						status: 'active' as ObserverStatus,
						errorMessage: undefined,
						lastChecked: now,
						updatedAt: now
					}
				}
			);

			console.log('[firecrawl-observer] No changes detected:', observerId);
		}
	} else {
		// No change tracking data, just update last checked
		await collection.updateOne(
			{ _id: objectId },
			{
				$set: {
					lastContent: markdown,
					lastChecked: now,
					updatedAt: now
				}
			}
		);
	}

	return changes;
}

/**
 * Get the status of an observer
 *
 * @param observerId - Observer ID (MongoDB ObjectId string)
 * @returns ObserverResult with current status
 *
 * @example
 * const status = await getObserverStatus('507f1f77bcf86cd799439011');
 * console.log(status.status); // 'active' | 'paused' | 'error'
 * console.log(status.lastChecked);
 */
export async function getObserverStatus(observerId: string): Promise<ObserverResult> {
	console.log('[firecrawl-observer] getObserverStatus called:', observerId);

	const collection = await getObserversCollection();
	let objectId: ObjectId;

	try {
		objectId = new ObjectId(observerId);
	} catch {
		throw new Error(`Invalid observer ID: ${observerId}`);
	}

	const doc = await collection.findOne({ _id: objectId });

	if (!doc) {
		throw new Error(`Observer not found: ${observerId}`);
	}

	return documentToResult(doc);
}

/**
 * Pause an active observer
 *
 * @param observerId - Observer ID to pause
 *
 * @example
 * await pauseObserver('507f1f77bcf86cd799439011');
 */
export async function pauseObserver(observerId: string): Promise<void> {
	console.log('[firecrawl-observer] pauseObserver called:', observerId);

	const collection = await getObserversCollection();
	let objectId: ObjectId;

	try {
		objectId = new ObjectId(observerId);
	} catch {
		throw new Error(`Invalid observer ID: ${observerId}`);
	}

	const result = await collection.updateOne(
		{ _id: objectId },
		{
			$set: {
				status: 'paused' as ObserverStatus,
				updatedAt: new Date()
			}
		}
	);

	if (result.matchedCount === 0) {
		throw new Error(`Observer not found: ${observerId}`);
	}

	console.log('[firecrawl-observer] Observer paused:', observerId);
}

/**
 * Resume a paused observer
 *
 * @param observerId - Observer ID to resume
 *
 * @example
 * await resumeObserver('507f1f77bcf86cd799439011');
 */
export async function resumeObserver(observerId: string): Promise<void> {
	console.log('[firecrawl-observer] resumeObserver called:', observerId);

	const collection = await getObserversCollection();
	let objectId: ObjectId;

	try {
		objectId = new ObjectId(observerId);
	} catch {
		throw new Error(`Invalid observer ID: ${observerId}`);
	}

	const result = await collection.updateOne(
		{ _id: objectId, status: 'paused' },
		{
			$set: {
				status: 'active' as ObserverStatus,
				updatedAt: new Date()
			}
		}
	);

	if (result.matchedCount === 0) {
		throw new Error(`Observer not found or not paused: ${observerId}`);
	}

	console.log('[firecrawl-observer] Observer resumed:', observerId);
}

/**
 * Delete an observer
 *
 * Removes the observer from MongoDB. Since state is local, there's no
 * Firecrawl-side cleanup needed.
 *
 * @param observerId - Observer ID to delete
 *
 * @example
 * await deleteObserver('507f1f77bcf86cd799439011');
 */
export async function deleteObserver(observerId: string): Promise<void> {
	console.log('[firecrawl-observer] deleteObserver called:', observerId);

	const collection = await getObserversCollection();
	let objectId: ObjectId;

	try {
		objectId = new ObjectId(observerId);
	} catch {
		throw new Error(`Invalid observer ID: ${observerId}`);
	}

	const result = await collection.deleteOne({ _id: objectId });

	if (result.deletedCount === 0) {
		throw new Error(`Observer not found: ${observerId}`);
	}

	console.log('[firecrawl-observer] Observer deleted:', observerId);
}

/**
 * List all observers
 *
 * @param options - Filter options
 * @returns Array of ObserverResult
 *
 * @example
 * const observers = await listObservers();
 * console.log(`Total observers: ${observers.length}`);
 *
 * // Filter by status
 * const activeObservers = await listObservers({ status: 'active' });
 *
 * // Filter by domain
 * const domainObservers = await listObservers({ domain: 'company.com' });
 */
export async function listObservers(options?: {
	status?: ObserverStatus;
	domain?: string;
	tags?: string[];
	limit?: number;
	offset?: number;
}): Promise<ObserverResult[]> {
	console.log('[firecrawl-observer] listObservers called:', options);

	const collection = await getObserversCollection();

	// Build query
	const query: Record<string, unknown> = {};
	if (options?.status) {
		query.status = options.status;
	}
	if (options?.domain) {
		query.domain = options.domain;
	}
	if (options?.tags?.length) {
		query.tags = { $in: options.tags };
	}

	const cursor = collection
		.find(query)
		.sort({ createdAt: -1 })
		.skip(options?.offset ?? 0)
		.limit(options?.limit ?? 100);

	const docs = await cursor.toArray();

	console.log('[firecrawl-observer] Found observers:', docs.length);

	return docs.map(documentToResult);
}

/**
 * Get observers that need to be checked
 *
 * Returns active observers whose last check was longer ago than their interval.
 * Used by scheduled jobs to determine which observers to check.
 *
 * @param limit - Maximum number of observers to return
 * @returns Array of ObserverResult needing checks
 */
export async function getObserversNeedingCheck(limit = 50): Promise<ObserverResult[]> {
	console.log('[firecrawl-observer] getObserversNeedingCheck called');

	const collection = await getObserversCollection();
	const now = new Date();

	// Find active observers that haven't been checked recently
	const docs = await collection
		.aggregate<ObserverDocument>([
			{
				$match: {
					status: 'active'
				}
			},
			{
				$addFields: {
					// Calculate when next check is due
					nextCheckDue: {
						$add: [
							{ $ifNull: ['$lastChecked', '$createdAt'] },
							{ $multiply: ['$interval', 60 * 1000] } // interval in ms
						]
					}
				}
			},
			{
				$match: {
					nextCheckDue: { $lte: now }
				}
			},
			{
				$sort: { nextCheckDue: 1 } // Oldest due first
			},
			{
				$limit: limit
			}
		])
		.toArray();

	console.log('[firecrawl-observer] Observers needing check:', docs.length);

	return docs.map(documentToResult);
}

/**
 * Run observer checks for all due observers
 *
 * This is the main function to call from a scheduled job (e.g., cron).
 * It finds all observers that need checking and runs checks for them.
 *
 * @returns Summary of check results
 */
export async function runObserverChecks(): Promise<{
	checked: number;
	changesDetected: number;
	errors: number;
}> {
	console.log('[firecrawl-observer] runObserverChecks called');

	const observers = await getObserversNeedingCheck();
	let changesDetected = 0;
	let errors = 0;

	for (const observer of observers) {
		try {
			const changes = await checkObserver(observer.observerId);
			if (changes.length > 0) {
				changesDetected += changes.length;
			}
		} catch (error) {
			console.error(`[firecrawl-observer] Check failed for ${observer.observerId}:`, error);
			errors++;
		}
	}

	const summary = {
		checked: observers.length,
		changesDetected,
		errors
	};

	console.log('[firecrawl-observer] Observer checks complete:', summary);

	return summary;
}

/**
 * Get change history for an observer
 *
 * @param observerId - Observer ID
 * @param limit - Maximum number of changes to return (default: 20)
 * @returns Array of ChangeEvent
 *
 * @example
 * const changes = await getObserverChanges('507f1f77bcf86cd799439011');
 * changes.forEach(change => {
 *   console.log(`${change.timestamp}: ${change.changeType}`);
 * });
 */
export async function getObserverChanges(observerId: string, limit = 20): Promise<ChangeEvent[]> {
	console.log('[firecrawl-observer] getObserverChanges called:', { observerId, limit });

	const collection = await getObserversCollection();
	let objectId: ObjectId;

	try {
		objectId = new ObjectId(observerId);
	} catch {
		throw new Error(`Invalid observer ID: ${observerId}`);
	}

	const doc = await collection.findOne(
		{ _id: objectId },
		{ projection: { changeHistory: { $slice: -limit } } }
	);

	if (!doc) {
		throw new Error(`Observer not found: ${observerId}`);
	}

	// Return in reverse chronological order
	return (doc.changeHistory || []).reverse();
}

/**
 * Update observer configuration
 *
 * @param observerId - Observer ID
 * @param updates - Fields to update
 * @returns Updated ObserverResult
 *
 * @example
 * const updated = await updateObserver('507f1f77bcf86cd799439011', {
 *   interval: 30,
 *   description: 'Monitor executive team page'
 * });
 */
export async function updateObserver(
	observerId: string,
	updates: Partial<Pick<ObserverOptions, 'interval' | 'webhookUrl' | 'description' | 'tags'>>
): Promise<ObserverResult> {
	console.log('[firecrawl-observer] updateObserver called:', { observerId, updates });

	const collection = await getObserversCollection();
	let objectId: ObjectId;

	try {
		objectId = new ObjectId(observerId);
	} catch {
		throw new Error(`Invalid observer ID: ${observerId}`);
	}

	const setFields: Record<string, unknown> = {
		updatedAt: new Date()
	};

	if (updates.interval !== undefined) setFields.interval = updates.interval;
	if (updates.webhookUrl !== undefined) setFields.webhookUrl = updates.webhookUrl;
	if (updates.description !== undefined) setFields.description = updates.description;
	if (updates.tags !== undefined) setFields.tags = updates.tags;

	const result = await collection.findOneAndUpdate(
		{ _id: objectId },
		{ $set: setFields },
		{ returnDocument: 'after' }
	);

	if (!result) {
		throw new Error(`Observer not found: ${observerId}`);
	}

	console.log('[firecrawl-observer] Observer updated:', observerId);

	return documentToResult(result);
}

/**
 * Record a change event for an observer
 *
 * Used internally or by webhook handlers to record detected changes.
 *
 * @param observerId - Observer ID
 * @param change - Change event to record
 */
export async function recordChange(
	observerId: string,
	change: Omit<ChangeEvent, 'timestamp'>
): Promise<void> {
	console.log('[firecrawl-observer] recordChange called:', {
		observerId,
		changeType: change.changeType
	});

	const collection = await getObserversCollection();
	let objectId: ObjectId;

	try {
		objectId = new ObjectId(observerId);
	} catch {
		throw new Error(`Invalid observer ID: ${observerId}`);
	}

	const changeEvent: ChangeEvent = {
		...change,
		timestamp: new Date()
	};

	await collection.updateOne(
		{ _id: objectId },
		{
			$set: {
				lastChange: changeEvent.timestamp,
				lastContent: change.newContent,
				updatedAt: changeEvent.timestamp
			},
			$push: {
				changeHistory: {
					$each: [changeEvent],
					$slice: -MAX_CHANGE_HISTORY
				}
			}
		}
	);

	console.log('[firecrawl-observer] Change recorded:', {
		observerId,
		timestamp: changeEvent.timestamp
	});
}

/**
 * Get observer statistics
 */
export async function getObserverStats(): Promise<{
	totalObservers: number;
	activeObservers: number;
	pausedObservers: number;
	errorObservers: number;
	totalChangesDetected: number;
	domainBreakdown: Array<{ domain: string; count: number }>;
}> {
	try {
		const collection = await getObserversCollection();

		const [stats] = await collection
			.aggregate([
				{
					$facet: {
						totals: [
							{
								$group: {
									_id: null,
									totalObservers: { $sum: 1 },
									activeObservers: {
										$sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
									},
									pausedObservers: {
										$sum: { $cond: [{ $eq: ['$status', 'paused'] }, 1, 0] }
									},
									errorObservers: {
										$sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] }
									},
									totalChangesDetected: { $sum: { $size: '$changeHistory' } }
								}
							}
						],
						byDomain: [
							{
								$group: {
									_id: '$domain',
									count: { $sum: 1 }
								}
							},
							{ $sort: { count: -1 } },
							{ $limit: 10 },
							{ $project: { domain: '$_id', count: 1, _id: 0 } }
						]
					}
				}
			])
			.toArray();

		const totals = stats?.totals?.[0] || {};
		const byDomain = stats?.byDomain || [];

		return {
			totalObservers: totals.totalObservers || 0,
			activeObservers: totals.activeObservers || 0,
			pausedObservers: totals.pausedObservers || 0,
			errorObservers: totals.errorObservers || 0,
			totalChangesDetected: totals.totalChangesDetected || 0,
			domainBreakdown: byDomain
		};
	} catch (error) {
		console.error('[firecrawl-observer] Stats error:', error);
		return {
			totalObservers: 0,
			activeObservers: 0,
			pausedObservers: 0,
			errorObservers: 0,
			totalChangesDetected: 0,
			domainBreakdown: []
		};
	}
}

// ============================================================================
// Index Management
// ============================================================================

/**
 * Ensure indexes exist for the observers collection
 * Should be called on server startup
 */
export async function ensureObserverIndexes(): Promise<void> {
	try {
		const collection = await getObserversCollection();

		console.log('[firecrawl-observer] Creating observer indexes...');

		// Unique index on URL hash for deduplication
		await collection.createIndex({ urlHash: 1 }, { unique: true, name: 'unique_urlHash' });

		// Index on status for filtering
		await collection.createIndex({ status: 1 }, { name: 'idx_status' });

		// Index on domain for domain-level queries
		await collection.createIndex({ domain: 1 }, { name: 'idx_domain' });

		// Index on tags for tag filtering
		await collection.createIndex({ tags: 1 }, { name: 'idx_tags' });

		// Compound index for listing queries
		await collection.createIndex({ status: 1, createdAt: -1 }, { name: 'idx_status_createdAt' });

		// Index on last change for finding recently changed observers
		await collection.createIndex({ lastChange: -1 }, { name: 'idx_lastChange', sparse: true });

		// Index on lastChecked for finding observers needing checks
		await collection.createIndex(
			{ status: 1, lastChecked: 1 },
			{ name: 'idx_status_lastChecked' }
		);

		// TTL index if expiresAt is set (optional cleanup)
		await collection.createIndex(
			{ expiresAt: 1 },
			{ expireAfterSeconds: 0, name: 'ttl_expiresAt', sparse: true }
		);

		console.log('[firecrawl-observer] Observer indexes created');
	} catch (error) {
		console.error('[firecrawl-observer] Index creation error:', error);
	}
}
