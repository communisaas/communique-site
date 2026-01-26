import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { runBasicSentimentTests } from '$lib/core/server/sentiment-basic';

export async function GET() {
	if (!dev) {
		return json({ error: 'Development endpoint not available' }, { status: 404 });
	}
	try {
		// Run the basic sentiment tests
		await runBasicSentimentTests();

		return json({
			success: true,
			message: 'Sentiment analysis tests completed successfully',
			note: 'Check server console for detailed results'
		});
	} catch (error) {
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
}
