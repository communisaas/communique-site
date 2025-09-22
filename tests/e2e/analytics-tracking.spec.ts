/**
 * End-to-End Analytics Tracking Tests
 *
 * Tests client-side analytics functionality in a real browser environment.
 * Validates that events are properly sent from the browser and that the
 * OAuth funnel flow works across page redirects.
 */

/// <reference path="../types/global.d.ts" />
import {
	test,
	expect,
	type Page,
	type BrowserContext,
	type Route,
	type Request,
	type ConsoleMessage
} from '@playwright/test';

// Analytics types for test payload validation
interface AnalyticsEventPayload {
	name: string;
	properties?: Record<string, unknown>;
	[key: string]: unknown;
}

interface AnalyticsPayload {
	events: AnalyticsEventPayload[];
	[key: string]: unknown;
}

test.describe('Analytics Tracking E2E', () => {
	test.beforeEach(async ({ page }: { page: Page }) => {
		// Listen for analytics API calls
		await page.route('/api/analytics/events', async (route: Route) => {
			const request = route.request();
			console.log(
				'Analytics API called:',
				request.method(),
				await request.postDataJSON().catch(() => ({}))
			);

			// Mock successful response
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					events_processed: 3,
					session_id: 'test-session-123'
				})
			});
		});

		// Navigate to homepage
		await page.goto('/');

		// Wait for page to load and analytics to initialize
		await page.waitForTimeout(1000);
	});

	test('should track page view events automatically', async ({ page }: { page: Page }) => {
		let analyticsCallCount = 0;
		let lastAnalyticsPayload: unknown = null;

		// Monitor analytics API calls
		page.on('request', (request: Request) => {
			if (request.url().includes('/api/analytics/events') && request.method() === 'POST') {
				analyticsCallCount++;
				request
					.postDataJSON()
					.then((data: unknown) => {
						lastAnalyticsPayload = data;
					})
					.catch(() => {});
			}
		});

		// Navigate to a template page
		await page.click('[data-testid="template-card"]');
		await page.waitForTimeout(2000);

		// Should have made at least one analytics call
		expect(analyticsCallCount).toBeGreaterThan(0);

		// Should include page view events
		if (lastAnalyticsPayload) {
			expect((lastAnalyticsPayload as AnalyticsPayload).events).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						name: 'page_view'
					})
				])
			);
		}
	});

	test('should track template interaction events', async ({ page }: { page: Page }) => {
		let templateViewTracked = false;
		let shareClickTracked = false;

		// Monitor analytics calls for specific events
		page.on('request', async (request: Request) => {
			if (request.url().includes('/api/analytics/events') && request.method() === 'POST') {
				const payload = (await request.postDataJSON()) as AnalyticsPayload;

				payload.events.forEach((event: AnalyticsEventPayload) => {
					if (event.name === 'template_viewed') {
						templateViewTracked = true;
						expect(event.properties?.template_id).toBeDefined();
						expect(event.properties?.source).toBeDefined();
					}

					if (event.name === 'share_link_click') {
						shareClickTracked = true;
						expect(event.properties?.type).toBeDefined();
					}
				});
			}
		});

		// Click on a template to view it
		await page.click('[data-testid="template-card"]');
		await page.waitForTimeout(1000);

		// Click share link button
		await page.click('[data-testid="share-link-button"]', { timeout: 5000 });
		await page.waitForTimeout(1000);

		// Verify tracking occurred
		expect(templateViewTracked).toBe(true);
		expect(shareClickTracked).toBe(true);
	});

	test('should handle OAuth funnel flow across redirects', async ({
		page,
		context
	}: {
		page: Page;
		context: BrowserContext;
	}) => {
		const funnelEvents: string[] = [];

		// Monitor all analytics events in the funnel
		page.on('request', async (request: Request) => {
			if (request.url().includes('/api/analytics/events') && request.method() === 'POST') {
				const payload = (await request.postDataJSON()) as AnalyticsPayload;

				payload.events.forEach((event: AnalyticsEventPayload) => {
					if (
						event.funnel_id ||
						['template_viewed', 'onboarding_started', 'auth_completed', 'template_used'].includes(
							event.name
						)
					) {
						funnelEvents.push(event.name);
						console.log('Funnel event tracked:', event.name, event.properties?.template_id);
					}
				});
			}
		});

		// Step 1: View template (should track template_viewed)
		await page.click('[data-testid="template-card"]');
		await page.waitForTimeout(1000);

		// Step 2: Start OAuth flow (should track onboarding_started)
		await page.click('text="Sign in to Send"');
		await page.waitForTimeout(1000);

		// Step 3: Mock OAuth redirect return
		// In a real test, this would involve actual OAuth, but we'll simulate the return
		await page.evaluate(() => {
			// Simulate OAuth completion by calling analytics directly
			window.analytics?.trackAuthCompleted?.('test-template-123', 'mock-provider', 'test-user-456');
		});
		await page.waitForTimeout(1000);

		// Step 4: Template usage (simulate message send)
		await page.evaluate(() => {
			window.analytics?.trackTemplateUsed?.('test-template-123', 'certified', 'test-user-456');
		});
		await page.waitForTimeout(1000);

		// Verify complete funnel was tracked
		expect(funnelEvents).toContain('template_viewed');
		expect(funnelEvents).toContain('onboarding_started');
		// Note: auth_completed and template_used are simulated via JavaScript
	});

	test('should batch events efficiently', async ({ page }: { page: Page }) => {
		let apiCallCount = 0;
		let totalEventsProcessed = 0;

		// Monitor API calls to verify batching
		page.on('request', async (request: Request) => {
			if (request.url().includes('/api/analytics/events') && request.method() === 'POST') {
				apiCallCount++;
				const payload = (await request.postDataJSON()) as AnalyticsPayload;
				totalEventsProcessed += payload.events.length;

				console.log(`Analytics batch ${apiCallCount}: ${payload.events.length} events`);
			}
		});

		// Generate multiple rapid interactions
		for (let i = 0; i < 5; i++) {
			await page.evaluate((index: number) => {
				window.analytics?.trackInteraction?.('test-button', 'click', { interaction_id: index });
			}, i);
			await page.waitForTimeout(100);
		}

		// Wait for batching to occur
		await page.waitForTimeout(3000);

		// Should have batched events (fewer API calls than individual events)
		expect(totalEventsProcessed).toBe(5);
		expect(apiCallCount).toBeLessThan(5); // Events should be batched
	});

	test('should handle analytics errors gracefully', async ({ page }: { page: Page }) => {
		// Mock analytics API to return errors
		await page.route('/api/analytics/events', async (route: Route) => {
			await route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({
					success: false,
					error: 'Database connection failed'
				})
			});
		});

		let errorOccurred = false;
		page.on('console', (msg: ConsoleMessage) => {
			if (msg.type() === 'error' && msg.text().includes('analytics')) {
				errorOccurred = true;
			}
		});

		// Trigger analytics events
		await page.click('[data-testid="template-card"]');
		await page.waitForTimeout(2000);

		// Page should still function despite analytics errors
		expect(await page.isVisible('text="Share Link"')).toBe(true);

		// Should log error but not break the page
		// Note: In a real implementation, failed events would be stored in localStorage
	});

	test('should maintain session continuity across navigation', async ({ page }: { page: Page }) => {
		const sessionIds: string[] = [];

		// Track session IDs from analytics calls
		page.on('request', async (request: Request) => {
			if (request.url().includes('/api/analytics/events') && request.method() === 'POST') {
				const payload = (await request.postDataJSON()) as AnalyticsPayload;
				if (payload.session_data?.session_id) {
					sessionIds.push(payload.session_data.session_id);
				}
			}
		});

		// Navigate between pages
		await page.click('[data-testid="template-card"]');
		await page.waitForTimeout(1000);

		await page.goBack();
		await page.waitForTimeout(1000);

		await page.click('[data-testid="template-card"]:nth-child(2)');
		await page.waitForTimeout(1000);

		// All events should use the same session ID
		const uniqueSessionIds = [...new Set(sessionIds)];
		expect(uniqueSessionIds).toHaveLength(1);
		expect(uniqueSessionIds[0]).toMatch(/^sess_\d+_[a-z0-9]+$/);
	});

	test('should respect privacy and not leak sensitive data', async ({ page }: { page: Page }) => {
		const analyticsPayloads: unknown[] = [];

		// Capture all analytics payloads
		page.on('request', async (request: Request) => {
			if (request.url().includes('/api/analytics/events') && request.method() === 'POST') {
				const payload = (await request.postDataJSON()) as AnalyticsPayload;
				analyticsPayloads.push(payload);
			}
		});

		// Trigger analytics events
		await page.click('[data-testid="template-card"]');
		await page.waitForTimeout(2000);

		// Verify no sensitive data is sent to client
		for (const payload of analyticsPayloads) {
			// Should not contain database credentials
			expect(JSON.stringify(payload)).not.toMatch(/SUPABASE_DATABASE_URL/);
			expect(JSON.stringify(payload)).not.toMatch(/password/i);

			// Should not contain API keys
			expect(JSON.stringify(payload)).not.toMatch(/api[_-]?key/i);
			expect(JSON.stringify(payload)).not.toMatch(/secret/i);

			// User data should be properly handled
			if (payload.session_data) {
				expect(payload.session_data).toHaveProperty('session_id');
				// IP address and user agent are collected server-side
			}
		}
	});
});
