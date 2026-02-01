/**
 * Delivery Feedback Journey - Type Definitions
 *
 * This module defines a generic type system for legislative delivery feedback.
 * It supports multiple legislature types including:
 * - US Congress (Senate + House)
 * - State legislatures (e.g., California Assembly + Senate)
 * - International parliaments (e.g., UK House of Commons + House of Lords)
 *
 * The abstraction uses "body" instead of "chamber" to be legislature-agnostic,
 * and "jurisdiction/subJurisdiction" instead of "state/district" to support
 * various geographic/administrative divisions.
 *
 * @module delivery-types
 * @see docs/temp/CWC-FEEDBACK-REDESIGN.md
 */

// ============================================================================
// Journey State
// ============================================================================

/**
 * Stages of the delivery feedback journey
 *
 * The journey progresses through these stages:
 * 1. acknowledging - Initial confirmation that submission was received
 * 2. delivering - Animated reveal of delivery status per office
 * 3. complete - Final summary with success/partial/failure state
 * 4. details - Expanded view showing confirmation IDs and retry options
 */
export type JourneyStage = 'acknowledging' | 'delivering' | 'complete' | 'details';

// ============================================================================
// Outcome Types
// ============================================================================

/**
 * Possible outcomes for a single office delivery attempt
 *
 * - delivered: Message successfully delivered, confirmation ID available
 * - failed: Delivery attempted but failed (may be retryable)
 * - unavailable: Office not accepting messages through this system
 */
export type OfficeOutcome = 'delivered' | 'failed' | 'unavailable';

// ============================================================================
// Legislature Configuration
// ============================================================================

/**
 * Configuration for a legislative body within a legislature
 *
 * @example
 * // US Senate body configuration
 * { id: 'senate', displayName: 'Senate', expectedCount: 2 }
 *
 * @example
 * // California Assembly body configuration
 * { id: 'assembly', displayName: 'State Assembly', expectedCount: 1 }
 */
export interface LegislativeBody {
	/** Unique identifier for the body (e.g., 'senate', 'house', 'assembly', 'commons') */
	id: string;

	/** Human-readable name for display (e.g., 'Senate', 'House of Representatives') */
	displayName: string;

	/**
	 * Expected number of representatives per jurisdiction
	 * - 2 for US Senate (2 senators per state)
	 * - 1 for US House (1 rep per district)
	 * - undefined if variable or not applicable
	 */
	expectedCount?: number;
}

/**
 * Headline templates for delivery feedback
 *
 * These templates are used to generate context-appropriate headlines
 * based on delivery outcome. Placeholders like {name} can be replaced
 * with dynamic values.
 */
export interface HeadlineTemplates {
	/** Headline for successful delivery to all offices */
	success: string;

	/** Headline for partial delivery (some succeeded, some failed) */
	partial: string;

	/** Headline for complete delivery failure */
	failure: string;
}

/**
 * Configuration for a legislative system
 *
 * This interface enables support for diverse legislature types by abstracting
 * the specific structure of each system. Each configuration defines:
 * - The legislature's display name
 * - Its constituent bodies and their properties
 * - Customized headline templates for feedback
 *
 * @example
 * // US Congress configuration
 * const config: LegislatureConfig = {
 *   name: 'Congress',
 *   bodies: [
 *     { id: 'senate', displayName: 'Senate', expectedCount: 2 },
 *     { id: 'house', displayName: 'House', expectedCount: 1 }
 *   ],
 *   headlines: {
 *     success: 'Your voice reached Congress',
 *     partial: 'Your message was delivered',
 *     failure: 'Delivery unsuccessful'
 *   }
 * };
 *
 * @example
 * // UK Parliament configuration
 * const ukConfig: LegislatureConfig = {
 *   name: 'Parliament',
 *   bodies: [
 *     { id: 'commons', displayName: 'House of Commons', expectedCount: 1 },
 *     { id: 'lords', displayName: 'House of Lords' }
 *   ],
 *   headlines: {
 *     success: 'Your voice reached Parliament',
 *     partial: 'Your message was delivered',
 *     failure: 'Delivery unsuccessful'
 *   }
 * };
 */
export interface LegislatureConfig {
	/** Display name for the legislature (e.g., "Congress", "California Legislature") */
	name: string;

	/** Legislative bodies in display order (first body appears first in UI) */
	bodies: LegislativeBody[];

	/** Headline templates for delivery feedback states */
	headlines: HeadlineTemplates;
}

/**
 * Pre-configured legislature configurations
 *
 * These configurations provide ready-to-use setups for common legislature types.
 * Additional configurations can be added as new legislatures are supported.
 *
 * @example
 * // Using the US Congress configuration
 * import { LEGISLATURE_CONFIGS } from './delivery-types';
 * const config = LEGISLATURE_CONFIGS.US_CONGRESS;
 * console.log(config.bodies[0].displayName); // "Senate"
 */
export const LEGISLATURE_CONFIGS = {
	/**
	 * United States Congress configuration
	 * - Senate: 2 senators per state
	 * - House: 1 representative per district
	 */
	US_CONGRESS: {
		name: 'Congress',
		bodies: [
			{ id: 'senate', displayName: 'Senate', expectedCount: 2 },
			{ id: 'house', displayName: 'House', expectedCount: 1 }
		],
		headlines: {
			success: 'Your voice reached Congress',
			partial: 'Your message was delivered',
			failure: 'Delivery unsuccessful'
		}
	}
} as const satisfies Record<string, LegislatureConfig>;

// ============================================================================
// Delivery Results
// ============================================================================

/**
 * Result of a delivery attempt to a single office
 *
 * This interface captures the outcome of attempting to deliver a message
 * to a specific legislative office. It uses generic terminology to support
 * various legislature types:
 *
 * - `body`: The legislative body (e.g., 'senate', 'house', 'assembly')
 * - `jurisdiction`: Primary geographic/administrative unit (e.g., 'CA', 'London')
 * - `subJurisdiction`: Secondary unit if applicable (e.g., district '11')
 *
 * @example
 * // US Senator delivery result
 * const senatorResult: DeliveryResult = {
 *   office: 'Sen. Adam Schiff',
 *   body: 'senate',
 *   jurisdiction: 'CA',
 *   outcome: 'delivered',
 *   confirmationId: 'CWC-2024-001234',
 *   deliveredAt: '2024-01-15T10:30:00Z'
 * };
 *
 * @example
 * // US House representative delivery result
 * const repResult: DeliveryResult = {
 *   office: 'Rep. John Smith',
 *   body: 'house',
 *   jurisdiction: 'CA',
 *   subJurisdiction: '11',
 *   outcome: 'delivered',
 *   confirmationId: 'CWC-2024-001235',
 *   deliveredAt: '2024-01-15T10:30:05Z'
 * };
 *
 * @example
 * // Failed delivery with retry option
 * const failedResult: DeliveryResult = {
 *   office: 'Sen. Jane Doe',
 *   body: 'senate',
 *   jurisdiction: 'NY',
 *   outcome: 'failed',
 *   error: 'Server temporarily unavailable',
 *   errorCode: 'TIMEOUT',
 *   retryable: true
 * };
 */
export interface DeliveryResult {
	/** Office/recipient display name (e.g., "Sen. Adam Schiff", "Rep. John Smith") */
	office: string;

	/**
	 * Legislative body identifier
	 * Must match a body ID from the legislature's configuration
	 * (e.g., 'senate', 'house', 'assembly', 'commons', 'lords')
	 */
	body: string;

	/**
	 * Primary jurisdiction identifier
	 * For US: state abbreviation (e.g., 'CA', 'NY')
	 * For UK: constituency or region
	 * For state legislatures: county or district name
	 */
	jurisdiction: string;

	/**
	 * Sub-jurisdiction identifier (optional)
	 * For US House: district number (e.g., '11')
	 * For state assemblies: district number
	 * Not used for bodies with statewide representation (e.g., US Senate)
	 */
	subJurisdiction?: string;

	/** Outcome of the delivery attempt */
	outcome: OfficeOutcome;

	/** Confirmation ID from the messaging system (on success) */
	confirmationId?: string;

	/** ISO timestamp when message was delivered (on success) */
	deliveredAt?: string;

	/** User-friendly error message (on failure) */
	error?: string;

	/** Technical error code for debugging/logging (on failure) */
	errorCode?: string;

	/** Whether the user can retry this delivery (on failure) */
	retryable?: boolean;
}

// ============================================================================
// Summary Types
// ============================================================================

/**
 * Aggregate summary of delivery outcomes
 *
 * Provides counts for each outcome type, useful for:
 * - Displaying summary statistics in the UI
 * - Determining overall success/partial/failure state
 * - Enabling retry functionality when failures exist
 */
export interface DeliverySummary {
	/** Total number of delivery attempts */
	total: number;

	/** Number of successful deliveries */
	delivered: number;

	/** Number of failed deliveries (potentially retryable) */
	failed: number;

	/** Number of unavailable offices */
	unavailable: number;
}

/**
 * Metadata about the message template used
 *
 * Captures information about the template for analytics,
 * receipt generation, and user reference.
 */
export interface TemplateMetrics {
	/** Template title/name */
	title: string;

	/** Template category (e.g., 'environment', 'healthcare') */
	category?: string;

	/** Topic tags for the template */
	topics?: string[];
}

// ============================================================================
// Animation Timing
// ============================================================================

/**
 * Timing constants for staged reveal animation
 *
 * These values create the perception of work during the delivery feedback
 * journey, even though results may already be known. The staged reveal
 * builds anticipation and provides satisfying visual feedback.
 *
 * All values are in milliseconds.
 */
export const TIMING = {
	// Acknowledgment phase
	/** Immediate visual feedback on click/tap */
	CLICK_RESPONSE: 50,

	// Staged reveal phase (performative - results may already be known)
	/** Duration to build anticipation before reveal starts */
	ANTICIPATION: 600,
	/** Total duration of the progress animation */
	PROGRESS_DURATION: 2400,
	/** Interval between revealing each office result */
	STAGE_INTERVAL: 800,

	// Completion phase
	/** Duration of the celebration pulse animation */
	CELEBRATION_PULSE: 400,
	/** Duration of the final state transition */
	SETTLE: 300,

	// General interactions
	/** Standard UI transition duration */
	TRANSITION: 300,
	/** Hover state transition duration */
	HOVER: 150
} as const;
