import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/core/db';

/**
 * CWC Job Status Endpoint
 *
 * Returns the current status of a CWC submission job
 * Used by the frontend to poll for progress updates
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	// Authentication check
	if (!locals.user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	try {
		const { jobId } = params;

		if (!jobId) {
			throw error(400, 'Job ID is required');
		}

		// Get job status from database
		const job = await prisma.cWCJob.findUnique({
			where: { id: jobId },
			select: {
				id: true,
				userId: true,
				status: true,
				createdAt: true,
				completedAt: true,
				results: true,
				submissionCount: true
			}
		});

		if (!job) {
			throw error(404, 'Job not found');
		}

		// Ownership check - ensure user owns this job
		if (job.userId !== locals.user.id) {
			return json({ error: 'Access denied' }, { status: 403 });
		}

		// Calculate progress based on status and results
		const progress = calculateProgress(job);

		// Format response for frontend
		const response = {
			jobId: job.id,
			status: job.status,
			progress,
			createdAt: job.createdAt,
			completedAt: job.completedAt,
			results: job.results || [],
			submissionCount: job.submissionCount
		};

		return json(response);
	} catch (err) {
		console.error('[CWC Job Status] Error:', err);

		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'Failed to retrieve job status');
	}
};

interface JobResult {
	status: string;
	[key: string]: unknown;
}

interface CWCJob {
	status: string;
	results?: unknown;
	[key: string]: unknown;
}

/**
 * Calculate progress percentage based on job status and results
 */
function calculateProgress(job: CWCJob): number {
	switch (job.status) {
		case 'pending':
			return 0;
		case 'processing':
			// If we have results, calculate based on completed submissions
			if (job.results && Array.isArray(job.results)) {
				const results = job.results as JobResult[];
				const completedCount = results.filter((r) => r.status !== 'pending').length;
				const totalCount = results.length;
				return totalCount > 0 ? Math.round((completedCount / totalCount) * 50) : 25; // Max 50% during processing
			}
			return 25; // Default processing progress
		case 'completed':
			return 100;
		case 'partially_completed':
			return 85; // Mostly done but with some failures
		case 'failed':
			return 0;
		default:
			return 0;
	}
}
