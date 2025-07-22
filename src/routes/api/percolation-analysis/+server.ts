import { json } from '@sveltejs/kit';
import { analyzeCivicInformationCascades, storeCascadeAnalysis } from '$lib/server/percolation-engine';
import { oauthSecurityMiddleware, logAnalyticsUsage } from '$lib/server/oauth-security';

export async function GET({ request }) {
  const startTime = Date.now();
  
  // OAuth security check
  const security = await oauthSecurityMiddleware(request, 'percolation-analysis');
  
  if (!security.allowed) {
    return json({ 
      success: false, 
      error: security.error 
    }, { 
      status: security.error?.includes('Authentication') ? 401 : 403,
      headers: security.headers || {}
    });
  }
  try {
    console.log('🌊 Running percolation analysis on civic information network...');
    
    const analysis = await analyzeCivicInformationCascades();
    
    // Store results in database
    await storeCascadeAnalysis(analysis);
    
    // Log successful usage
    await logAnalyticsUsage(security.user_id!, 'percolation-analysis', true, Date.now() - startTime);
    
    return json({
      success: true,
      message: 'Percolation analysis completed successfully',
      data: {
        cascade_analysis: analysis,
        interpretation: {
          threshold_meaning: `Information needs ${(analysis.threshold_probability * 100).toFixed(1)}% activation probability to cascade`,
          cascade_status: analysis.cascade_potential,
          critical_nodes_count: analysis.critical_nodes.length,
          bottleneck_count: analysis.bottleneck_edges.length,
          network_resilience: analysis.bottleneck_edges.length < 3 ? 'fragile' : 'robust'
        }
      }
    });
    
  } catch (error) {
    // Log failed usage
    await logAnalyticsUsage(security.user_id!, 'percolation-analysis', false, Date.now() - startTime);
    
    console.error('Error in percolation analysis:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500,
      headers: security.headers || {}
    });
  }
}