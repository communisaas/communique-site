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

// ═══════════════════════════════════════════════════════════════════════════
// LMSR PRICE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/** Map of argumentIndex → stance, derived from DebateData.arguments */
export type ArgumentStanceMap = Record<number, 'SUPPORT' | 'OPPOSE' | 'AMEND'>;

/**
 * Compute stance percentages from LMSR prices.
 *
 * Groups argument-level prices by stance, sums each group, and normalizes
 * to percentages. Applies the same 2% visual floor as computeStancePercentages.
 *
 * LMSR SEMANTICS: Prices are a probability distribution that sums to 1.
 * Multiple arguments can share the same stance — we sum their probabilities
 * to get the aggregate belief in each stance.
 *
 * @param prices           - argumentIndex → price (decimal string, e.g. "0.42")
 * @param argumentStances  - argumentIndex → stance
 * @returns StancePercentages (same shape as computeStancePercentages output)
 */
export function computeLMSRPercentages(
	prices: Record<number, string>,
	argumentStances: ArgumentStanceMap
): StancePercentages {
	let supportSum = 0;
	let opposeSum = 0;
	let amendSum = 0;

	for (const [indexStr, priceStr] of Object.entries(prices)) {
		const idx = Number(indexStr);
		const price = Number(priceStr);
		if (isNaN(price)) continue;

		const stance = argumentStances[idx];
		if (stance === 'SUPPORT') supportSum += price;
		else if (stance === 'OPPOSE') opposeSum += price;
		else if (stance === 'AMEND') amendSum += price;
		// Arguments without a known stance are ignored (shouldn't occur in practice)
	}

	const total = supportSum + opposeSum + amendSum;
	if (total === 0) return { supportPct: 0, opposePct: 0, amendPct: 0 };

	const supportPct = supportSum > 0 ? Math.max(2, (supportSum / total) * 100) : 0;
	const opposePct = opposeSum > 0 ? Math.max(2, (opposeSum / total) * 100) : 0;
	const amendPct = Math.max(0, 100 - supportPct - opposePct);

	return { supportPct, opposePct, amendPct };
}

/** The leading stance and its rounded percentage. */
export interface LeadingStance {
	stance: 'SUPPORT' | 'OPPOSE' | 'AMEND';
	label: string; // Human-readable: "Support", "Oppose", "Amend"
	pct: number;   // Rounded integer (e.g. 62)
}

const STANCE_LABELS: Record<string, string> = {
	SUPPORT: 'Support',
	OPPOSE: 'Oppose',
	AMEND: 'Amend'
};

/**
 * Identify the leading stance from LMSR percentages.
 *
 * Returns the stance with the highest percentage, formatted for display
 * as "Amend 62%". Returns null if all percentages are zero.
 */
export function getLeadingStance(pcts: StancePercentages): LeadingStance | null {
	const { supportPct, opposePct, amendPct } = pcts;
	if (supportPct === 0 && opposePct === 0 && amendPct === 0) return null;

	if (supportPct >= opposePct && supportPct >= amendPct) {
		return { stance: 'SUPPORT', label: STANCE_LABELS.SUPPORT, pct: Math.round(supportPct) };
	}
	if (opposePct >= supportPct && opposePct >= amendPct) {
		return { stance: 'OPPOSE', label: STANCE_LABELS.OPPOSE, pct: Math.round(opposePct) };
	}
	return { stance: 'AMEND', label: STANCE_LABELS.AMEND, pct: Math.round(amendPct) };
}

/**
 * Build an ArgumentStanceMap from DebateData.arguments.
 *
 * Convenience function to extract the argumentIndex→stance mapping
 * needed by computeLMSRPercentages.
 */
export function buildArgumentStanceMap(
	args: Array<{ argumentIndex: number; stance: string }> | undefined | null
): ArgumentStanceMap {
	if (!args) return {};
	const map: ArgumentStanceMap = {};
	for (const a of args) {
		if (a.stance === 'SUPPORT' || a.stance === 'OPPOSE' || a.stance === 'AMEND') {
			map[a.argumentIndex] = a.stance;
		}
	}
	return map;
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
