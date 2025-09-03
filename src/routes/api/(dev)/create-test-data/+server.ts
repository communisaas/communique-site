import { json } from '@sveltejs/kit';
import { storeSingleUserSentiment } from '$lib/core/server/sentiment-storage';

export async function POST() {
  try {
    
    // Create test sentiment data matching our mathematical pipeline example
    const testData = [
      {
        user_id: 'test_austin_user',
        message: "Student loans crushing families, support forgiveness!",
        coords: { lat: 30.27, lng: -97.74 } // Austin, TX
      },
      {
        user_id: 'test_amarillo_user', 
        message: "Oppose loan forgiveness, people should pay debts",
        coords: { lat: 35.22, lng: -101.83 } // Amarillo, TX
      },
      {
        user_id: 'test_houston_user',
        message: "Lower interest rates on student loans",
        coords: { lat: 29.76, lng: -95.37 } // Houston, TX
      },
      {
        user_id: 'test_dallas_user',
        message: "Cancel student debt completely!",
        coords: { lat: 32.78, lng: -96.80 } // Dallas, TX
      },
      {
        user_id: 'test_sanantonio_user',
        message: "Pause loan payments during hardship",
        coords: { lat: 29.42, lng: -98.49 } // San Antonio, TX
      }
    ];
    
    const results = [];
    
    for (const data of testData) {
      // Store sentiment (NOT dry run this time)
      const result = await storeSingleUserSentiment(
        data.user_id,
        data.message,
        false // Actually store the data
      );
      
      if (result) {
        results.push({
          user_id: data.user_id,
          location: `${data.coords.lat}, ${data.coords.lng}`,
          sentiment: result.sentiment_result.sentiment,
          confidence: result.sentiment_result.confidence,
          intensity: result.sentiment_result.intensity
        });
      }
    }
    
    return json({
      success: true,
      message: `Created ${results.length} test sentiment data points`,
      data: results
    });
    
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}