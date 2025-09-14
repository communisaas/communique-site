import { json } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { reputationCalculator } from '$lib/services/reputation-calculator';
import type { RequestHandler } from './$types';

/**
 * Template Quality API Endpoint
 * 
 * Provides public transparency for template quality scores
 * and author reputation information
 */
export const GET: RequestHandler = async ({ params }) => {
	try {
		// Get template verification data
		const verification = await db.templateVerification.findUnique({
			where: { template_id: params.id },
			include: {
				template: {
					include: {
						user: true
					}
				},
				user: true,
				legislative_channel: true
			}
		});
		
		// If no verification exists, check if template exists
		if (!verification) {
			const template = await db.template.findUnique({
				where: { id: params.id },
				include: { user: true }
			});
			
			if (!template) {
				return json(
					{ error: 'Template not found' },
					{ status: 404 }
				);
			}
			
			// Return basic info for templates without verification
			return json({
				template_id: params.id,
				status: 'unverified',
				message: 'This template has not been verified for congressional submission',
				author: template.user ? {
					user_id: template.userId,
					voter_reputation: template.user.voter_reputation || 50,
					tier: reputationCalculator.getTier(template.user.voter_reputation || 50)
				} : null
			});
		}
		
		// Calculate additional author metrics
		let authorMetrics = null;
		if (verification.user) {
			// Count user's templates
			const templateCount = await db.template.count({
				where: { userId: verification.user_id }
			});
			
			// Get average quality of user's verified templates
			const userVerifications = await db.templateVerification.findMany({
				where: { 
					user_id: verification.user_id,
					quality_score: { not: null }
				},
				select: { quality_score: true }
			});
			
			const avgQuality = userVerifications.length > 0
				? userVerifications.reduce((sum, v) => sum + (v.quality_score || 0), 0) / userVerifications.length
				: null;
			
			// Count approved vs rejected
			const approvedCount = await db.templateVerification.count({
				where: {
					user_id: verification.user_id,
					moderation_status: 'approved'
				}
			});
			
			const rejectedCount = await db.templateVerification.count({
				where: {
					user_id: verification.user_id,
					moderation_status: 'rejected'
				}
			});
			
			authorMetrics = {
				templates_created: templateCount,
				templates_approved: approvedCount,
				templates_rejected: rejectedCount,
				approval_rate: templateCount > 0 
					? ((approvedCount / (approvedCount + rejectedCount)) * 100).toFixed(1) + '%'
					: 'N/A',
				avg_quality_score: avgQuality ? Math.round(avgQuality) : null
			};
		}
		
		// Get tier information
		const tierInfo = verification.user 
			? reputationCalculator.getTierInfo(
				reputationCalculator.getTier(verification.user.voter_reputation || 50)
			)
			: null;
		
		// Build response
		const response = {
			template_id: params.id,
			
			// Verification status
			verification: {
				status: verification.moderation_status,
				verified_at: verification.reviewed_at,
				severity_level: verification.severity_level,
				
				// Quality scores
				quality_score: verification.quality_score,
				grammar_score: verification.grammar_score,
				clarity_score: verification.clarity_score,
				completeness_score: verification.completeness_score,
				
				// Consensus information (without exposing raw votes)
				consensus_score: verification.consensus_score 
					? (verification.consensus_score * 100).toFixed(1) + '%'
					: null,
				
				// Auto-correction info
				auto_corrected: !!verification.correction_log,
				corrections_applied: verification.correction_log 
					? (verification.correction_log as any[]).length
					: 0
			},
			
			// Author reputation
			author: verification.user ? {
				user_id: verification.user_id,
				voter_reputation: verification.user.voter_reputation || 50,
				tier: reputationCalculator.getTier(verification.user.voter_reputation || 50),
				tier_info: tierInfo,
				...authorMetrics
			} : null,
			
			// Legislative context
			legislative_context: verification.legislative_channel ? {
				country_code: verification.country_code,
				country_name: verification.legislative_channel.name,
				access_tier: verification.legislative_channel.access_tier
			} : {
				country_code: verification.country_code || 'US',
				country_name: 'United States',
				access_tier: 2
			},
			
			// Template metadata
			template: {
				title: verification.template.title,
				type: verification.template.type,
				delivery_method: verification.template.deliveryMethod,
				created_at: verification.template.createdAt,
				is_public: verification.template.is_public
			}
		};
		
		return json(response);
		
	} catch (error) {
		console.error('Error fetching template quality:', error);
		return json(
			{ error: 'Failed to fetch template quality information' },
			{ status: 500 }
		);
	}
};