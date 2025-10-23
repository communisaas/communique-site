import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Identity Verification Flow
 *
 * Tests the complete user journey from address collection through identity verification.
 * This is a critical conversion funnel that must work flawlessly.
 */

test.describe('Identity Verification Flow', () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to a template page that triggers the address collection flow
		await page.goto('/s/test-template');
	});

	test('should complete full verification flow with NFC passport', async ({ page }) => {
		// Step 1: Trigger address collection modal
		const sendButton = page.getByRole('button', { name: /send.*message/i });
		await sendButton.click();

		// Modal should appear with progress indicator showing step 1/4
		await expect(page.getByRole('dialog')).toBeVisible();
		await expect(page.getByText(/find your representatives/i)).toBeVisible();

		// Step 2: Fill in address form
		await page.getByLabel(/street address/i).fill('1600 Pennsylvania Avenue NW');
		await page.getByLabel(/city/i).fill('Washington');
		await page.getByLabel(/state/i).fill('DC');
		await page.getByLabel(/zip code/i).fill('20500');

		// Step 3: Verify address
		await page.getByRole('button', { name: /verify.*find representatives/i }).click();

		// Wait for address verification to complete
		await expect(page.getByText(/confirm your address/i)).toBeVisible({ timeout: 5000 });
		await expect(page.getByText(/verified address/i)).toBeVisible();

		// Step 4: Accept verified address (moves to identity verification)
		await page.getByRole('button', { name: /looks good/i }).click();

		// Step 5: Identity verification step should appear
		await expect(page.getByText(/boost your impact/i)).toBeVisible();
		await expect(page.getByText(/3x higher response rate/i)).toBeVisible();

		// Value proposition should be visible
		await expect(page.getByText(/verified constituents get/i)).toBeVisible();

		// Step 6: Select NFC passport verification
		const nfcButton = page.getByRole('button', { name: /nfc passport/i });
		await expect(nfcButton).toBeVisible();
		await expect(nfcButton).toContainText(/recommended/i);
		await nfcButton.click();

		// Step 7: NFC verification UI should appear
		await expect(page.getByText(/verify with nfc passport/i)).toBeVisible();
		await expect(page.getByText(/maximum privacy protection/i)).toBeVisible();

		// Privacy guarantees should be visible
		await expect(page.getByText(/never leaves your device/i)).toBeVisible();
		await expect(page.getByText(/without storing your address/i)).toBeVisible();

		// Generate QR Code button should be visible
		const generateQRButton = page.getByRole('button', { name: /generate qr code/i });
		await expect(generateQRButton).toBeVisible();
		await generateQRButton.click();

		// QR code should appear with loading state first
		await expect(page.getByText(/generating secure qr code/i)).toBeVisible();

		// Note: In a real test, we'd need to mock the verification API
		// For now, we verify the UI renders correctly
	});

	test('should allow fallback to government ID verification', async ({ page }) => {
		// Navigate through address collection
		const sendButton = page.getByRole('button', { name: /send.*message/i });
		await sendButton.click();

		// Fill address
		await page.getByLabel(/street address/i).fill('123 Main Street');
		await page.getByLabel(/city/i).fill('San Francisco');
		await page.getByLabel(/state/i).fill('CA');
		await page.getByLabel(/zip code/i).fill('94102');
		await page.getByRole('button', { name: /verify.*find representatives/i }).click();

		// Accept address
		await expect(page.getByText(/confirm your address/i)).toBeVisible({ timeout: 5000 });
		await page.getByRole('button', { name: /looks good/i }).click();

		// Identity verification step
		await expect(page.getByText(/boost your impact/i)).toBeVisible();

		// Select government ID option
		const govIdButton = page.getByRole('button', { name: /government id/i });
		await expect(govIdButton).toBeVisible();
		await govIdButton.click();

		// Government ID verification UI should appear
		await expect(page.getByText(/verify with government id/i)).toBeVisible();

		// "Start Verification" button should be visible
		const startButton = page.getByRole('button', { name: /start verification/i });
		await expect(startButton).toBeVisible();
	});

	test('should allow user to skip identity verification', async ({ page }) => {
		// Navigate through address collection
		const sendButton = page.getByRole('button', { name: /send.*message/i });
		await sendButton.click();

		// Fill and verify address
		await page.getByLabel(/street address/i).fill('456 Oak Avenue');
		await page.getByLabel(/city/i).fill('New York');
		await page.getByLabel(/state/i).fill('NY');
		await page.getByLabel(/zip code/i).fill('10001');
		await page.getByRole('button', { name: /verify.*find representatives/i }).click();
		await page.waitForTimeout(2000); // Wait for verification

		// Accept address
		await page.getByRole('button', { name: /looks good/i }).click();

		// Identity verification step should show skip option
		await expect(page.getByText(/boost your impact/i)).toBeVisible();

		const skipButton = page.getByRole('button', { name: /continue without verification/i });
		await expect(skipButton).toBeVisible();
		await expect(skipButton).toContainText(/lower credibility/i);

		// Click skip
		await skipButton.click();

		// Should complete the flow (dispatch complete event)
		// Note: In a real app, this would redirect or show completion
	});

	test('should allow switching between verification methods', async ({ page }) => {
		// Navigate through address collection
		const sendButton = page.getByRole('button', { name: /send.*message/i });
		await sendButton.click();

		// Fill and verify address
		await page.getByLabel(/street address/i).fill('789 Elm Street');
		await page.getByLabel(/city/i).fill('Austin');
		await page.getByLabel(/state/i).fill('TX');
		await page.getByLabel(/zip code/i).fill('78701');
		await page.getByRole('button', { name: /verify.*find representatives/i }).click();
		await page.waitForTimeout(2000);
		await page.getByRole('button', { name: /looks good/i }).click();

		// Select NFC passport
		await page.getByRole('button', { name: /nfc passport/i }).click();

		// NFC verification UI should appear
		await expect(page.getByText(/verify with nfc passport/i)).toBeVisible();

		// Go back to method selection
		const backButton = page.getByRole('button', { name: /choose different method/i });
		await expect(backButton).toBeVisible();
		await backButton.click();

		// Should be back at method selection
		await expect(page.getByRole('button', { name: /nfc passport/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /government id/i })).toBeVisible();

		// Now select government ID
		await page.getByRole('button', { name: /government id/i }).click();

		// Government ID verification UI should appear
		await expect(page.getByText(/verify with government id/i)).toBeVisible();
	});

	test('should display privacy guarantees prominently', async ({ page }) => {
		const sendButton = page.getByRole('button', { name: /send.*message/i });
		await sendButton.click();

		// Address collection step should show privacy note
		await expect(page.getByText(/privacy protected/i)).toBeVisible();
		await expect(
			page.getByText(/not stored or shared with third parties/i)
		).toBeVisible();

		// Fill and verify address
		await page.getByLabel(/street address/i).fill('321 Pine Street');
		await page.getByLabel(/city/i).fill('Seattle');
		await page.getByLabel(/state/i).fill('WA');
		await page.getByLabel(/zip code/i).fill('98101');
		await page.getByRole('button', { name: /verify.*find representatives/i }).click();
		await page.waitForTimeout(2000);
		await page.getByRole('button', { name: /looks good/i }).click();

		// Identity verification should show privacy benefits
		await expect(page.getByText(/boost your impact/i)).toBeVisible();

		// Select NFC passport to see privacy guarantees
		await page.getByRole('button', { name: /nfc passport/i }).click();

		// Privacy guarantees should be prominent
		await expect(page.getByText(/maximum privacy protection/i)).toBeVisible();
		await expect(page.getByText(/never leaves your device/i)).toBeVisible();
		await expect(page.getByText(/without storing your address/i)).toBeVisible();
		await expect(page.getByText(/locally on your phone/i)).toBeVisible();
	});

	test('should show value proposition with impact statistics', async ({ page }) => {
		const sendButton = page.getByRole('button', { name: /send.*message/i });
		await sendButton.click();

		// Navigate to identity verification step
		await page.getByLabel(/street address/i).fill('555 Market Street');
		await page.getByLabel(/city/i).fill('San Francisco');
		await page.getByLabel(/state/i).fill('CA');
		await page.getByLabel(/zip code/i).fill('94105');
		await page.getByRole('button', { name: /verify.*find representatives/i }).click();
		await page.waitForTimeout(2000);
		await page.getByRole('button', { name: /looks good/i }).click();

		// Value proposition should show impact statistics
		await expect(page.getByText(/3x higher response rate/i)).toBeVisible();
		await expect(page.getByText(/87%.*prioritize/i)).toBeVisible();
		await expect(page.getByText(/30 second/i)).toBeVisible();
	});

	test('should handle verification errors gracefully', async ({ page }) => {
		// Note: This test would require mocking API failures
		// For now, we verify error UI elements exist in the components

		const sendButton = page.getByRole('button', { name: /send.*message/i });
		await sendButton.click();

		// Navigate to identity verification
		await page.getByLabel(/street address/i).fill('999 Test Street');
		await page.getByLabel(/city/i).fill('Boston');
		await page.getByLabel(/state/i).fill('MA');
		await page.getByLabel(/zip code/i).fill('02101');
		await page.getByRole('button', { name: /verify.*find representatives/i }).click();
		await page.waitForTimeout(2000);
		await page.getByRole('button', { name: /looks good/i }).click();

		// Select NFC passport
		await page.getByRole('button', { name: /nfc passport/i }).click();

		// Generate QR code
		const generateButton = page.getByRole('button', { name: /generate qr code/i });
		await generateButton.click();

		// In case of error, retry button should be available
		// Note: This would need API mocking to trigger actual errors
	});

	test('should maintain progress indicator throughout flow', async ({ page }) => {
		const sendButton = page.getByRole('button', { name: /send.*message/i });
		await sendButton.click();

		// Progress indicator should show 4 steps
		const progressDots = page.locator('.h-2.rounded-full');
		await expect(progressDots).toHaveCount(4);

		// First step should be active (wider, blue)
		const activeDot = progressDots.filter({ hasText: '' }).first();
		await expect(activeDot).toHaveClass(/w-12.*bg-blue-600/);

		// Fill and verify address
		await page.getByLabel(/street address/i).fill('777 Broadway');
		await page.getByLabel(/city/i).fill('New York');
		await page.getByLabel(/state/i).fill('NY');
		await page.getByLabel(/zip code/i).fill('10003');
		await page.getByRole('button', { name: /verify.*find representatives/i }).click();
		await page.waitForTimeout(2000);

		// Second step should now be active
		await page.getByRole('button', { name: /looks good/i }).click();

		// Third step (identity) should now be active
		await expect(page.getByText(/boost your impact/i)).toBeVisible();

		// Progress should advance
		const activeDotsAfterIdentity = progressDots.filter({ hasText: '' });
		await expect(activeDotsAfterIdentity.first()).toHaveClass(/bg-blue/);
	});
});
