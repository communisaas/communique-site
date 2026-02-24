/**
 * Epsilon Budget Tracker
 *
 * In-memory enforcement of the daily differential privacy budget.
 *
 * WHY THIS EXISTS:
 * MAX_DAILY_EPSILON is defined in metrics.ts but was never enforced.
 * Without enforcement, unlimited queries could erode privacy guarantees
 * through composition: running k queries with epsilon_1..epsilon_k
 * yields total privacy loss of SUM(epsilon_i).
 *
 * DESIGN:
 * - In-memory singleton (no DB dependency, no Node.js APIs)
 * - Resets automatically at UTC midnight
 * - Fails closed: if budget is exhausted, queries are rejected
 * - Compatible with Cloudflare Workers (no Node.js-specific APIs)
 *
 * LIMITATION:
 * This is per-process/per-isolate. In a multi-instance deployment,
 * each isolate tracks its own budget independently. For production
 * multi-instance enforcement, use the privacy_budget DB table as
 * the source of truth (snapshot.ts already writes to it).
 */

import { PRIVACY } from '$lib/types/analytics';

// =============================================================================
// TYPES
// =============================================================================

export interface BudgetStatus {
	/** Current UTC date string (YYYY-MM-DD) */
	date: string;
	/** Total epsilon spent today */
	spent: number;
	/** Remaining epsilon before budget exhaustion */
	remaining: number;
	/** Daily limit */
	limit: number;
	/** Whether the budget is exhausted */
	exhausted: boolean;
}

// =============================================================================
// BUDGET STATE
// =============================================================================

/** Current UTC date string for the active budget window */
let currentDate: string = getUTCDateString();

/** Cumulative epsilon spent in the current day */
let epsilonSpent: number = 0;

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Get today's date as a UTC string (YYYY-MM-DD)
 *
 * Uses only standard Date APIs (no Node.js-specific calls).
 */
function getUTCDateString(): string {
	const now = new Date();
	const year = now.getUTCFullYear();
	const month = String(now.getUTCMonth() + 1).padStart(2, '0');
	const day = String(now.getUTCDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Reset the budget if the UTC date has changed
 *
 * Called automatically before every spend/query operation.
 * Can also be called explicitly (e.g., from a cron handler).
 */
export function resetIfNewDay(): void {
	const today = getUTCDateString();
	if (today !== currentDate) {
		currentDate = today;
		epsilonSpent = 0;
	}
}

/**
 * Attempt to spend epsilon from the daily budget
 *
 * @param amount - Epsilon to spend (must be positive)
 * @returns true if the spend was accepted, false if it would exceed the budget
 *
 * FAIL-CLOSED: Returns false (rejects the query) when budget is exhausted.
 * This is the correct behavior for differential privacy -- allowing queries
 * without noise would be worse than refusing them entirely.
 */
export function spendEpsilon(amount: number): boolean {
	if (amount <= 0) {
		return true;
	}

	resetIfNewDay();

	if (epsilonSpent + amount > PRIVACY.MAX_DAILY_EPSILON) {
		return false;
	}

	epsilonSpent += amount;
	return true;
}

/**
 * Get the remaining epsilon budget for today
 *
 * @returns Remaining epsilon (always >= 0)
 */
export function remainingBudget(): number {
	resetIfNewDay();
	return Math.max(0, PRIVACY.MAX_DAILY_EPSILON - epsilonSpent);
}

/**
 * Get full budget status for diagnostics/API responses
 */
export function getBudgetSnapshot(): BudgetStatus {
	resetIfNewDay();
	return {
		date: currentDate,
		spent: epsilonSpent,
		remaining: Math.max(0, PRIVACY.MAX_DAILY_EPSILON - epsilonSpent),
		limit: PRIVACY.MAX_DAILY_EPSILON,
		exhausted: epsilonSpent >= PRIVACY.MAX_DAILY_EPSILON
	};
}

/**
 * Reset budget state for testing
 *
 * WARNING: Only use in tests. Clears all budget state.
 */
export function resetBudgetForTesting(): void {
	currentDate = getUTCDateString();
	epsilonSpent = 0;
}

/**
 * Override the current date for testing
 *
 * WARNING: Only use in tests. Forces a specific date for budget tracking.
 */
export function setDateForTesting(dateStr: string): void {
	currentDate = dateStr;
	epsilonSpent = 0;
}

// =============================================================================
// ERROR
// =============================================================================

/**
 * Thrown when an operation would exceed the daily epsilon budget
 *
 * Callers should catch this and return an appropriate error response
 * rather than proceeding without noise (which would be a privacy violation).
 */
export class PrivacyBudgetExhaustedError extends Error {
	/** Epsilon that was requested but could not be spent */
	readonly requested: number;
	/** Epsilon remaining in the budget */
	readonly remaining: number;
	/** Daily epsilon limit */
	readonly limit: number;

	constructor(requested: number) {
		const rem = remainingBudget();
		super(
			`[Analytics] Privacy budget exhausted. ` +
				`Requested epsilon=${requested}, remaining=${rem}, ` +
				`daily limit=${PRIVACY.MAX_DAILY_EPSILON}. ` +
				`Queries are blocked to preserve differential privacy guarantees. ` +
				`Budget resets at 00:00 UTC.`
		);
		this.name = 'PrivacyBudgetExhaustedError';
		this.requested = requested;
		this.remaining = rem;
		this.limit = PRIVACY.MAX_DAILY_EPSILON;
	}
}
