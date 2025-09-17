import { json } from '@sveltejs/kit';
import {
	analyzeCivicInformationCascades,
	storeCascadeAnalysis
} from '$lib/core/server/percolation-engine';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	try {
		// Run percolation-style connectivity analysis on the civic information network
		const analysis = await analyzeCivicInformationCascades();

		// Store results for historical tracking
		await storeCascadeAnalysis(analysis);

		return json({
			success: true,
			analysis,
			timestamp: new Date().toISOString(),
			interpretation: {
				cascade_status: analysis.cascade_potential,
				network_health: analysis.max_flow_capacity > 10 ? 'strong' : 'weak',
				critical_node_count: analysis.critical_nodes.length,
				bottleneck_severity: analysis.bottleneck_edges.length > 5 ? 'high' : 'moderate',
				recommendation: getRecommendation(analysis)
			}
		});
	} catch (_error) {
		console.error('Error:' , _error);

		return json(
			{
				success: false,
				error: 'Failed to analyze information cascades',
				details: _error instanceof Error ? _error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

function getRecommendation(analysis: any): string {
	if (analysis.cascade_potential === 'supercritical') {
		return 'Network in optimal state for viral spread. Focus on quality content creation.';
	} else if (analysis.cascade_potential === 'critical') {
		return 'Network approaching viral threshold. Target critical nodes for maximum impact.';
	} else {
		return 'Network below viral threshold. Focus on connecting isolated communities.';
	}
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { action, parameters } = await request.json();

		if (action === 'refresh') {
			// Force refresh of network analysis
			const analysis = await analyzeCivicInformationCascades();
			await storeCascadeAnalysis(analysis);

			return json({
				success: true,
				message: 'Network analysis refreshed',
				analysis
			});
		}

		return json(
			{
				success: false,
				error: 'Invalid action'
			},
			{ status: 400 }
		);
	} catch (_error) {
		return json(
			{
				success: false,
				error: 'Failed to process request'
			},
			{ status: 500 }
		);
	}
};
