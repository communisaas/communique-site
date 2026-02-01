/**
 * Delivery Feedback Components
 *
 * Perceptual engineering approach to CWC submission feedback.
 * Implements staged reveal of immediate results for emotional arc.
 *
 * @see docs/temp/CWC-FEEDBACK-REDESIGN.md
 */

// Types
export type {
	JourneyStage,
	OfficeOutcome,
	DeliveryResult,
	DeliverySummary,
	TemplateMetrics
} from './delivery-types';

export { TIMING } from './delivery-types';

// Utilities
export {
	computeSummary,
	groupByChamber,
	sortByOutcome,
	formatOfficeName,
	formatChamber,
	formatLocation,
	formatTimestamp,
	formatConfirmationId,
	getOutcomeMessage,
	getOutcomeLabel,
	generateReceiptText,
	getRetryableResults,
	hasRetryableResults
} from './delivery-utils';

// Components
export { default as DeliveryJourney } from './DeliveryJourney.svelte';
export { default as DeliveryProgress } from './DeliveryProgress.svelte';
export { default as DeliveryConfirmation } from './DeliveryConfirmation.svelte';
export { default as OfficeDetails } from './OfficeDetails.svelte';
export { default as DeliveryProof } from './DeliveryProof.svelte';
export { default as Confetti } from './Confetti.svelte';
