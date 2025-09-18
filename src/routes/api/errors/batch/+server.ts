import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ErrorReport } from '$lib/utils/errorBoundary';

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

		const processedErrors: ErrorReport[] = errors.map((error: unknown) => ({
			message: (error as any)?.message || 'Unknown error',
			stack: (error as any)?.stack,
			context: (error as any)?.context || 'unknown',
			timestamp: (error as any)?.timestamp || Date.now(),
			userAgent: (error as any)?.userAgent,
			url: (error as any)?.url,
			userId: locals.user?.id,
			additionalData: {
				...(error as any)?.additionalData,
				sessionId: locals.session?.id,
				batchId: crypto.randomUUID()
			}
		}));

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
	} catch (_error: unknown) {
		console.error('Failed to process batch error report:', _error);
		return json(
			{
				success: false,
				error: 'Failed to process batch error report'
			},
			{ status: 500 }
		);
	}
};
