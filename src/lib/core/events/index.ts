/**
 * Stream Event Module
 *
 * Unified SSE event schema for all streaming operations.
 * Provides consistent event structure across the application.
 *
 * @module events
 *
 * @example
 * ```typescript
 * import {
 *   type ThoughtStreamEvent,
 *   type CompositeStreamEvent,
 *   progressEvent,
 *   completeEvent,
 *   errorEvent,
 *   isProgressEvent,
 *   normalizeEventType
 * } from '$lib/core/events';
 *
 * // Create events
 * const progress = progressEvent({ count: 5 });
 * const complete = completeEvent({ result: 'success' });
 * const error = errorEvent('Something went wrong');
 *
 * // Check event types
 * if (isProgressEvent(event)) {
 *   console.log('Progress:', event.data);
 * }
 *
 * // Normalize legacy event types
 * const standardType = normalizeEventType('phase'); // -> 'phase-change'
 * ```
 */

// ============================================================================
// Base Types and Utilities
// ============================================================================

export {
	// Types
	type BaseStreamEvent,
	type BaseProgressEvent,
	type BaseCompleteEvent,
	type BaseErrorEvent,
	// Deprecated alias
	type StreamEvent,
	// Event constructors
	progressEvent,
	completeEvent,
	errorEvent,
	// Type guards
	isProgressEvent,
	isCompleteEvent,
	isErrorEvent
} from './base';

// ============================================================================
// Domain-Specific Event Types
// ============================================================================

export {
	// Thought streaming (agent reasoning)
	type ThoughtStreamEvent,
	type ThoughtData,

	// Composite streaming (two-phase flow)
	type CompositeStreamEvent,
	type CompositeData,

	// Subject generation
	type SubjectStreamEvent,
	type SubjectData,

	// Intelligence gathering
	type IntelligenceStreamEvent,
	type IntelligenceData,

	// Message generation
	type MessageStreamEvent,
	type MessageData,

	// Decision-maker resolution
	type DecisionMakerStreamEvent,
	type DecisionMakerData,

	// Worker events (ZK proofs)
	type WorkerEvent,
	type WorkerCommand,
	type WorkerEventData,

	// Backward compatibility
	type LegacyThoughtStreamEvent,
	EVENT_TYPE_ALIASES,
	normalizeEventType
} from './types';
