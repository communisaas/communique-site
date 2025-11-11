/**
 * User Reputation API
 *
 * GET /api/reputation/user/[userId]
 * Returns user's reputation score and concrete signals.
 *
 * Phase 1 signals (0-60 points):
 * - Template adoption rate (max 25 points)
 * - Peer endorsements (max 15 points)
 * - Civic velocity (max 10 points)
 * - Template contributions (max 10 points)
 *
 * Phase 2 signals (40 points) - all default to 0:
 * - Challenge wins/losses
 * - Response correlation
 * - Citation count
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/core/db';
import { calculateReputationScore } from '$lib/core/reputation/adoption-tracker';
import { createApiError, type ApiResponse } from '$lib/types/errors';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { userId } = params;

		// Fetch user reputation signals
		const user = await db.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				name: true,
				// Phase 1 signals
				templates_contributed: true,
				template_adoption_rate: true,
				peer_endorsements: true,
				active_months: true,
				// Phase 2 signals (will be 0)
				challenge_wins: true,
				challenge_losses: true,
				response_correlation: true,
				citation_count: true,
				// Metadata
				createdAt: true
			}
		});

		if (!user) {
			const response: ApiResponse = {
				success: false,
				error: createApiError('validation', 'VALIDATION_NOT_FOUND', 'User not found')
			};
			return json(response, { status: 404 });
		}

		// Calculate reputation score from Phase 1 signals
		const score = calculateReputationScore({
			template_adoption_rate: user.template_adoption_rate,
			peer_endorsements: user.peer_endorsements,
			active_months: user.active_months,
			templates_contributed: user.templates_contributed
		});

		// Determine reputation tier
		let tier = 'novice';
		if (score >= 50) tier = 'expert';
		else if (score >= 30) tier = 'experienced';
		else if (score >= 15) tier = 'contributor';

		// Get user's domain expertise (credibility attestations)
		const { getUserExpertise } = await import('$lib/core/reputation/credential-verifier');
		const expertise = await getUserExpertise(userId);

		// Build response with reputation data
		const response: ApiResponse = {
			success: true,
			data: {
				userId: user.id,
				name: user.name,
				reputation: {
					score, // 0-100 scale
					tier, // novice | contributor | experienced | expert
					phase: 'phase_1', // Indicates this is Phase 1 reputation only

					// Phase 1 signals (concrete, verifiable)
					signals: {
						template_adoption_rate: user.template_adoption_rate,
						peer_endorsements: user.peer_endorsements,
						active_months: user.active_months,
						templates_contributed: user.templates_contributed
					},

					// Phase 2 signals (all default 0)
					phase_2_signals: {
						challenge_wins: user.challenge_wins,
						challenge_losses: user.challenge_losses,
						response_correlation: user.response_correlation,
						citation_count: user.citation_count
					},

					// Breakdown of score components (for transparency)
					score_breakdown: {
						template_signal: Math.min(user.template_adoption_rate * 5, 25),
						endorsement_signal: Math.min(user.peer_endorsements * 2, 15),
						velocity_signal: Math.min(user.active_months * 2, 10),
						contribution_signal: Math.min(user.templates_contributed * 2, 10)
					},

					// Domain credibility (NEW: agent-verified expertise)
					domain_expertise: expertise.map((e) => ({
						domain: e.domain,
						organization_type: e.organization_type,
						professional_role: e.professional_role,
						verification_status: e.verification_status,
						credential_multiplier: e.credential_multiplier,
						messages_sent: e.messages_sent,
						templates_created: e.templates_created,
						issues_tracked: e.issues_tracked.length,
						verified_at: e.verified_at
					}))
				},
				memberSince: user.createdAt
			}
		};

		return json(response);
	} catch (error) {
		console.error('User reputation API error:', error);

		const response: ApiResponse = {
			success: false,
			error: createApiError('server', 'SERVER_INTERNAL', 'Failed to fetch user reputation')
		};

		return json(response, { status: 500 });
	}
};
