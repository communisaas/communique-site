import { json } from '@sveltejs/kit';
import { testOnRealData, runBasicSentimentTests } from '$lib/server/sentiment-basic';

export async function GET() {
  try {
    console.log('🧪 Running sentiment analysis tests...');
    
    // Run the basic sentiment tests
    await runBasicSentimentTests();
    
    return json({ 
      success: true, 
      message: 'Sentiment analysis tests completed successfully',
      note: 'Check server console for detailed results'
    });
    
  } catch (error) {
    console.error('Error running sentiment tests:', error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}