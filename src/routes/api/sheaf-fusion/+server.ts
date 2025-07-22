import { json } from '@sveltejs/kit';
import { fuseInformationSources, storeFusionResults } from '$lib/server/sheaf-fusion';

export async function GET({ url }) {
  try {
    const category = url.searchParams.get('category') || 'education';
    const timeWindow = parseInt(url.searchParams.get('days') || '7');
    
    console.log(`🔗 Running sheaf data fusion for category: ${category}`);
    
    const fusionResult = await fuseInformationSources(category, timeWindow);
    
    if (fusionResult.success) {
      // Store results in database
      await storeFusionResults(category, fusionResult);
    }
    
    return json({
      success: fusionResult.success,
      message: fusionResult.success 
        ? `Sheaf data fusion completed for ${category}`
        : `No data available for fusion in category ${category}`,
      data: {
        category,
        time_window_days: timeWindow,
        fusion_result: fusionResult,
        mathematical_interpretation: {
          h0_meaning: 'Global consensus across all geographic regions',
          h1_meaning: 'Information conflicts requiring resolution',
          fusion_quality_meaning: `${(fusionResult.quality_metrics.fusion_quality * 100).toFixed(1)}% of sources are globally consistent`,
          confidence_bound_meaning: `Mathematical lower bound: ${(fusionResult.quality_metrics.confidence_bound * 100).toFixed(1)}% confidence`
        }
      }
    });
    
  } catch (error) {
    console.error('Error in sheaf fusion:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}