import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/core/db';

/**
 * CWC Job Status Endpoint
 *
 * Returns the current status of a CWC submission job
 * Used by the frontend to poll for progress updates
 */
export const GET: RequestHandler = async ({ params }) => {
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
				status: true,
				created_at: true,
				started_at: true,
				completed_at: true,
				results: true,
				metadata: true,
				error: true
			}
		});

		if (!job) {
			throw error(404, 'Job not found');
		}

		// Calculate progress based on status and results
		const progress = calculateProgress(job);

		// Format response for frontend
		const response = {
			jobId: job.id,
			status: job.status,
			progress,
			createdAt: job.created_at,
			startedAt: job.started_at,
			completedAt: job.completed_at,
			results: job.results || [],
			error: job.error,
			metadata: job.metadata
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

/**
 * Calculate progress percentage based on job status and results
 */
function calculateProgress(job: any): number {
	switch (job.status) {
		case 'pending':
			return 0;
		case 'processing':
			// If we have results, calculate based on completed submissions
			if (job.results && Array.isArray(job.results)) {
				const completedCount = job.results.filter((r: any) => r.status !== 'pending').length;
				const totalCount = job.results.length;
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