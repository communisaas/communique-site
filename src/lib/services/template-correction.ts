/**
 * Template Auto-Correction Service
 *
 * Handles Stage 1 of template moderation:
 * - Auto-corrects minor issues (severity levels 1-6)
 * - Grammar, formatting, clarity improvements
 * - Updates templates in database with corrections
 */

import { db } from '$lib/core/db';
import type { Template, TemplateVerification } from '@prisma/client';

interface CorrectionResult {
	severity: number;
	corrected_body: string;
	corrected_subject: string;
	changes: CorrectionChange[];
	scores: {
		grammar: number;
		clarity: number;
		completeness: number;
	};
}

interface CorrectionChange {
	type: 'grammar' | 'formatting' | 'clarity' | 'completeness';
	original: string;
	corrected: string;
	reason: string;
}

export class TemplateCorrector {
	/**
	 * Process a template verification for auto-correction
	 */
	async processVerification(verificationId: string) {
		const verification = await db.templateVerification.findUnique({
			where: { id: verificationId },
			include: {
				template: true
			}
		});

		if (!verification) {
			throw new Error(`Verification ${verificationId} not found`);
		}

		// Store original content before any modifications
		await db.templateVerification.update({
			where: { id: verificationId },
			data: {
				original_content: {
					message_body: verification.template.message_body,
					subject: verification.template.subject,
					preview: verification.template.preview
				}
			}
		});

		// Detect issues and apply corrections
		const corrections = await this.detectAndCorrect(verification.template);

		// Handle based on severity
		if (corrections.severity <= 6) {
			// Apply corrections to template
			await db.template.update({
				where: { id: verification.template_id },
				data: {
					message_body: corrections.corrected_body,
					subject: corrections.corrected_subject
				}
			});

			// Update verification record with correction details
			await db.templateVerification.update({
				where: { id: verificationId },
				data: {
					correction_log: corrections.changes,
					grammar_score: corrections.scores.grammar,
					clarity_score: corrections.scores.clarity,
					completeness_score: corrections.scores.completeness,
					quality_score: Math.round(
						(corrections.scores.grammar +
							corrections.scores.clarity +
							corrections.scores.completeness) /
							3
					),
					corrected_at: new Date(),
					severity_level: corrections.severity,
					moderation_status: 'approved' // Auto-approve after correction
				}
			});

			return {
				status: 'corrected',
				proceed: false, // No need for further moderation
				severity: corrections.severity
			};
		}

		// Severity 7+ requires manual moderation
		await db.templateVerification.update({
			where: { id: verificationId },
			data: {
				severity_level: corrections.severity,
				moderation_status: 'reviewing'
			}
		});

		return {
			status: 'needs_moderation',
			proceed: true,
			severity: corrections.severity
		};
	}

	/**
	 * Detect issues and generate corrections
	 */
	private async detectAndCorrect(template: Template): Promise<CorrectionResult> {
		const changes: CorrectionChange[] = [];
		let correctedBody = template.message_body;
		let correctedSubject = template.subject || '';

		// Grammar corrections
		const grammarResult = this.correctGrammar(correctedBody);
		if (grammarResult.changed) {
			correctedBody = grammarResult.text;
			changes.push(...grammarResult.changes);
		}

		// Formatting standardization
		const formattingResult = this.standardizeFormatting(correctedBody);
		if (formattingResult.changed) {
			correctedBody = formattingResult.text;
			changes.push(...formattingResult.changes);
		}

		// Clarity improvements
		const clarityResult = this.improveClarity(correctedBody);
		if (clarityResult.changed) {
			correctedBody = clarityResult.text;
			changes.push(...clarityResult.changes);
		}

		// Subject line improvements
		if (correctedSubject) {
			const subjectResult = this.improveSubject(correctedSubject);
			if (subjectResult.changed) {
				correctedSubject = subjectResult.text;
				changes.push(...subjectResult.changes);
			}
		}

		// Calculate scores
		const scores = {
			grammar: this.calculateGrammarScore(correctedBody),
			clarity: this.calculateClarityScore(correctedBody),
			completeness: this.calculateCompletenessScore(template, correctedBody)
		};

		// Determine severity based on issues found
		const severity = this.calculateSeverity(template, changes);

		return {
			severity,
			corrected_body: correctedBody,
			corrected_subject: correctedSubject,
			changes,
			scores
		};
	}

	/**
	 * Apply grammar corrections
	 */
	private correctGrammar(text: string): {
		text: string;
		changed: boolean;
		changes: CorrectionChange[];
	} {
		const changes: CorrectionChange[] = [];
		let corrected = text;
		let changed = false;

		// Common grammar fixes
		const grammarRules = [
			{ pattern: /\bi\b/g, replacement: 'I', reason: 'Capitalize first person pronoun' },
			{ pattern: /\s+([,.!?;])/g, replacement: '$1', reason: 'Remove space before punctuation' },
			{ pattern: /([,.!?;])(\w)/g, replacement: '$1 $2', reason: 'Add space after punctuation' },
			{ pattern: /\s+/g, replacement: ' ', reason: 'Normalize whitespace' },
			{ pattern: /^\s+|\s+$/g, replacement: '', reason: 'Trim whitespace' }
		];

		for (const rule of grammarRules) {
			const matches = corrected.match(rule.pattern);
			if (matches && matches.length > 0) {
				const original = matches[0];
				corrected = corrected.replace(rule.pattern, rule.replacement);
				if (original !== rule.replacement) {
					changed = true;
					changes.push({
						type: 'grammar',
						original: original,
						corrected: rule.replacement.toString(),
						reason: rule.reason
					});
				}
			}
		}

		return { text: corrected, changed, changes };
	}

	/**
	 * Standardize formatting
	 */
	private standardizeFormatting(text: string): {
		text: string;
		changed: boolean;
		changes: CorrectionChange[];
	} {
		const changes: CorrectionChange[] = [];
		let corrected = text;
		let changed = false;

		// Ensure proper paragraph spacing
		if (!corrected.includes('\n\n') && corrected.length > 500) {
			// Add paragraph breaks for long text
			const sentences = corrected.split(/(?<=[.!?])\s+/);
			if (sentences.length > 5) {
				const midpoint = Math.floor(sentences.length / 2);
				corrected =
					sentences.slice(0, midpoint).join(' ') + '\n\n' + sentences.slice(midpoint).join(' ');
				changed = true;
				changes.push({
					type: 'formatting',
					original: 'Single block of text',
					corrected: 'Added paragraph break',
					reason: 'Improve readability with paragraphs'
				});
			}
		}

		// Ensure proper salutation if missing
		if (!corrected.match(/^(Dear|Hello|Hi|Greetings)/i)) {
			corrected = 'Dear Representative,\n\n' + corrected;
			changed = true;
			changes.push({
				type: 'formatting',
				original: 'No salutation',
				corrected: 'Dear Representative',
				reason: 'Add formal salutation'
			});
		}

		// Ensure proper closing if missing
		if (!corrected.match(/(Sincerely|Regards|Thank you|Respectfully),?\s*$/i)) {
			corrected = corrected.trimEnd() + '\n\nSincerely,\n[Your Name]';
			changed = true;
			changes.push({
				type: 'formatting',
				original: 'No closing',
				corrected: 'Sincerely',
				reason: 'Add formal closing'
			});
		}

		return { text: corrected, changed, changes };
	}

	/**
	 * Improve clarity
	 */
	private improveClarity(text: string): {
		text: string;
		changed: boolean;
		changes: CorrectionChange[];
	} {
		const changes: CorrectionChange[] = [];
		let corrected = text;
		let changed = false;

		// Replace unclear phrases
		const clarityRules = [
			{ pattern: /in order to/gi, replacement: 'to', reason: 'Simplify phrase' },
			{ pattern: /at this point in time/gi, replacement: 'now', reason: 'Simplify phrase' },
			{ pattern: /due to the fact that/gi, replacement: 'because', reason: 'Simplify phrase' },
			{ pattern: /in the event that/gi, replacement: 'if', reason: 'Simplify phrase' }
		];

		for (const rule of clarityRules) {
			if (corrected.match(rule.pattern)) {
				corrected = corrected.replace(rule.pattern, rule.replacement);
				changed = true;
				changes.push({
					type: 'clarity',
					original: rule.pattern.source,
					corrected: rule.replacement,
					reason: rule.reason
				});
			}
		}

		return { text: corrected, changed, changes };
	}

	/**
	 * Improve subject line
	 */
	private improveSubject(subject: string): {
		text: string;
		changed: boolean;
		changes: CorrectionChange[];
	} {
		const changes: CorrectionChange[] = [];
		let corrected = subject;
		let changed = false;

		// Capitalize first letter
		if (corrected[0] !== corrected[0].toUpperCase()) {
			const original = corrected;
			corrected = corrected[0].toUpperCase() + corrected.slice(1);
			changed = true;
			changes.push({
				type: 'formatting',
				original,
				corrected,
				reason: 'Capitalize subject line'
			});
		}

		// Remove trailing punctuation from subject
		if (corrected.match(/[.!?,;]$/)) {
			const original = corrected;
			corrected = corrected.replace(/[.!?,;]$/, '');
			changed = true;
			changes.push({
				type: 'formatting',
				original,
				corrected,
				reason: 'Remove trailing punctuation from subject'
			});
		}

		return { text: corrected, changed, changes };
	}

	/**
	 * Calculate grammar score (0-100)
	 */
	private calculateGrammarScore(text: string): number {
		let score = 100;

		// Deduct for common grammar issues
		if (text.match(/\bi\b/)) score -= 10; // Uncapitalized 'I'
		if (text.match(/\s+[,.!?;]/)) score -= 5; // Space before punctuation
		if (text.match(/[,.!?;]\w/)) score -= 5; // No space after punctuation
		if (text.match(/\s{2,}/)) score -= 5; // Multiple spaces

		return Math.max(0, score);
	}

	/**
	 * Calculate clarity score (0-100)
	 */
	private calculateClarityScore(text: string): number {
		let score = 100;

		// Check for clarity issues
		const wordCount = text.split(/\s+/).length;
		const sentenceCount = text.split(/[.!?]+/).length;
		const avgWordsPerSentence = wordCount / sentenceCount;

		// Penalize overly long sentences
		if (avgWordsPerSentence > 25) score -= 20;
		else if (avgWordsPerSentence > 20) score -= 10;

		// Check for passive voice indicators
		if (text.match(/\b(was|were|been|being)\s+\w+ed\b/gi)) {
			score -= 10;
		}

		return Math.max(0, score);
	}

	/**
	 * Calculate completeness score (0-100)
	 */
	private calculateCompletenessScore(template: Template, text: string): number {
		let score = 100;

		// Check for required elements
		if (!text.match(/^(Dear|Hello|Hi|Greetings)/i)) score -= 20; // No salutation
		if (!text.match(/(Sincerely|Regards|Thank you|Respectfully)/i)) score -= 20; // No closing
		if (text.length < 100) score -= 30; // Too short
		if (!template.subject || template.subject.length < 5) score -= 10; // No/short subject

		return Math.max(0, score);
	}

	/**
	 * Calculate severity level (1-10)
	 */
	private calculateSeverity(template: Template, changes: CorrectionChange[]): number {
		// Start with base severity
		let severity = 1;

		// Check for severe content issues (7+)
		const lowerBody = template.message_body.toLowerCase();

		// Hate speech indicators (severity 8-9)
		const hateTerms = ['hate', 'kill', 'destroy', 'eliminate'];
		for (const term of hateTerms) {
			if (lowerBody.includes(term)) {
				severity = Math.max(severity, 8);
			}
		}

		// Threat indicators (severity 9-10)
		if (lowerBody.match(/\b(threat|harm|hurt|attack)\b/)) {
			severity = Math.max(severity, 9);
		}

		// Spam patterns (severity 7)
		if (
			lowerBody.match(/(.)\1{5,}/) || // Repeated characters
			lowerBody.match(/\b(\w+)\s+\1\b/gi)
		) {
			// Repeated words
			severity = Math.max(severity, 7);
		}

		// For minor issues, calculate based on number of corrections needed
		if (severity < 7) {
			if (changes.length > 10) severity = 6;
			else if (changes.length > 7) severity = 5;
			else if (changes.length > 5) severity = 4;
			else if (changes.length > 3) severity = 3;
			else if (changes.length > 1) severity = 2;
		}

		return severity;
	}
}

// Export singleton instance
export const templateCorrector = new TemplateCorrector();
