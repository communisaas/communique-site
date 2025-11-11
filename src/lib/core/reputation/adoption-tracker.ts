/**
 * Template Adoption Tracker
 *
 * Privacy-preserving template adoption tracking per Phase 1 reputation implementation.
 * Uses aggregate counters ONLY - no individual user tracking.
 *
 * Key Metrics:
 * - verified_sends: Total messages sent using this template (crowd wisdom signal)
 * - unique_districts: Number of unique congressional districts reached
 * - avg_reputation: Average reputation of senders (quality signal)
 *
 * Privacy Guarantees:
 * - Uses district_hash (SHA-256) as user identity proxy, not plaintext
 * - No user_id linkage in Message model (see CYPHERPUNK-ARCHITECTURE.md)
 * - Aggregate metrics only - cannot trace individual users
 *
 * Integration Points:
 * - Called from congressional delivery flow (src/lib/core/congress/delivery.ts)
 * - Triggers reputation updates for template creator
 * - Updates template metrics in real-time
 */

import { db } from '$lib/core/db';
import type { PrismaClient } from '@prisma/client';

export interface TrackAdoptionParams {
	templateId: string;
	userId: string;
	districtHash: string; // SHA-256(congressional_district)
	reputationScore: number; // Sender's reputation at send time
	content: string; // Message content (for Message model)
	subject?: string; // Email subject (if applicable)
	deliveryMethod: 'cwc' | 'email';
}

export interface AdoptionMetrics {
	verified_sends: number;
	unique_districts: number;
	avg_reputation: number;
	template_adoption_rate?: number; // For template creator
}

/**
 * Track template adoption when a user sends a message
 *
 * This is the core privacy-preserving adoption tracking mechanism.
 * Updates aggregate template metrics and creator reputation.
 *
 * @param params - Adoption tracking parameters
 * @returns Updated adoption metrics
 */
export async function trackTemplateAdoption(params: TrackAdoptionParams): Promise<AdoptionMetrics> {
	const { templateId, userId, districtHash, reputationScore, content, subject, deliveryMethod } =
		params;

	// Use a transaction to ensure atomic updates
	const result = await db.$transaction(async (tx: PrismaClient) => {
		// 1. Create verifiable message record (PUBLIC, pseudonymous)
		await tx.message.create({
			data: {
				template_id: templateId,
				content,
				subject,
				verification_proof: '', // Will be populated by ZK proof service
				district_hash: districtHash,
				reputation_score: reputationScore,
				delivery_method: deliveryMethod,
				delivery_status: 'pending',
				sent_at: new Date()
			}
		});

		// 2. Increment template.verified_sends (aggregate counter)
		const updatedTemplate = await tx.template.update({
			where: { id: templateId },
			data: {
				verified_sends: { increment: 1 }
			},
			select: {
				verified_sends: true,
				unique_districts: true,
				avg_reputation: true,
				userId: true // Need creator ID for reputation update
			}
		});

		// 3. Check if this district is new (privacy-preserving unique count)
		const existingDistrictMessage = await tx.message.findFirst({
			where: {
				template_id: templateId,
				district_hash: districtHash
			}
		});

		let uniqueDistricts = updatedTemplate.unique_districts;
		if (!existingDistrictMessage) {
			// New district - increment unique_districts counter
			const templateWithNewDistrict = await tx.template.update({
				where: { id: templateId },
				data: {
					unique_districts: { increment: 1 }
				},
				select: {
					unique_districts: true
				}
			});
			uniqueDistricts = templateWithNewDistrict.unique_districts;
		}

		// 4. Update average reputation (running average)
		const currentAvg = updatedTemplate.avg_reputation || 0;
		const totalSends = updatedTemplate.verified_sends;
		const newAvg = (currentAvg * (totalSends - 1) + reputationScore) / totalSends;

		await tx.template.update({
			where: { id: templateId },
			data: {
				avg_reputation: newAvg
			}
		});

		// 5. Update template creator's reputation (if not the sender)
		if (updatedTemplate.userId && updatedTemplate.userId !== userId) {
			await updateCreatorReputation(tx, updatedTemplate.userId, templateId);
		}

		return {
			verified_sends: updatedTemplate.verified_sends,
			unique_districts: uniqueDistricts,
			avg_reputation: newAvg
		};
	});

	return result;
}

/**
 * Update template creator's reputation based on template adoption
 *
 * Calculates template_adoption_rate as percentage of templates that others have used.
 * This is a key reputation signal per Phase 1 spec.
 *
 * @param tx - Prisma transaction client
 * @param userId - Template creator user ID
 * @param templateId - Template that was just adopted
 */
async function updateCreatorReputation(
	tx: PrismaClient,
	userId: string,
	templateId: string
): Promise<void> {
	// Get all templates created by this user
	const userTemplates = await tx.template.findMany({
		where: { userId },
		select: {
			id: true,
			verified_sends: true
		}
	});

	// Count how many templates have been adopted (verified_sends > 0)
	const adoptedTemplates = userTemplates.filter((t) => t.verified_sends > 0).length;
	const totalTemplates = userTemplates.length;

	// Calculate adoption rate (0.0 - 1.0)
	const adoptionRate = totalTemplates > 0 ? adoptedTemplates / totalTemplates : 0;

	// Update user's template_adoption_rate
	await tx.user.update({
		where: { id: userId },
		data: {
			template_adoption_rate: adoptionRate
		}
	});
}

/**
 * Get adoption metrics for a template
 *
 * @param templateId - Template ID
 * @returns Adoption metrics
 */
export async function getTemplateAdoptionMetrics(templateId: string): Promise<AdoptionMetrics> {
	const template = await db.template.findUnique({
		where: { id: templateId },
		select: {
			verified_sends: true,
			unique_districts: true,
			avg_reputation: true
		}
	});

	if (!template) {
		throw new Error(`Template ${templateId} not found`);
	}

	return {
		verified_sends: template.verified_sends,
		unique_districts: template.unique_districts,
		avg_reputation: template.avg_reputation || 0
	};
}

/**
 * Get user's template contribution metrics
 *
 * @param userId - User ID
 * @returns User contribution metrics
 */
export async function getUserContributionMetrics(userId: string) {
	const user = await db.user.findUnique({
		where: { id: userId },
		select: {
			templates_contributed: true,
			template_adoption_rate: true,
			peer_endorsements: true,
			active_months: true
		}
	});

	if (!user) {
		throw new Error(`User ${userId} not found`);
	}

	return user;
}

/**
 * Calculate simple reputation score (0-100) from concrete signals
 *
 * This is the Phase 1 reputation calculation formula per the implementation spec.
 *
 * Formula:
 * - Template adoption: min(adoption_rate * 5, 25) [max 25 points]
 * - Peer endorsements: min(endorsements * 2, 15) [max 15 points]
 * - Civic velocity: min(active_months * 2, 10) [max 10 points]
 * - Template creation: min(templates_contributed * 2, 10) [max 10 points]
 *
 * Total possible: 60 points (Phase 1 baseline)
 * Phase 2 adds: 40 points (challenge markets + impact verification)
 *
 * @param signals - User reputation signals
 * @returns Reputation score (0-100)
 */
export function calculateReputationScore(signals: {
	template_adoption_rate: number;
	peer_endorsements: number;
	active_months: number;
	templates_contributed: number;
}): number {
	const templateSignal = Math.min(signals.template_adoption_rate * 5, 25); // Max 25
	const endorsementSignal = Math.min(signals.peer_endorsements * 2, 15); // Max 15
	const velocitySignal = Math.min(signals.active_months * 2, 10); // Max 10
	const contributionSignal = Math.min(signals.templates_contributed * 2, 10); // Max 10

	const baseScore = templateSignal + endorsementSignal + velocitySignal + contributionSignal;

	return Math.round(baseScore);
}
