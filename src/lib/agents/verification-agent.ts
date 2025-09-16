/**
 * Verification Agent
 * 
 * Handles template verification and correction
 * Uses LLMs to check for grammar, clarity, and policy violations
 */

import { BaseAgent, type AgentConfig, type AgentDecision } from './base-agent';
import type { Template } from '$lib/types/template';

export interface VerificationInput {
	template: Template;
	checkGrammar?: boolean;
	checkPolicy?: boolean;
	checkFactuality?: boolean;
}

export interface VerificationResult extends AgentDecision {
	approved: boolean;
	corrections?: {
		subject?: string;
		body?: string;
	};
	severityLevel: number; // 1-10
	violations?: string[];
}

export class VerificationAgent extends BaseAgent {
	constructor() {
		super({
			name: 'verification_agent',
			temperature: 0.1, // Low temperature for accuracy
			maxTokens: 500,
			capabilities: ['identity_verification', 'action_validation', 'fraud_detection'],
			workflowPrefix: 'verification'
		});
	}
	
	async process(input: VerificationInput): Promise<VerificationResult> {
		const { template, checkGrammar = true, checkPolicy = true } = input;
		
		try {
			// Use N8N workflow for comprehensive verification
			const verificationResult = await this.callLLMWorkflow('comprehensive', {
				template: {
					id: template.id,
					subject: template.subject,
					message_body: template.message_body
				},
				checks: {
					grammar: checkGrammar,
					policy: checkPolicy,
					factuality: input.checkFactuality || false
				},
				criteria: {
					grammar_threshold: 3,
					policy_threshold: 7,
					auto_approve_below: 7
				}
			});
			
			return {
				decision: verificationResult.approved ? 'approved' : 'requires_review',
				confidence: verificationResult.confidence || 0.85,
				reasoning: verificationResult.reasoning || [],
				approved: verificationResult.approved,
				corrections: verificationResult.corrections,
				severityLevel: verificationResult.severity_level || 1,
				violations: verificationResult.violations
			};
			
		} catch (error) {
			console.error('Verification workflow error:', error);
			// Fallback to local verification
			return this.fallbackVerification(input);
		}
	}
	
	async validate(input: any): Promise<boolean> {
		return input?.template && typeof input.template === 'object';
	}
	
	/**
	 * Fallback verification when N8N workflows are unavailable
	 */
	private async fallbackVerification(input: VerificationInput): Promise<VerificationResult> {
		const { template, checkGrammar = true, checkPolicy = true } = input;
		
		// Stage 1: Grammar and clarity check
		let corrections = {};
		let severityLevel = 1;
		let violations: string[] = [];
		
		if (checkGrammar) {
			const grammarCheck = await this.checkGrammar(template);
			if (grammarCheck.corrections) {
				corrections = grammarCheck.corrections;
				severityLevel = Math.max(severityLevel, 3); // Grammar issues are low severity
			}
		}
		
		if (checkPolicy) {
			const policyCheck = await this.checkPolicy(template);
			if (policyCheck.violations.length > 0) {
				violations = policyCheck.violations;
				severityLevel = policyCheck.severityLevel;
			}
		}
		
		// Determine approval based on severity
		const approved = severityLevel < 7; // Auto-approve below severity 7
		
		return {
			decision: approved ? 'approved' : 'requires_review',
			confidence: 0.85,
			reasoning: [
				`Template severity level: ${severityLevel}`,
				violations.length > 0 ? `Violations found: ${violations.join(', ')}` : 'No violations found',
				'[Fallback verification used]'
			],
			approved,
			corrections: Object.keys(corrections).length > 0 ? corrections : undefined,
			severityLevel,
			violations: violations.length > 0 ? violations : undefined
		};
	}
	
	private async checkGrammar(template: Template): Promise<{
		corrections?: { subject?: string; body?: string };
	}> {
		// Simple grammar check - in production would call GPT-4 or similar
		const corrections: any = {};
		
		// Check for basic issues
		if (template.subject) {
			// Capitalize first letter
			if (template.subject[0] !== template.subject[0].toUpperCase()) {
				corrections.subject = template.subject[0].toUpperCase() + template.subject.slice(1);
			}
		}
		
		if (template.message_body) {
			// Check for double spaces
			if (template.message_body.includes('  ')) {
				corrections.body = template.message_body.replace(/\s+/g, ' ');
			}
		}
		
		return { corrections: Object.keys(corrections).length > 0 ? corrections : undefined };
	}
	
	private async checkPolicy(template: Template): Promise<{
		violations: string[];
		severityLevel: number;
	}> {
		const violations: string[] = [];
		let severityLevel = 1;
		
		const bodyLower = (template.message_body || '').toLowerCase();
		const subjectLower = (template.subject || '').toLowerCase();
		const combined = `${subjectLower} ${bodyLower}`;
		
		// Check for severe violations
		const severePatterns = [
			{ pattern: /\bkill\b|\bmurder\b|\bviolence\b/i, violation: 'threats', severity: 9 },
			{ pattern: /\bhate\b.*\b(group|race|religion)\b/i, violation: 'hate_speech', severity: 8 },
			{ pattern: /\bscam\b|\bphishing\b/i, violation: 'malicious_content', severity: 8 }
		];
		
		for (const { pattern, violation, severity } of severePatterns) {
			if (pattern.test(combined)) {
				violations.push(violation);
				severityLevel = Math.max(severityLevel, severity);
			}
		}
		
		// Check for moderate issues
		const moderatePatterns = [
			{ pattern: /\b(spam|click here|buy now)\b/i, violation: 'spam_patterns', severity: 5 },
			{ pattern: /\b(conspiracy|fake news)\b/i, violation: 'potential_misinformation', severity: 6 }
		];
		
		for (const { pattern, violation, severity } of moderatePatterns) {
			if (pattern.test(combined)) {
				violations.push(violation);
				severityLevel = Math.max(severityLevel, severity);
			}
		}
		
		return { violations, severityLevel };
	}
	
	/**
	 * Get corrected content for a template
	 */
	async getCorrectedContent(template: Template): Promise<{
		subject?: string;
		body?: string;
	}> {
		const result = await this.process({ template, checkGrammar: true, checkPolicy: false });
		return result.corrections || {};
	}
	
	/**
	 * Check if template needs consensus review
	 */
	needsConsensusReview(severityLevel: number): boolean {
		return severityLevel >= 7;
	}
}