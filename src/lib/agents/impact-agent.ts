/**
 * ImpactAgent - Legislative Influence Tracking
 * 
 * Core vision: "We don't count messages. We count minds changed."
 * 
 * Tracks template influence on legislative behavior, identifies causal chains
 * from civic information to political outcomes, enables treasury funding
 * of responsive legislators.
 */

import { BaseAgent, AgentType, AgentContext, AgentDecision } from './base-agent.js';
import { prisma } from '$lib/core/db.js';

export interface ImpactAssessment {
	templateId: string;
	legislativeOutcomes: LegislativeOutcome[];
	impactScore: number; // 0-100 scale
	confidenceLevel: 'high' | 'medium' | 'low';
	causalChains: CausalChain[];
	correlationStrength: number; // 0-1 scale
	recommendedFunding?: number; // USD amount for responsive legislators
}

export interface LegislativeOutcome {
	type: 'floor_speech' | 'committee_testimony' | 'vote_change' | 'amendment_adoption' | 'position_evolution';
	legislator: {
		name: string;
		state: string;
		chamber: 'house' | 'senate';
		party?: string;
	};
	content?: string; // Text that matches template
	timestamp: Date;
	source: string; // Congressional Record, committee transcript, etc.
	matchStrength: number; // How closely it matches template content
}

export interface CausalChain {
	sequence: string[];
	strength: 'proven' | 'strong' | 'moderate' | 'weak';
	description: string;
	evidenceLinks: string[];
}

export class ImpactAgent extends BaseAgent {
	constructor() {
		super('impact-agent-v1', AgentType.IMPACT, {
			minImpactScore: [0, 20],        // Minimum score for funding consideration
			maxCorrelationAge: [7, 90],     // Max days to track correlations
			confidenceThreshold: [0.6, 0.9], // Minimum confidence for action
			fundingMultiplier: [100, 10000]  // USD per impact point
		});
	}

	async makeDecision(context: AgentContext): Promise<AgentDecision> {
		try {
			// Get template impact data
			const impactAssessment = await this.assessTemplateImpact(
				context.templateId!, 
				context.timestamp
			);
			
			// Track legislative outcomes
			const outcomes = await this.trackLegislativeOutcomes(context.templateId!);
			
			// Build causal chains
			const causalChains = await this.buildCausalChains(context.templateId!, outcomes);
			
			// Calculate impact score
			const impactScore = this.calculateImpactScore(outcomes, causalChains);
			
			// Determine confidence level
			const confidenceLevel = this.determineConfidenceLevel(outcomes, causalChains);
			
			// Calculate funding recommendation
			const recommendedFunding = this.calculateFundingRecommendation(
				impactScore, 
				confidenceLevel, 
				outcomes
			);
			
			const assessment: ImpactAssessment = {
				templateId: context.templateId!,
				legislativeOutcomes: outcomes,
				impactScore,
				confidenceLevel,
				causalChains,
				correlationStrength: this.calculateCorrelationStrength(outcomes),
				recommendedFunding
			};
			
			const confidence = this.assessDecisionConfidence(assessment, context);
			
			return this.createDecision(
				assessment,
				confidence,
				this.generateImpactReasoning(assessment, outcomes),
				{ templateId: context.templateId, impactDetected: impactScore > 0 }
			);
			
		} catch (error) {
			console.error('ImpactAgent decision error:', error);
			return this.createDecision(
				{ templateId: context.templateId, impactScore: 0, confidenceLevel: 'low' },
				0.2,
				`Error in impact assessment: ${error instanceof Error ? error.message : 'Unknown error'}`,
				{ error: true }
			);
		}
	}

	private async assessTemplateImpact(templateId: string, timestamp?: string): Promise<ImpactAssessment> {
		// Get template content for matching
		const template = await prisma.template.findUnique({
			where: { id: templateId },
			select: { 
				title: true, 
				message_body: true,
				subject: true,
				created_at: true
			}
		});

		if (!template) {
			throw new Error(`Template ${templateId} not found`);
		}

		// Get usage statistics
		const usageCount = await prisma.civicAction.count({
			where: {
				template_id: templateId,
				action_type: 'cwc_message'
			}
		});

		// Extract key phrases for legislative monitoring
		const keyPhrases = this.extractKeyPhrases(template.message_body);

		// Mock legislative tracking - in production would integrate with:
		// - Congressional Record API
		// - Committee transcript monitoring
		// - Legislative tracking services
		// - Media monitoring APIs
		const outcomes = await this.mockLegislativeTracking(keyPhrases, templateId);

		return {
			templateId,
			legislativeOutcomes: outcomes,
			impactScore: 0, // Will be calculated
			confidenceLevel: 'medium',
			causalChains: [],
			correlationStrength: 0
		};
	}

	private async trackLegislativeOutcomes(templateId: string): Promise<LegislativeOutcome[]> {
		// In production, this would integrate with:
		// - Congress.gov API
		// - Legislative tracking services
		// - Media monitoring APIs
		// - Congressional Record parsing

		// For now, simulate with database queries and mock data
		const template = await prisma.template.findUnique({
			where: { id: templateId },
			select: { message_body: true, title: true }
		});

		if (!template) return [];

		// Extract key phrases that might appear in legislative content
		const keyPhrases = this.extractKeyPhrases(template.message_body);

		// Mock outcomes - in production would be real legislative monitoring
		return this.generateMockLegislativeOutcomes(keyPhrases);
	}

	private async buildCausalChains(templateId: string, outcomes: LegislativeOutcome[]): Promise<CausalChain[]> {
		const chains: CausalChain[] = [];

		// Get template usage timeline
		const actions = await prisma.civicAction.findMany({
			where: { 
				template_id: templateId,
				action_type: 'cwc_message' 
			},
			orderBy: { created_at: 'asc' },
			take: 100
		});

		if (actions.length === 0 || outcomes.length === 0) return chains;

		// Build causal chains based on timing and content
		for (const outcome of outcomes) {
			const relevantActions = actions.filter(action => 
				outcome.timestamp > action.created_at &&
				(outcome.timestamp.getTime() - action.created_at.getTime()) < (30 * 24 * 60 * 60 * 1000) // 30 days
			);

			if (relevantActions.length > 0) {
				const sequence = [
					`Template usage: ${relevantActions.length} messages sent`,
					`Timeline: Actions ${this.formatDateRange(relevantActions)}`,
					`Legislative outcome: ${outcome.type} by ${outcome.legislator.name}`,
					`Content match: ${outcome.matchStrength * 100}% similarity`
				];

				const strength = this.determineCausalStrength(outcome, relevantActions.length);
				
				chains.push({
					sequence,
					strength,
					description: this.describeCausalChain(outcome, relevantActions.length),
					evidenceLinks: [`template:${templateId}`, `outcome:${outcome.type}`]
				});
			}
		}

		return chains;
	}

	private calculateImpactScore(outcomes: LegislativeOutcome[], causalChains: CausalChain[]): number {
		let score = 0;

		// Score based on outcome types (weighted by importance)
		const outcomeWeights = {
			floor_speech: 20,      // High visibility
			committee_testimony: 15, // Formal record
			vote_change: 40,       // Actual policy change
			amendment_adoption: 35, // Direct policy influence
			position_evolution: 25  // Measurable shift
		};

		for (const outcome of outcomes) {
			const baseScore = outcomeWeights[outcome.type] || 10;
			const matchBonus = outcome.matchStrength * 20; // Up to 20 bonus points
			score += baseScore + matchBonus;
		}

		// Bonus for strong causal chains
		const strongChains = causalChains.filter(c => c.strength === 'proven' || c.strength === 'strong');
		score += strongChains.length * 15;

		// Cap at 100 and apply safety bounds
		return this.applySafetyBounds(Math.min(100, score), 'minImpactScore');
	}

	private determineConfidenceLevel(outcomes: LegislativeOutcome[], causalChains: CausalChain[]): 'high' | 'medium' | 'low' {
		const provenChains = causalChains.filter(c => c.strength === 'proven').length;
		const strongChains = causalChains.filter(c => c.strength === 'strong').length;
		const highMatchOutcomes = outcomes.filter(o => o.matchStrength > 0.8).length;

		if (provenChains > 0 || (strongChains > 1 && highMatchOutcomes > 1)) {
			return 'high';
		} else if (strongChains > 0 || highMatchOutcomes > 0) {
			return 'medium';
		} else {
			return 'low';
		}
	}

	private calculateFundingRecommendation(
		impactScore: number, 
		confidenceLevel: 'high' | 'medium' | 'low',
		outcomes: LegislativeOutcome[]
	): number {
		if (impactScore < 20 || confidenceLevel === 'low') return 0;

		const baseMultiplier = this.applySafetyBounds(500, 'fundingMultiplier'); // $500 per impact point
		const confidenceMultiplier = confidenceLevel === 'high' ? 1.5 : confidenceLevel === 'medium' ? 1.0 : 0.5;
		
		// Bonus for responsive legislators who actually changed positions
		const responsiveLegislators = outcomes.filter(o => 
			o.type === 'vote_change' || o.type === 'position_evolution'
		).length;

		const responsiveBonus = responsiveLegislators * 1000; // $1000 per responsive legislator

		return Math.round((impactScore * baseMultiplier * confidenceMultiplier) + responsiveBonus);
	}

	private calculateCorrelationStrength(outcomes: LegislativeOutcome[]): number {
		if (outcomes.length === 0) return 0;

		// Average match strength weighted by outcome importance
		const weights = {
			floor_speech: 0.6,
			committee_testimony: 0.7,
			vote_change: 1.0,
			amendment_adoption: 0.9,
			position_evolution: 0.8
		};

		const totalWeight = outcomes.reduce((sum, o) => sum + (weights[o.type] || 0.5), 0);
		const weightedScore = outcomes.reduce((sum, o) => 
			sum + (o.matchStrength * (weights[o.type] || 0.5)), 0
		);

		return totalWeight > 0 ? weightedScore / totalWeight : 0;
	}

	private extractKeyPhrases(messageBody: string): string[] {
		// Simple phrase extraction - in production would use NLP
		const phrases = messageBody
			.split(/[.!?]+/)
			.map(s => s.trim())
			.filter(s => s.length > 20 && s.length < 200)
			.slice(0, 5); // Top 5 key phrases

		return phrases;
	}

	private async mockLegislativeTracking(keyPhrases: string[], templateId: string): Promise<LegislativeOutcome[]> {
		// Mock legislative outcomes - in production would be real API calls
		const outcomes: LegislativeOutcome[] = [];

		// Simulate finding template phrases in legislative record
		if (Math.random() > 0.7) { // 30% chance of finding outcomes
			outcomes.push({
				type: 'floor_speech',
				legislator: {
					name: 'Rep. Sample',
					state: 'CA',
					chamber: 'house',
					party: 'Democratic'
				},
				content: keyPhrases[0]?.substring(0, 100) + '...',
				timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
				source: 'Congressional Record',
				matchStrength: 0.75 + Math.random() * 0.25
			});
		}

		if (Math.random() > 0.85) { // 15% chance of vote changes
			outcomes.push({
				type: 'vote_change',
				legislator: {
					name: 'Sen. Example',
					state: 'TX',
					chamber: 'senate',
					party: 'Republican'
				},
				timestamp: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000),
				source: 'Senate Voting Record',
				matchStrength: 0.85
			});
		}

		return outcomes;
	}

	private generateMockLegislativeOutcomes(keyPhrases: string[]): LegislativeOutcome[] {
		// Simulate legislative monitoring results
		return []; // Will be filled by mockLegislativeTracking
	}

	private determineCausalStrength(outcome: LegislativeOutcome, actionCount: number): 'proven' | 'strong' | 'moderate' | 'weak' {
		if (outcome.matchStrength > 0.9 && actionCount > 100) return 'proven';
		if (outcome.matchStrength > 0.8 && actionCount > 50) return 'strong';
		if (outcome.matchStrength > 0.6 && actionCount > 10) return 'moderate';
		return 'weak';
	}

	private describeCausalChain(outcome: LegislativeOutcome, actionCount: number): string {
		return `${actionCount} template-based messages preceded ${outcome.legislator.name}'s ${outcome.type} ` +
			   `with ${(outcome.matchStrength * 100).toFixed(1)}% content similarity`;
	}

	private formatDateRange(actions: any[]): string {
		if (actions.length === 0) return '';
		const earliest = new Date(Math.min(...actions.map(a => a.created_at.getTime())));
		const latest = new Date(Math.max(...actions.map(a => a.created_at.getTime())));
		return `${earliest.toLocaleDateString()} - ${latest.toLocaleDateString()}`;
	}

	private assessDecisionConfidence(assessment: ImpactAssessment, context: AgentContext): number {
		let confidence = 0.5; // Base confidence

		// Higher confidence with more outcomes
		if (assessment.legislativeOutcomes.length > 0) confidence += 0.2;
		if (assessment.legislativeOutcomes.length > 2) confidence += 0.1;

		// Higher confidence with strong causal chains
		const strongChains = assessment.causalChains.filter(c => 
			c.strength === 'proven' || c.strength === 'strong'
		).length;
		confidence += strongChains * 0.1;

		// Higher confidence with high match strength
		const avgMatchStrength = assessment.legislativeOutcomes.length > 0 ?
			assessment.legislativeOutcomes.reduce((sum, o) => sum + o.matchStrength, 0) / assessment.legislativeOutcomes.length : 0;
		confidence += avgMatchStrength * 0.2;

		return Math.min(1.0, Math.max(0.1, confidence));
	}

	private generateImpactReasoning(assessment: ImpactAssessment, outcomes: LegislativeOutcome[]): string {
		const { impactScore, confidenceLevel, causalChains } = assessment;

		if (impactScore === 0) {
			return `No legislative impact detected for template ${assessment.templateId}. ` +
				   `Monitoring continues for future outcomes.`;
		}

		const strongChains = causalChains.filter(c => c.strength === 'proven' || c.strength === 'strong');
		const responsiveOutcomes = outcomes.filter(o => o.type === 'vote_change' || o.type === 'position_evolution');

		return `Impact detected: Score ${impactScore}/100 with ${confidenceLevel} confidence. ` +
			   `Found ${outcomes.length} legislative outcomes, ${strongChains.length} strong causal chains. ` +
			   `${responsiveOutcomes.length} legislators showed responsive position changes. ` +
			   `${assessment.recommendedFunding ? `Recommended funding: $${assessment.recommendedFunding.toLocaleString()}` : 'No funding recommended.'}`;
	}
}