import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ErrorReport } from '$lib/utils/errorBoundary';
import type { ErrorDetails } from '$lib/types/any-replacements.js';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const { errors } = await request.json();

		// Validate batch
		if (!Array.isArray(errors) || errors.length === 0) {
			return json({ success: false, error: 'Invalid errors array' }, { status: 400 });
		}

		// Limit batch size
		if (errors.length > 50) {
			return json({ success: false, error: 'Batch too large (max 50 errors)' }, { status: 400 });
		}

		const processedErrors: ErrorReport[] = errors.map((error: unknown) => {
			const errorData = error as ErrorDetails;
			return {
				message: errorData?.message || 'Unknown error',
				stack: errorData?.stack,
				context: errorData?.context || 'unknown',
				timestamp: errorData?.timestamp || Date.now(),
				userAgent: errorData?.userAgent,
				url: errorData?.url,
				userId: locals.user?.id,
				additionalData: {
					...errorData?.additionalData,
					sessionId: locals.session?.id,
					batchId: crypto.randomUUID()
				}
			};
		});

		// Log errors (in production, send to monitoring service)
		if (process.env.NODE_ENV === 'development') {
			console.error(`Batch error report (${processedErrors.length} errors):`, processedErrors);
		} else {
			// TODO: Send to monitoring service
			// await sendBatchToMonitoringService(processedErrors);
		}

		// TODO: Batch insert to database
		// await db.error_reports.createMany({ data: processedErrors });

		return json({
			success: true,
			message: `${processedErrors.length} errors reported successfully`
		});
	} catch (err) {
		console.error('Error occurred');
		return json(
			{
				success: false,
				error: 'Failed to process batch error report'
			},
			{ status: 500 }
		);
	}
};
