/**
 * Perceptual Timing Constants
 *
 * Single source of truth for all timing values in the UI.
 * Based on human perceptual constraints and cognitive load management.
 *
 * Key thresholds:
 * - <100ms: Feels instant (causality preserved)
 * - <400ms: Perceived as responsive
 * - >1000ms: Requires loading indicator
 *
 * References:
 * - Nielsen's response time limits (1993)
 * - Miller's Rule: 100ms for perceived causality
 * - WCAG 2.1 Animation guidelines
 */

export const PERCEPTUAL_TIMING = {
	// ========================================================================
	// Causality Budget
	// ========================================================================

	/** Direct state changes (user-caused, instant feedback) */
	INSTANT: 0,

	/** Maximum delay where action feels connected to response */
	CAUSALITY_MAX: 100,

	// ========================================================================
	// UI Transitions
	// ========================================================================

	/** Quick UI reorganization (below perception threshold) */
	SNAP: 150,

	/** Standard view changes, drawer slide animations */
	TRANSITION: 300,

	// ========================================================================
	// L2 Preview Behavior (Hover-based Progressive Disclosure)
	// ========================================================================

	/** Delay before L2 preview appears (prevents accidental triggers) */
	L2_HOVER_DELAY: 300,

	/** Grace period when leaving trigger area (allows traversal to preview) */
	L2_LINGER: 150,

	/** Fade-in animation duration for L2 previews */
	L2_FADE_IN: 150,

	// ========================================================================
	// Streaming Rhythm (Thought Flow)
	// ========================================================================

	/** Pause between individual thought chunks */
	THOUGHT_PAUSE: 300,

	/** Pause between phase transitions in multi-phase flows */
	PHASE_PAUSE: 500,

	// ========================================================================
	// Loading Thresholds
	// ========================================================================

	/** Minimum duration before showing loading indicator */
	LOADING_THRESHOLD: 1000,

	// ========================================================================
	// Composite Flow Specific (Discovery + Verification)
	// ========================================================================

	/** Expected duration for discovery phase (Firecrawl research) */
	DISCOVERY_EXPECTED: 45_000, // 45 seconds typical

	/** Average interval between thought emissions during discovery */
	DISCOVERY_THOUGHT_INTERVAL: 2000, // Thought every 2 seconds

	/** Peripheral activity pulse during discovery (ambient awareness) */
	DISCOVERY_PROGRESS_PULSE: 500,

	/** Expected duration for verification phase (Gemini) */
	VERIFICATION_EXPECTED: 8_000, // 8 seconds typical

	/** Average interval between thoughts during verification */
	VERIFICATION_THOUGHT_INTERVAL: 3000, // Fewer, confirmatory thoughts

	/** Confidence boost applied per verified thought */
	CONFIDENCE_BOOST: 0.15
} as const;

export type PerceptualTiming = typeof PERCEPTUAL_TIMING;

// ============================================================================
// Convenience Re-exports (Common Use Cases)
// ============================================================================

/**
 * L2 hover delay - use this for hover-triggered progressive disclosure
 * @example
 * ```typescript
 * setTimeout(() => showPreview(), L2_HOVER_DELAY);
 * ```
 */
export const { L2_HOVER_DELAY } = PERCEPTUAL_TIMING;

/**
 * L2 linger time - grace period when mouse leaves trigger
 * @example
 * ```typescript
 * setTimeout(() => hidePreview(), L2_LINGER);
 * ```
 */
export const { L2_LINGER } = PERCEPTUAL_TIMING;

/**
 * Standard transition duration - view changes, drawer animations
 * @example
 * ```css
 * transition: transform 300ms ease-out;
 * ```
 */
export const { TRANSITION } = PERCEPTUAL_TIMING;

/**
 * Phase pause - settling time between streaming phases
 * @example
 * ```typescript
 * await sleep(PHASE_PAUSE);
 * composite.transitionToVerification();
 * ```
 */
export const { PHASE_PAUSE } = PERCEPTUAL_TIMING;

/**
 * Confidence boost per verification - for composite thought streams
 * @example
 * ```typescript
 * newConfidence = Math.min(1, baseConfidence + CONFIDENCE_BOOST);
 * ```
 */
export const { CONFIDENCE_BOOST } = PERCEPTUAL_TIMING;

/**
 * L2 fade-in duration - for preview appearance animations
 * @example
 * ```css
 * animation: fadeIn 150ms ease-out;
 * ```
 */
export const { L2_FADE_IN } = PERCEPTUAL_TIMING;

/**
 * Snap duration - quick UI reorganization below perception threshold
 * @example
 * ```css
 * transition: all 150ms ease-out;
 * ```
 */
export const { SNAP } = PERCEPTUAL_TIMING;
