/**
 * Base Stream Event Types
 *
 * Generic base types for SSE event schemas across the application.
 * Provides consistent structure for progress, complete, and error events
 * while allowing domain-specific event types via generics.
 *
 * @module events/base
 */

// ============================================================================
// Base Event Types
// ============================================================================

/**
 * Base progress event - emitted during streaming operations
 */
export interface BaseProgressEvent<D = unknown> {
	type: 'progress';
	data: D;
}

/**
 * Base complete event - emitted when streaming finishes successfully
 */
export interface BaseCompleteEvent<D = unknown> {
	type: 'complete';
	data: D;
}

/**
 * Base error event - emitted when an error occurs
 */
export interface BaseErrorEvent {
	type: 'error';
	error: string;
}

/**
 * Generic base stream event type
 *
 * Provides a foundation for domain-specific SSE event schemas.
 * Always includes progress, complete, and error events.
 * Additional event types are specified via the T generic.
 *
 * @typeParam T - Union of additional event type strings (e.g., 'thought' | 'phase-change')
 * @typeParam D - Data payload type for progress/complete/custom events
 *
 * @example
 * ```typescript
 * // Simple stream with just progress/complete/error
 * type SimpleStreamEvent = BaseStreamEvent<never, { count: number }>;
 *
 * // Stream with custom event types
 * type ThoughtStreamEvent = BaseStreamEvent<
 *   'thought' | 'phase-change' | 'confidence',
 *   ThoughtData
 * >;
 * ```
 */
export type BaseStreamEvent<T extends string, D = unknown> =
	| BaseProgressEvent<D>
	| BaseCompleteEvent<D>
	| BaseErrorEvent
	| { type: T; data: D };

// ============================================================================
// Event Constructors
// ============================================================================

/**
 * Create a progress event
 */
export function progressEvent<D>(data: D): BaseProgressEvent<D> {
	return { type: 'progress', data };
}

/**
 * Create a complete event
 */
export function completeEvent<D>(data: D): BaseCompleteEvent<D> {
	return { type: 'complete', data };
}

/**
 * Create an error event
 */
export function errorEvent(error: string): BaseErrorEvent {
	return { type: 'error', error };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for progress events
 */
export function isProgressEvent<D>(event: { type: string }): event is BaseProgressEvent<D> {
	return event.type === 'progress';
}

/**
 * Type guard for complete events
 */
export function isCompleteEvent<D>(event: { type: string }): event is BaseCompleteEvent<D> {
	return event.type === 'complete';
}

/**
 * Type guard for error events
 */
export function isErrorEvent(event: { type: string }): event is BaseErrorEvent {
	return event.type === 'error';
}

// ============================================================================
// Backward Compatibility Aliases
// ============================================================================

/**
 * @deprecated Use BaseStreamEvent instead
 * Alias for backward compatibility during migration
 */
export type StreamEvent<T extends string, D = unknown> = BaseStreamEvent<T, D>;
