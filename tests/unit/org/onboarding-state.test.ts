import { describe, it, expect } from 'vitest';

/**
 * Tests for onboarding state derivation logic.
 *
 * The onboarding state is computed in the org dashboard page.server.ts.
 * We test the derivation logic directly since it's pure computation.
 */

interface OnboardingState {
	hasDescription: boolean;
	hasSupporters: boolean;
	hasCampaigns: boolean;
	hasTeam: boolean;
	hasSentEmail: boolean;
}

/** Reproduce the onboarding derivation from org/[slug]/+page.server.ts */
function deriveOnboardingState(data: {
	description: string | null;
	totalSupporters: number;
	campaignCount: number;
	teamCount: number;
	sentEmailCount: number;
}): OnboardingState {
	return {
		hasDescription: !!data.description,
		hasSupporters: data.totalSupporters > 0,
		hasCampaigns: data.campaignCount > 0,
		hasTeam: data.teamCount > 1, // >1 because the org creator is always a member
		hasSentEmail: data.sentEmailCount > 0
	};
}

function isOnboardingComplete(state: OnboardingState): boolean {
	return state.hasSupporters && state.hasCampaigns;
}

describe('deriveOnboardingState', () => {
	it('should return all false for a brand new org', () => {
		const state = deriveOnboardingState({
			description: null,
			totalSupporters: 0,
			campaignCount: 0,
			teamCount: 1, // just the creator
			sentEmailCount: 0
		});
		expect(state).toEqual({
			hasDescription: false,
			hasSupporters: false,
			hasCampaigns: false,
			hasTeam: false,
			hasSentEmail: false
		});
	});

	it('should detect description', () => {
		const state = deriveOnboardingState({
			description: 'Our mission is...',
			totalSupporters: 0,
			campaignCount: 0,
			teamCount: 1,
			sentEmailCount: 0
		});
		expect(state.hasDescription).toBe(true);
	});

	it('should treat empty string as no description', () => {
		const state = deriveOnboardingState({
			description: '',
			totalSupporters: 0,
			campaignCount: 0,
			teamCount: 1,
			sentEmailCount: 0
		});
		expect(state.hasDescription).toBe(false);
	});

	it('should detect supporters', () => {
		const state = deriveOnboardingState({
			description: null,
			totalSupporters: 1,
			campaignCount: 0,
			teamCount: 1,
			sentEmailCount: 0
		});
		expect(state.hasSupporters).toBe(true);
	});

	it('should detect campaigns', () => {
		const state = deriveOnboardingState({
			description: null,
			totalSupporters: 0,
			campaignCount: 1,
			teamCount: 1,
			sentEmailCount: 0
		});
		expect(state.hasCampaigns).toBe(true);
	});

	it('should detect team only when more than 1 member', () => {
		const noTeam = deriveOnboardingState({
			description: null,
			totalSupporters: 0,
			campaignCount: 0,
			teamCount: 1,
			sentEmailCount: 0
		});
		expect(noTeam.hasTeam).toBe(false);

		const hasTeam = deriveOnboardingState({
			description: null,
			totalSupporters: 0,
			campaignCount: 0,
			teamCount: 2,
			sentEmailCount: 0
		});
		expect(hasTeam.hasTeam).toBe(true);
	});

	it('should detect sent emails', () => {
		const state = deriveOnboardingState({
			description: null,
			totalSupporters: 0,
			campaignCount: 0,
			teamCount: 1,
			sentEmailCount: 1
		});
		expect(state.hasSentEmail).toBe(true);
	});

	it('should handle fully onboarded org', () => {
		const state = deriveOnboardingState({
			description: 'Our mission',
			totalSupporters: 500,
			campaignCount: 3,
			teamCount: 5,
			sentEmailCount: 10
		});
		expect(state).toEqual({
			hasDescription: true,
			hasSupporters: true,
			hasCampaigns: true,
			hasTeam: true,
			hasSentEmail: true
		});
	});
});

describe('isOnboardingComplete', () => {
	it('should be incomplete when missing both supporters and campaigns', () => {
		expect(
			isOnboardingComplete({
				hasDescription: true,
				hasSupporters: false,
				hasCampaigns: false,
				hasTeam: true,
				hasSentEmail: true
			})
		).toBe(false);
	});

	it('should be incomplete when missing supporters only', () => {
		expect(
			isOnboardingComplete({
				hasDescription: true,
				hasSupporters: false,
				hasCampaigns: true,
				hasTeam: true,
				hasSentEmail: true
			})
		).toBe(false);
	});

	it('should be incomplete when missing campaigns only', () => {
		expect(
			isOnboardingComplete({
				hasDescription: true,
				hasSupporters: true,
				hasCampaigns: false,
				hasTeam: true,
				hasSentEmail: true
			})
		).toBe(false);
	});

	it('should be complete when has both supporters and campaigns (minimum)', () => {
		expect(
			isOnboardingComplete({
				hasDescription: false,
				hasSupporters: true,
				hasCampaigns: true,
				hasTeam: false,
				hasSentEmail: false
			})
		).toBe(true);
	});

	it('should not require description, team, or sent email for completion', () => {
		// Onboarding completion only depends on hasSupporters && hasCampaigns
		expect(
			isOnboardingComplete({
				hasDescription: false,
				hasSupporters: true,
				hasCampaigns: true,
				hasTeam: false,
				hasSentEmail: false
			})
		).toBe(true);
	});
});
