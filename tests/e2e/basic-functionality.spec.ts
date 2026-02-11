/**
 * Basic E2E Functionality Tests
 *
 * Tests core UI functionality without relying on analytics or complex integrations.
 * Validates that the basic user flow works as expected.
 *
 * Updated for new Activation Surface landing page (Nov 2024).
 */

import { test, expect, type Page } from '@playwright/test';

test.describe('Basic E2E Functionality', () => {
	test.beforeEach(async ({ page }: { page: Page }) => {
		// Navigate to homepage
		await page.goto('/');

		// Wait for template list to be visible (deterministic loading)
		await page.getByTestId('template-list').waitFor({ state: 'visible', timeout: 10000 });
	});

	test('should load homepage with template list', async ({ page }: { page: Page }) => {
		// Check that template list loads
		const templateList = page.getByTestId('template-list');
		await expect(templateList).toBeVisible();

		// Check that at least one template button exists
		const firstTemplate = templateList.locator('[data-testid^="template-button-"]').first();
		await expect(firstTemplate).toBeVisible();
	});

	test('should be able to select and view template', async ({ page }: { page: Page }) => {
		// Get the first available template button (deterministic)
		const templateButton = page
			.getByTestId('template-list')
			.locator('[data-testid^="template-button-"]')
			.first();

		// Click on first template
		await templateButton.click();

		// On desktop: template preview should be visible
		// On mobile: modal opens
		const viewport = page.viewportSize();
		const isMobile = viewport ? viewport.width < 768 : false;

		if (isMobile) {
			// Mobile: check for modal
			const modal = page.locator('[role="dialog"]').or(page.locator('.modal'));
			await expect(modal).toBeVisible({ timeout: 5000 });
		} else {
			// Desktop: check template preview loads in sidebar
			const templatePreview = page.getByTestId('template-preview');
			await expect(templatePreview).toBeVisible();

			// Check that some action button exists (send, contact, etc)
			const actionButton = templatePreview.locator('button').filter({
				hasText: /Send|Contact|Join/i
			});
			await expect(actionButton.first()).toBeVisible({ timeout: 5000 });
		}
	});

	test('should handle navigation between templates', async ({ page }: { page: Page }) => {
		const templateList = page.getByTestId('template-list');

		// Click first template (deterministic)
		const firstTemplate = templateList.locator('[data-testid^="template-button-"]').first();
		await firstTemplate.click();

		// Wait a moment for selection to process
		await page.waitForTimeout(500);

		// Try to click second template if available
		const templates = await templateList.locator('[data-testid^="template-button-"]').count();

		if (templates > 1) {
			const secondTemplate = templateList.locator('[data-testid^="template-button-"]').nth(1);
			await secondTemplate.click();
			await page.waitForTimeout(500);

			// On desktop, preview should still be visible (just different content)
			const viewport = page.viewportSize();
			const isMobile = viewport ? viewport.width < 768 : false;
			if (!isMobile) {
				const templatePreview = page.getByTestId('template-preview');
				await expect(templatePreview).toBeVisible();
			}
		}
	});

	test('should handle template retry on error', async ({ page }: { page: Page }) => {
		// Check for retry button in case templates fail to load
		const retryButton = page.getByTestId('retry-templates-button');

		if (await retryButton.isVisible()) {
			await retryButton.click();
			await page.waitForTimeout(2000);

			// Should still show template list after retry
			const templateList = page.getByTestId('template-list');
			await expect(templateList).toBeVisible();
		}
	});

	test('should navigate to profile page', async ({ page }: { page: Page }) => {
		await page.goto('/profile');

		// Profile page should load (may redirect to auth)
		// Just check page doesn't crash
		await expect(page.locator('body')).toBeVisible();
	});

	test('should navigate to analytics page', async ({ page }: { page: Page }) => {
		await page.goto('/analytics');

		// Analytics page should load
		await expect(page.locator('body')).toBeVisible();

		// Should have some content (not just empty body)
		const content = await page.textContent('body');
		expect(content?.trim().length).toBeGreaterThan(0);
	});

	test('should handle mobile responsive design', async ({ page }: { page: Page }) => {
		// Test mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		// Template list should still be visible on mobile
		const templateList = page.getByTestId('template-list');
		await expect(templateList).toBeVisible();

		// Templates should be visible
		const firstTemplate = templateList.locator('[data-testid^="template-button-"]').first();
		await expect(firstTemplate).toBeVisible();
	});

	test('should display CreationSpark on landing page', async ({ page }: { page: Page }) => {
		// Check that CreationSpark (create template) interface is visible
		const createHeadline = page.getByText(/Your voice.*Sent together/i);
		await expect(createHeadline).toBeVisible({ timeout: 5000 });

		// Check for the input field
		const issueInput = page.locator('#issue-input');
		await expect(issueInput).toBeVisible();
	});

	test('should display CoordinationExplainer section', async ({ page }: { page: Page }) => {
		// Check that "How it works" explainer is present
		const explainerButton = page.getByRole('button', {
			name: /How coordination works/i
		});
		await expect(explainerButton).toBeVisible();
	});
});
