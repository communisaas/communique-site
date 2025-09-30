/**
 * CWC Job Status Tracking API Endpoint
 *
 * Provides real-time status updates for async CWC submission jobs
 * Used by N8N workflow and frontend to monitor progress of queued submissions
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/core/db';

// TypeScript interfaces for strong typing
interface CWCJobSubmission {
	recipient: {
		name: string;
		chamber: 'senate' | 'house';
		bioguideId: string;
	};
	status: 'queued' | 'processing' | 'submitted' | 'failed' | 'rate_limited';
	messageId?: string;
	cwcConfirmation?: string;
	error?: string;
	submittedAt?: string;
}

interface CWCJobStatusResponse {
	jobId: string;
	status: 'queued' | 'processing' | 'completed' | 'partial' | 'failed';
	submissionCount: number;
	submissions: CWCJobSubmission[];
	createdAt: string;
	completedAt?: string;
	metadata: {
		templateId: string;
		userId: string;
	};
}

interface CWCJobError {
	error: string;
	jobId?: string;
	timestamp: string;
}

/**
 * GET endpoint for checking CWC job status
 * Supports webhook secret validation for N8N polling
 */
export const GET: RequestHandler = async ({ params, request, url }) => {
	try {
		const { id: jobId } = params;

		// Validate job ID format
		if (!jobId || typeof jobId !== 'string') {
			return json(
				{
					error: 'Invalid job ID format',
					jobId: jobId || 'undefined',
					timestamp: new Date().toISOString()
				} satisfies CWCJobError,
				{ status: 400 }
			);
		}

		// Optional webhook secret validation for N8N
		const webhookSecret = request.headers.get('x-webhook-secret');
		const expectedSecret = process.env.N8N_WEBHOOK_SECRET;

		if (expectedSecret && webhookSecret && webhookSecret !== expectedSecret) {
			return json(
				{
					error: 'Invalid webhook secret',
					jobId,
					timestamp: new Date().toISOString()
				} satisfies CWCJobError,
				{ status: 401 }
			);
		}

		// Query both CWCJob and template_campaign records for complete status
		const [cwcJob, templateCampaigns] = await Promise.all([
			// Primary job record
			db.cWCJob.findUnique({
				where: { id: jobId }
			}),
			// Individual submission records
			db.template_campaign.findMany({
				where: {
					metadata: {
						path: ['job_id'],
						equals: jobId
					}
				},
				orderBy: {
					created_at: 'asc'
				}
			})
		]);

		if (!cwcJob) {
			// Check if this might be an old-format job ID in template_campaign
			const legacySubmissions = templateCampaigns;

			if (legacySubmissions.length === 0) {
				return json(
					{
						error: 'Job not found',
						jobId,
						timestamp: new Date().toISOString()
					} satisfies CWCJobError,
					{ status: 404 }
				);
			}

			// Build response from legacy submissions only
			const submissions: CWCJobSubmission[] = legacySubmissions.map((campaign) => {
				const metadata = campaign.metadata as any;
				return {
					recipient: {
						name: metadata?.recipient_name || 'Unknown',
						chamber: metadata?.chamber || 'house',
						bioguideId: campaign.recipient_id || 'unknown'
					},
					status: mapCampaignStatusToSubmissionStatus(campaign.status),
					messageId: campaign.cwc_delivery_id || undefined,
					cwcConfirmation: metadata?.cwc_confirmation || undefined,
					error: campaign.error_message || undefined,
					submittedAt: campaign.delivered_at?.toISOString() || campaign.sent_at?.toISOString()
				};
			});

			const overallStatus = determineOverallStatus(submissions);
			const firstSubmission = legacySubmissions[0];

			return json({
				jobId,
				status: overallStatus,
				submissionCount: submissions.length,
				submissions,
				createdAt: firstSubmission.created_at.toISOString(),
				completedAt: legacySubmissions.every((s) => s.status !== 'pending' && s.status !== 'queued')
					? new Date(
							Math.max(...legacySubmissions.map((s) => (s.delivered_at || s.updated_at).getTime()))
						).toISOString()
					: undefined,
				metadata: {
					templateId: firstSubmission.template_id,
					userId: firstSubmission.user_id
				}
			} satisfies CWCJobStatusResponse);
		}

		// Build submissions array from template_campaign records
		const submissions: CWCJobSubmission[] = templateCampaigns.map((campaign) => {
			const metadata = campaign.metadata as any;
			return {
				recipient: {
					name: metadata?.recipient_name || 'Unknown',
					chamber: metadata?.chamber || 'house',
					bioguideId: campaign.recipient_id || 'unknown'
				},
				status: mapCampaignStatusToSubmissionStatus(campaign.status),
				messageId: campaign.cwc_delivery_id || undefined,
				cwcConfirmation: metadata?.cwc_confirmation || undefined,
				error: campaign.error_message || undefined,
				submittedAt: campaign.delivered_at?.toISOString() || campaign.sent_at?.toISOString()
			};
		});

		// Support batch status queries via URL parameter
		const includeBatch = url.searchParams.get('batch') === 'true';
		if (includeBatch) {
			// For batch queries, we could include additional jobs
			// This is a placeholder for future batch functionality
		}

		// Determine overall job status
		const overallStatus = cwcJob.status as CWCJobStatusResponse['status'];

		// Build complete response
		const response: CWCJobStatusResponse = {
			jobId: cwcJob.id,
			status: overallStatus,
			submissionCount: cwcJob.submissionCount || submissions.length,
			submissions,
			createdAt: cwcJob.createdAt.toISOString(),
			completedAt: cwcJob.completedAt?.toISOString(),
			metadata: {
				templateId: cwcJob.templateId,
				userId: cwcJob.userId
			}
		};

		console.log(`CWC job status query:`, {
			jobId: cwcJob.id,
			status: response.status,
			submissionCount: response.submissionCount,
			completedSubmissions: submissions.filter((s) => s.status === 'submitted').length,
			failedSubmissions: submissions.filter((s) => s.status === 'failed').length,
			timestamp: new Date().toISOString()
		});

		return json(response);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		console.error('CWC job status query failed:', {
			jobId: params.id,
			error: errorMessage,
			stack: error instanceof Error ? error.stack : undefined,
			timestamp: new Date().toISOString()
		});

		return json(
			{
				error: `Failed to retrieve job status: ${errorMessage}`,
				jobId: params.id || 'unknown',
				timestamp: new Date().toISOString()
			} satisfies CWCJobError,
			{ status: 500 }
		);
	}
};

/**
 * POST endpoint for updating job status (used by Lambda workers)
 * Webhook secret validation required for security
 */
export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const { id: jobId } = params;

		// Validate webhook secret (required for POST updates)
		const webhookSecret = request.headers.get('x-webhook-secret');
		const expectedSecret = process.env.LAMBDA_WEBHOOK_SECRET || process.env.N8N_WEBHOOK_SECRET;

		if (!expectedSecret || webhookSecret !== expectedSecret) {
			return json(
				{
					error: 'Invalid or missing webhook secret',
					jobId,
					timestamp: new Date().toISOString()
				} satisfies CWCJobError,
				{ status: 401 }
			);
		}

		const updateData = await request.json();
		const { status, submissionResults = [], completedAt } = updateData;

		// Validate status
		const validStatuses = ['queued', 'processing', 'completed', 'partial', 'failed'];
		if (status && !validStatuses.includes(status)) {
			return json(
				{
					error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
					jobId,
					timestamp: new Date().toISOString()
				} satisfies CWCJobError,
				{ status: 400 }
			);
		}

		// Update job record
		const updatePayload: any = {};
		if (status) updatePayload.status = status;
		if (submissionResults.length > 0) updatePayload.results = submissionResults;
		if (completedAt) updatePayload.completedAt = new Date(completedAt);

		const updatedJob = await db.cWCJob.update({
			where: { id: jobId },
			data: updatePayload
		});

		// Also update individual template_campaign records if submission results provided
		if (submissionResults.length > 0) {
			for (const result of submissionResults) {
				const { messageId, status: submissionStatus, cwcConfirmation, error } = result;

				await db.template_campaign.updateMany({
					where: {
						cwc_delivery_id: messageId,
						metadata: {
							path: ['job_id'],
							equals: jobId
						}
					},
					data: {
						status: submissionStatus,
						delivered_at: submissionStatus === 'submitted' ? new Date() : undefined,
						error_message: error || null,
						metadata: {
							update: {
								cwc_confirmation: cwcConfirmation
							}
						}
					}
				});
			}
		}

		console.log(`CWC job status updated:`, {
			jobId: updatedJob.id,
			status: updatedJob.status,
			submissionResultsCount: submissionResults.length,
			completedAt: updatedJob.completedAt,
			timestamp: new Date().toISOString()
		});

		return json({
			success: true,
			jobId: updatedJob.id,
			status: updatedJob.status,
			updatedAt: new Date().toISOString()
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		console.error('CWC job status update failed:', {
			jobId: params.id,
			error: errorMessage,
			stack: error instanceof Error ? error.stack : undefined,
			timestamp: new Date().toISOString()
		});

		return json(
			{
				error: `Failed to update job status: ${errorMessage}`,
				jobId: params.id || 'unknown',
				timestamp: new Date().toISOString()
			} satisfies CWCJobError,
			{ status: 500 }
		);
	}
};

/**
 * Helper function to map template_campaign status to submission status
 */
function mapCampaignStatusToSubmissionStatus(campaignStatus: string): CWCJobSubmission['status'] {
	switch (campaignStatus) {
		case 'pending':
		case 'queued':
			return 'queued';
		case 'processing':
			return 'processing';
		case 'sent':
		case 'delivered':
		case 'completed':
			return 'submitted';
		case 'failed':
		case 'error':
			return 'failed';
		case 'rate_limited':
			return 'rate_limited';
		default:
			return 'queued';
	}
}

/**
 * Helper function to determine overall job status from individual submissions
 */
function determineOverallStatus(submissions: CWCJobSubmission[]): CWCJobStatusResponse['status'] {
	if (submissions.length === 0) return 'queued';

	const statusCounts = submissions.reduce(
		(acc, sub) => {
			acc[sub.status] = (acc[sub.status] || 0) + 1;
			return acc;
		},
		{} as Record<string, number>
	);

	// All failed
	if (statusCounts.failed === submissions.length) return 'failed';

	// All submitted
	if (statusCounts.submitted === submissions.length) return 'completed';

	// Some submitted, some failed/rate limited
	if (statusCounts.submitted > 0 && (statusCounts.failed > 0 || statusCounts.rate_limited > 0)) {
		return 'partial';
	}

	// Any still processing
	if (statusCounts.processing > 0) return 'processing';

	// Default to queued
	return 'queued';
}
