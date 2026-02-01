/**
 * CompositeThoughtEmitter - Two-phase streaming for Discovery + Verification
 *
 * Orchestrates the two-phase streaming experience:
 * - Phase 1: Discovery (Firecrawl, 30-60s) - emits thoughts with base confidence
 * - Phase 2: Verification (Gemini, 5-10s) - boosts confidence as thoughts verify
 *
 * Users experience continuous flow without explicit phase boundaries.
 * Confidence grows as verification completes (base 0.4, +0.15 per verification).
 *
 * @example
 * ```typescript
 * const composite = new CompositeThoughtEmitter((segment) => {
 *   console.log('Thought:', segment.content, 'Confidence:', segment.confidence);
 * });
 *
 * composite.onPhaseChange((phase) => {
 *   console.log('Phase changed to:', phase);
 * });
 *
 * composite.onConfidenceUpdate((thoughtId, confidence) => {
 *   console.log('Confidence updated:', thoughtId, confidence);
 * });
 *
 * // Discovery phase
 * composite.startDiscovery();
 * const thoughtId = composite.emitDiscovery('Found sustainability report from Apple');
 *
 * // Transition to verification
 * await composite.transitionToVerification();
 *
 * // Verification phase
 * composite.emitVerification(thoughtId, true); // Boosts confidence by 0.15
 * composite.complete();
 * ```
 *
 * @module thoughts/composite-emitter
 */

import { ThoughtEmitter } from './emitter';
import type {
	ThoughtSegment,
	Citation,
	ActionHandle,
	ActionTargetType,
	ThinkOptions,
	InsightOptions,
	RecommendOptions
} from './types';
import { CONFIDENCE } from '$lib/core/agents/providers/constants';
import { PERCEPTUAL_TIMING } from '$lib/core/perceptual/timing';

// ============================================================================
// Types
// ============================================================================

/**
 * Composite streaming phase state machine
 *
 * - idle: Not started
 * - discovery: Firecrawl research in progress
 * - discovery-complete: Discovery finished, preparing for verification
 * - verification: Gemini verification in progress
 * - complete: All phases finished successfully
 * - degraded: Verification failed/skipped, using discovery results only
 */
export type CompositePhase =
	| 'idle'
	| 'discovery'
	| 'discovery-complete'
	| 'verification'
	| 'complete'
	| 'degraded';

/**
 * Timing constants for composite streaming phases
 * @deprecated Use PERCEPTUAL_TIMING from $lib/core/perceptual/timing instead
 */
export const COMPOSITE_TIMING = {
	/** Discovery phase (Firecrawl research) */
	DISCOVERY: {
		/** Expected duration in ms (45s typical) */
		expected: PERCEPTUAL_TIMING.DISCOVERY_EXPECTED,
		/** Minimum interval between thought emissions */
		thoughtInterval: PERCEPTUAL_TIMING.DISCOVERY_THOUGHT_INTERVAL
	},
	/** Verification phase (Gemini) */
	VERIFICATION: {
		/** Expected duration in ms (8s typical) */
		expected: PERCEPTUAL_TIMING.VERIFICATION_EXPECTED,
		/** Confidence boost per verified thought */
		confidenceBoost: PERCEPTUAL_TIMING.CONFIDENCE_BOOST
	},
	/** Phase transition settings */
	TRANSITION: {
		/** Settling pause before verification starts (ms) */
		pauseBeforeVerify: PERCEPTUAL_TIMING.PHASE_PAUSE
	}
} as const;

/**
 * Extended thought segment with confidence tracking
 */
export interface ConfidentThoughtSegment extends ThoughtSegment {
	/** Confidence score (0-1) - grows with verification */
	confidence: number;
	/** Whether this thought has been verified */
	verified?: boolean;
	/** Source phase that emitted this thought */
	sourcePhase: 'discovery' | 'verification';
}

/**
 * Phase change event payload
 */
export interface PhaseChangeEvent {
	/** Previous phase */
	from: CompositePhase;
	/** New phase */
	to: CompositePhase;
	/** Timestamp of transition */
	timestamp: number;
}

/**
 * Phase settling event payload - emitted during transition pauses
 *
 * Per Phase 2D.1 perceptual architecture spec, a settling pause gives users
 * time to register phase changes cognitively before the next phase begins.
 */
export interface PhaseSettlingEvent {
	/** Event type identifier */
	type: 'settling';
	/** Duration of the settling pause in ms */
	duration: number;
	/** Human-readable message for UI feedback */
	message: string;
	/** Timestamp when settling began */
	timestamp: number;
}

/**
 * Confidence update event payload
 */
export interface ConfidenceUpdateEvent {
	/** Thought ID that was updated */
	thoughtId: string;
	/** Previous confidence */
	previousConfidence: number;
	/** New confidence */
	newConfidence: number;
	/** Whether thought was verified */
	verified: boolean;
}

/**
 * Composite emitter event types
 */
export type CompositeEvent =
	| { type: 'phase-change'; event: PhaseChangeEvent }
	| { type: 'phase-settling'; event: PhaseSettlingEvent }
	| { type: 'confidence-update'; event: ConfidenceUpdateEvent }
	| { type: 'thought'; segment: ConfidentThoughtSegment };

/**
 * Callback for segment emission with confidence
 */
export type ConfidentSegmentCallback = (segment: ConfidentThoughtSegment) => void;

/**
 * Callback for phase changes
 */
export type PhaseChangeCallback = (event: PhaseChangeEvent) => void;

/**
 * Callback for confidence updates
 */
export type ConfidenceUpdateCallback = (event: ConfidenceUpdateEvent) => void;

/**
 * Callback for phase settling events
 */
export type PhaseSettlingCallback = (event: PhaseSettlingEvent) => void;

// ============================================================================
// CompositeThoughtEmitter Class
// ============================================================================

/**
 * Two-phase streaming emitter for Discovery + Verification flow
 *
 * Wraps ThoughtEmitter to add:
 * - Phase state machine (idle -> discovery -> verification -> complete)
 * - Per-thought confidence tracking
 * - Verification-based confidence boosting
 * - Phase change and confidence update events
 */
export class CompositeThoughtEmitter {
	/** Underlying thought emitter */
	private emitter: ThoughtEmitter;

	/** Current phase in the state machine */
	private _phase: CompositePhase = 'idle';

	/** Per-thought confidence tracking */
	private confidenceMap: Map<string, number> = new Map();

	/** Per-thought verification status */
	private verificationMap: Map<string, boolean> = new Map();

	/** All emitted thought IDs in order */
	private thoughtIds: string[] = [];

	/** Callback for confident segment emission */
	private onSegmentEmit: ConfidentSegmentCallback;

	/** Phase change listeners */
	private phaseChangeListeners: Set<PhaseChangeCallback> = new Set();

	/** Confidence update listeners */
	private confidenceUpdateListeners: Set<ConfidenceUpdateCallback> = new Set();

	/** Phase settling listeners */
	private phaseSettlingListeners: Set<PhaseSettlingCallback> = new Set();

	/** Phase start timestamps for timing analysis */
	private phaseTimestamps: Map<CompositePhase, number> = new Map();

	/**
	 * Create a new CompositeThoughtEmitter
	 *
	 * @param onEmit - Callback invoked for each emitted thought segment with confidence
	 */
	constructor(onEmit: ConfidentSegmentCallback) {
		this.onSegmentEmit = onEmit;

		// Create underlying emitter that wraps segments with confidence
		this.emitter = new ThoughtEmitter((segment) => {
			// This callback is used for internal emission, we intercept and enhance
			// The actual emission happens through emitWithConfidence
		});
	}

	// ========================================================================
	// Phase Management
	// ========================================================================

	/**
	 * Get current phase
	 */
	get phase(): CompositePhase {
		return this._phase;
	}

	/**
	 * Transition to a new phase
	 *
	 * @param newPhase - Phase to transition to
	 * @throws Error if transition is invalid
	 */
	private transitionTo(newPhase: CompositePhase): void {
		const validTransitions: Record<CompositePhase, CompositePhase[]> = {
			idle: ['discovery'],
			discovery: ['discovery-complete', 'degraded'],
			'discovery-complete': ['verification', 'degraded'],
			verification: ['complete', 'degraded'],
			complete: [],
			degraded: []
		};

		if (!validTransitions[this._phase].includes(newPhase)) {
			throw new Error(
				`Invalid phase transition: ${this._phase} -> ${newPhase}. ` +
					`Valid transitions: ${validTransitions[this._phase].join(', ') || 'none'}`
			);
		}

		const event: PhaseChangeEvent = {
			from: this._phase,
			to: newPhase,
			timestamp: Date.now()
		};

		this._phase = newPhase;
		this.phaseTimestamps.set(newPhase, event.timestamp);

		// Notify listeners
		Array.from(this.phaseChangeListeners).forEach((listener) => {
			try {
				listener(event);
			} catch (error) {
				console.error('Phase change listener error:', error);
			}
		});
	}

	/**
	 * Start the discovery phase
	 *
	 * Transitions from idle to discovery and starts the underlying emitter's
	 * research phase.
	 *
	 * @throws Error if not in idle phase
	 */
	startDiscovery(): void {
		this.transitionTo('discovery');
		this.emitter.startPhase('discovery');
	}

	/**
	 * Complete the discovery phase and prepare for verification
	 *
	 * Transitions from discovery to discovery-complete.
	 */
	completeDiscovery(): void {
		this.transitionTo('discovery-complete');
		this.emitter.completePhase();
	}

	/**
	 * Transition to verification phase with settling pause
	 *
	 * Handles the 500ms settling pause before verification begins,
	 * giving the UI time to show discovery completion. Per Phase 2D.1
	 * perceptual architecture spec, this pause allows users to cognitively
	 * register the phase change before verification starts.
	 *
	 * @returns Promise that resolves when verification phase begins
	 */
	async transitionToVerification(): Promise<void> {
		// Ensure discovery is complete
		if (this._phase === 'discovery') {
			this.completeDiscovery();
		}

		if (this._phase !== 'discovery-complete') {
			throw new Error(
				`Cannot transition to verification from phase: ${this._phase}. ` +
					`Must be in 'discovery-complete' phase.`
			);
		}

		// Emit settling event for UI feedback before pause
		await this.emitPhasePause(
			COMPOSITE_TIMING.TRANSITION.pauseBeforeVerify,
			'Processing findings...'
		);

		this.transitionTo('verification');
		this.emitter.startPhase('verification');
	}

	/**
	 * Emit a phase settling event and wait for the specified duration
	 *
	 * This allows the UI to show subtle feedback (e.g., "Processing findings...")
	 * during the cognitive settling pause between phases.
	 *
	 * @param duration - Duration of pause in milliseconds
	 * @param message - Human-readable message for UI display
	 */
	private async emitPhasePause(duration: number, message: string): Promise<void> {
		const event: PhaseSettlingEvent = {
			type: 'settling',
			duration,
			message,
			timestamp: Date.now()
		};

		// Notify settling listeners
		Array.from(this.phaseSettlingListeners).forEach((listener) => {
			try {
				listener(event);
			} catch (error) {
				console.error('Phase settling listener error:', error);
			}
		});

		// Wait for the settling duration
		await this.sleep(duration);
	}

	/**
	 * Mark the composite flow as complete
	 *
	 * @param success - Whether verification completed successfully
	 */
	complete(success: boolean = true): void {
		if (this._phase === 'verification') {
			this.transitionTo(success ? 'complete' : 'degraded');
		} else if (this._phase === 'discovery-complete' || this._phase === 'discovery') {
			// Verification was skipped
			this.transitionTo('degraded');
		}

		this.emitter.completePhase();
	}

	/**
	 * Mark the flow as degraded (verification failed/skipped)
	 */
	degraded(): void {
		if (this._phase !== 'complete' && this._phase !== 'degraded') {
			this.transitionTo('degraded');
		}
	}

	// ========================================================================
	// Discovery Phase Emission
	// ========================================================================

	/**
	 * Emit a discovery-phase thought with base confidence
	 *
	 * @param content - Thought content
	 * @param options - Optional think options
	 * @returns Thought ID for later verification
	 */
	emitDiscovery(content: string, options?: ThinkOptions): string {
		if (this._phase !== 'discovery') {
			throw new Error(`Cannot emit discovery thought in phase: ${this._phase}`);
		}

		return this.emitWithConfidence(content, CONFIDENCE.BASE_DISCOVERY, 'discovery', options);
	}

	/**
	 * Emit a discovery insight with base confidence
	 *
	 * @param content - Insight content
	 * @param options - Optional insight options
	 * @returns Thought ID for later verification
	 */
	emitDiscoveryInsight(content: string, options?: InsightOptions): string {
		if (this._phase !== 'discovery') {
			throw new Error(`Cannot emit discovery insight in phase: ${this._phase}`);
		}

		return this.emitInsightWithConfidence(content, CONFIDENCE.BASE_DISCOVERY, 'discovery', options);
	}

	/**
	 * Start a research action during discovery
	 *
	 * @param target - Research target
	 * @param targetType - Type of target
	 * @returns Action handle with thought ID
	 */
	startDiscoveryResearch(
		target: string,
		targetType?: ActionTargetType
	): ActionHandle & { thoughtId: string } {
		if (this._phase !== 'discovery') {
			throw new Error(`Cannot start discovery research in phase: ${this._phase}`);
		}

		const handle = this.emitter.startResearch(target, targetType);
		const thoughtId = crypto.randomUUID();

		// Track this action's confidence
		this.confidenceMap.set(thoughtId, CONFIDENCE.BASE_DISCOVERY);
		this.verificationMap.set(thoughtId, false);
		this.thoughtIds.push(thoughtId);

		return {
			...handle,
			thoughtId
		};
	}

	// ========================================================================
	// Verification Phase Emission
	// ========================================================================

	/**
	 * Emit verification result for a discovery thought
	 *
	 * Boosts confidence by VERIFICATION.confidenceBoost if verified.
	 *
	 * @param thoughtId - ID of thought to verify
	 * @param verified - Whether the thought was verified
	 * @param verificationNote - Optional note about verification
	 */
	emitVerification(thoughtId: string, verified: boolean, verificationNote?: string): void {
		if (this._phase !== 'verification') {
			throw new Error(`Cannot emit verification in phase: ${this._phase}`);
		}

		const previousConfidence = this.confidenceMap.get(thoughtId);
		if (previousConfidence === undefined) {
			console.warn(`Attempted to verify unknown thought: ${thoughtId}`);
			return;
		}

		// Calculate new confidence
		const boost = verified ? COMPOSITE_TIMING.VERIFICATION.confidenceBoost : 0;
		const newConfidence = Math.min(1, previousConfidence + boost);

		// Update tracking
		this.confidenceMap.set(thoughtId, newConfidence);
		this.verificationMap.set(thoughtId, verified);

		// Emit confidence update event
		const event: ConfidenceUpdateEvent = {
			thoughtId,
			previousConfidence,
			newConfidence,
			verified
		};

		Array.from(this.confidenceUpdateListeners).forEach((listener) => {
			try {
				listener(event);
			} catch (error) {
				console.error('Confidence update listener error:', error);
			}
		});

		// Optionally emit a verification note
		if (verificationNote) {
			this.emitter.think(verificationNote, { emphasis: verified ? 'normal' : 'muted' });
		}
	}

	/**
	 * Emit a verification-phase thought (new finding during verification)
	 *
	 * These thoughts start with boosted confidence since they come from verification.
	 *
	 * @param content - Thought content
	 * @param options - Optional think options
	 * @returns Thought ID
	 */
	emitVerificationThought(content: string, options?: ThinkOptions): string {
		if (this._phase !== 'verification') {
			throw new Error(`Cannot emit verification thought in phase: ${this._phase}`);
		}

		// Verification-discovered thoughts get boosted confidence
		const confidence = CONFIDENCE.BASE_DISCOVERY + CONFIDENCE.VERIFICATION_BOOST;
		return this.emitWithConfidence(content, confidence, 'verification', options);
	}

	/**
	 * Batch verify multiple thoughts
	 *
	 * @param verifications - Map of thought IDs to verification status
	 */
	batchVerify(verifications: Map<string, boolean>): void {
		Array.from(verifications.entries()).forEach(([thoughtId, verified]) => {
			this.emitVerification(thoughtId, verified);
		});
	}

	// ========================================================================
	// Event Subscription
	// ========================================================================

	/**
	 * Subscribe to phase change events
	 *
	 * @param callback - Callback invoked on phase changes
	 * @returns Unsubscribe function
	 */
	onPhaseChange(callback: PhaseChangeCallback): () => void {
		this.phaseChangeListeners.add(callback);
		return () => this.phaseChangeListeners.delete(callback);
	}

	/**
	 * Subscribe to confidence update events
	 *
	 * @param callback - Callback invoked when thought confidence changes
	 * @returns Unsubscribe function
	 */
	onConfidenceUpdate(callback: ConfidenceUpdateCallback): () => void {
		this.confidenceUpdateListeners.add(callback);
		return () => this.confidenceUpdateListeners.delete(callback);
	}

	/**
	 * Subscribe to phase settling events
	 *
	 * Called when a settling pause begins between phases. The UI can use this
	 * to show subtle feedback like "Processing findings..." during the pause.
	 *
	 * @param callback - Callback invoked when phase settling begins
	 * @returns Unsubscribe function
	 */
	onPhaseSettling(callback: PhaseSettlingCallback): () => void {
		this.phaseSettlingListeners.add(callback);
		return () => this.phaseSettlingListeners.delete(callback);
	}

	// ========================================================================
	// State Access
	// ========================================================================

	/**
	 * Get confidence for a specific thought
	 *
	 * @param thoughtId - Thought ID
	 * @returns Confidence score or undefined if not found
	 */
	getConfidence(thoughtId: string): number | undefined {
		return this.confidenceMap.get(thoughtId);
	}

	/**
	 * Get verification status for a specific thought
	 *
	 * @param thoughtId - Thought ID
	 * @returns Verification status or undefined if not found
	 */
	isVerified(thoughtId: string): boolean | undefined {
		return this.verificationMap.get(thoughtId);
	}

	/**
	 * Get all thought IDs emitted during discovery
	 *
	 * @returns Array of thought IDs
	 */
	getDiscoveryThoughtIds(): string[] {
		return [...this.thoughtIds];
	}

	/**
	 * Get average confidence across all thoughts
	 *
	 * @returns Average confidence (0-1) or 0 if no thoughts
	 */
	getAverageConfidence(): number {
		if (this.confidenceMap.size === 0) return 0;

		const values = Array.from(this.confidenceMap.values());
		const sum = values.reduce((acc, confidence) => acc + confidence, 0);
		return sum / this.confidenceMap.size;
	}

	/**
	 * Get verification rate (verified thoughts / total thoughts)
	 *
	 * @returns Verification rate (0-1) or 0 if no thoughts
	 */
	getVerificationRate(): number {
		if (this.verificationMap.size === 0) return 0;

		const values = Array.from(this.verificationMap.values());
		const verified = values.filter((isVerified) => isVerified).length;
		return verified / this.verificationMap.size;
	}

	/**
	 * Get phase duration in milliseconds
	 *
	 * @param phase - Phase to get duration for
	 * @returns Duration in ms or undefined if phase not reached
	 */
	getPhaseDuration(phase: CompositePhase): number | undefined {
		const startTime = this.phaseTimestamps.get(phase);
		if (!startTime) return undefined;

		// Find next phase start time
		const phases: CompositePhase[] = [
			'idle',
			'discovery',
			'discovery-complete',
			'verification',
			'complete',
			'degraded'
		];
		const phaseIndex = phases.indexOf(phase);

		for (let i = phaseIndex + 1; i < phases.length; i++) {
			const nextTime = this.phaseTimestamps.get(phases[i]);
			if (nextTime) {
				return nextTime - startTime;
			}
		}

		// Phase is current or terminal
		return Date.now() - startTime;
	}

	/**
	 * Get underlying ThoughtEmitter for advanced usage
	 *
	 * @returns The wrapped ThoughtEmitter instance
	 */
	getEmitter(): ThoughtEmitter {
		return this.emitter;
	}

	// ========================================================================
	// Internal Helpers
	// ========================================================================

	/**
	 * Emit a thought segment with confidence tracking
	 *
	 * @param content - Thought content
	 * @param confidence - Confidence score
	 * @param sourcePhase - Phase that emitted this thought
	 * @param options - Optional think options
	 * @returns Thought ID
	 */
	private emitWithConfidence(
		content: string,
		confidence: number,
		sourcePhase: 'discovery' | 'verification',
		options?: ThinkOptions
	): string {
		const id = crypto.randomUUID();

		// Track confidence
		this.confidenceMap.set(id, confidence);
		this.verificationMap.set(id, sourcePhase === 'verification');
		this.thoughtIds.push(id);

		// Create confident segment
		const segment: ConfidentThoughtSegment = {
			id,
			timestamp: Date.now(),
			type: 'reasoning',
			phase: this._phase,
			content,
			expandable: !!options?.citations?.length,
			citations: options?.citations,
			emphasis: options?.emphasis || 'normal',
			pinToKeyMoments: options?.pin,
			confidence,
			verified: sourcePhase === 'verification',
			sourcePhase
		};

		// Emit to callback
		this.onSegmentEmit(segment);

		return id;
	}

	/**
	 * Emit an insight with confidence tracking
	 *
	 * @param content - Insight content
	 * @param confidence - Confidence score
	 * @param sourcePhase - Phase that emitted this insight
	 * @param options - Optional insight options
	 * @returns Thought ID
	 */
	private emitInsightWithConfidence(
		content: string,
		confidence: number,
		sourcePhase: 'discovery' | 'verification',
		options?: InsightOptions
	): string {
		const id = crypto.randomUUID();

		// Track confidence
		this.confidenceMap.set(id, confidence);
		this.verificationMap.set(id, sourcePhase === 'verification');
		this.thoughtIds.push(id);

		// Create confident segment
		const segment: ConfidentThoughtSegment = {
			id,
			timestamp: Date.now(),
			type: 'insight',
			phase: this._phase,
			content,
			expandable: !!options?.citations?.length,
			citations: options?.citations,
			emphasis: 'highlight',
			pinToKeyMoments: options?.pin !== false,
			confidence,
			verified: sourcePhase === 'verification',
			sourcePhase
		};

		// Emit to callback
		this.onSegmentEmit(segment);

		return id;
	}

	/**
	 * Sleep utility for transition pauses
	 *
	 * @param ms - Milliseconds to sleep
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a CompositeThoughtEmitter with common event handlers
 *
 * @param onSegment - Callback for thought segments
 * @param onPhaseChange - Optional callback for phase changes
 * @param onConfidenceUpdate - Optional callback for confidence updates
 * @param onPhaseSettling - Optional callback for phase settling events
 * @returns Configured CompositeThoughtEmitter
 */
export function createCompositeEmitter(
	onSegment: ConfidentSegmentCallback,
	onPhaseChange?: PhaseChangeCallback,
	onConfidenceUpdate?: ConfidenceUpdateCallback,
	onPhaseSettling?: PhaseSettlingCallback
): CompositeThoughtEmitter {
	const emitter = new CompositeThoughtEmitter(onSegment);

	if (onPhaseChange) {
		emitter.onPhaseChange(onPhaseChange);
	}

	if (onConfidenceUpdate) {
		emitter.onConfidenceUpdate(onConfidenceUpdate);
	}

	if (onPhaseSettling) {
		emitter.onPhaseSettling(onPhaseSettling);
	}

	return emitter;
}
