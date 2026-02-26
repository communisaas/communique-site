/**
 * Shared debate statistics utilities.
 * Pure functions for stance counting, percentage math, and time formatting.
 * Used by DebateSignal, MobileDebateBanner, and ActiveDebatePanel.
 */

export interface StanceCounts {
	support: number;
	oppose: number;
	amend: number;
}

export interface StancePercentages {
	supportPct: number;
	opposePct: number;
	amendPct: number;
}

/**
 * Count arguments by stance.
 */
export function computeStanceCounts(
	args: Array<{ stance: string }> | undefined | null
): StanceCounts {
	if (!args) return { support: 0, oppose: 0, amend: 0 };
	return {
		support: args.filter((a) => a.stance === 'SUPPORT').length,
		oppose: args.filter((a) => a.stance === 'OPPOSE').length,
		amend: args.filter((a) => a.stance === 'AMEND').length
	};
}

/**
 * Compute stance percentages with a 2% visual floor.
 * The floor only applies to stances with at least 1 argument.
 * amendPct takes the remainder, clamped to >= 0.
 */
export function computeStancePercentages(counts: StanceCounts): StancePercentages {
	const total = counts.support + counts.oppose + counts.amend;
	if (total === 0) return { supportPct: 0, opposePct: 0, amendPct: 0 };

	const supportPct = counts.support > 0 ? Math.max(2, (counts.support / total) * 100) : 0;
	const opposePct = counts.oppose > 0 ? Math.max(2, (counts.oppose / total) * 100) : 0;
	const amendPct = Math.max(0, 100 - supportPct - opposePct);

	return { supportPct, opposePct, amendPct };
}

/**
 * Format a deadline into a human-readable remaining time string.
 * Returns empty string if no deadline.
 */
export function formatTimeRemaining(deadline: string | undefined | null): string {
	if (!deadline) return '';
	const now = Date.now();
	const deadlineMs = new Date(deadline).getTime();
	const diff = deadlineMs - now;
	if (diff <= 0) return 'ended';
	const hours = Math.floor(diff / (1000 * 60 * 60));
	const days = Math.floor(hours / 24);
	if (days > 0) return `${days}d left`;
	if (hours > 0) return `${hours}h left`;
	const mins = Math.floor(diff / (1000 * 60));
	return `${mins}m left`;
}
