import { json } from '@sveltejs/kit';
import { createApiError, type ApiResponse } from '$lib/types/errors';
import type { RequestHandler } from './$types';

interface SubmissionStatus {
	status: 'sending' | 'routing' | 'delivered' | 'recorded' | 'failed';
	details?: string;
	deliveryCount?: number;
	canOverride?: boolean;
	timestamp?: string;
	cwcConfirmation?: string;
}

// In a real implementation, this would connect to your database
// For now, mock the status progression based on submission lifecycle
async function getSubmissionStatus(submissionId: string): Promise<SubmissionStatus | null> {
	try {
		// This would query your database for the actual submission
		// For now, simulate status based on time since submission

		// Mock data - replace with actual database queries
		const submission = {
			id: submissionId,
			createdAt: new Date(),
			status: 'sending' as const,
			deliveryCount: null,
			cwcConfirmation: null
		};

		// Simulate progression through N8N workflow stages
		const minutesSinceSubmission = (Date.now() - submission.createdAt.getTime()) / 1000 / 60;

		if (minutesSinceSubmission < 1) {
			return {
				status: 'sending',
				details: 'Processing through delivery system',
				canOverride: true
			};
		} else if (minutesSinceSubmission < 3) {
			return {
				status: 'routing',
				details: 'Identifying congressional offices',
				canOverride: true
			};
		} else if (minutesSinceSubmission < 5) {
			return {
				status: 'delivered',
				details: 'Via Communicating with Congress (CWC) API',
				deliveryCount: 3,
				canOverride: false,
				cwcConfirmation: 'CWC-' + submissionId.substring(0, 8)
			};
		} else {
			return {
				status: 'recorded',
				details: 'Civic action verified and logged',
				canOverride: false,
				timestamp: new Date().toISOString()
			};
		}
	} catch (error) {
		console.error('Failed to get submission status:', error);
		return null;
	}
}

export const GET: RequestHandler = async ({ params }) => {
	try {
		const submissionId = params.id;

		if (!submissionId) {
			const response: ApiResponse = {
				success: false,
				error: createApiError('validation', 'VALIDATION_REQUIRED', 'Submission ID is required')
			};
			return json(response, { status: 400 });
		}

		const status = await getSubmissionStatus(submissionId);

		if (!status) {
			const response: ApiResponse = {
				success: false,
				error: createApiError('validation', 'RESOURCE_NOT_FOUND', 'Submission not found')
			};
			return json(response, { status: 404 });
		}

		const response: ApiResponse = {
			success: true,
			data: status
		};

		return json(response);
	} catch (error) {
		console.error('Submission status error:', error);

		const response: ApiResponse = {
			success: false,
			error: createApiError('server', 'SERVER_INTERNAL', 'Failed to get submission status')
		};

		return json(response, { status: 500 });
	}
};
