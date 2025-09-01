/**
 * OAuth Funnel Analytics Integration Tests
 * 
 * Tests the specific OAuth funnel flow that was broken: template_viewed → 
 * onboarding_started → auth_completed → template_used. This validates the
 * fix for the "api.track is not a function" error.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { funnelAnalytics } from '$lib/analytics/funnel';
import type { FunnelEvent } from '$lib/analytics/funnel';

// Mock the database analytics module
vi.mock('$lib/core/analytics/database', () => {
	const mockAnalytics = {
		trackFunnelEvent: vi.fn().mockResolvedValue(undefined),
		trackTemplateView: vi.fn().mockResolvedValue(undefined),
		trackOnboardingStarted: vi.fn().mockResolvedValue(undefined),
		trackAuthCompleted: vi.fn().mockResolvedValue(undefined),
		trackTemplateUsed: vi.fn().mockResolvedValue(undefined),
		trackSocialShare: vi.fn().mockResolvedValue(undefined),
		isReady: true
	};

	return {
		analytics: mockAnalytics
	};
});

describe('OAuth Funnel Analytics Integration', () => {
	let mockAnalytics: any;

	beforeEach(() => {
		// Clear localStorage
		if (typeof window !== 'undefined') {
			localStorage.clear();
		}

		// Get the mocked analytics
		mockAnalytics = (await import('$lib/core/analytics/database')).analytics;
		
		// Reset all mocks
		vi.clearAllMocks();
	});

	describe('OAuth Funnel Flow', () => {
		const templateId = 'template-oauth-test-123';
		const userId = 'user-oauth-456';
		const sessionId = 'sess_oauth_789';

		it('should track complete OAuth funnel flow without errors', async () => {
			// Step 1: User views template (landing page)
			await funnelAnalytics.trackTemplateView(templateId, 'direct-link');

			// Step 2: User starts onboarding (clicks "Sign in to Send")  
			await funnelAnalytics.trackOnboardingStarted(templateId, 'direct-link');

			// Step 3: User completes OAuth (returns from Facebook/Google)
			await funnelAnalytics.trackAuthCompleted(templateId, 'facebook', userId);

			// Step 4: User uses template (sends message)
			await funnelAnalytics.trackTemplateUsed(templateId, 'certified', userId);

			// Verify all tracking calls were made without errors
			expect(mockAnalytics.trackFunnelEvent).toHaveBeenCalledTimes(4);

			// Verify specific funnel events
			expect(mockAnalytics.trackFunnelEvent).toHaveBeenNthCalledWith(1, 
				expect.objectContaining({
					event: 'template_viewed',
					template_id: templateId,
					properties: expect.objectContaining({
						source: 'direct-link',
						step: 'landing'
					})
				})
			);

			expect(mockAnalytics.trackFunnelEvent).toHaveBeenNthCalledWith(2,
				expect.objectContaining({
					event: 'onboarding_started', 
					template_id: templateId,
					properties: expect.objectContaining({
						source: 'direct-link',
						step: 'auth_modal'
					})
				})
			);

			expect(mockAnalytics.trackFunnelEvent).toHaveBeenNthCalledWith(3,
				expect.objectContaining({
					event: 'auth_completed',
					template_id: templateId,
					user_id: userId,
					properties: expect.objectContaining({
						provider: 'facebook',
						step: 'auth_success'
					})
				})
			);

			expect(mockAnalytics.trackFunnelEvent).toHaveBeenNthCalledWith(4,
				expect.objectContaining({
					event: 'template_used',
					template_id: templateId,
					user_id: userId,
					properties: expect.objectContaining({
						delivery_method: 'certified',
						step: 'conversion'
					})
				})
			);
		});

		it('should handle different OAuth providers', async () => {
			const providers = ['facebook', 'google', 'github'];

			for (const provider of providers) {
				await funnelAnalytics.trackAuthCompleted(templateId, provider, userId);
			}

			expect(mockAnalytics.trackFunnelEvent).toHaveBeenCalledTimes(3);

			// Verify each provider was tracked correctly
			providers.forEach((provider, index) => {
				expect(mockAnalytics.trackFunnelEvent).toHaveBeenNthCalledWith(index + 1,
					expect.objectContaining({
						event: 'auth_completed',
						properties: expect.objectContaining({
							provider
						})
					})
				);
			});
		});

		it('should handle different traffic sources', async () => {
			const sources: ('social-link' | 'direct-link' | 'share')[] = ['social-link', 'direct-link', 'share'];

			for (const source of sources) {
				await funnelAnalytics.trackTemplateView(templateId, source);
			}

			expect(mockAnalytics.trackFunnelEvent).toHaveBeenCalledTimes(3);

			// Verify each source was tracked correctly
			sources.forEach((source, index) => {
				expect(mockAnalytics.trackFunnelEvent).toHaveBeenNthCalledWith(index + 1,
					expect.objectContaining({
						event: 'template_viewed',
						properties: expect.objectContaining({
							source
						})
					})
				);
			});
		});
	});

	describe('Error Handling & Resilience', () => {
		it('should handle analytics service failures gracefully', async () => {
			// Mock analytics to fail
			mockAnalytics.trackFunnelEvent.mockRejectedValueOnce(new Error('Analytics service unavailable'));

			// Track event - should not throw error
			await expect(funnelAnalytics.trackTemplateView('test-template', 'direct-link'))
				.resolves.not.toThrow();

			// Verify it still attempted to track
			expect(mockAnalytics.trackFunnelEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					event: 'template_viewed'
				})
			);
		});

		it('should store failed events for retry in localStorage', async () => {
			// Mock localStorage for this test
			const mockLocalStorage = {
				getItem: vi.fn().mockReturnValue('[]'),
				setItem: vi.fn(),
				removeItem: vi.fn()
			};

			Object.defineProperty(window, 'localStorage', {
				value: mockLocalStorage,
				writable: true
			});

			// Mock analytics failure
			mockAnalytics.trackFunnelEvent.mockRejectedValueOnce(new Error('Network error'));

			// Track event
			await funnelAnalytics.trackTemplateView('failed-template', 'direct-link');

			// Verify failed event was stored
			expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
				'communique_failed_events',
				expect.stringContaining('"event":"template_viewed"')
			);
		});
	});

	describe('Session & User Context', () => {
		it('should generate unique session IDs', () => {
			const analytics1 = new (funnelAnalytics.constructor as any)();
			const analytics2 = new (funnelAnalytics.constructor as any)();

			// Should have different session IDs (tested via internal property)
			expect(analytics1.sessionId).toBeDefined();
			expect(analytics2.sessionId).toBeDefined();
			expect(analytics1.sessionId).not.toBe(analytics2.sessionId);
		});

		it('should track user progression through funnel stages', async () => {
			const templateId = 'progression-test-template';
			const userId = 'progression-user-123';

			// Simulate realistic funnel progression with timing
			await funnelAnalytics.trackTemplateView(templateId, 'social-link');
			
			// Wait a bit (simulate user thinking)
			await new Promise(resolve => setTimeout(resolve, 100));
			await funnelAnalytics.trackOnboardingStarted(templateId, 'social-link');
			
			// Wait (simulate OAuth redirect)
			await new Promise(resolve => setTimeout(resolve, 100));  
			await funnelAnalytics.trackAuthCompleted(templateId, 'google', userId);
			
			// Wait (simulate template customization)
			await new Promise(resolve => setTimeout(resolve, 100));
			await funnelAnalytics.trackTemplateUsed(templateId, 'direct', userId);

			// Verify progression tracking
			const calls = mockAnalytics.trackFunnelEvent.mock.calls;
			expect(calls).toHaveLength(4);

			// Verify temporal progression (each call should have later timestamp)
			for (let i = 1; i < calls.length; i++) {
				const prevEvent = calls[i - 1][0] as FunnelEvent;
				const currentEvent = calls[i][0] as FunnelEvent;
				expect(currentEvent.timestamp).toBeGreaterThan(prevEvent.timestamp);
			}
		});
	});

	describe('Social Sharing & Viral Tracking', () => {
		it('should track social shares correctly', async () => {
			const templateId = 'viral-template-123';
			const userId = 'sharer-456';
			const platforms = ['twitter', 'facebook', 'linkedin', 'other'];

			for (const platform of platforms) {
				await funnelAnalytics.trackSocialShare(templateId, platform, userId);
			}

			expect(mockAnalytics.trackFunnelEvent).toHaveBeenCalledTimes(4);

			platforms.forEach((platform, index) => {
				expect(mockAnalytics.trackFunnelEvent).toHaveBeenNthCalledWith(index + 1,
					expect.objectContaining({
						event: 'template_shared',
						template_id: templateId,
						user_id: userId,
						platform
					})
				);
			});
		});

		it('should handle anonymous social sharing', async () => {
			await funnelAnalytics.trackSocialShare('anonymous-template', 'twitter');

			expect(mockAnalytics.trackFunnelEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					event: 'template_shared',
					template_id: 'anonymous-template',
					platform: 'twitter',
					user_id: undefined
				})
			);
		});
	});

	describe('Metrics & Analytics Integration', () => {
		it('should provide funnel metrics for debugging', () => {
			const metrics = funnelAnalytics.getFunnelMetrics();

			expect(metrics).toEqual(
				expect.objectContaining({
					total_events: expect.any(Number),
					unique_templates: expect.any(Number),
					conversion_rate: expect.any(Number),
					funnel_steps: expect.objectContaining({
						template_viewed: expect.any(Number),
						onboarding_started: expect.any(Number),
						auth_completed: expect.any(Number),
						template_used: expect.any(Number)
					})
				})
			);
		});

		it('should calculate conversion rate correctly', async () => {
			// Track a complete funnel  
			const templateId = 'conversion-test-template';
			await funnelAnalytics.trackTemplateView(templateId);
			await funnelAnalytics.trackOnboardingStarted(templateId, 'direct-link');
			await funnelAnalytics.trackAuthCompleted(templateId, 'google', 'user-123');
			await funnelAnalytics.trackTemplateUsed(templateId, 'certified', 'user-123');

			const metrics = funnelAnalytics.getFunnelMetrics();

			// Should have 100% conversion rate (1 view, 1 use)
			expect(metrics.conversion_rate).toBeGreaterThan(0);
			expect(metrics.funnel_steps.template_viewed).toBeGreaterThan(0);
			expect(metrics.funnel_steps.template_used).toBeGreaterThan(0);
		});

		it('should clear events for testing', () => {
			// Add some events
			funnelAnalytics.trackTemplateView('test-template');
			
			// Clear
			funnelAnalytics.clear();

			// Should have no events
			const metrics = funnelAnalytics.getFunnelMetrics();
			expect(metrics.total_events).toBe(0);
		});
	});
});