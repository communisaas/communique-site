import { test, expect } from '@playwright/test';

test.describe('Template Preview Scrolling Regression Test', () => {
	test('send button is always accessible and message content scrolls independently', async ({ page }) => {
		await page.goto('/');
		
		// Click Start Writing to show templates
		await page.getByRole('button', { name: 'Start Writing' }).click();
		
		// Select a template (wait for any template to be available)
		await page.waitForSelector('[data-template-button]', { timeout: 10000 });
		const templateButton = page.locator('[data-template-button]').first();
		await templateButton.click();
		
		// Wait for template preview to appear
		const templatePreview = page.locator('[data-testid="template-preview"]');
		await expect(templatePreview).toBeVisible();
		
		// CRITICAL REGRESSION TEST: Send button must be visible and accessible
		// This prevents the bug where the send button was clipped out of the container
		const sendButton = page.getByRole('button', { name: /Sign in to Send/ });
		await expect(sendButton).toBeVisible();
		
		// Scroll to the send button to ensure it's in viewport
		await sendButton.scrollIntoViewIfNeeded();
		await expect(sendButton).toBeInViewport();
		
		// Verify message content has proper scrolling structure
		const messageScrollContainer = page.locator('[data-scrollable]');
		await expect(messageScrollContainer).toBeVisible();
		
		// Verify scrolling container has proper CSS classes for the fix
		await expect(messageScrollContainer).toHaveClass(/overflow-y-auto/);
		await expect(messageScrollContainer).toHaveClass(/absolute/);
		await expect(messageScrollContainer).toHaveClass(/inset-0/);
		
		// Verify the outer container has the correct flex structure
		const outerContainer = messageScrollContainer.locator('..');
		await expect(outerContainer).toHaveClass(/relative/);
		await expect(outerContainer).toHaveClass(/min-h-0/);
		await expect(outerContainer).toHaveClass(/flex-1/);
	});
});