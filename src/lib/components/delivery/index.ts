/**
 * Delivery Feedback Components
 *
 * A complete UI system for legislature message delivery feedback.
 * Supports staged reveal, celebration animations, and detailed receipts.
 *
 * ## Supported Legislatures
 * - US Congress (default)
 * - State legislatures
 * - International parliaments (via custom config)
 *
 * ## Usage
 * ```svelte
 * <script>
 *   import { DeliveryJourney, LEGISLATURE_CONFIGS } from '$lib/components/delivery';
 * </script>
 *
 * <DeliveryJourney
 *   {submissionId}
 *   {results}
 *   config={LEGISLATURE_CONFIGS.US_CONGRESS}
 * />
 * ```
 *
 * ## Future: mailto: Delivery
 * These components are designed for API-verified delivery (legislature APIs).
 * For decision-maker delivery via mailto:, a separate component set will be needed
 * with trust-based or optimistic confirmation patterns.
 */

// Types
export type {
	JourneyStage,
	OfficeOutcome,
	DeliveryResult,
	DeliverySummary,
	TemplateMetrics,
	LegislatureConfig,
	LegislativeBody,
	HeadlineTemplates
} from './delivery-types';

export { TIMING, LEGISLATURE_CONFIGS } from './delivery-types';

// Utilities
export {
	computeSummary,
	groupByBody,
	sortByOutcome,
	formatOfficeName,
	formatBody,
	formatLocation,
	formatTimestamp,
	formatConfirmationId,
	getOutcomeMessage,
	getOutcomeLabel,
	getHeadline,
	generateReceiptText,
	getRetryableResults,
	hasRetryableResults
} from './delivery-utils';

// Components
export { default as DeliveryJourney } from './DeliveryJourney.svelte';
export { default as DeliveryProgress } from './DeliveryProgress.svelte';
export { default as DeliveryConfirmation } from './DeliveryConfirmation.svelte';
export { default as DeliveryProof } from './DeliveryProof.svelte';
export { default as OfficeDetails } from './OfficeDetails.svelte';
export { default as Confetti } from './Confetti.svelte';
