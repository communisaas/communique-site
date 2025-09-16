import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ErrorReport } from '$lib/utils/errorBoundary';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const { error, context, retryCount } = await request.json();

		// Basic validation
		if (!error || typeof error !== 'object') {
			return json({ success: false, error: 'Invalid error data' }, { status: 400 });
		}

		const errorReport: ErrorReport = {
			message: error.message || 'Unknown error',
			stack: error.stack,
			context: context || 'unknown',
			timestamp: error.timestamp || Date.now(),
			userAgent: error.userAgent,
			url: error.url,
			userId: locals.user?.id,
			additionalData: {
				retryCount: retryCount || 0,
				sessionId: locals.session?.id
			}
		};

		// Log error (in production, send to monitoring service)
		if (process.env.NODE_ENV === 'development') {
			console.error('Error reported:', errorReport);
		} else {
			// TODO: Send to monitoring service (Sentry, DataDog, etc.)
			// await sendToMonitoringService(errorReport);
		}

		// TODO: Store in database for analysis
		// await db.error_reports.create({ data: errorReport });

		return json({
			success: true,
			message: 'Error reported successfully'
		});
	} catch (err) {
		console.error('Failed to process error report:', err);
		return json(
			{
				success: false,
				error: 'Failed to process error report'
			},
			{ status: 500 }
		);
	}
};
