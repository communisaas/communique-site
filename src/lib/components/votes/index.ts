/**
 * Legislative Vote UI Components
 *
 * Progressive disclosure pattern (L1/L2/L3) for congressional vote display:
 *
 * - L1 (VoteIndicator): Peripheral awareness - color-coded badge for scanning
 * - L2 (VoteContext): Recognition card - hover preview with party breakdown
 * - L3 (RollCall): Focal immersion - full roll call with filtering
 *
 * Design follows perceptual engineering principles:
 * - 300ms hover delay for L2 activation
 * - Color semantics: Green (Yea), Red (Nay), Gray (Not Voting), Yellow (Present)
 * - Party colors: Blue (D), Red (R), Purple (I)
 * - WCAG AA contrast compliance
 * - Reduced motion support
 *
 * @example
 * ```svelte
 * import { VoteIndicator, VoteContext, RollCall } from '$lib/components/votes';
 * import type { VoteRecord, RollCallVote } from '$lib/components/votes';
 * ```
 */

// Component exports
export { default as VoteIndicator } from './VoteIndicator.svelte';
export { default as VoteContext } from './VoteContext.svelte';
export { default as RollCall } from './RollCall.svelte';

// Type exports
export type {
	VotePosition,
	VoteResult,
	PartyAffiliation,
	PartyBreakdown,
	VoteRecord,
	RollCallMember,
	RollCallVote,
	VoteIndicatorSize,
	SortDirection,
	SortableColumn,
	PartyFilter,
	PositionFilter
} from './types';
