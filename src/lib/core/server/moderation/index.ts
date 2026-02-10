/**
 * Unified Moderation Pipeline - Permissive Civic Platform
 *
 * Three-layer moderation optimized for multi-stakeholder civic engagement:
 *
 * Layer 0: Llama Prompt Guard 2 (via GROQ) - REQUIRED
 *   - Prompt injection/jailbreak detection
 *   - Protects AI agents from manipulation attacks
 *   - 99.8% AUC for jailbreak detection
 *
 * Layer 1: Llama Guard 4 12B (via GROQ) - OPTIONAL
 *   - MLCommons S1-S14 hazard taxonomy
 *   - PERMISSIVE: Only S1 (threats) and S4 (CSAM) block content
 *   - Political speech, defamation claims, electoral opinions ALLOWED
 *
 * Layer 2: Gemini 2.5 Flash - OPTIONAL
 *   - Quality assessment (policy relevance, professionalism)
 *   - Only called if earlier layers pass
 *
 * Design principle: Be PERMISSIVE with user speech.
 * Platform serves ANY decision-maker (Congress, corporations, HOAs, etc.)
 * The real threat is prompt injection, not controversial opinions.
 */

import { z } from 'zod';
import { env } from '$env/dynamic/private';
import { classifySafety } from './llama-guard';
import { detectPromptInjection } from './prompt-guard';
import type {
	ModerationResult,
	QualityResult,
	SafetyResult,
	PromptGuardResult,
	TemplateModerationInput
} from './types';

// Re-export types for external consumers
export type {
	ModerationResult,
	QualityResult,
	SafetyResult,
	PromptGuardResult,
	TemplateModerationInput
};
export type { MLCommonsHazard } from './types';
export { HAZARD_DESCRIPTIONS, BLOCKING_HAZARDS, NON_BLOCKING_HAZARDS } from './types';
// Legacy export for backward compatibility
export { CIVIC_CRITICAL_HAZARDS } from './types';
export { classifySafety } from './llama-guard';
export { detectPromptInjection, isPromptInjection } from './prompt-guard';

// =============================================================================
// ZOD SCHEMA
// =============================================================================

const QualityResponseSchema = z.object({
	approved: z.boolean(),
	confidence: z.number().min(0).max(1),
	reasoning: z.string()
});

/**
 * Quality assessment using Gemini 2.5 Flash
 *
 * Evaluates congressional appropriateness, policy relevance,
 * and message professionalism. NOT fact-checking.
 */
async function assessQuality(template: TemplateModerationInput): Promise<QualityResult> {
	const apiKey = env.GEMINI_API_KEY;

	if (!apiKey) {
		console.warn('[moderation] GEMINI_API_KEY not configured, skipping quality assessment');
		return {
			approved: true,
			confidence: 0.5,
			reasoning: 'Gemini API key not configured - quality check skipped',
			timestamp: new Date().toISOString(),
			model: 'gemini-3-flash-preview'
		};
	}

	const prompt = `You are a quality assessor for congressional correspondence. Evaluate this template for:

1. Policy relevance - Does it address a legitimate policy issue?
2. Professionalism - Is the tone appropriate for elected officials?
3. Congressional appropriateness - Is this suitable for constituent communication?
4. Absence of spam or manipulation

You are NOT fact-checking claims. Focus on form and appropriateness, not content accuracy.

Template Title: ${template.title}
Category: ${template.category || 'General'}

Message:
${template.message_body}

Respond in JSON format only:
{"approved": boolean, "confidence": number, "reasoning": "brief explanation"}`;

	const response = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				contents: [{ parts: [{ text: prompt }] }],
				generationConfig: {
					temperature: 0.3,
					responseMimeType: 'application/json'
				}
			})
		}
	);

	if (!response.ok) {
		const errorText = await response.text();
		console.error('[moderation] Gemini API error:', response.status, errorText);
		throw new Error(`Quality assessment failed: ${response.status}`);
	}

	const data = await response.json();
	const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

	let result;
	try {
		const parsed = JSON.parse(content);
		const validationResult = QualityResponseSchema.safeParse(parsed);

		if (!validationResult.success) {
			console.warn(
				'[moderation] Invalid quality response structure:',
				validationResult.error.flatten()
			);
			result = { approved: true, confidence: 0.5, reasoning: 'Validation failed - defaulting to approved' };
		} else {
			result = validationResult.data;
		}
	} catch (error) {
		console.warn('[moderation] Failed to parse Gemini response:', content, error);
		result = { approved: true, confidence: 0.5, reasoning: 'Parse error - defaulting to approved' };
	}

	return {
		approved: result.approved ?? true,
		confidence: result.confidence ?? 0.5,
		reasoning: result.reasoning || 'No reasoning provided',
		timestamp: new Date().toISOString(),
		model: 'gemini-3-flash-preview'
	};
}

/**
 * Moderation options
 */
export interface ModerationOptions {
	/** Skip prompt injection check (default: false) */
	skipPromptGuard?: boolean;
	/** Skip content safety check (default: false) */
	skipSafety?: boolean;
	/** Skip quality assessment (default: false) */
	skipQuality?: boolean;
	/** Prompt injection threshold (default: 0.5, higher = more permissive) */
	injectionThreshold?: number;
}

/**
 * Moderate template through the full pipeline
 *
 * Pipeline order:
 * 1. Prompt injection detection (blocks agent manipulation)
 * 2. Content safety (only S1/S4 block - threats, CSAM)
 * 3. Quality assessment (optional)
 *
 * @param template - Template content to moderate
 * @param options - Moderation options
 * @returns ModerationResult with all layer assessments
 */
export async function moderateTemplate(
	template: TemplateModerationInput,
	options: ModerationOptions = {}
): Promise<ModerationResult> {
	const startTime = Date.now();

	// Combine title and body for comprehensive analysis
	const content = `${template.title}\n\n${template.message_body}`;

	// =========================================================================
	// Layer 0: Prompt Injection Detection (REQUIRED)
	// Protects AI agents from manipulation attacks
	// =========================================================================
	if (!options.skipPromptGuard) {
		const promptGuard = await detectPromptInjection(content, options.injectionThreshold);

		if (!promptGuard.safe) {
			const latencyMs = Date.now() - startTime;
			console.log('[moderation] Template REJECTED - prompt injection detected:', {
				score: promptGuard.score.toFixed(4),
				threshold: promptGuard.threshold,
				latencyMs
			});

			return {
				approved: false,
				rejection_reason: 'prompt_injection',
				prompt_guard: promptGuard,
				summary: `Blocked: Detected potential prompt injection (score: ${(promptGuard.score * 100).toFixed(1)}%)`,
				latency_ms: latencyMs
			};
		}
	}

	// =========================================================================
	// Layer 1: Content Safety (OPTIONAL, PERMISSIVE)
	// Only S1 (threats) and S4 (CSAM) actually block content
	// =========================================================================
	let safety: SafetyResult | undefined;

	if (!options.skipSafety) {
		safety = await classifySafety(content);

		// Only block on BLOCKING_HAZARDS (S1, S4)
		if (!safety.safe) {
			const latencyMs = Date.now() - startTime;
			console.log('[moderation] Template REJECTED - illegal content detected:', {
				blocking_hazards: safety.blocking_hazards,
				all_hazards: safety.hazards,
				latencyMs
			});

			// Capture safety in local const to preserve TypeScript narrowing in closure
			const safetyResult = safety;
			const hazardDescriptions = safetyResult.blocking_hazards
				.map((h) => safetyResult.hazard_descriptions[safetyResult.hazards.indexOf(h)])
				.join(', ');

			return {
				approved: false,
				rejection_reason: 'safety_violation',
				safety,
				summary: `Blocked: ${hazardDescriptions}`,
				latency_ms: latencyMs
			};
		}

		// Log non-blocking hazards for analytics (but allow content)
		if (safety.hazards.length > 0) {
			console.log('[moderation] Non-blocking hazards detected (allowed):', {
				hazards: safety.hazards,
				descriptions: safety.hazard_descriptions
			});
		}
	}

	// =========================================================================
	// Layer 2: Quality Assessment (OPTIONAL)
	// =========================================================================
	if (options.skipQuality) {
		const latencyMs = Date.now() - startTime;
		return {
			approved: true,
			safety,
			summary: 'Approved (quality check skipped)',
			latency_ms: latencyMs
		};
	}

	const quality = await assessQuality(template);
	const latencyMs = Date.now() - startTime;

	if (!quality.approved) {
		console.log('[moderation] Template REJECTED by quality layer:', {
			confidence: quality.confidence,
			reasoning: quality.reasoning,
			latencyMs
		});

		return {
			approved: false,
			rejection_reason: 'quality_failure',
			safety,
			quality,
			summary: `Quality assessment failed: ${quality.reasoning}`,
			latency_ms: latencyMs
		};
	}

	console.log('[moderation] Template APPROVED:', {
		safetyModel: safety?.model || 'skipped',
		qualityModel: quality.model,
		qualityConfidence: quality.confidence,
		nonBlockingHazards: safety?.hazards.length || 0,
		latencyMs
	});

	return {
		approved: true,
		safety,
		quality,
		summary: 'Approved',
		latency_ms: latencyMs
	};
}

/**
 * Prompt injection check only (fastest, lowest cost)
 *
 * Use for real-time validation of user input before it reaches agents.
 * This is the CRITICAL security layer.
 *
 * @param content - User input to check
 * @returns PromptGuardResult with score and classification
 */
export async function moderatePromptOnly(content: string, threshold?: number): Promise<PromptGuardResult> {
	return detectPromptInjection(content, threshold);
}

/**
 * Moderate user-supplied personalization text at send time.
 *
 * Lightweight pipeline: Prompt Guard + Llama Guard only (no Gemini).
 * The template itself was already moderated at creation time — this
 * only checks the user's personalization delta (e.g., [Personal Connection]).
 *
 * Designed for send-time latency: target < 500ms total.
 *
 * @param text - User-supplied personalization text
 * @returns ModerationResult (approved/rejected with reason)
 */
export async function moderatePersonalization(text: string): Promise<ModerationResult> {
	const startTime = Date.now();

	// Skip empty text — nothing to moderate
	if (!text || text.trim().length === 0) {
		return {
			approved: true,
			summary: 'Empty personalization — skipped',
			latency_ms: Date.now() - startTime
		};
	}

	// Layer 0: Prompt injection detection
	const promptGuard = await detectPromptInjection(text);

	if (!promptGuard.safe) {
		const latencyMs = Date.now() - startTime;
		console.log('[moderation] Personalization REJECTED — prompt injection:', {
			score: promptGuard.score.toFixed(4),
			latencyMs
		});

		return {
			approved: false,
			rejection_reason: 'prompt_injection',
			prompt_guard: promptGuard,
			summary: `Blocked: Detected potential prompt injection in personalization (score: ${(promptGuard.score * 100).toFixed(1)}%)`,
			latency_ms: latencyMs
		};
	}

	// Layer 1: Content safety (only S1/S4 block)
	const safety = await classifySafety(text);

	if (!safety.safe) {
		const latencyMs = Date.now() - startTime;
		console.log('[moderation] Personalization REJECTED — safety:', {
			blocking_hazards: safety.blocking_hazards,
			latencyMs
		});

		const safetyResult = safety;
		const hazardDescriptions = safetyResult.blocking_hazards
			.map((h) => safetyResult.hazard_descriptions[safetyResult.hazards.indexOf(h)])
			.join(', ');

		return {
			approved: false,
			rejection_reason: 'safety_violation',
			safety,
			summary: `Blocked: ${hazardDescriptions}`,
			latency_ms: latencyMs
		};
	}

	const latencyMs = Date.now() - startTime;
	console.log('[moderation] Personalization APPROVED:', { latencyMs });

	return {
		approved: true,
		safety,
		summary: 'Approved',
		latency_ms: latencyMs
	};
}

