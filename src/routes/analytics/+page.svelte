<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import type { PercolationData, FusionData } from '$lib/types/analytics';
  
  let percolationData: PercolationData | null = null;
  let fusionData: FusionData | null = null;
  let loading = true;
  let error = '';

  onMount(async () => {
    try {
      // Fetch analytics data (will require OAuth)
      const [percolationRes, fusionRes] = await Promise.all([
        fetch('/api/percolation-analysis'),
        fetch('/api/sheaf-fusion?category=education')
      ]);
      
      if (percolationRes.ok) {
        percolationData = await percolationRes.json();
      }
      
      if (fusionRes.ok) {
        fusionData = await fusionRes.json();
      }
      
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load analytics';
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>Civic Analytics - Communiqué</title>
</svelte:head>

<div class="max-w-6xl mx-auto p-6 space-y-8">
  <div class="text-center">
    <h1 class="text-3xl font-bold text-slate-900 mb-2">Civic Information Analytics</h1>
    <p class="text-slate-600">Mathematical analysis of how information flows through communities</p>
  </div>

  {#if loading}
    <div class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-4 text-slate-600">Analyzing civic information dynamics...</p>
    </div>
  {/if}

  {#if error}
    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
      <p class="text-red-800">
        {#if error.includes('Authentication')}
          Please <a href="/auth/login" class="underline">log in</a> to access analytics.
        {:else}
          Error: {error}
        {/if}
      </p>
    </div>
  {/if}

  {#if percolationData}
    <div class="bg-white rounded-lg border border-slate-200 p-6">
      <h2 class="text-xl font-semibold text-slate-900 mb-4">🌊 Information Cascade Analysis</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="bg-blue-50 rounded-lg p-4">
          <h3 class="font-medium text-blue-900">Cascade Potential</h3>
          <p class="text-2xl font-bold text-blue-700 capitalize">
            {percolationData.data.cascade_analysis.cascade_potential}
          </p>
          <p class="text-sm text-blue-600 mt-1">
            {percolationData.data.interpretation.cascade_status === 'subcritical' 
              ? 'Information stays localized' 
              : percolationData.data.interpretation.cascade_status === 'critical'
              ? 'On the edge of viral spread'
              : 'High viral potential'}
          </p>
        </div>

        <div class="bg-green-50 rounded-lg p-4">
          <h3 class="font-medium text-green-900">Threshold</h3>
          <p class="text-2xl font-bold text-green-700">
            {(percolationData.data.cascade_analysis.threshold_probability * 100).toFixed(1)}%
          </p>
          <p class="text-sm text-green-600 mt-1">
            Activation rate needed for viral spread
          </p>
        </div>

        <div class="bg-purple-50 rounded-lg p-4">
          <h3 class="font-medium text-purple-900">Network Health</h3>
          <p class="text-2xl font-bold text-purple-700 capitalize">
            {percolationData.data.interpretation.network_resilience}
          </p>
          <p class="text-sm text-purple-600 mt-1">
            {percolationData.data.interpretation.bottleneck_count} critical bottlenecks
          </p>
        </div>
      </div>

      <div class="bg-slate-50 rounded-lg p-4">
        <h3 class="font-medium text-slate-900 mb-2">What This Means</h3>
        <p class="text-slate-700">
          {percolationData.data.interpretation.threshold_meaning}. 
          The network is currently in a <strong>{percolationData.data.cascade_analysis.cascade_potential}</strong> state,
          meaning information spread is 
          {#if percolationData.data.cascade_analysis.cascade_potential === 'subcritical'}
            limited to local communities.
          {:else if percolationData.data.cascade_analysis.cascade_potential === 'critical'}
            on the edge of breaking into viral cascade.
          {:else}
            primed for rapid viral spread across the entire network.
          {/if}
        </p>
      </div>
    </div>
  {/if}

  {#if fusionData}
    <div class="bg-white rounded-lg border border-slate-200 p-6">
      <h2 class="text-xl font-semibold text-slate-900 mb-4">🔗 Information Consistency Analysis</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div class="bg-emerald-50 rounded-lg p-4">
          <h3 class="font-medium text-emerald-900">Fusion Quality</h3>
          <p class="text-2xl font-bold text-emerald-700">
            {(fusionData.data.fusion_result.quality_metrics.fusion_quality * 100).toFixed(1)}%
          </p>
          <p class="text-sm text-emerald-600 mt-1">
            Information sources in agreement
          </p>
        </div>

        <div class="bg-orange-50 rounded-lg p-4">
          <h3 class="font-medium text-orange-900">Conflicts Detected</h3>
          <p class="text-2xl font-bold text-orange-700">
            {fusionData.data.fusion_result.conflicts.length}
          </p>
          <p class="text-sm text-orange-600 mt-1">
            Regional disagreements
          </p>
        </div>
      </div>

      <div class="bg-slate-50 rounded-lg p-4">
        <h3 class="font-medium text-slate-900 mb-2">Mathematical Interpretation</h3>
        <ul class="text-slate-700 space-y-1 text-sm">
          <li><strong>H⁰ (Global Consensus):</strong> {fusionData.data.mathematical_interpretation.h0_meaning}</li>
          <li><strong>H¹ (Information Conflicts):</strong> {fusionData.data.mathematical_interpretation.h1_meaning}</li>
          <li><strong>Confidence Bound:</strong> {fusionData.data.mathematical_interpretation.confidence_bound_meaning}</li>
        </ul>
      </div>
    </div>
  {/if}

  {#if !loading && !percolationData && !fusionData && !error}
    <div class="text-center py-12">
      <h2 class="text-xl font-semibold text-slate-900 mb-4">Ready for Analysis</h2>
      <p class="text-slate-600 mb-6">
        Create templates and engage with the platform to generate civic analytics insights.
      </p>
      <a href="/dashboard/templates" 
         class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
        Create Your First Template
      </a>
    </div>
  {/if}

  <div class="bg-blue-50 rounded-lg p-6">
    <h2 class="text-lg font-semibold text-blue-900 mb-3">About These Analytics</h2>
    <div class="text-blue-800 space-y-2 text-sm">
      <p><strong>Percolation Analysis:</strong> Uses network flow algorithms (Ford-Fulkerson) to predict information cascade potential across civic networks.</p>
      <p><strong>Sheaf Data Fusion:</strong> Applies algebraic topology (Čech cohomology) to detect and resolve conflicts between information sources across geographic regions.</p>
      <p><strong>Mathematical Guarantees:</strong> All analyses use proven algorithms with polynomial-time complexity and established theoretical foundations.</p>
    </div>
  </div>
</div>