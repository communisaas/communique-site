import { json } from '@sveltejs/kit';
import {
	analyzeCivicInformationCascades,
	storeCascadeAnalysis
} from '$lib/core/server/percolation-engine';
import { db } from '$lib/core/db';
import type { PercolationData as _PercolationData } from '$lib/types/analytics';
import type { RequestHandler } from './$types';
import type { PercolationAnalysis } from '$lib/types/any-replacements';

export const GET: RequestHandler = async ({ url: _url, locals }) => {
	try {
		// Run percolation-style connectivity analysis on the civic information network
		const analysis = await analyzeCivicInformationCascades();

		// Store results for historical tracking
		await storeCascadeAnalysis(analysis);

		// Optional: Log analytics event for percolation analysis view
		if (locals.user?.id) {
			try {
				await db.analytics_event.create({
					data: {
						session_id: crypto.randomUUID(),
						user_id: locals.user.id,
						timestamp: new Date(),
						name: 'percolation_analysis_viewed',
						event_type: 'interaction',
						properties: {
							cascade_status: analysis.cascade_potential,
							network_health: analysis.max_flow_capacity > 10 ? 'strong' : 'weak',
							critical_node_count: analysis.critical_nodes?.length || 0
						},
						computed_metrics: {}
					}
				});
			} catch (error) {
				// Ignore analytics errors
			}
		}

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
	} catch (error) {
		console.error('Error occurred');

		return json(
			{
				success: false,
				error: 'Failed to analyze information cascades',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

function getRecommendation(analysis: PercolationAnalysis): string {
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
		const { action, parameters: _parameters } = await request.json();

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
	} catch (error) {
		return json(
			{
				success: false,
				error: 'Failed to process request'
			},
			{ status: 500 }
		);
	}
};
