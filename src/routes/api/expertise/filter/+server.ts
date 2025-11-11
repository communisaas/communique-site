/**
 * Expertise Filtering API (Decision-Maker Interface)
 *
 * GET /api/expertise/filter?domain={domain}&min_multiplier={1.5}&organization_type={congress}
 *
 * For congressional staffers, HOA boards, university admins, corporate decision-makers:
 * Filter messages/templates by sender credibility in specific domains
 *
 * Use Cases:
 * - Congressional staffer: "Show me only verified healthcare professionals on this bill"
 * - HOA board: "Filter to certified arborists discussing tree removal"
 * - University: "Show accessibility consultants with IAAP certification"
 * - Corporate: "Filter to supply chain managers with APICS certification"
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getVerifiedExpertsInDomain } from '$lib/core/reputation/credential-verifier';
import { createApiError, type ApiResponse } from '$lib/types/errors';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const domain = url.searchParams.get('domain');
		const min_multiplier = parseFloat(url.searchParams.get('min_multiplier') || '1.5');
		const organization_type = url.searchParams.get('organization_type');

		if (!domain) {
			const response: ApiResponse = {
				success: false,
				error: createApiError(
					'validation',
					'VALIDATION_REQUIRED_FIELD',
					'Domain parameter required'
				)
			};
			return json(response, { status: 400 });
		}

		// Get verified experts in this domain
		const experts = await getVerifiedExpertsInDomain(domain, min_multiplier);

		// Filter by organization_type if provided
		const filteredExperts = organization_type
			? experts.filter((e) => e.organization_type === organization_type)
			: experts;

		// Return aggregated stats (privacy-preserving)
		const response: ApiResponse = {
			success: true,
			data: {
				domain,
				min_multiplier,
				organization_type,
				expert_count: filteredExperts.length,
				verification_breakdown: {
					state_api_verified: filteredExperts.filter(
						(e) => e.verification_status === 'state_api_verified'
					).length,
					peer_endorsed: filteredExperts.filter((e) => e.verification_status === 'peer_endorsed')
						.length,
					agent_verified: filteredExperts.filter((e) => e.verification_status === 'agent_verified')
						.length
				},
				avg_messages_sent: average(filteredExperts.map((e) => e.messages_sent)),
				avg_templates_created: average(filteredExperts.map((e) => e.templates_created)),
				avg_issues_tracked: average(filteredExperts.map((e) => e.issues_tracked.length)),
				// Top professional roles (aggregated for privacy)
				top_roles: getTopRoles(filteredExperts, 5)
			}
		};

		return json(response);
	} catch (error) {
		console.error('Expertise filter API error:', error);

		const response: ApiResponse = {
			success: false,
			error: createApiError('server', 'SERVER_INTERNAL', 'Failed to filter experts')
		};

		return json(response, { status: 500 });
	}
};

// Helper: Calculate average
function average(numbers: number[]): number {
	if (numbers.length === 0) return 0;
	return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

// Helper: Get top professional roles (for dashboard display)
function getTopRoles(
	experts: { professional_role: string | null }[],
	limit: number
): Record<string, number> {
	const roleCounts: Record<string, number> = {};

	for (const expert of experts) {
		if (expert.professional_role) {
			roleCounts[expert.professional_role] = (roleCounts[expert.professional_role] || 0) + 1;
		}
	}

	// Sort by count and return top N
	return Object.fromEntries(
		Object.entries(roleCounts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, limit)
	);
}
