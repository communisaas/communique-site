/**
 * Basic E2E Functionality Tests
 *
 * Tests core UI functionality without relying on analytics or complex integrations.
 * Validates that the basic user flow works as expected.
 */

import { test, expect, type Page } from '@playwright/test';

test.describe('Basic E2E Functionality', () => {
	test.beforeEach(async ({ page }: { page: Page }) => {
		// Navigate to homepage
		await page.goto('/');

		// Wait for page to load
		await page.waitForTimeout(1000);
	});

	test('should load homepage with template section', async ({ page }: { page: Page }) => {
		// Check that template section loads
		const templateSection = page.getByTestId('template-section');
		await expect(templateSection).toBeVisible();

		// Check templates heading is visible
		const templatesHeading = page.getByTestId('templates-heading');
		await expect(templatesHeading).toBeVisible();
		await expect(templatesHeading).toHaveText('Active Campaigns');

		// Check templates list is visible
		const templatesList = page.getByTestId('template-list');
		await expect(templatesList).toBeVisible();
	});

	test('should be able to select and view template', async ({ page }: { page: Page }) => {
		// Wait for templates to load
		const templateButton = page.getByTestId(/^template-button-/).first();
		await expect(templateButton).toBeVisible();

		// Click on first template
		await templateButton.click();

		// Check template preview loads
		const templatePreview = page.getByTestId('template-preview');
		await expect(templatePreview).toBeVisible();

		// Check that either contact congress or send email button is visible
		const contactButton = page.getByTestId('contact-congress-button');
		const emailButton = page.getByTestId('send-email-button');

		const hasContactButton = (await contactButton.count()) > 0;
		const hasEmailButton = (await emailButton.count()) > 0;

		expect(hasContactButton || hasEmailButton).toBe(true);
	});

	test('should handle navigation between templates', async ({ page }: { page: Page }) => {
		// Click first template
		await page
			.getByTestId(/^template-button-/)
			.first()
			.click();
		await page.waitForTimeout(500);

		// Verify preview is visible
		const templatePreview = page.getByTestId('template-preview');
		await expect(templatePreview).toBeVisible();

		// Click second template if available
		const secondTemplate = page.getByTestId(/^template-button-/).nth(1);
		if ((await secondTemplate.count()) > 0) {
			await secondTemplate.click();
			await page.waitForTimeout(500);

			// Preview should still be visible
			await expect(templatePreview).toBeVisible();
		}
	});

	test('should handle template retry on error', async ({ page }: { page: Page }) => {
		// Check for retry button in case templates fail to load
		const retryButton = page.getByTestId('retry-templates-button');

		if (await retryButton.isVisible()) {
			await retryButton.click();
			await page.waitForTimeout(2000);

			// Should still show template section after retry
			const templateSection = page.getByTestId('template-section');
			await expect(templateSection).toBeVisible();
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

		// Template section should still be visible on mobile
		const templateSection = page.getByTestId('template-section');
		await expect(templateSection).toBeVisible();

		// Templates list should be visible on mobile
		const templatesList = page.getByTestId('template-list');
		await expect(templatesList).toBeVisible();
	});
});
