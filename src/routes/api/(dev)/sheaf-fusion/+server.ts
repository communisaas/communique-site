import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fuseInformationSources, storeFusionResults } from '$lib/core/server/sheaf-fusion';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const category = url.searchParams.get('category') || 'education';
		const timeWindow = parseInt(url.searchParams.get('days') || '7');

		const fusionResult = await fuseInformationSources(category, timeWindow);

		if (fusionResult.success) {
			// Store results in database
			await storeFusionResults(category, fusionResult);
		}

		return json({
			success: fusionResult.success,
			message: fusionResult.success
				? `Sheaf (Čech-inspired proxy) data fusion completed for ${category}`
				: `No data available for fusion in category ${category}`,
			data: {
				category,
				time_window_days: timeWindow,
				fusion_result: fusionResult,
				mathematical_interpretation: {
					h0_meaning: 'Proxy for global consensus across all geographic regions',
					h1_meaning: 'Proxy-detected information conflicts requiring resolution',
					fusion_quality_meaning: `${(fusionResult.quality_metrics.fusion_quality * 100).toFixed(1)}% of sources are globally consistent`,
					confidence_bound_meaning: `Mathematical lower bound: ${(fusionResult.quality_metrics.confidence_bound * 100).toFixed(1)}% confidence`
				}
			}
		});
	} catch (err) {
		return json(
			{
				success: false,
				error: err instanceof Error ? err.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
