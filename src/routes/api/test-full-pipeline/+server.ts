import { json } from '@sveltejs/kit';
import { runBasicSentimentTests } from '$lib/server/sentiment-basic';
import { runSafeStorageTest } from '$lib/server/sentiment-storage';
import { testGeographicInterpolation } from '$lib/server/geographic-interpolation';
import { testCommunityClustering } from '$lib/server/community-clustering';

export async function GET() {
  try {
    console.log('🚀 RUNNING FULL MATHEMATICAL PIPELINE TEST\n');
    console.log('='.repeat(50));
    
    const results = {
      pipeline_stages: [],
      overall_success: true,
      summary: {}
    };
    
    // Stage 1: Sentiment Classification
    console.log('\n📊 STAGE 1: Sentiment Classification');
    console.log('-'.repeat(30));
    
    try {
      await runBasicSentimentTests();
      results.pipeline_stages.push({
        stage: 'sentiment_classification',
        status: 'success',
        message: 'Basic sentiment classification working'
      });
    } catch (error) {
      results.pipeline_stages.push({
        stage: 'sentiment_classification',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      results.overall_success = false;
    }
    
    // Stage 2: Sentiment Storage
    console.log('\n💾 STAGE 2: Sentiment Storage');
    console.log('-'.repeat(30));
    
    const storageResult = await runSafeStorageTest();
    results.pipeline_stages.push({
      stage: 'sentiment_storage',
      status: storageResult.success ? 'success' : 'error',
      message: storageResult.message
    });
    
    if (!storageResult.success) {
      results.overall_success = false;
    }
    
    // Stage 3: Geographic Interpolation
    console.log('\n🗺️  STAGE 3: Geographic Interpolation');
    console.log('-'.repeat(30));
    
    const geoResult = await testGeographicInterpolation();
    results.pipeline_stages.push({
      stage: 'geographic_interpolation',
      status: geoResult.success ? 'success' : 'error',
      message: geoResult.message,
      data: geoResult.data
    });
    
    if (!geoResult.success) {
      results.overall_success = false;
    }
    
    // Stage 4: Community Clustering
    console.log('\n🏘️  STAGE 4: Community Clustering');
    console.log('-'.repeat(30));
    
    const clusterResult = await testCommunityClustering();
    results.pipeline_stages.push({
      stage: 'community_clustering',
      status: clusterResult.success ? 'success' : 'error',
      message: clusterResult.message,
      data: clusterResult.data
    });
    
    if (!clusterResult.success) {
      results.overall_success = false;
    }
    
    // Generate summary
    const successStages = results.pipeline_stages.filter(s => s.status === 'success').length;
    const totalStages = results.pipeline_stages.length;
    
    results.summary = {
      stages_completed: `${successStages}/${totalStages}`,
      success_rate: `${((successStages / totalStages) * 100).toFixed(1)}%`,
      foundation_status: successStages >= 3 ? 'READY FOR ENHANCEMENT' : 'NEEDS WORK',
      next_steps: successStages >= 3 ? [
        'Implement BERT embeddings',
        'Add ARIMA time series analysis', 
        'Build CWC transformation pipeline',
        'Scale to production data volumes'
      ] : [
        'Fix failing pipeline stages',
        'Add test data for validation',
        'Debug storage and database operations'
      ]
    };
    
    console.log('\n🎯 PIPELINE TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`Success Rate: ${results.summary.success_rate}`);
    console.log(`Foundation Status: ${results.summary.foundation_status}`);
    console.log('Next Steps:');
    (results.summary.next_steps as string[]).forEach((step, i) => {
      console.log(`  ${i + 1}. ${step}`);
    });
    
    if (results.overall_success) {
      console.log('\n🚀 MATHEMATICAL PIPELINE FOUNDATION COMPLETE!');
      console.log('Ready for iterative enhancement with BERT and ARIMA.');
    } else {
      console.log('\n⚠️  Some pipeline stages need attention.');
      console.log('Foundation is buildable but requires data and debugging.');
    }
    
    return json({
      success: results.overall_success,
      message: results.overall_success 
        ? 'Mathematical pipeline foundation test completed successfully'
        : 'Pipeline test completed with some issues',
      data: results
    });
    
  } catch (error) {
    console.error('❌ Error in full pipeline test:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}