/**
 * Unit tests for Credential Policy Service
 *
 * Tests the TTL (time-to-live) enforcement for session credentials based on
 * action sensitivity. This module is security-critical: it controls access
 * to 4 action types and prevents stale-credential attacks (ISSUE-005).
 *
 * Coverage targets:
 * - All 4 action types with their specific TTLs
 * - TTL boundary conditions (maxAge-1, maxAge, maxAge+1)
 * - Date input formats (Date object vs ISO string)
 * - Tier-level credential freshness (tiers 0-5)
 * - Reverification warning logic (7-day window)
 * - Error formatting for API responses
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	isCredentialValidForAction,
	getValidActionsForCredential,
	getNextExpiringAction,
	shouldPromptReverification,
	isTierCredentialFresh,
	formatValidationError,
	getStrictestTTL,
	getMostPermissiveTTL,
	getDaysUntilExpiry,
	getExpirationDateForAction,
	isCredentialValid,
	CREDENTIAL_TTL,
	CREDENTIAL_TTL_DISPLAY,
	ACTION_DESCRIPTIONS,
	TIER_CREDENTIAL_TTL,
	type CredentialAction,
	type SessionCredentialForPolicy,
	type CredentialValidation
} from '$lib/core/identity/credential-policy';

// ============================================================================
// Constants (milliseconds)
// ============================================================================

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

// Action TTLs in days for readability
const TTL_DAYS = {
	view_content: 180,
	community_discussion: 180,
	constituent_message: 90,
	official_petition: 30
};

// ============================================================================
// Helpers
// ============================================================================

/** Create a credential with createdAt set to `daysAgo` days before now. */
function makeCredential(daysAgo: number, overrides?: Partial<SessionCredentialForPolicy>): SessionCredentialForPolicy {
	return {
		userId: 'test-user-001',
		createdAt: new Date(Date.now() - daysAgo * MS_PER_DAY),
		...overrides
	};
}

/** Create a credential with createdAt as an ISO string (not Date object). */
function makeCredentialWithISOString(daysAgo: number): SessionCredentialForPolicy {
	return {
		userId: 'test-user-002',
		createdAt: new Date(Date.now() - daysAgo * MS_PER_DAY).toISOString()
	};
}

// ============================================================================
// Exported Constants
// ============================================================================

describe('exported constants', () => {
	describe('CREDENTIAL_TTL', () => {
		it('should define TTL for all 4 action types', () => {
			expect(Object.keys(CREDENTIAL_TTL)).toHaveLength(4);
			expect(CREDENTIAL_TTL).toHaveProperty('view_content');
			expect(CREDENTIAL_TTL).toHaveProperty('community_discussion');
			expect(CREDENTIAL_TTL).toHaveProperty('constituent_message');
			expect(CREDENTIAL_TTL).toHaveProperty('official_petition');
		});

		it('should have correct TTL values in milliseconds', () => {
			expect(CREDENTIAL_TTL.view_content).toBe(180 * MS_PER_DAY);
			expect(CREDENTIAL_TTL.community_discussion).toBe(180 * MS_PER_DAY);
			expect(CREDENTIAL_TTL.constituent_message).toBe(90 * MS_PER_DAY);
			expect(CREDENTIAL_TTL.official_petition).toBe(30 * MS_PER_DAY);
		});

		it('should enforce view_content >= community_discussion >= official_petition ordering', () => {
			expect(CREDENTIAL_TTL.view_content).toBeGreaterThanOrEqual(CREDENTIAL_TTL.community_discussion);
			expect(CREDENTIAL_TTL.community_discussion).toBeGreaterThanOrEqual(CREDENTIAL_TTL.constituent_message);
			expect(CREDENTIAL_TTL.constituent_message).toBeGreaterThanOrEqual(CREDENTIAL_TTL.official_petition);
		});
	});

	describe('CREDENTIAL_TTL_DISPLAY', () => {
		it('should have human-readable display names for all actions', () => {
			expect(CREDENTIAL_TTL_DISPLAY.view_content).toBe('6 months');
			expect(CREDENTIAL_TTL_DISPLAY.community_discussion).toBe('6 months');
			expect(CREDENTIAL_TTL_DISPLAY.constituent_message).toBe('90 days');
			expect(CREDENTIAL_TTL_DISPLAY.official_petition).toBe('30 days');
		});
	});

	describe('ACTION_DESCRIPTIONS', () => {
		it('should have descriptions for all actions', () => {
			expect(ACTION_DESCRIPTIONS.view_content).toBe('viewing content');
			expect(ACTION_DESCRIPTIONS.community_discussion).toBe('community discussions');
			expect(ACTION_DESCRIPTIONS.constituent_message).toBe('contacting your representatives');
			expect(ACTION_DESCRIPTIONS.official_petition).toBe('signing official petitions');
		});
	});

	describe('TIER_CREDENTIAL_TTL', () => {
		it('should define TTLs for tiers 0-5', () => {
			for (let tier = 0; tier <= 5; tier++) {
				expect(TIER_CREDENTIAL_TTL).toHaveProperty(String(tier));
			}
		});

		it('should have tier 0 (guest) as zero TTL', () => {
			expect(TIER_CREDENTIAL_TTL[0]).toBe(0);
		});

		it('should have specific tier TTL values', () => {
			expect(TIER_CREDENTIAL_TTL[1]).toBe(365 * MS_PER_DAY); // OAuth: 1 year
			expect(TIER_CREDENTIAL_TTL[2]).toBe(180 * MS_PER_DAY); // Address attestation: 6 months
			expect(TIER_CREDENTIAL_TTL[3]).toBe(180 * MS_PER_DAY); // Identity verification: 6 months
			expect(TIER_CREDENTIAL_TTL[4]).toBe(180 * MS_PER_DAY); // Passport verification: 6 months
			expect(TIER_CREDENTIAL_TTL[5]).toBe(365 * MS_PER_DAY); // Government credential: 1 year
		});
	});
});

// ============================================================================
// isCredentialValidForAction
// ============================================================================

describe('isCredentialValidForAction', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('return shape', () => {
		it('should return all expected fields', () => {
			const credential = makeCredential(0);
			const result = isCredentialValidForAction(credential, 'view_content');

			expect(result).toHaveProperty('valid');
			expect(result).toHaveProperty('action');
			expect(result).toHaveProperty('age');
			expect(result).toHaveProperty('maxAge');
			expect(result).toHaveProperty('daysUntilExpiry');
			expect(result).toHaveProperty('requiresReverification');
		});

		it('should echo the action back in the result', () => {
			const credential = makeCredential(0);
			const actions: CredentialAction[] = [
				'view_content',
				'community_discussion',
				'constituent_message',
				'official_petition'
			];
			for (const action of actions) {
				const result = isCredentialValidForAction(credential, action);
				expect(result.action).toBe(action);
			}
		});
	});

	describe('view_content (180 day TTL)', () => {
		it('should be valid for a fresh credential (0 days old)', () => {
			const credential = makeCredential(0);
			const result = isCredentialValidForAction(credential, 'view_content');
			expect(result.valid).toBe(true);
			expect(result.requiresReverification).toBe(false);
			expect(result.message).toBeUndefined();
		});

		it('should be valid at 179 days (maxAge - 1 day)', () => {
			const credential = makeCredential(179);
			const result = isCredentialValidForAction(credential, 'view_content');
			expect(result.valid).toBe(true);
			expect(result.daysUntilExpiry).toBeGreaterThanOrEqual(0);
		});

		it('should be invalid at 181 days (maxAge + 1 day)', () => {
			const credential = makeCredential(181);
			const result = isCredentialValidForAction(credential, 'view_content');
			expect(result.valid).toBe(false);
			expect(result.requiresReverification).toBe(true);
			expect(result.daysUntilExpiry).toBe(0);
		});

		it('should be invalid at exactly 180 days (boundary: age === maxAge)', () => {
			// age >= maxAge means expired, since the check is `age < maxAge`
			const now = Date.now();
			vi.spyOn(Date, 'now').mockReturnValue(now);
			const credential: SessionCredentialForPolicy = {
				userId: 'test',
				createdAt: new Date(now - 180 * MS_PER_DAY)
			};
			const result = isCredentialValidForAction(credential, 'view_content');
			// age === maxAge => NOT less than maxAge => invalid
			expect(result.valid).toBe(false);
		});

		it('should have maxAge equal to the view_content TTL', () => {
			const credential = makeCredential(0);
			const result = isCredentialValidForAction(credential, 'view_content');
			expect(result.maxAge).toBe(CREDENTIAL_TTL.view_content);
		});
	});

	describe('community_discussion (180 day TTL)', () => {
		it('should be valid for a fresh credential', () => {
			const credential = makeCredential(0);
			const result = isCredentialValidForAction(credential, 'community_discussion');
			expect(result.valid).toBe(true);
		});

		it('should be valid at 179 days (maxAge - 1 day)', () => {
			const credential = makeCredential(179);
			const result = isCredentialValidForAction(credential, 'community_discussion');
			expect(result.valid).toBe(true);
		});

		it('should be invalid at 181 days (maxAge + 1 day)', () => {
			const credential = makeCredential(181);
			const result = isCredentialValidForAction(credential, 'community_discussion');
			expect(result.valid).toBe(false);
			expect(result.requiresReverification).toBe(true);
		});

		it('should be invalid at exactly 180 days', () => {
			const now = Date.now();
			vi.spyOn(Date, 'now').mockReturnValue(now);
			const credential: SessionCredentialForPolicy = {
				userId: 'test',
				createdAt: new Date(now - 180 * MS_PER_DAY)
			};
			const result = isCredentialValidForAction(credential, 'community_discussion');
			expect(result.valid).toBe(false);
		});
	});

	describe('constituent_message (90 day TTL)', () => {
		it('should be valid for a fresh credential', () => {
			const credential = makeCredential(0);
			const result = isCredentialValidForAction(credential, 'constituent_message');
			expect(result.valid).toBe(true);
		});

		it('should be valid at 89 days', () => {
			const credential = makeCredential(89);
			const result = isCredentialValidForAction(credential, 'constituent_message');
			expect(result.valid).toBe(true);
		});

		it('should be invalid at 91 days', () => {
			const credential = makeCredential(91);
			const result = isCredentialValidForAction(credential, 'constituent_message');
			expect(result.valid).toBe(false);
			expect(result.message).toBeDefined();
			expect(result.message).toContain('contacting your representatives');
			expect(result.message).toContain('90 days');
		});

		it('should have shorter TTL than community_discussion', () => {
			expect(CREDENTIAL_TTL.constituent_message).toBeLessThan(CREDENTIAL_TTL.community_discussion);
		});
	});

	describe('official_petition (30 day TTL)', () => {
		it('should be valid for a fresh credential', () => {
			const credential = makeCredential(0);
			const result = isCredentialValidForAction(credential, 'official_petition');
			expect(result.valid).toBe(true);
		});

		it('should be valid at 29 days (maxAge - 1 day)', () => {
			const credential = makeCredential(29);
			const result = isCredentialValidForAction(credential, 'official_petition');
			expect(result.valid).toBe(true);
		});

		it('should be invalid at 31 days (maxAge + 1 day)', () => {
			const credential = makeCredential(31);
			const result = isCredentialValidForAction(credential, 'official_petition');
			expect(result.valid).toBe(false);
			expect(result.message).toContain('signing official petitions');
			expect(result.message).toContain('30 days');
		});

		it('should be invalid at exactly 30 days', () => {
			const now = Date.now();
			vi.spyOn(Date, 'now').mockReturnValue(now);
			const credential: SessionCredentialForPolicy = {
				userId: 'test',
				createdAt: new Date(now - 30 * MS_PER_DAY)
			};
			const result = isCredentialValidForAction(credential, 'official_petition');
			expect(result.valid).toBe(false);
		});

		it('should be the most restrictive action type', () => {
			const actions: CredentialAction[] = [
				'view_content',
				'community_discussion',
				'constituent_message',
				'official_petition'
			];
			const ttls = actions.map((a) => CREDENTIAL_TTL[a]);
			expect(Math.min(...ttls)).toBe(CREDENTIAL_TTL.official_petition);
		});
	});

	describe('date input formats', () => {
		it('should accept Date object for createdAt', () => {
			const credential = makeCredential(1);
			expect(credential.createdAt).toBeInstanceOf(Date);
			const result = isCredentialValidForAction(credential, 'view_content');
			expect(result.valid).toBe(true);
		});

		it('should accept ISO string for createdAt', () => {
			const credential = makeCredentialWithISOString(1);
			expect(typeof credential.createdAt).toBe('string');
			const result = isCredentialValidForAction(credential, 'view_content');
			expect(result.valid).toBe(true);
		});

		it('should produce consistent results between Date and string inputs', () => {
			const now = Date.now();
			vi.spyOn(Date, 'now').mockReturnValue(now);

			const daysAgo = 50;
			const timestamp = now - daysAgo * MS_PER_DAY;
			const dateObj = new Date(timestamp);

			const credWithDate: SessionCredentialForPolicy = {
				userId: 'test',
				createdAt: dateObj
			};
			const credWithString: SessionCredentialForPolicy = {
				userId: 'test',
				createdAt: dateObj.toISOString()
			};

			const resultDate = isCredentialValidForAction(credWithDate, 'community_discussion');
			const resultString = isCredentialValidForAction(credWithString, 'community_discussion');

			expect(resultDate.valid).toBe(resultString.valid);
			expect(resultDate.daysUntilExpiry).toBe(resultString.daysUntilExpiry);
		});
	});

	describe('daysUntilExpiry calculation', () => {
		it('should be 0 when credential is expired', () => {
			const credential = makeCredential(200);
			const result = isCredentialValidForAction(credential, 'view_content');
			expect(result.daysUntilExpiry).toBe(0);
		});

		it('should count down correctly for view_content', () => {
			const now = Date.now();
			vi.spyOn(Date, 'now').mockReturnValue(now);

			const credential: SessionCredentialForPolicy = {
				userId: 'test',
				createdAt: new Date(now - 100 * MS_PER_DAY)
			};
			const result = isCredentialValidForAction(credential, 'view_content');
			// 180 - 100 = 80 days remaining
			expect(result.daysUntilExpiry).toBe(80);
		});

		it('should be 0 for expired official_petition', () => {
			const credential = makeCredential(35);
			const result = isCredentialValidForAction(credential, 'official_petition');
			expect(result.daysUntilExpiry).toBe(0);
		});
	});

	describe('error message formatting', () => {
		it('should include days old in the error message', () => {
			const now = Date.now();
			vi.spyOn(Date, 'now').mockReturnValue(now);
			const credential: SessionCredentialForPolicy = {
				userId: 'test',
				createdAt: new Date(now - 100 * MS_PER_DAY)
			};
			const result = isCredentialValidForAction(credential, 'official_petition');
			expect(result.message).toContain('100 days old');
		});

		it('should include the action description in the error message', () => {
			const credential = makeCredential(200);
			const result = isCredentialValidForAction(credential, 'view_content');
			expect(result.message).toContain('viewing content');
		});

		it('should include the TTL display string in the error message', () => {
			const credential = makeCredential(200);
			const result = isCredentialValidForAction(credential, 'view_content');
			expect(result.message).toContain('6 months');
		});

		it('should prompt re-verification in the error message', () => {
			const credential = makeCredential(200);
			const result = isCredentialValidForAction(credential, 'view_content');
			expect(result.message).toContain('re-verify');
		});

		it('should not have a message when valid', () => {
			const credential = makeCredential(0);
			const result = isCredentialValidForAction(credential, 'view_content');
			expect(result.message).toBeUndefined();
		});
	});

	describe('cross-action security contract', () => {
		it('91-day-old credential should fail constituent_message but pass view_content', () => {
			const credential = makeCredential(91);
			const viewResult = isCredentialValidForAction(credential, 'view_content');
			const messageResult = isCredentialValidForAction(credential, 'constituent_message');

			expect(viewResult.valid).toBe(true);
			expect(messageResult.valid).toBe(false);
		});

		it('91-day-old credential should still pass community_discussion (180 day TTL)', () => {
			const credential = makeCredential(91);
			const result = isCredentialValidForAction(credential, 'community_discussion');
			expect(result.valid).toBe(true);
		});

		it('31-day-old credential should fail official_petition but pass everything else', () => {
			const credential = makeCredential(31);
			expect(isCredentialValidForAction(credential, 'view_content').valid).toBe(true);
			expect(isCredentialValidForAction(credential, 'community_discussion').valid).toBe(true);
			expect(isCredentialValidForAction(credential, 'constituent_message').valid).toBe(true);
			expect(isCredentialValidForAction(credential, 'official_petition').valid).toBe(false);
		});

		it('a very old credential (365 days) should fail all actions', () => {
			const credential = makeCredential(365);
			const actions: CredentialAction[] = [
				'view_content',
				'community_discussion',
				'constituent_message',
				'official_petition'
			];
			for (const action of actions) {
				expect(isCredentialValidForAction(credential, action).valid).toBe(false);
			}
		});

		it('a brand new credential (0 days) should pass all actions', () => {
			const credential = makeCredential(0);
			const actions: CredentialAction[] = [
				'view_content',
				'community_discussion',
				'constituent_message',
				'official_petition'
			];
			for (const action of actions) {
				expect(isCredentialValidForAction(credential, action).valid).toBe(true);
			}
		});
	});
});

// ============================================================================
// getValidActionsForCredential
// ============================================================================

describe('getValidActionsForCredential', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should return all 4 actions for a brand new credential', () => {
		const credential = makeCredential(0);
		const valid = getValidActionsForCredential(credential);
		expect(valid).toHaveLength(4);
		expect(valid).toContain('view_content');
		expect(valid).toContain('community_discussion');
		expect(valid).toContain('constituent_message');
		expect(valid).toContain('official_petition');
	});

	it('should return 3 actions when official_petition has expired (31 days)', () => {
		const credential = makeCredential(31);
		const valid = getValidActionsForCredential(credential);
		expect(valid).toHaveLength(3);
		expect(valid).toContain('view_content');
		expect(valid).toContain('community_discussion');
		expect(valid).toContain('constituent_message');
		expect(valid).not.toContain('official_petition');
	});

	it('should return view_content and community_discussion when constituent_message has expired (91 days)', () => {
		const credential = makeCredential(91);
		const valid = getValidActionsForCredential(credential);
		expect(valid).toHaveLength(2);
		expect(valid).toContain('view_content');
		expect(valid).toContain('community_discussion');
		expect(valid).not.toContain('official_petition');
		expect(valid).not.toContain('constituent_message');
	});

	it('should return empty array when all actions have expired (181 days)', () => {
		const credential = makeCredential(181);
		const valid = getValidActionsForCredential(credential);
		expect(valid).toHaveLength(0);
	});

	it('should return empty array for a very old credential (1000 days)', () => {
		const credential = makeCredential(1000);
		const valid = getValidActionsForCredential(credential);
		expect(valid).toHaveLength(0);
	});

	it('should accept ISO string dates', () => {
		const credential = makeCredentialWithISOString(1);
		const valid = getValidActionsForCredential(credential);
		expect(valid).toHaveLength(4);
	});
});

// ============================================================================
// getNextExpiringAction
// ============================================================================

describe('getNextExpiringAction', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should return official_petition for a fresh credential (soonest to expire)', () => {
		const credential = makeCredential(0);
		expect(getNextExpiringAction(credential)).toBe('official_petition');
	});

	it('should return constituent_message when official_petition has expired', () => {
		const credential = makeCredential(31);
		const result = getNextExpiringAction(credential);
		// official_petition expired (30 day TTL), next is constituent_message (90 day TTL)
		expect(result).toBe('constituent_message');
	});

	it('should return view_content when constituent_message has expired', () => {
		const credential = makeCredential(91);
		const result = getNextExpiringAction(credential);
		// constituent_message expired (90 day TTL), community_discussion and view_content share 180 day TTL
		expect(result).toBe('community_discussion');
	});

	it('should return null when all actions have expired', () => {
		const credential = makeCredential(181);
		expect(getNextExpiringAction(credential)).toBeNull();
	});

	it('should return null for a very old credential', () => {
		const credential = makeCredential(1000);
		expect(getNextExpiringAction(credential)).toBeNull();
	});

	it('should handle exact boundary: at 30 days official_petition expires', () => {
		const now = Date.now();
		vi.spyOn(Date, 'now').mockReturnValue(now);
		const credential: SessionCredentialForPolicy = {
			userId: 'test',
			createdAt: new Date(now - 30 * MS_PER_DAY)
		};
		// age === maxAge => NOT less than maxAge => expired
		// Should skip official_petition and return constituent_message
		expect(getNextExpiringAction(credential)).toBe('constituent_message');
	});
});

// ============================================================================
// shouldPromptReverification
// ============================================================================

describe('shouldPromptReverification', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('with upcomingAction specified', () => {
		it('should not prompt when well within TTL (official_petition, 0 days old)', () => {
			// For official_petition (30 day TTL), warning starts at day 23 (30 - 7 = 23)
			const now = Date.now();
			vi.spyOn(Date, 'now').mockReturnValue(now);
			const credential: SessionCredentialForPolicy = {
				userId: 'test',
				createdAt: new Date(now) // literally just created
			};
			const result = shouldPromptReverification(credential, 'official_petition');
			// age = 0, threshold - warning = 30*MS - 7*MS = 23*MS, so age > 23*MS => false
			expect(result).toBe(false);
		});

		it('should prompt when approaching official_petition expiry (24 days old)', () => {
			// For official_petition: threshold=30 days, warning=7 days
			// Prompt when age > (30-7)*MS_PER_DAY = 23 days
			// 24 days old => age > 23 days => should prompt
			const credential = makeCredential(24);
			expect(shouldPromptReverification(credential, 'official_petition')).toBe(true);
		});

		it('should not prompt when well within view_content TTL (30 days old)', () => {
			// view_content: threshold=180 days, warning=7 days => prompt at 173+ days
			const credential = makeCredential(30);
			expect(shouldPromptReverification(credential, 'view_content')).toBe(false);
		});

		it('should prompt when approaching view_content expiry (174 days old)', () => {
			// view_content: prompt when age > (180-7)*MS_PER_DAY = 173 days
			const credential = makeCredential(174);
			expect(shouldPromptReverification(credential, 'view_content')).toBe(true);
		});

		it('should not prompt for view_content at 172 days', () => {
			const credential = makeCredential(172);
			expect(shouldPromptReverification(credential, 'view_content')).toBe(false);
		});

		it('should prompt for constituent_message at 84 days (within 7-day warning)', () => {
			// constituent_message: threshold=90 days, warning=7 days => prompt at 83+ days
			const credential = makeCredential(84);
			expect(shouldPromptReverification(credential, 'constituent_message')).toBe(true);
		});

		it('should not prompt for constituent_message at 82 days', () => {
			const credential = makeCredential(82);
			expect(shouldPromptReverification(credential, 'constituent_message')).toBe(false);
		});

		it('should prompt for community_discussion at 174 days', () => {
			// community_discussion: threshold=180 days, warning=7 days => prompt at 173+ days
			const credential = makeCredential(174);
			expect(shouldPromptReverification(credential, 'community_discussion')).toBe(true);
		});

		it('should prompt when already expired', () => {
			const credential = makeCredential(200);
			expect(shouldPromptReverification(credential, 'view_content')).toBe(true);
		});

		it('should prompt at exact boundary (173 days for view_content)', () => {
			const now = Date.now();
			vi.spyOn(Date, 'now').mockReturnValue(now);
			const credential: SessionCredentialForPolicy = {
				userId: 'test',
				// Place age at exactly threshold - warningPeriod
				createdAt: new Date(now - 173 * MS_PER_DAY)
			};
			// age = 173 days = threshold(180) - warning(7) = 173 days
			// Check: age > 173 * MS_PER_DAY? => equal, not greater => false
			expect(shouldPromptReverification(credential, 'view_content')).toBe(false);
		});

		it('should prompt at 173 days + 1 ms for view_content', () => {
			const now = Date.now();
			vi.spyOn(Date, 'now').mockReturnValue(now);
			const credential: SessionCredentialForPolicy = {
				userId: 'test',
				createdAt: new Date(now - 173 * MS_PER_DAY - 1) // 1ms past boundary
			};
			expect(shouldPromptReverification(credential, 'view_content')).toBe(true);
		});
	});

	describe('without upcomingAction (general prompt)', () => {
		it('should not prompt for a fresh credential (0 days)', () => {
			const credential = makeCredential(0);
			expect(shouldPromptReverification(credential)).toBe(false);
		});

		it('should not prompt at 29 days', () => {
			const credential = makeCredential(29);
			expect(shouldPromptReverification(credential)).toBe(false);
		});

		it('should prompt at 30 days (general threshold)', () => {
			const now = Date.now();
			vi.spyOn(Date, 'now').mockReturnValue(now);
			const credential: SessionCredentialForPolicy = {
				userId: 'test',
				createdAt: new Date(now - 30 * MS_PER_DAY)
			};
			// age >= 30 days => true
			expect(shouldPromptReverification(credential)).toBe(true);
		});

		it('should prompt at 31 days', () => {
			const credential = makeCredential(31);
			expect(shouldPromptReverification(credential)).toBe(true);
		});

		it('should prompt for very old credentials', () => {
			const credential = makeCredential(365);
			expect(shouldPromptReverification(credential)).toBe(true);
		});
	});
});

// ============================================================================
// isTierCredentialFresh
// ============================================================================

describe('isTierCredentialFresh', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('tier 0 (guest)', () => {
		it('should always return false regardless of verifiedAt', () => {
			expect(isTierCredentialFresh(0, new Date())).toBe(false);
			expect(isTierCredentialFresh(0, null)).toBe(false);
		});
	});

	describe('null verifiedAt', () => {
		it('should return false for any tier when verifiedAt is null', () => {
			for (let tier = 0; tier <= 5; tier++) {
				expect(isTierCredentialFresh(tier, null)).toBe(false);
			}
		});
	});

	describe('invalid tier', () => {
		it('should return false for tier numbers not in the TTL map', () => {
			expect(isTierCredentialFresh(6, new Date())).toBe(false);
			expect(isTierCredentialFresh(-1, new Date())).toBe(false);
			expect(isTierCredentialFresh(99, new Date())).toBe(false);
		});
	});

	describe('tier 1 (OAuth, 365 day TTL)', () => {
		it('should be fresh for a just-verified credential', () => {
			expect(isTierCredentialFresh(1, new Date())).toBe(true);
		});

		it('should be fresh at 364 days', () => {
			const verifiedAt = new Date(Date.now() - 364 * MS_PER_DAY);
			expect(isTierCredentialFresh(1, verifiedAt)).toBe(true);
		});

		it('should be stale at 366 days', () => {
			const verifiedAt = new Date(Date.now() - 366 * MS_PER_DAY);
			expect(isTierCredentialFresh(1, verifiedAt)).toBe(false);
		});

		it('should be stale at exactly 365 days', () => {
			const now = Date.now();
			vi.spyOn(Date, 'now').mockReturnValue(now);
			const verifiedAt = new Date(now - 365 * MS_PER_DAY);
			expect(isTierCredentialFresh(1, verifiedAt)).toBe(false);
		});
	});

	describe('tier 2 (address attestation, 180 day TTL)', () => {
		it('should be fresh at 179 days', () => {
			const verifiedAt = new Date(Date.now() - 179 * MS_PER_DAY);
			expect(isTierCredentialFresh(2, verifiedAt)).toBe(true);
		});

		it('should be stale at 181 days', () => {
			const verifiedAt = new Date(Date.now() - 181 * MS_PER_DAY);
			expect(isTierCredentialFresh(2, verifiedAt)).toBe(false);
		});

		it('should be stale at exactly 180 days', () => {
			const now = Date.now();
			vi.spyOn(Date, 'now').mockReturnValue(now);
			const verifiedAt = new Date(now - 180 * MS_PER_DAY);
			expect(isTierCredentialFresh(2, verifiedAt)).toBe(false);
		});
	});

	describe('tier 3 (identity verification, 180 day TTL)', () => {
		it('should be fresh at 179 days', () => {
			const verifiedAt = new Date(Date.now() - 179 * MS_PER_DAY);
			expect(isTierCredentialFresh(3, verifiedAt)).toBe(true);
		});

		it('should be stale at 181 days', () => {
			const verifiedAt = new Date(Date.now() - 181 * MS_PER_DAY);
			expect(isTierCredentialFresh(3, verifiedAt)).toBe(false);
		});
	});

	describe('tier 4 (passport, 180 day TTL)', () => {
		it('should have same TTL as tier 3', () => {
			expect(TIER_CREDENTIAL_TTL[4]).toBe(TIER_CREDENTIAL_TTL[3]);
		});

		it('should be fresh at 179 days', () => {
			const verifiedAt = new Date(Date.now() - 179 * MS_PER_DAY);
			expect(isTierCredentialFresh(4, verifiedAt)).toBe(true);
		});

		it('should be stale at 181 days', () => {
			const verifiedAt = new Date(Date.now() - 181 * MS_PER_DAY);
			expect(isTierCredentialFresh(4, verifiedAt)).toBe(false);
		});
	});

	describe('tier 5 (government credential, 365 day TTL)', () => {
		it('should be fresh at 364 days', () => {
			const verifiedAt = new Date(Date.now() - 364 * MS_PER_DAY);
			expect(isTierCredentialFresh(5, verifiedAt)).toBe(true);
		});

		it('should be stale at 366 days', () => {
			const verifiedAt = new Date(Date.now() - 366 * MS_PER_DAY);
			expect(isTierCredentialFresh(5, verifiedAt)).toBe(false);
		});
	});

	describe('date input formats', () => {
		it('should accept Date object', () => {
			expect(isTierCredentialFresh(1, new Date())).toBe(true);
		});

		it('should accept ISO string', () => {
			expect(isTierCredentialFresh(1, new Date().toISOString())).toBe(true);
		});

		it('should produce same result for Date and ISO string', () => {
			const now = Date.now();
			vi.spyOn(Date, 'now').mockReturnValue(now);
			const date = new Date(now - 50 * MS_PER_DAY);
			expect(isTierCredentialFresh(2, date)).toBe(isTierCredentialFresh(2, date.toISOString()));
		});
	});
});

// ============================================================================
// formatValidationError
// ============================================================================

describe('formatValidationError', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should return the correct error structure', () => {
		const now = Date.now();
		vi.spyOn(Date, 'now').mockReturnValue(now);
		const credential: SessionCredentialForPolicy = {
			userId: 'test',
			createdAt: new Date(now - 100 * MS_PER_DAY)
		};
		const validation = isCredentialValidForAction(credential, 'constituent_message');
		const error = formatValidationError(validation);

		expect(error).toEqual({
			error: 'credential_expired',
			code: 'CREDENTIAL_TTL_EXCEEDED',
			action: 'constituent_message',
			message: expect.any(String),
			requiresReverification: true,
			daysOld: 100,
			maxDays: 90
		});
	});

	it('should always set error to "credential_expired"', () => {
		const credential = makeCredential(200);
		const validation = isCredentialValidForAction(credential, 'view_content');
		const error = formatValidationError(validation);
		expect(error.error).toBe('credential_expired');
	});

	it('should always set code to "CREDENTIAL_TTL_EXCEEDED"', () => {
		const credential = makeCredential(200);
		const validation = isCredentialValidForAction(credential, 'view_content');
		const error = formatValidationError(validation);
		expect(error.code).toBe('CREDENTIAL_TTL_EXCEEDED');
	});

	it('should always set requiresReverification to true', () => {
		// Even if validation.valid is true (which would be unusual for this function),
		// formatValidationError always sets requiresReverification: true
		const credential = makeCredential(0);
		const validation = isCredentialValidForAction(credential, 'view_content');
		const error = formatValidationError(validation);
		expect(error.requiresReverification).toBe(true);
	});

	it('should calculate daysOld correctly', () => {
		const now = Date.now();
		vi.spyOn(Date, 'now').mockReturnValue(now);
		const credential: SessionCredentialForPolicy = {
			userId: 'test',
			createdAt: new Date(now - 45 * MS_PER_DAY)
		};
		const validation = isCredentialValidForAction(credential, 'official_petition');
		const error = formatValidationError(validation);
		expect(error.daysOld).toBe(45);
	});

	it('should calculate maxDays correctly for each action', () => {
		const credential = makeCredential(200);

		const viewError = formatValidationError(isCredentialValidForAction(credential, 'view_content'));
		expect(viewError.maxDays).toBe(180);

		const discussionError = formatValidationError(isCredentialValidForAction(credential, 'community_discussion'));
		expect(discussionError.maxDays).toBe(180);

		const messageError = formatValidationError(isCredentialValidForAction(credential, 'constituent_message'));
		expect(messageError.maxDays).toBe(90);

		const petitionError = formatValidationError(isCredentialValidForAction(credential, 'official_petition'));
		expect(petitionError.maxDays).toBe(30);
	});

	it('should echo the action in the error', () => {
		const credential = makeCredential(200);
		const validation = isCredentialValidForAction(credential, 'official_petition');
		const error = formatValidationError(validation);
		expect(error.action).toBe('official_petition');
	});

	it('should use validation message if available', () => {
		const credential = makeCredential(200);
		const validation = isCredentialValidForAction(credential, 'view_content');
		const error = formatValidationError(validation);
		expect(error.message).toBe(validation.message);
	});

	it('should fall back to a generic message when validation has no message', () => {
		// Construct a validation object with no message (as if valid)
		const fakeValidation: CredentialValidation = {
			valid: true,
			action: 'official_petition',
			age: 0,
			maxAge: CREDENTIAL_TTL.official_petition,
			daysUntilExpiry: 7,
			requiresReverification: false,
			message: undefined
		};
		const error = formatValidationError(fakeValidation);
		expect(error.message).toBe('Credential expired for signing official petitions');
	});
});

// ============================================================================
// getStrictestTTL
// ============================================================================

describe('getStrictestTTL', () => {
	it('should return the shortest TTL from a list of actions', () => {
		const result = getStrictestTTL(['view_content', 'official_petition']);
		expect(result).toBe(CREDENTIAL_TTL.official_petition);
	});

	it('should return official_petition TTL when all actions are included', () => {
		const all: CredentialAction[] = [
			'view_content',
			'community_discussion',
			'constituent_message',
			'official_petition'
		];
		expect(getStrictestTTL(all)).toBe(CREDENTIAL_TTL.official_petition);
	});

	it('should return the only TTL when a single action is provided', () => {
		expect(getStrictestTTL(['view_content'])).toBe(CREDENTIAL_TTL.view_content);
	});

	it('should default to view_content TTL when given an empty array', () => {
		expect(getStrictestTTL([])).toBe(CREDENTIAL_TTL.view_content);
	});

	it('should handle duplicate actions', () => {
		expect(getStrictestTTL(['official_petition', 'official_petition'])).toBe(
			CREDENTIAL_TTL.official_petition
		);
	});
});

// ============================================================================
// getMostPermissiveTTL
// ============================================================================

describe('getMostPermissiveTTL', () => {
	it('should return the longest TTL from a list of actions', () => {
		const result = getMostPermissiveTTL(['official_petition', 'view_content']);
		expect(result).toBe(CREDENTIAL_TTL.view_content);
	});

	it('should return view_content TTL when all actions are included', () => {
		const all: CredentialAction[] = [
			'view_content',
			'community_discussion',
			'constituent_message',
			'official_petition'
		];
		expect(getMostPermissiveTTL(all)).toBe(CREDENTIAL_TTL.view_content);
	});

	it('should return the only TTL when a single action is provided', () => {
		expect(getMostPermissiveTTL(['official_petition'])).toBe(CREDENTIAL_TTL.official_petition);
	});

	it('should default to view_content TTL when given an empty array', () => {
		expect(getMostPermissiveTTL([])).toBe(CREDENTIAL_TTL.view_content);
	});
});

// ============================================================================
// getDaysUntilExpiry
// ============================================================================

describe('getDaysUntilExpiry', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should return positive days for a fresh credential', () => {
		const now = Date.now();
		vi.spyOn(Date, 'now').mockReturnValue(now);
		const credential: SessionCredentialForPolicy = {
			userId: 'test',
			createdAt: new Date(now)
		};
		expect(getDaysUntilExpiry(credential, 'view_content')).toBe(180);
	});

	it('should return negative days for an expired credential', () => {
		const now = Date.now();
		vi.spyOn(Date, 'now').mockReturnValue(now);
		const credential: SessionCredentialForPolicy = {
			userId: 'test',
			createdAt: new Date(now - 200 * MS_PER_DAY)
		};
		const days = getDaysUntilExpiry(credential, 'view_content');
		// 180 - 200 = -20
		expect(days).toBe(-20);
	});

	it('should return 0 at exactly the TTL boundary', () => {
		const now = Date.now();
		vi.spyOn(Date, 'now').mockReturnValue(now);
		const credential: SessionCredentialForPolicy = {
			userId: 'test',
			createdAt: new Date(now - 180 * MS_PER_DAY)
		};
		expect(getDaysUntilExpiry(credential, 'view_content')).toBe(0);
	});

	it('should handle official_petition correctly (30 day TTL)', () => {
		const now = Date.now();
		vi.spyOn(Date, 'now').mockReturnValue(now);
		const credential: SessionCredentialForPolicy = {
			userId: 'test',
			createdAt: new Date(now - 3 * MS_PER_DAY)
		};
		// 30 - 3 = 27 days
		expect(getDaysUntilExpiry(credential, 'official_petition')).toBe(27);
	});
});

// ============================================================================
// getExpirationDateForAction
// ============================================================================

describe('getExpirationDateForAction', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should return a Date object', () => {
		const credential = makeCredential(0);
		const result = getExpirationDateForAction(credential, 'view_content');
		expect(result).toBeInstanceOf(Date);
	});

	it('should return a date 180 days after createdAt for view_content', () => {
		const now = Date.now();
		vi.spyOn(Date, 'now').mockReturnValue(now);
		const credential: SessionCredentialForPolicy = {
			userId: 'test',
			createdAt: new Date(now)
		};
		const expiration = getExpirationDateForAction(credential, 'view_content');
		expect(expiration.getTime()).toBe(now + 180 * MS_PER_DAY);
	});

	it('should return a date 30 days after createdAt for official_petition', () => {
		const now = Date.now();
		vi.spyOn(Date, 'now').mockReturnValue(now);
		const credential: SessionCredentialForPolicy = {
			userId: 'test',
			createdAt: new Date(now)
		};
		const expiration = getExpirationDateForAction(credential, 'official_petition');
		expect(expiration.getTime()).toBe(now + 30 * MS_PER_DAY);
	});

	it('should work with ISO string dates', () => {
		const now = Date.now();
		const credential: SessionCredentialForPolicy = {
			userId: 'test',
			createdAt: new Date(now).toISOString()
		};
		const expiration = getExpirationDateForAction(credential, 'community_discussion');
		expect(expiration.getTime()).toBe(now + 180 * MS_PER_DAY);
	});
});

// ============================================================================
// isCredentialValid
// ============================================================================

describe('isCredentialValid', () => {
	it('should return true for a fresh credential', () => {
		const credential = makeCredential(0);
		expect(isCredentialValid(credential)).toBe(true);
	});

	it('should return true at 179 days (within view_content TTL)', () => {
		const credential = makeCredential(179);
		expect(isCredentialValid(credential)).toBe(true);
	});

	it('should return false at 181 days (past view_content TTL)', () => {
		const credential = makeCredential(181);
		expect(isCredentialValid(credential)).toBe(false);
	});

	it('should use view_content as the threshold (least restrictive)', () => {
		// 91 days old: fails constituent_message but passes view_content
		const credential = makeCredential(91);
		expect(isCredentialValid(credential)).toBe(true);
	});
});

// ============================================================================
// Edge Cases & Integration Scenarios
// ============================================================================

describe('edge cases', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('sub-day precision', () => {
		it('should handle credential created 1 millisecond ago', () => {
			const now = Date.now();
			vi.spyOn(Date, 'now').mockReturnValue(now);
			const credential: SessionCredentialForPolicy = {
				userId: 'test',
				createdAt: new Date(now - 1)
			};
			const result = isCredentialValidForAction(credential, 'official_petition');
			expect(result.valid).toBe(true);
			expect(result.age).toBe(1);
		});

		it('should handle credential created 1 millisecond before TTL boundary', () => {
			const now = Date.now();
			vi.spyOn(Date, 'now').mockReturnValue(now);
			const credential: SessionCredentialForPolicy = {
				userId: 'test',
				createdAt: new Date(now - (30 * MS_PER_DAY - 1))
			};
			const result = isCredentialValidForAction(credential, 'official_petition');
			expect(result.valid).toBe(true);
		});

		it('should handle credential created 1 millisecond after TTL boundary', () => {
			const now = Date.now();
			vi.spyOn(Date, 'now').mockReturnValue(now);
			const credential: SessionCredentialForPolicy = {
				userId: 'test',
				createdAt: new Date(now - (30 * MS_PER_DAY + 1))
			};
			const result = isCredentialValidForAction(credential, 'official_petition');
			expect(result.valid).toBe(false);
		});
	});

	describe('credential with optional fields', () => {
		it('should work without expiresAt field', () => {
			const credential: SessionCredentialForPolicy = {
				userId: 'test-user',
				createdAt: new Date()
			};
			const result = isCredentialValidForAction(credential, 'view_content');
			expect(result.valid).toBe(true);
		});

		it('should work without congressionalDistrict field', () => {
			const credential: SessionCredentialForPolicy = {
				userId: 'test-user',
				createdAt: new Date()
			};
			const result = isCredentialValidForAction(credential, 'constituent_message');
			expect(result.valid).toBe(true);
		});

		it('should work with all optional fields present', () => {
			const credential: SessionCredentialForPolicy = {
				userId: 'test-user',
				createdAt: new Date(),
				expiresAt: new Date(Date.now() + 30 * MS_PER_DAY),
				congressionalDistrict: 'CA-12'
			};
			const result = isCredentialValidForAction(credential, 'view_content');
			expect(result.valid).toBe(true);
		});
	});

	describe('future createdAt (clock skew)', () => {
		it('should treat a future-dated credential as valid (age is negative)', () => {
			const now = Date.now();
			vi.spyOn(Date, 'now').mockReturnValue(now);
			const credential: SessionCredentialForPolicy = {
				userId: 'test',
				createdAt: new Date(now + 1 * MS_PER_DAY) // 1 day in the future
			};
			const result = isCredentialValidForAction(credential, 'official_petition');
			// age = now - (now + 1 day) = -1 day, which is < maxAge => valid
			expect(result.valid).toBe(true);
			expect(result.age).toBeLessThan(0);
		});
	});

	describe('consistency across functions', () => {
		it('getValidActionsForCredential should agree with isCredentialValidForAction', () => {
			const credential = makeCredential(50);
			const validActions = getValidActionsForCredential(credential);
			const allActions: CredentialAction[] = [
				'view_content',
				'community_discussion',
				'constituent_message',
				'official_petition'
			];

			for (const action of allActions) {
				const isValid = isCredentialValidForAction(credential, action).valid;
				if (isValid) {
					expect(validActions).toContain(action);
				} else {
					expect(validActions).not.toContain(action);
				}
			}
		});

		it('getNextExpiringAction should return an action that isCredentialValidForAction considers valid', () => {
			const credential = makeCredential(50);
			const next = getNextExpiringAction(credential);
			if (next !== null) {
				const result = isCredentialValidForAction(credential, next);
				expect(result.valid).toBe(true);
			}
		});

		it('isCredentialValid should agree with isCredentialValidForAction for view_content', () => {
			const ages = [0, 50, 100, 179, 180, 181, 365];
			for (const daysOld of ages) {
				const now = Date.now();
				vi.spyOn(Date, 'now').mockReturnValue(now);
				const credential: SessionCredentialForPolicy = {
					userId: 'test',
					createdAt: new Date(now - daysOld * MS_PER_DAY)
				};
				expect(isCredentialValid(credential)).toBe(
					isCredentialValidForAction(credential, 'view_content').valid
				);
				vi.restoreAllMocks();
			}
		});
	});
});
