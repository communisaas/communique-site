/**
 * Impact Tracking Endpoint
 *
 * Tracks causal chains from templates to legislative outcomes
 * "We don't count messages sent. We count minds changed."
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ImpactAgent } from '$lib/agents';
import { db } from '$lib/core/db';

const impactAgent = new ImpactAgent();

interface ImpactObservation {
	type: 'speech' | 'vote' | 'amendment' | 'media' | 'testimony';
	source: string; // URL, transcript reference, etc.
	confidence: number; // 0-100 correlation confidence
	timestamp: Date;
	details: unknown;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { templateId, observations = [], legislatorId, eventType, eventDetails } = body;

		if (!templateId) {
			return json({ error: 'templateId required' }, { status: 400 });
		}

		// Fetch template and its history
		const template = await db.template.findUnique({
			where: { id: templateId },
			include: {
				deliveries: true,
				user: true,
				verification: true
			}
		});

		if (!template) {
			return json({ error: 'Template not found' }, { status: 404 });
		}

		// Process single observation if provided
		if (eventType && !observations.length) {
			observations.push({
				type: eventType,
				source: eventDetails?.source || 'N8N observation',
				confidence: eventDetails?.confidence || 50,
				timestamp: new Date(),
				details: eventDetails
			});
		}

		// Track each observation
		const trackedObservations = [];
		let totalImpactScore = 0;
		let maxConfidence = 0;

		for (const obs of observations) {
			// Determine causal strength based on observation type
			let causalStrength = 0;
			let impactType = 'correlation';

			switch (obs.type) {
				case 'speech':
					// Direct quote in floor speech = strong causation
					if (obs.details?.verbatimQuote) {
						causalStrength = 90;
						impactType = 'direct_causation';
					} else if (obs.details?.topicMatch) {
						causalStrength = 60;
						impactType = 'topic_influence';
					} else {
						causalStrength = 30;
						impactType = 'temporal_correlation';
					}
					break;

				case 'vote':
					// Vote change after campaign = moderate causation
					if (obs.details?.previousPosition && obs.details?.newPosition) {
						causalStrength = 70;
						impactType = 'position_change';
					} else {
						causalStrength = 40;
						impactType = 'vote_alignment';
					}
					break;

				case 'amendment':
					// Amendment with template language = very strong causation
					if (obs.details?.languageMatch > 80) {
						causalStrength = 95;
						impactType = 'direct_adoption';
					} else {
						causalStrength = 50;
						impactType = 'conceptual_influence';
					}
					break;

				case 'media':
					// Media coverage mentioning campaign
					causalStrength = 40;
					impactType = 'media_amplification';
					break;

				case 'testimony':
					// Committee testimony using template points
					if (obs.details?.directReference) {
						causalStrength = 85;
						impactType = 'testimony_influence';
					} else {
						causalStrength = 55;
						impactType = 'argument_adoption';
					}
					break;
			}

			// Apply confidence modifier
			const adjustedScore = Math.floor(causalStrength * (obs.confidence / 100));
			totalImpactScore += adjustedScore;
			maxConfidence = Math.max(maxConfidence, obs.confidence);

			// Store observation
			const tracked = {
				type: obs.type,
				source: obs.source,
				confidence: obs.confidence,
				causalStrength,
				impactType,
				adjustedScore,
				timestamp: obs.timestamp,
				details: obs.details
			};

			trackedObservations.push(tracked);

			// Store in database
			await db.impactObservation?.create({
				data: {
					template_id: templateId,
					observation_type: obs.type,
					source_url: obs.source,
					confidence_score: obs.confidence,
					causal_strength: causalStrength,
					impact_type: impactType,
					legislator_id: legislatorId,
					observation_data: obs.details,
					observed_at: obs.timestamp
				}
			});
		}

		// Calculate overall impact using ImpactAgent
		const impactResult = await impactAgent.process({
			actionType: 'cwc_message',
			recipients: template.deliveries?.map((d) => d.recipient_id) || [],
			templateId,
			metadata: {
				observationCount: trackedObservations.length,
				maxCausalStrength: Math.max(...trackedObservations.map((o) => o.causalStrength)),
				totalDeliveries: template.send_count || 0
			}
		});

		// Determine if we have proven causation or just correlation
		const hasCausation = trackedObservations.some(
			(o) => o.impactType.includes('causation') || o.impactType.includes('adoption')
		);

		// Calculate creator bonus based on impact
		const creatorBonus = hasCausation
			? BigInt(10000 * 10 ** 18) * BigInt(Math.floor(maxConfidence / 10)) // Up to 100k VOTER for proven causation
			: BigInt(1000 * 10 ** 18) * BigInt(Math.floor(totalImpactScore / 100)); // Up to 10k for correlations

		// Update template impact score
		await db.template.update({
			where: { id: templateId },
			data: {
				impact_score: Math.min(
					100,
					(template.impact_score || 0) + Math.floor(totalImpactScore / 10)
				),
				last_impact_at: new Date()
			}
		});

		// Update creator rewards if causation proven
		if (hasCausation && template.user_id) {
			const user = await db.user.findUnique({
				where: { id: template.user_id }
			});

			if (user) {
				await db.user.update({
					where: { id: template.user_id },
					data: {
						pending_rewards: (user.pending_rewards || 0) + Number(creatorBonus),
						impact_score: Math.min(100, (user.impact_score || 0) + 10),
						civic_score: Math.min(100, (user.civic_score || 0) + 5)
					}
				});
			}
		}

		// Determine treasury action (for 501c4 funding)
		let treasuryAction = null;
		if (hasCausation && legislatorId) {
			// This legislator demonstrably responded to citizen input
			treasuryAction = {
				type: 'electoral_support',
				legislatorId,
				reason: 'Demonstrated responsiveness to constituent feedback',
				amount: BigInt(100000 * 10 ** 18), // 100k VOTER worth of electoral support
				confidence: maxConfidence
			};

			// Store treasury recommendation
			await db.treasuryRecommendation?.create({
				data: {
					template_id: templateId,
					legislator_id: legislatorId,
					action_type: 'electoral_support',
					amount: treasuryAction.amount.toString(),
					confidence_score: maxConfidence,
					reasoning: treasuryAction.reason,
					created_at: new Date()
				}
			});
		}

		return json({
			success: true,
			templateId,
			impact: {
				score: totalImpactScore,
				multiplier: impactResult.impactMultiplier,
				hasCausation,
				highestConfidence: maxConfidence,
				observationCount: trackedObservations.length
			},
			observations: trackedObservations,
			rewards: {
				creatorBonus: creatorBonus.toString(),
				creatorBonusFormatted: `${Number(creatorBonus) / 10 ** 18} VOTER`,
				reason: hasCausation
					? 'Proven causal impact on legislative outcome'
					: 'Correlated influence on political discourse'
			},
			treasuryAction,
			causality: {
				status: hasCausation ? 'proven' : 'correlation',
				strength: Math.max(...trackedObservations.map((o) => o.causalStrength)),
				types: [...new Set(trackedObservations.map((o) => o.impactType))],
				explanation: hasCausation
					? 'Template language or concepts directly adopted in legislative action'
					: 'Template correlated with political activity but causation not proven'
			},
			philosophy: "We don't count messages sent. We count minds changed."
		});
	} catch (_error) {
		console.error('Impact tracking error:', error);
		return json(
			{
				success: false,
				error: 'Impact tracking failed',
				details: _error.message
			},
			{ status: 500 }
		);
	}
};

// GET endpoint to retrieve impact history
export const GET: RequestHandler = async ({ url }) => {
	const templateId = url.searchParams.get('templateId');
	const legislatorId = url.searchParams.get('legislatorId');

	if (templateId) {
		// Get impact observations for specific template
		const observations = await db.impactObservation?.findMany({
			where: { template_id: templateId },
			orderBy: { observed_at: 'desc' },
			take: 50
		});

		const template = await db.template.findUnique({
			where: { id: templateId },
			select: {
				impact_score: true,
				last_impact_at: true,
				send_count: true
			}
		});

		// Categorize observations
		const byType = observations?.reduce(
			(acc, obs) => {
				acc[obs.observation_type] = (acc[obs.observation_type] || 0) + 1;
				return acc;
			},
			{} as Record<string, number>
		);

		const hasCausation = observations?.some(
			(o) => o.impact_type?.includes('causation') || o.impact_type?.includes('adoption')
		);

		return json({
			templateId,
			impactScore: template?.impact_score || 0,
			lastTracked: template?.last_impact_at,
			messagesSent: template?.send_count || 0,
			observations: observations?.length || 0,
			observationTypes: byType,
			hasCausation,
			recentObservations: observations?.slice(0, 10)
		});
	}

	if (legislatorId) {
		// Get legislator responsiveness score
		const observations = await db.impactObservation?.findMany({
			where: { legislator_id: legislatorId },
			orderBy: { observed_at: 'desc' }
		});

		const recommendations = await db.treasuryRecommendation?.findMany({
			where: { legislator_id: legislatorId }
		});

		const totalSupport = recommendations?.reduce(
			(sum, rec) => sum + BigInt(rec.amount || 0),
			BigInt(0)
		);

		return json({
			legislatorId,
			responsivenessScore: Math.min(100, observations?.length * 10),
			observationCount: observations?.length || 0,
			treasurySupport: totalSupport?.toString() || '0',
			supportFormatted: `${Number(totalSupport || 0) / 10 ** 18} VOTER`,
			recommendationCount: recommendations?.length || 0
		});
	}

	// Return general impact stats
	const totalObservations = await db.impactObservation?.count();
	const causationCount = await db.impactObservation?.count({
		where: {
			OR: [{ impact_type: { contains: 'causation' } }, { impact_type: { contains: 'adoption' } }]
		}
	});

	return json({
		status: 'active',
		totalObservations: totalObservations || 0,
		provenCausations: causationCount || 0,
		philosophy: "We don't count messages sent. We count minds changed.",
		message: 'Impact tracking system operational'
	});
};
