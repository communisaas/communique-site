/**
 * Epsilon Budget Enforcement Tests
 *
 * The daily epsilon budget is the foundation of composition safety in
 * differential privacy. Without enforcement, unlimited queries erode
 * the privacy guarantee: running k queries with epsilon_1..epsilon_k
 * yields total privacy loss of SUM(epsilon_i).
 *
 * This test suite verifies:
 * - Budget tracking arithmetic is correct
 * - Budget exhaustion is enforced (fail-closed)
 * - Sequential composition accounting (total = sum of spends)
 * - Daily reset at UTC midnight boundary
 * - Edge cases (zero, negative, fractional epsilon)
 * - PrivacyBudgetExhaustedError carries correct diagnostics
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
	spendEpsilon,
	remainingBudget,
	getBudgetSnapshot,
	resetBudgetForTesting,
	setDateForTesting,
	PrivacyBudgetExhaustedError,
	type BudgetStatus
} from '$lib/core/analytics/budget';
import { PRIVACY } from '$lib/types/analytics';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** MAX_DAILY_EPSILON from config, used throughout for clarity */
const MAX = PRIVACY.MAX_DAILY_EPSILON; // 10.0

describe('Budget Tracking Basics', () => {
	beforeEach(() => {
		resetBudgetForTesting();
	});

	it('should start with full budget (MAX_DAILY_EPSILON remaining)', () => {
		expect(remainingBudget()).toBe(MAX);
	});

	it('should deduct epsilon correctly after a single spend', () => {
		const accepted = spendEpsilon(1.0);

		expect(accepted).toBe(true);
		expect(remainingBudget()).toBe(MAX - 1.0);
	});

	it('should reflect cumulative spending across multiple spends', () => {
		spendEpsilon(2.0);
		spendEpsilon(3.0);

		expect(remainingBudget()).toBe(MAX - 5.0);
	});

	it('should return correct BudgetStatus from getBudgetSnapshot', () => {
		spendEpsilon(3.5);

		const snap: BudgetStatus = getBudgetSnapshot();

		expect(snap.spent).toBe(3.5);
		expect(snap.remaining).toBe(MAX - 3.5);
		expect(snap.limit).toBe(MAX);
		expect(snap.exhausted).toBe(false);
		// date should be a YYYY-MM-DD string
		expect(snap.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it('should return BudgetStatus with exhausted=false when budget is partially used', () => {
		spendEpsilon(5.0);

		const snap = getBudgetSnapshot();

		expect(snap.exhausted).toBe(false);
		expect(snap.remaining).toBe(5.0);
	});
});

describe('Budget Exhaustion', () => {
	beforeEach(() => {
		resetBudgetForTesting();
	});

	it('should accept 10 spends of 1.0 (total = MAX_DAILY_EPSILON)', () => {
		for (let i = 0; i < 10; i++) {
			expect(spendEpsilon(1.0)).toBe(true);
		}

		expect(remainingBudget()).toBe(0);
	});

	it('should reject the 11th spend of 1.0', () => {
		// Exhaust the budget
		for (let i = 0; i < 10; i++) {
			spendEpsilon(1.0);
		}

		// 11th spend must be rejected
		expect(spendEpsilon(1.0)).toBe(false);
	});

	it('should reject a partial spend that would exceed remaining budget', () => {
		// Spend 9.5, leaving 0.5
		spendEpsilon(9.5);
		expect(remainingBudget()).toBe(0.5);

		// Requesting 1.0 when only 0.5 remains => rejected
		expect(spendEpsilon(1.0)).toBe(false);

		// Budget should be unchanged after rejection
		expect(remainingBudget()).toBe(0.5);
	});

	it('should report exhausted=true when budget is fully consumed', () => {
		spendEpsilon(MAX);

		const snap = getBudgetSnapshot();

		expect(snap.exhausted).toBe(true);
		expect(snap.remaining).toBe(0);
		expect(snap.spent).toBe(MAX);
	});

	it('should reject all subsequent spends after exhaustion', () => {
		spendEpsilon(MAX);

		// Multiple attempts should all fail
		expect(spendEpsilon(0.001)).toBe(false);
		expect(spendEpsilon(1.0)).toBe(false);
		expect(spendEpsilon(MAX)).toBe(false);
	});

	it('should not deduct from budget on rejected spend', () => {
		spendEpsilon(9.0);
		const beforeReject = remainingBudget();

		// This would exceed the budget
		spendEpsilon(2.0);

		// Budget should be unchanged
		expect(remainingBudget()).toBe(beforeReject);
	});
});

describe('Composition Property', () => {
	beforeEach(() => {
		resetBudgetForTesting();
	});

	it('should track total epsilon as the sum of all successful spends', () => {
		const amounts = [1.0, 2.0, 0.5, 1.5, 3.0];
		const expectedTotal = amounts.reduce((sum, a) => sum + a, 0); // 8.0

		for (const amount of amounts) {
			spendEpsilon(amount);
		}

		const snap = getBudgetSnapshot();

		expect(snap.spent).toBeCloseTo(expectedTotal, 10);
		expect(snap.remaining).toBeCloseTo(MAX - expectedTotal, 10);
	});

	it('should not count rejected spends in the total', () => {
		spendEpsilon(9.0);

		// These will be rejected (9.0 + 2.0 > 10.0)
		spendEpsilon(2.0);
		spendEpsilon(3.0);

		const snap = getBudgetSnapshot();

		expect(snap.spent).toBe(9.0);
		expect(snap.remaining).toBe(1.0);
	});

	it('should handle many small spends correctly (floating-point stress test)', () => {
		const smallAmount = 0.1;
		const count = 100; // 100 * 0.1 = 10.0 = MAX

		for (let i = 0; i < count; i++) {
			expect(spendEpsilon(smallAmount)).toBe(true);
		}

		// Due to floating-point arithmetic, the remaining should be very close to 0
		// but we need to be tolerant of IEEE 754 representation artifacts
		expect(remainingBudget()).toBeCloseTo(0, 10);
	});
});

describe('Daily Reset', () => {
	beforeEach(() => {
		resetBudgetForTesting();
	});

	it('should fully restore budget after date change', () => {
		// Exhaust budget on "day 1"
		setDateForTesting('2026-01-01');
		spendEpsilon(MAX);

		expect(remainingBudget()).toBe(0);

		// Simulate next day
		setDateForTesting('2026-01-02');

		// Budget should be fully available after date change
		// (remainingBudget calls resetIfNewDay internally, but setDateForTesting
		// already resets epsilonSpent, so we need to verify via fresh spend)
		expect(remainingBudget()).toBe(MAX);
		expect(getBudgetSnapshot().exhausted).toBe(false);
	});

	it('should not carry over spending from previous day', () => {
		setDateForTesting('2026-06-15');
		spendEpsilon(7.0);

		expect(getBudgetSnapshot().spent).toBe(7.0);

		// Move to next day
		setDateForTesting('2026-06-16');

		const snap = getBudgetSnapshot();
		expect(snap.spent).toBe(0);
		expect(snap.remaining).toBe(MAX);
	});

	it('should allow full spending on the new day', () => {
		setDateForTesting('2026-03-01');
		spendEpsilon(MAX);
		expect(spendEpsilon(1.0)).toBe(false);

		// New day
		setDateForTesting('2026-03-02');

		// Should be able to spend the full budget again
		expect(spendEpsilon(MAX)).toBe(true);
		expect(remainingBudget()).toBe(0);
	});

	it('should reflect current UTC date in BudgetStatus after reset', () => {
		// setDateForTesting forces a specific date internally, but every public
		// API call (getBudgetSnapshot, remainingBudget, spendEpsilon) invokes
		// resetIfNewDay(), which compares the forced date against the real UTC
		// date. If they differ, the budget resets to today.
		//
		// This means setDateForTesting is primarily useful for simulating a
		// "previous day" that then triggers a reset when the next API call
		// detects the date has changed (i.e., today != forced date).
		//
		// Verify: after setDateForTesting with a past date, the next
		// getBudgetSnapshot sees a date mismatch and resets to today.
		setDateForTesting('2025-01-01');

		const snap = getBudgetSnapshot();

		// getBudgetSnapshot called resetIfNewDay, which detected the date
		// mismatch and reset currentDate to the real UTC date (today).
		const now = new Date();
		const expectedDate = [
			now.getUTCFullYear(),
			String(now.getUTCMonth() + 1).padStart(2, '0'),
			String(now.getUTCDate()).padStart(2, '0')
		].join('-');

		expect(snap.date).toBe(expectedDate);
		expect(snap.spent).toBe(0);
	});
});

describe('Edge Cases', () => {
	beforeEach(() => {
		resetBudgetForTesting();
	});

	it('should accept spendEpsilon(0) without changing budget', () => {
		const before = remainingBudget();

		expect(spendEpsilon(0)).toBe(true);
		expect(remainingBudget()).toBe(before);
	});

	it('should accept negative epsilon as a no-op', () => {
		const before = remainingBudget();

		expect(spendEpsilon(-1.0)).toBe(true);
		expect(remainingBudget()).toBe(before);
	});

	it('should accept spendEpsilon(0) even when budget is exhausted', () => {
		spendEpsilon(MAX);

		// Zero spend should still be accepted — it costs nothing
		expect(spendEpsilon(0)).toBe(true);
	});

	it('should accept negative epsilon even when budget is exhausted', () => {
		spendEpsilon(MAX);

		// Negative is a no-op and costs nothing
		expect(spendEpsilon(-5.0)).toBe(true);
	});

	it('should accumulate very small epsilon amounts correctly', () => {
		const tiny = 0.001;
		let count = 0;

		while (spendEpsilon(tiny)) {
			count++;
			// Safety valve to prevent infinite loop in case of bug
			if (count > 20000) break;
		}

		// 10.0 / 0.001 = 10000 spends
		// Due to floating-point, might be 9999 or 10000
		expect(count).toBeGreaterThanOrEqual(9999);
		expect(count).toBeLessThanOrEqual(10001);
	});

	it('should succeed when spending exactly MAX_DAILY_EPSILON in one call', () => {
		expect(spendEpsilon(MAX)).toBe(true);
		expect(remainingBudget()).toBe(0);
		expect(getBudgetSnapshot().exhausted).toBe(true);
	});

	it('should reject a single spend that exceeds MAX_DAILY_EPSILON', () => {
		expect(spendEpsilon(MAX + 0.001)).toBe(false);

		// Budget should remain untouched
		expect(remainingBudget()).toBe(MAX);
	});
});

describe('PrivacyBudgetExhaustedError', () => {
	beforeEach(() => {
		resetBudgetForTesting();
	});

	it('should have the correct name property', () => {
		const err = new PrivacyBudgetExhaustedError(1.0);

		expect(err.name).toBe('PrivacyBudgetExhaustedError');
	});

	it('should be an instance of Error', () => {
		const err = new PrivacyBudgetExhaustedError(1.0);

		expect(err).toBeInstanceOf(Error);
		expect(err).toBeInstanceOf(PrivacyBudgetExhaustedError);
	});

	it('should capture the requested epsilon amount', () => {
		const err = new PrivacyBudgetExhaustedError(2.5);

		expect(err.requested).toBe(2.5);
	});

	it('should capture the remaining budget at time of construction', () => {
		spendEpsilon(7.0);

		const err = new PrivacyBudgetExhaustedError(5.0);

		expect(err.remaining).toBe(3.0);
	});

	it('should capture the daily limit', () => {
		const err = new PrivacyBudgetExhaustedError(1.0);

		expect(err.limit).toBe(MAX);
	});

	it('should include useful diagnostic info in the message', () => {
		spendEpsilon(8.0);
		const err = new PrivacyBudgetExhaustedError(3.0);

		expect(err.message).toContain('Privacy budget exhausted');
		expect(err.message).toContain('epsilon=3');
		expect(err.message).toContain('remaining=2');
		expect(err.message).toContain(`daily limit=${MAX}`);
		expect(err.message).toContain('00:00 UTC');
	});

	it('should have readonly fields', () => {
		const err = new PrivacyBudgetExhaustedError(1.0);

		// TypeScript enforces readonly at compile time. At runtime, we verify
		// the fields are present and have the expected types.
		expect(typeof err.requested).toBe('number');
		expect(typeof err.remaining).toBe('number');
		expect(typeof err.limit).toBe('number');
	});

	it('should reflect zero remaining when budget is fully exhausted', () => {
		spendEpsilon(MAX);

		const err = new PrivacyBudgetExhaustedError(1.0);

		expect(err.remaining).toBe(0);
	});
});

describe('Integration: Budget + Config Consistency', () => {
	beforeEach(() => {
		resetBudgetForTesting();
	});

	it('should use MAX_DAILY_EPSILON = 10.0 from PRIVACY config', () => {
		expect(PRIVACY.MAX_DAILY_EPSILON).toBe(10.0);
		expect(getBudgetSnapshot().limit).toBe(10.0);
	});

	it('should allow exactly MAX_DAILY_EPSILON / SERVER_EPSILON snapshot materializations', () => {
		const materializationsAllowed = Math.floor(MAX / PRIVACY.SERVER_EPSILON);

		// Each materialization costs SERVER_EPSILON = 1.0
		for (let i = 0; i < materializationsAllowed; i++) {
			expect(spendEpsilon(PRIVACY.SERVER_EPSILON)).toBe(true);
		}

		// Next one should be rejected
		expect(spendEpsilon(PRIVACY.SERVER_EPSILON)).toBe(false);
		expect(materializationsAllowed).toBe(10);
	});

	it('should correctly report SERVER_EPSILON = 1.0', () => {
		expect(PRIVACY.SERVER_EPSILON).toBe(1.0);
	});
});

/**
 * Integration with applyLaplaceWithBudget in coarsen.ts
 *
 * applyLaplaceWithBudget is a private (non-exported) function in coarsen.ts.
 * It wraps applyLaplace and calls spendEpsilon, throwing
 * PrivacyBudgetExhaustedError when the budget is exceeded.
 *
 * Since it is not exported, we cannot import it directly. Instead, we verify
 * the contract it depends on: that spendEpsilon returns false when budget is
 * exceeded, and that PrivacyBudgetExhaustedError can be thrown and caught
 * with the correct fields. This is the same pattern coarsen.ts uses internally.
 */
describe('Integration: Budget Exhaustion Error Contract (coarsen.ts pattern)', () => {
	beforeEach(() => {
		resetBudgetForTesting();
	});

	it('should support the throw-on-false pattern used by applyLaplaceWithBudget', () => {
		// Simulate the pattern from coarsen.ts:
		//   if (!spendEpsilon(epsilon)) throw new PrivacyBudgetExhaustedError(epsilon);

		spendEpsilon(MAX); // exhaust budget

		const epsilon = PRIVACY.SERVER_EPSILON;

		expect(() => {
			if (!spendEpsilon(epsilon)) {
				throw new PrivacyBudgetExhaustedError(epsilon);
			}
		}).toThrow(PrivacyBudgetExhaustedError);
	});

	it('should not throw when budget is available (normal path)', () => {
		const epsilon = PRIVACY.SERVER_EPSILON;

		expect(() => {
			if (!spendEpsilon(epsilon)) {
				throw new PrivacyBudgetExhaustedError(epsilon);
			}
		}).not.toThrow();
	});

	it('should carry correct fields when caught in a try/catch', () => {
		spendEpsilon(9.5); // leave 0.5

		const epsilon = 1.0;

		try {
			if (!spendEpsilon(epsilon)) {
				throw new PrivacyBudgetExhaustedError(epsilon);
			}
			// Should not reach here
			expect.unreachable('Should have thrown PrivacyBudgetExhaustedError');
		} catch (err) {
			expect(err).toBeInstanceOf(PrivacyBudgetExhaustedError);
			if (err instanceof PrivacyBudgetExhaustedError) {
				expect(err.requested).toBe(1.0);
				expect(err.remaining).toBe(0.5);
				expect(err.limit).toBe(MAX);
			}
		}
	});
});
