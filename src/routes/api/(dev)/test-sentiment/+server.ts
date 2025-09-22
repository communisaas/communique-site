import { json } from '@sveltejs/kit';
import { runBasicSentimentTests } from '$lib/core/server/sentiment-basic';

export async function GET() {
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
