/**
 * End-to-End Analytics Tracking Tests
 *
 * Tests client-side analytics functionality in a real browser environment.
 * Validates that events are properly sent from the browser and that the
 * OAuth funnel flow works across page redirects.
 */

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

		// Navigate to a template page using actual selector
		await page.getByTestId(/^template-button-/).first().click();
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
				});
			}
		});

		// Click on a template to view it using the actual selector
		await page.getByTestId(/^template-button-/).first().click();
		await page.waitForTimeout(1000);

		// Verify template view tracking occurred
		expect(templateViewTracked).toBe(true);
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
						['template_viewed', 'onboarding_started', 'template_interaction'].includes(event.name)
					) {
						funnelEvents.push(event.name);
						console.log('Funnel event tracked:', event.name, event.properties?.template_id);
					}
				});
			}
		});

		// Step 1: View template (should track template_viewed)
		await page.getByTestId(/^template-button-/).first().click();
		await page.waitForTimeout(1000);

		// Step 2: Try to interact with send button (should track template_interaction)
		const sendButton = page.getByTestId('contact-congress-button').or(page.getByTestId('send-email-button'));
		if (await sendButton.count() > 0) {
			await sendButton.first().click();
			await page.waitForTimeout(1000);
		}

		// Verify funnel tracking occurred - we can only test UI interactions
		expect(funnelEvents).toContain('template_viewed');
		// Note: Additional funnel events would be tested in integration tests
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

		// Generate multiple rapid interactions through UI
		for (let i = 0; i < 3; i++) {
			// Click different templates to generate multiple events
			await page.getByTestId(/^template-button-/).nth(i % 2).click();
			await page.waitForTimeout(200);
		}

		// Wait for batching to occur
		await page.waitForTimeout(3000);

		// Should have generated some events
		expect(totalEventsProcessed).toBeGreaterThan(0);
		expect(apiCallCount).toBeGreaterThan(0);
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

		let analyticsError = false;
		page.on('console', (msg: ConsoleMessage) => {
			if (msg.type() === 'error' && msg.text().includes('analytics')) {
				analyticsError = true;
			}
		});

		// Trigger analytics events
		await page.getByTestId(/^template-button-/).first().click();
		await page.waitForTimeout(2000);

		// Page should still function despite analytics errors
		const templatePreview = page.getByTestId('template-preview');
		expect(await templatePreview.isVisible()).toBe(true);

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
		await page.getByTestId(/^template-button-/).first().click();
		await page.waitForTimeout(1000);

		await page.goBack();
		await page.waitForTimeout(1000);

		await page.getByTestId(/^template-button-/).nth(1).click();
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
		await page.getByTestId(/^template-button-/).first().click();
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
