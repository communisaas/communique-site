/**
 * Congress.gov Scheduled Ingestion Job
 *
 * Scheduled job to ingest new bills from Congress.gov:
 * - Runs daily (fire-and-forget on server start)
 * - Generates L1 summaries with simple heuristics
 * - Creates voyage-law-2 embeddings for vector search
 * - Stores in MongoDB for caching and search
 *
 * Phase 2E Implementation
 *
 * @module congress/ingest-job
 */

import { getDatabase } from '../mongodb';
import {
	ingestLegislativeFeed,
	getFeedStats,
	type IngestionStats,
	type IngestionOptions
} from './feed';
import { getCurrentCongress, getRateLimitStatus } from './client';

// ============================================================================
// Configuration
// ============================================================================

/** Collection for storing ingestion run metadata */
const INGESTION_RUNS_COLLECTION = 'congress_ingestion_runs';

/** Minimum hours between ingestion runs */
const MIN_HOURS_BETWEEN_RUNS = 20; // Run at most once per day

/** Default options for scheduled ingestion */
const DEFAULT_INGESTION_OPTIONS: IngestionOptions = {
	generateEmbeddings: true,
	generateL1Summaries: true,
	limit: 100 // Process up to 100 bills per run
};

// ============================================================================
// Types
// ============================================================================

interface IngestionRunDocument {
	/** Run start timestamp */
	startedAt: Date;
	/** Run completion timestamp */
	completedAt?: Date;
	/** Run status */
	status: 'running' | 'completed' | 'failed';
	/** Ingestion statistics */
	stats?: IngestionStats;
	/** Error message if failed */
	error?: string;
	/** Congress number processed */
	congress: number;
	/** Options used */
	options: IngestionOptions;
}

interface IngestionJobResult {
	/** Whether the job ran successfully */
	success: boolean;
	/** Whether the job was skipped (too soon since last run) */
	skipped: boolean;
	/** Reason for skipping or failure */
	reason?: string;
	/** Ingestion statistics if run */
	stats?: IngestionStats;
	/** Next scheduled run time */
	nextRunAt?: Date;
}

// ============================================================================
// Job Runner
// ============================================================================

/**
 * Check if enough time has passed since the last ingestion run
 */
async function shouldRunIngestion(): Promise<{
	shouldRun: boolean;
	lastRun?: Date;
	hoursSinceLastRun?: number;
}> {
	try {
		const db = await getDatabase();
		const collection = db.collection<IngestionRunDocument>(INGESTION_RUNS_COLLECTION);

		// Find the most recent completed run
		const lastRun = await collection.findOne(
			{ status: 'completed' },
			{ sort: { completedAt: -1 } }
		);

		if (!lastRun?.completedAt) {
			// No previous run found, should run
			return { shouldRun: true };
		}

		const hoursSinceLastRun =
			(Date.now() - lastRun.completedAt.getTime()) / (1000 * 60 * 60);

		return {
			shouldRun: hoursSinceLastRun >= MIN_HOURS_BETWEEN_RUNS,
			lastRun: lastRun.completedAt,
			hoursSinceLastRun
		};
	} catch (error) {
		// If we can't check, allow the run but log the error
		console.error('[Congress Ingestion] Error checking last run:', error);
		return { shouldRun: true };
	}
}

/**
 * Record the start of an ingestion run
 */
async function recordRunStart(
	congress: number,
	options: IngestionOptions
): Promise<string> {
	const db = await getDatabase();
	const collection = db.collection<IngestionRunDocument>(INGESTION_RUNS_COLLECTION);

	const doc: IngestionRunDocument = {
		startedAt: new Date(),
		status: 'running',
		congress,
		options
	};

	const result = await collection.insertOne(doc);
	return result.insertedId.toString();
}

/**
 * Record the completion of an ingestion run
 */
async function recordRunComplete(
	runId: string,
	stats: IngestionStats
): Promise<void> {
	const db = await getDatabase();
	const collection = db.collection<IngestionRunDocument>(INGESTION_RUNS_COLLECTION);

	const { ObjectId } = await import('mongodb');

	await collection.updateOne(
		{ _id: new ObjectId(runId) },
		{
			$set: {
				completedAt: new Date(),
				status: 'completed',
				stats
			}
		}
	);
}

/**
 * Record a failed ingestion run
 */
async function recordRunFailed(runId: string, error: string): Promise<void> {
	const db = await getDatabase();
	const collection = db.collection<IngestionRunDocument>(INGESTION_RUNS_COLLECTION);

	const { ObjectId } = await import('mongodb');

	await collection.updateOne(
		{ _id: new ObjectId(runId) },
		{
			$set: {
				completedAt: new Date(),
				status: 'failed',
				error
			}
		}
	);
}

/**
 * Run the Congress.gov bill ingestion job
 *
 * This is the main entry point for scheduled ingestion.
 * It checks if enough time has passed since the last run,
 * then ingests new bills from Congress.gov.
 *
 * @param options - Optional ingestion options to override defaults
 * @returns Result of the ingestion job
 *
 * @example
 * // Fire-and-forget on server start
 * runCongressIngestion().catch(console.error);
 *
 * // With custom options
 * const result = await runCongressIngestion({ limit: 50 });
 */
export async function runCongressIngestion(
	options: Partial<IngestionOptions> = {}
): Promise<IngestionJobResult> {
	console.log('[Congress Ingestion] Starting ingestion job...');

	// Merge options with defaults
	const ingestionOptions: IngestionOptions = {
		...DEFAULT_INGESTION_OPTIONS,
		...options
	};

	// Check if we should run
	const { shouldRun, lastRun, hoursSinceLastRun } = await shouldRunIngestion();

	if (!shouldRun) {
		const nextRunAt = lastRun
			? new Date(lastRun.getTime() + MIN_HOURS_BETWEEN_RUNS * 60 * 60 * 1000)
			: new Date();

		console.log(
			`[Congress Ingestion] Skipping - last run was ${hoursSinceLastRun?.toFixed(1)} hours ago. ` +
				`Next run at ${nextRunAt.toISOString()}`
		);

		return {
			success: true,
			skipped: true,
			reason: `Last run was ${hoursSinceLastRun?.toFixed(1)} hours ago (minimum: ${MIN_HOURS_BETWEEN_RUNS} hours)`,
			nextRunAt
		};
	}

	// Check rate limit status before running
	const rateLimitStatus = getRateLimitStatus();
	if (rateLimitStatus.requestsRemaining < 50) {
		console.warn(
			`[Congress Ingestion] Low rate limit remaining: ${rateLimitStatus.requestsRemaining}. ` +
				`Skipping to preserve quota.`
		);

		return {
			success: true,
			skipped: true,
			reason: `Low API rate limit remaining: ${rateLimitStatus.requestsRemaining} requests`,
			nextRunAt: rateLimitStatus.resetTime
		};
	}

	const congress = ingestionOptions.congress || getCurrentCongress();
	let runId: string | undefined;

	try {
		// Record run start
		runId = await recordRunStart(congress, ingestionOptions);
		console.log(`[Congress Ingestion] Run started: ${runId}`);

		// Run the ingestion
		const stats = await ingestLegislativeFeed(ingestionOptions);

		// Record completion
		await recordRunComplete(runId, stats);

		console.log('[Congress Ingestion] Run completed:', {
			runId,
			fetched: stats.fetched,
			added: stats.added,
			updated: stats.updated,
			skipped: stats.skipped,
			embeddingsGenerated: stats.embeddingsGenerated,
			l1SummariesGenerated: stats.l1SummariesGenerated,
			duration: `${stats.duration}ms`,
			errors: stats.errors.length
		});

		// Calculate next run time
		const nextRunAt = new Date(Date.now() + MIN_HOURS_BETWEEN_RUNS * 60 * 60 * 1000);

		return {
			success: stats.errors.length === 0,
			skipped: false,
			stats,
			nextRunAt
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		console.error('[Congress Ingestion] Run failed:', errorMessage);

		// Record failure if we have a run ID
		if (runId) {
			await recordRunFailed(runId, errorMessage);
		}

		return {
			success: false,
			skipped: false,
			reason: errorMessage
		};
	}
}

/**
 * Get ingestion job status and history
 */
export async function getIngestionStatus(): Promise<{
	lastRun?: {
		startedAt: Date;
		completedAt?: Date;
		status: string;
		stats?: IngestionStats;
	};
	recentRuns: IngestionRunDocument[];
	feedStats: Awaited<ReturnType<typeof getFeedStats>>;
	rateLimitStatus: ReturnType<typeof getRateLimitStatus>;
}> {
	const db = await getDatabase();
	const collection = db.collection<IngestionRunDocument>(INGESTION_RUNS_COLLECTION);

	const [lastRun, recentRuns, feedStats] = await Promise.all([
		collection.findOne({}, { sort: { startedAt: -1 } }),
		collection.find({}).sort({ startedAt: -1 }).limit(10).toArray(),
		getFeedStats()
	]);

	return {
		lastRun: lastRun
			? {
					startedAt: lastRun.startedAt,
					completedAt: lastRun.completedAt,
					status: lastRun.status,
					stats: lastRun.stats
				}
			: undefined,
		recentRuns,
		feedStats,
		rateLimitStatus: getRateLimitStatus()
	};
}

/**
 * Force run ingestion (bypasses time check)
 * Use with caution - may hit rate limits
 */
export async function forceRunIngestion(
	options: Partial<IngestionOptions> = {}
): Promise<IngestionJobResult> {
	console.log('[Congress Ingestion] Force running ingestion...');

	const ingestionOptions: IngestionOptions = {
		...DEFAULT_INGESTION_OPTIONS,
		...options,
		forceUpdate: true
	};

	const congress = ingestionOptions.congress || getCurrentCongress();
	let runId: string | undefined;

	try {
		runId = await recordRunStart(congress, ingestionOptions);

		const stats = await ingestLegislativeFeed(ingestionOptions);

		await recordRunComplete(runId, stats);

		return {
			success: stats.errors.length === 0,
			skipped: false,
			stats
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		if (runId) {
			await recordRunFailed(runId, errorMessage);
		}

		return {
			success: false,
			skipped: false,
			reason: errorMessage
		};
	}
}

/**
 * Cleanup old ingestion run records
 * Keeps only the last 30 days of records
 */
export async function cleanupOldRuns(): Promise<number> {
	const db = await getDatabase();
	const collection = db.collection<IngestionRunDocument>(INGESTION_RUNS_COLLECTION);

	const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

	const result = await collection.deleteMany({
		startedAt: { $lt: thirtyDaysAgo }
	});

	console.log(`[Congress Ingestion] Cleaned up ${result.deletedCount} old run records`);

	return result.deletedCount;
}
