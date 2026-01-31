/**
 * Confidence Constants for Decision-Maker Resolution
 *
 * Single source of truth for confidence scoring used across:
 * - composite-provider.ts: Discovery and verification phases
 * - composite-emitter.ts: Thought streaming with confidence tracking
 *
 * Confidence Scoring Model:
 * - Base discovery confidence: 0.4 (unverified findings)
 * - Each Gemini verification: +0.15 confidence boost
 * - Maximum confidence: 1.0
 */

export const CONFIDENCE = {
	/** Base confidence for discovered decision-makers before verification */
	BASE_DISCOVERY: 0.4,

	/** Confidence boost applied when a decision-maker is verified */
	VERIFICATION_BOOST: 0.15,

	/** Maximum confidence score cap */
	MAX: 1.0
} as const;

/** Type for accessing CONFIDENCE values */
export type ConfidenceValue = (typeof CONFIDENCE)[keyof typeof CONFIDENCE];
