import { json } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { reputationCalculator } from '$lib/services/reputation-calculator';
import type { RequestHandler } from './$types';
import type { UnknownRecord } from '$lib/types/any-replacements';

/**
 * Template Quality API Endpoint
 *
 * Provides public transparency for template quality scores
 * and author reputation information
 */
export const GET: RequestHandler = async ({ params }) => {
	try {
		// Get template with consolidated verification fields
		const template = await db.template.findUnique({
			where: { id: params.id },
			include: { user: true }
		});

		if (!template) {
			return json({ error: 'Template not found' }, { status: 404 });
		}

		// Check if template has verification data (for congressional templates)
		if (!template.verification_status) {
			// Return basic info for templates without verification
			return json({
				template_id: params.id,
				status: 'unverified',
				message: 'This template has not been verified for congressional submission',
				author: template.user
					? {
							user_id: template.userId,
							voter_reputation: template.user.trust_score || 50,
							tier: reputationCalculator.getTier(template.user.trust_score || 50)
						}
					: null
			});
		}

		// Calculate additional author metrics
		let authorMetrics = null;
		if (template.user) {
			// Count user's templates
			const templateCount = await db.template.count({
				where: { userId: template.userId }
			});

			// Get average quality of user's verified templates
			const userTemplates = await db.template.findMany({
				where: {
					userId: template.userId,
					quality_score: { gt: 0 }
				},
				select: { quality_score: true }
			});

			const avgQuality =
				userTemplates.length > 0
					? userTemplates.reduce((sum, t) => sum + (t.quality_score || 0), 0) / userTemplates.length
					: null;

			// Count approved vs rejected
			const approvedCount = await db.template.count({
				where: {
					userId: template.userId,
					verification_status: 'approved'
				}
			});

			const rejectedCount = await db.template.count({
				where: {
					userId: template.userId,
					verification_status: 'rejected'
				}
			});

			authorMetrics = {
				templates_created: templateCount,
				templates_approved: approvedCount,
				templates_rejected: rejectedCount,
				approval_rate:
					templateCount > 0
						? ((approvedCount / (approvedCount + rejectedCount)) * 100).toFixed(1) + '%'
						: 'N/A',
				avg_quality_score: avgQuality ? Math.round(avgQuality) : null
			};
		}

		// Get tier information
		const tierInfo = template.user
			? reputationCalculator.getTierInfo(
					reputationCalculator.getTier(template.user.trust_score || 50)
				)
			: null;

		// Build response
		const response = {
			template_id: params.id,

			// Verification status
			verification: {
				status: template.verification_status,
				verified_at: template.reviewed_at,
				severity_level: template.severity_level,

				// Quality scores
				quality_score: template.quality_score,
				grammar_score: template.grammar_score,
				clarity_score: template.clarity_score,
				completeness_score: template.completeness_score,

				// Consensus information (without exposing raw votes)
				consensus_score: template.consensus_score
					? (template.consensus_score * 100).toFixed(1) + '%'
					: null,

				// Auto-correction info
				auto_corrected: !!template.correction_log,
				corrections_applied: template.correction_log
					? (template.correction_log as UnknownRecord[]).length
					: 0
			},

			// Author reputation
			author: template.user
				? {
						user_id: template.userId,
						voter_reputation: template.user.trust_score || 50,
						tier: reputationCalculator.getTier(template.user.trust_score || 50),
						tier_info: tierInfo,
						...authorMetrics
					}
				: null,

			// Legislative context
			legislative_context: {
				country_code: template.country_code || 'US',
				country_name: 'United States',
				access_tier: 2
			},

			// Template metadata
			template: {
				title: template.title,
				type: template.type,
				delivery_method: template.deliveryMethod,
				created_at: template.createdAt,
				is_public: template.is_public
			}
		};

		return json(response);
	} catch (err) {
		console.error('Error occurred');
		return json({ error: 'Failed to fetch template quality information' }, { status: 500 });
	}
};
