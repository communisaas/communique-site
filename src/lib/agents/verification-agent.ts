/**
 * VerificationAgent - Multi-Source Identity Verification
 *
 * Core vision: "Authentic democracy through verifiable identity, not surveillance"
 *
 * Coordinates identity verification across multiple sources to establish
 * democratic authenticity while preserving privacy. Integrates with Didit.me
 * for zero-knowledge identity verification and on-chain attestations.
 */

import { BaseAgent, AgentType } from './base-agent';
import type { AgentContext, AgentDecision, AgentCapability } from './base-agent';
import type { VerificationDecision } from './type-guards';
import { db, prisma } from '$lib/core/db';

export interface VerificationAssessment {
	userId: string;
	verificationLevel: 'unverified' | 'partial' | 'verified' | 'high_assurance';
	trustScore: number; // 0-1000 scale
	verificationSources: VerificationSource[];
	riskFactors: string[];
	recommendedActions: string[];
	zkProofHash?: string;
	districtVerification?: {
		congressionalDistrict: string;
		confidence: number;
		source: string;
	};
}

export interface VerificationSource {
	provider: 'didit' | 'manual_review' | 'blockchain_history';
	type: 'kyc' | 'zk_proof' | 'address_verification' | 'behavioral_analysis';
	score: number; // 0-100
	confidence: number; // 0-1
	timestamp: Date;
	metadata: unknown;
}

export class VerificationAgent extends BaseAgent {
	constructor() {
		super('verification-agent-v1', AgentType.VERIFICATION, {
			minTrustScore: [0, 100], // Minimum trust score for basic verification
			zkProofWeight: [0.3, 0.8], // Weight given to ZK proofs
			kycWeight: [0.4, 0.9], // Weight given to KYC verification
			behavioralWeight: [0.1, 0.5], // Weight given to behavioral analysis
			maxRiskTolerance: [0.2, 0.7] // Maximum acceptable risk level
		});
	}

	getCapabilities(): AgentCapability {
		return {
			type: AgentType.VERIFICATION,
			description: 'Multi-source identity verification for democratic authenticity',
			capabilities: [
				'identity_verification',
				'trust_score_calculation',
				'risk_assessment',
				'zk_proof_validation'
			],
			decisionTypes: ['verification_assessment', 'trust_scoring'],
			requiredContext: ['userId']
		};
	}

	async makeDecision(context: AgentContext): Promise<AgentDecision<VerificationAssessment>> {
		try {
			// Check if this is template verification mode
			if (context.actionType === 'verify' && context.parameters?.template) {
				return await this.performTemplateVerification(context);
			}

			// Standard user verification mode
			// Get existing user verification data
			const verificationData = await this.gatherVerificationData(context.userId!);

			// Analyze verification sources
			const sourceAnalysis = this.analyzeVerificationSources(verificationData.sources);

			// Calculate trust score
			const trustScore = this.calculateTrustScore(verificationData.sources);

			// Determine verification level
			const verificationLevel = this.determineVerificationLevel(trustScore, sourceAnalysis);

			// Identify risk factors
			const riskFactors = this.identifyRiskFactors(verificationData, sourceAnalysis);

			// Generate recommendations
			const recommendedActions = this.generateRecommendations(
				verificationLevel,
				riskFactors,
				verificationData
			);

			const assessment: VerificationAssessment = {
				userId: context.userId!,
				verificationLevel,
				trustScore: this.applySafetyBounds(trustScore, 'minTrustScore'),
				verificationSources: verificationData.sources,
				riskFactors,
				recommendedActions,
				zkProofHash: verificationData.zkProofHash,
				districtVerification: verificationData.districtVerification as
					| { congressionalDistrict: string; confidence: number; source: string }
					| undefined
			};

			const confidence = this.assessDecisionConfidence(assessment, sourceAnalysis);

			return this.createDecision(
				assessment,
				confidence,
				this.generateVerificationReasoning(assessment, sourceAnalysis),
				{
					userId: context.userId,
					sourcesCount: verificationData.sources.length,
					verificationLevel
				}
			);
		} catch (_error) {
			console.error('VerificationAgent decision error:', _error);
			return this.createDecision(
				{
					userId: context.userId,
					verificationLevel: 'unverified',
					trustScore: 0,
					verificationSources: [],
					riskFactors: ['verification_system_error'],
					recommendedActions: ['retry_verification']
				},
				0.1,
				`Error in verification assessment: ${_error instanceof Error ? _error.message : 'Unknown error'}`,
				{ error: true }
			);
		}
	}

	private async gatherVerificationData(userId: string): Promise<{
		sources: VerificationSource[];
		zkProofHash?: string;
		districtVerification?: unknown;
	}> {
		const user = await db.user.findUnique({
			where: { id: userId },
			select: {
				verification_data: true,
				verification_method: true,
				verified_at: true,
				congressional_district: true
			}
		});

		if (!user) {
			throw new Error(`User ${userId} not found`);
		}

		const sources: VerificationSource[] = [];

		// Add KYC verification source if available
		if (user.verification_data && user.verification_method === 'didit') {
			const kycData = user.verification_data as any;
			sources.push({
				provider: 'didit',
				type: 'kyc',
				score: kycData.confidence ? Math.round(kycData.confidence * 100) : 60,
				confidence: kycData.confidence || 0.6,
				timestamp: user.verified_at || new Date(),
				metadata: {
					addressVerified: kycData.addressData ? true : false,
					documentTypes: kycData.documentTypes || [],
					faceMatch: kycData.faceMatch || false
				}
			});
		}

		// Behavioral analysis and blockchain history analysis disabled
		// due to missing database schema fields (civicActions, walletAddress)

		return {
			sources,
			districtVerification: user.congressional_district
				? {
						congressionalDistrict: user.congressional_district,
						confidence: 0.8,
						source: 'address_verification'
					}
				: undefined
		};
	}

	private analyzeVerificationSources(sources: VerificationSource[]): {
		kycPresent: boolean;
		zkProofPresent: boolean;
		behavioralDataPresent: boolean;
		sourceCount: number;
		averageConfidence: number;
		highestScore: number;
	} {
		return {
			kycPresent: sources.some((s) => s.type === 'kyc'),
			zkProofPresent: sources.some((s) => s.type === 'zk_proof'),
			behavioralDataPresent: sources.some((s) => s.type === 'behavioral_analysis'),
			sourceCount: sources.length,
			averageConfidence:
				sources.length > 0 ? sources.reduce((sum, s) => sum + s.confidence, 0) / sources.length : 0,
			highestScore: sources.length > 0 ? Math.max(...sources.map((s) => s.score)) : 0
		};
	}

	private calculateTrustScore(sources: VerificationSource[]): number {
		if (sources.length === 0) return 0;

		let score = 0;
		const weights = {
			kyc: this.applySafetyBounds(0.6, 'kycWeight'),
			zk_proof: this.applySafetyBounds(0.5, 'zkProofWeight'),
			address_verification: 0.4,
			behavioral_analysis: this.applySafetyBounds(0.3, 'behavioralWeight')
		};

		for (const source of sources) {
			const weight = weights[source.type] || 0.2;
			const weightedScore = (source.score / 100) * weight * source.confidence;
			score += weightedScore;
		}

		// Bonus for multiple verification sources
		const diversityBonus = Math.min(0.2, (sources.length - 1) * 0.05);
		score += diversityBonus;

		// Convert to 0-1000 scale
		return Math.round(Math.min(1000, score * 1000));
	}

	private determineVerificationLevel(
		trustScore: number,
		analysis: { kycPresent: boolean; zkProofPresent: boolean; behavioralDataPresent: boolean }
	): 'unverified' | 'partial' | 'verified' | 'high_assurance' {
		if (trustScore >= 800 && analysis.kycPresent && analysis.behavioralDataPresent) {
			return 'high_assurance';
		} else if (trustScore >= 600 && analysis.kycPresent) {
			return 'verified';
		} else if (trustScore >= 300 && (analysis.kycPresent || analysis.behavioralDataPresent)) {
			return 'partial';
		} else {
			return 'unverified';
		}
	}

	private identifyRiskFactors(verificationData: unknown, analysis: any): string[] {
		const risks: string[] = [];

		if (!analysis.kycPresent) risks.push('no_kyc_verification');
		if (!analysis.behavioralDataPresent) risks.push('insufficient_behavioral_data');
		if (analysis.sourceCount < 2) risks.push('single_source_dependency');
		if (analysis.averageConfidence < 0.5) risks.push('low_confidence_sources');

		return risks;
	}

	private generateRecommendations(
		level: string,
		risks: string[],
		verificationData: unknown
	): string[] {
		const recommendations: string[] = [];

		if (level === 'unverified') {
			recommendations.push('complete_kyc_verification');
			recommendations.push('connect_wallet_address');
		}

		if (risks.includes('no_kyc_verification')) {
			recommendations.push('complete_didit_kyc');
		}

		if (risks.includes('insufficient_behavioral_data')) {
			recommendations.push('increase_civic_engagement');
		}

		if (level === 'partial') {
			recommendations.push('add_additional_verification_source');
		}

		return recommendations;
	}

	private analyzeBehavioralPatterns(actions: unknown[]): number {
		if (actions.length === 0) return 0;

		let score = Math.min(50, actions.length * 5); // Base score from action count

		// Consistent action types indicate authentic engagement
		const actionTypes = new Set(actions.map((a: any) => a.actionType));
		if (actionTypes.size > 1) score += 10;

		// Regular activity over time
		const timeSpan = this.calculateEngagementTimeSpan(actions);
		if (timeSpan > 7) score += 10; // More than a week of activity
		if (timeSpan > 30) score += 10; // More than a month of activity

		// Successful completions
		const successfulActions = actions.filter((a: any) => a.status === 'completed').length;
		const successRate = successfulActions / actions.length;
		score += Math.round(successRate * 20);

		return Math.min(100, score);
	}

	private checkBehaviorConsistency(actions: unknown[]): boolean {
		// Simple consistency check - more sophisticated logic would analyze patterns
		return actions.filter((a: any) => a.status === 'completed').length / actions.length > 0.8;
	}

	private calculateEngagementTimeSpan(actions: unknown[]): number {
		if (actions.length < 2) return 0;

		const dates = actions.map((a: any) => new Date(a.createdAt).getTime()).sort();
		return Math.round((dates[dates.length - 1] - dates[0]) / (24 * 60 * 60 * 1000)); // Days
	}

	private async analyzeBlockchainHistory(walletAddress: string): Promise<number> {
		// Mock blockchain analysis - in production would analyze on-chain behavior
		// Look for: transaction history, contract interactions, token holdings, etc.

		// For now, return a modest score indicating some blockchain presence
		return Math.random() > 0.5 ? 40 : 20;
	}

	private assessDecisionConfidence(assessment: VerificationAssessment, analysis: any): number {
		let confidence = 0.5; // Base confidence

		// Higher confidence with more sources
		confidence += Math.min(0.3, analysis.sourceCount * 0.1);

		// Higher confidence with KYC
		if (analysis.kycPresent) confidence += 0.2;

		// Higher confidence with behavioral data
		if (analysis.behavioralDataPresent) confidence += 0.1;

		// Higher confidence with high average source confidence
		confidence += analysis.averageConfidence * 0.2;

		return Math.min(1.0, Math.max(0.1, confidence));
	}

	private generateVerificationReasoning(assessment: VerificationAssessment, analysis: any): string {
		const { trustScore, verificationLevel, verificationSources, riskFactors } = assessment;

		return (
			`Verification assessment: ${verificationLevel} level with trust score ${trustScore}/1000. ` +
			`Analyzed ${verificationSources.length} sources: ${analysis.kycPresent ? 'KYC verified' : 'no KYC'}, ` +
			`${analysis.behavioralDataPresent ? 'behavioral data present' : 'limited behavioral data'}. ` +
			`${riskFactors.length > 0 ? `Risk factors: ${riskFactors.join(', ')}. ` : ''}` +
			`Average source confidence: ${(analysis.averageConfidence * 100).toFixed(1)}%.`
		);
	}

	/**
	 * Template verification mode - verifies template content for policy compliance
	 */
	private async performTemplateVerification(context: AgentContext): Promise<AgentDecision> {
		const template = context.parameters?.template as any;
		if (!template) {
			throw new Error('Template required for template verification mode');
		}

		// Simple template verification logic
		const subject = template.subject || template.title || '';
		const body = template.message_body || '';
		
		// Check for severity level factors
		let severityLevel = 1;
		const violations: string[] = [];
		const corrections: Record<string, any> = {};

		// Check for inflammatory language
		const inflammatoryPatterns = [
			/violent|violence|attack|destroy|kill/i,
			/hate|hatred|despise|loathe/i,
			/communist|socialist|radical|extremist/i,
		];
		
		for (const pattern of inflammatoryPatterns) {
			if (pattern.test(subject) || pattern.test(body)) {
				severityLevel = Math.max(severityLevel, 7);
				violations.push('inflammatory_language');
				break;
			}
		}

		// Check for profanity
		const profanityPatterns = [/damn|hell|shit|crap/i];
		for (const pattern of profanityPatterns) {
			if (pattern.test(subject) || pattern.test(body)) {
				severityLevel = Math.max(severityLevel, 3);
				violations.push('profanity');
				break;
			}
		}

		// Check for policy compliance
		if (body.length > 5000) {
			severityLevel = Math.max(severityLevel, 2);
			violations.push('excessive_length');
			corrections.body = body.substring(0, 4900) + '...';
		}

		if (subject.length > 200) {
			severityLevel = Math.max(severityLevel, 2);
			violations.push('long_subject');
			corrections.subject = subject.substring(0, 190) + '...';
		}

		// Determine approval based on severity
		const approved = severityLevel < 7;
		const confidence = approved ? 0.8 : 0.3;

		const verificationDecision = {
			approved,
			corrections,
			severityLevel,
			violations
		};

		return this.createDecision(
			verificationDecision,
			confidence,
			`Template verification: ${approved ? 'APPROVED' : 'REJECTED'}. Severity level: ${severityLevel}. ${violations.length > 0 ? `Violations: ${violations.join(', ')}.` : ''} ${Object.keys(corrections).length > 0 ? `Corrections suggested for: ${Object.keys(corrections).join(', ')}.` : ''}`,
			{
				templateId: template.id,
				templateVerification: true,
				severityLevel,
				violationCount: violations.length
			}
		);
	}
}
