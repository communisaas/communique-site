/**
 * Delivery Feedback Journey - Type Definitions
 * Specification: docs/temp/CWC-FEEDBACK-REDESIGN.md
 */

export type JourneyStage = 'acknowledging' | 'delivering' | 'complete' | 'details';

export type OfficeOutcome = 'delivered' | 'failed' | 'unavailable';

export interface DeliveryResult {
	office: string; // "Sen. Adam Schiff"
	chamber: 'senate' | 'house';
	state: string; // "CA"
	district?: string; // "11" (house only)

	outcome: OfficeOutcome;

	// On success
	confirmationId?: string; // CWC message ID
	deliveredAt?: string; // ISO timestamp

	// On failure
	error?: string; // User-friendly message
	errorCode?: string; // Technical code
	retryable?: boolean; // Can user retry?
}

export interface DeliverySummary {
	total: number;
	delivered: number;
	failed: number;
	unavailable: number;
}

export interface TemplateMetrics {
	title: string;
	category?: string;
	topics?: string[];
}

/**
 * Timing constants for staged reveal animation
 * These create the perception of work while results are already known
 */
export const TIMING = {
	// Acknowledgment
	CLICK_RESPONSE: 50, // Immediate visual feedback

	// Staged reveal (performative - we know results)
	ANTICIPATION: 600, // Build expectation
	PROGRESS_DURATION: 2400, // Total animation time
	STAGE_INTERVAL: 800, // Between office reveals

	// Completion
	CELEBRATION_PULSE: 400, // Scale animation
	SETTLE: 300, // Final state transition

	// Interactions
	TRANSITION: 300, // Standard UI transitions
	HOVER: 150 // Hover states
} as const;
