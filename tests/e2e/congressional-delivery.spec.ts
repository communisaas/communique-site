import { test, expect, type Page } from '@playwright/test';

test.describe('Congressional Delivery E2E', () => {
	test('should complete full congressional delivery flow', async ({ page }: { page: Page }) => {
		// Navigate to the app
		await page.goto('/');

		// Check that template section loads
		const templateSection = page.getByTestId('template-section');
		await expect(templateSection).toBeVisible();

		// Check templates list is visible
		const templatesList = page.getByTestId('template-list');
		await expect(templatesList).toBeVisible();

		// Click on a template to select it (deterministic)
		await page.getByTestId('template-list').locator('[data-testid^="template-button-"]').first().waitFor({ state: 'visible' });
		const templateButton = page.getByTestId('template-list').locator('[data-testid^="template-button-"]').first();
		await templateButton.click();

		// Check template preview loads
		const templatePreview = page.getByTestId('template-preview');
		await expect(templatePreview).toBeVisible();

		// TODO: Add more specific E2E tests once UI is more defined
		// This is a placeholder for the full congressional delivery flow:
		// 1. User creates/selects template ✓
		// 2. User enters personal message
		// 3. System looks up representatives
		// 4. User confirms delivery
		// 5. Messages are sent via CWC
		// 6. User sees confirmation
	});

	test('should handle authentication flow', async ({ page }: { page: Page }) => {
		// Navigate to auth-required page (profile requires auth)
		await page.goto('/profile');

		// Should redirect to homepage for unauthenticated users (as per current implementation)
		await expect(async () => {
			const url = page.url();
			// Profile page redirects unauthenticated users to homepage
			const isValidUrl = url.includes('/') && !url.includes('/profile');
			expect(isValidUrl).toBe(true);
		}).toPass({ timeout: 5000 });

		// Verify we're on homepage after redirect
		const templateSection = page.getByTestId('template-section');
		await expect(templateSection).toBeVisible();
	});

	test('should display analytics page', async ({ page }: { page: Page }) => {
		await page.goto('/analytics');

		// Should show analytics dashboard
		// TODO: Add specific selectors based on actual UI

		// Placeholder - verify page loads
		await expect(page.locator('body')).toBeVisible();
	});
});
