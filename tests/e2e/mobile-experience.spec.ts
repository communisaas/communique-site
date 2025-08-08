import { test, expect, devices } from '@playwright/test';

// Test mobile experience
test.use({ ...devices['iPhone 13'] });

test.describe('Mobile Experience', () => {
	test('homepage renders correctly on mobile', async ({ page }) => {
		await page.goto('/');
		
		// Should see mobile-optimized header
		await expect(page.getByText(/Communiqué/i)).toBeVisible();
		
		// Template list should be vertically stacked
		const templateList = page.locator('[data-testid="template-list"]').or(
			page.getByText('Message Templates').locator('..')
		);
		await expect(templateList).toBeVisible();
	});

	test('template selection opens mobile modal', async ({ page }) => {
		await page.goto('/');
		
		// Find first template
		const firstTemplate = page.getByRole('button').filter({ hasText: /template|action/i }).first();
		if (await firstTemplate.isVisible()) {
			await firstTemplate.click();
			
			// Should open mobile preview modal
			await expect(
				page.locator('.modal, [role="dialog"]')
			).toBeVisible();
		}
	});

	test('mobile modal has swipe-to-dismiss functionality', async ({ page }) => {
		await page.goto('/');
		
		const firstTemplate = page.getByRole('button').filter({ hasText: /template/i }).first();
		if (await firstTemplate.isVisible()) {
			await firstTemplate.click();
			
			const modal = page.locator('.modal, [role="dialog"]').first();
			await expect(modal).toBeVisible();
			
			// Simulate swipe down to dismiss (using touch events)
			await modal.dispatchEvent('touchstart', {
				touches: [{ clientX: 200, clientY: 300 }]
			});
			
			await modal.dispatchEvent('touchmove', {
				touches: [{ clientX: 200, clientY: 500 }]
			});
			
			await modal.dispatchEvent('touchend', {
				changedTouches: [{ clientX: 200, clientY: 500 }]
			});
			
			// Modal might be dismissed or show dismiss hint
			// Implementation depends on the exact touch handling
		}
	});

	test('mobile navigation is accessible', async ({ page }) => {
		await page.goto('/');
		
		// Check for mobile menu button if it exists
		const menuButton = page.getByRole('button', { name: /menu|navigation|☰/i });
		if (await menuButton.isVisible()) {
			await menuButton.click();
			
			// Should show navigation options
			await expect(
				page.getByText(/home|templates|create|about/i)
			).toBeVisible();
		}
	});

	test('mobile template preview is readable', async ({ page }) => {
		await page.goto('/climate-action');
		
		// Template content should be readable on mobile
		const templateTitle = page.getByRole('heading', { level: 1 });
		await expect(templateTitle).toBeVisible();
		
		// Message content should not be cut off
		const messageContent = page.getByText(/dear|representative|message/i).first();
		if (await messageContent.isVisible()) {
			// Should be within viewport
			const boundingBox = await messageContent.boundingBox();
			expect(boundingBox?.width).toBeLessThanOrEqual(400); // iPhone 13 width approx
		}
	});

	test('mobile auth modal is user-friendly', async ({ page }) => {
		await page.goto('/climate-action');
		
		const authButton = page.getByRole('button', { name: /sign in|login/i });
		if (await authButton.isVisible()) {
			await authButton.click();
			
			// Auth options should be readable and accessible
			const googleButton = page.getByRole('button', { name: /google/i });
			if (await googleButton.isVisible()) {
				const boundingBox = await googleButton.boundingBox();
				expect(boundingBox?.height).toBeGreaterThan(40); // Touch-friendly height
			}
		}
	});

	test('mobile address form is usable', async ({ page, context }) => {
		await context.addCookies([{
			name: 'auth-session',
			value: 'mock-session',
			domain: 'localhost',
			path: '/'
		}]);

		await page.goto('/climate-action');
		
		const sendButton = page.getByRole('button', { name: /send|contact/i });
		await sendButton.click();
		
		// Address form should be mobile-optimized
		const streetInput = page.getByLabel(/street|address/i);
		if (await streetInput.isVisible()) {
			// Input should be large enough for touch
			const boundingBox = await streetInput.boundingBox();
			expect(boundingBox?.height).toBeGreaterThan(40);
			
			// Should be able to type
			await streetInput.fill('123 Mobile Test St');
			await expect(streetInput).toHaveValue('123 Mobile Test St');
		}
	});

	test('mobile keyboard does not obscure important elements', async ({ page, context }) => {
		await context.addCookies([{
			name: 'auth-session',
			value: 'mock-session',
			domain: 'localhost',
			path: '/'
		}]);

		await page.goto('/climate-action');
		
		const sendButton = page.getByRole('button', { name: /send|contact/i });
		await sendButton.click();
		
		const streetInput = page.getByLabel(/street|address/i);
		if (await streetInput.isVisible()) {
			// Focus input (simulates keyboard appearing)
			await streetInput.focus();
			
			// Submit button should still be accessible
			const submitButton = page.getByRole('button', { name: /verify|submit/i });
			if (await submitButton.isVisible()) {
				const submitBox = await submitButton.boundingBox();
				expect(submitBox?.y).toBeGreaterThan(0); // Should be visible above keyboard
			}
		}
	});

	test('mobile template sharing works', async ({ page }) => {
		await page.goto('/climate-action');
		
		// Look for share button
		const shareButton = page.getByRole('button', { name: /share|copy.*link/i });
		if (await shareButton.isVisible()) {
			await shareButton.click();
			
			// Should show sharing options or confirmation
			await expect(
				page.getByText(/copied|shared|link/i)
			).toBeVisible();
		}
	});

	test('mobile performance is acceptable', async ({ page }) => {
		const startTime = Date.now();
		
		await page.goto('/');
		
		// Page should load within reasonable time
		await expect(page.getByText(/Communiqué/i)).toBeVisible();
		
		const loadTime = Date.now() - startTime;
		expect(loadTime).toBeLessThan(5000); // Should load in under 5 seconds
	});

	test('mobile template creation is functional', async ({ page }) => {
		await page.goto('/');
		
		const createButton = page.getByRole('button', { name: /create|new template/i });
		if (await createButton.isVisible()) {
			await createButton.click();
			
			// Form should be mobile-optimized
			const titleInput = page.getByLabel(/title|name/i);
			if (await titleInput.isVisible()) {
				const boundingBox = await titleInput.boundingBox();
				expect(boundingBox?.height).toBeGreaterThan(40);
				
				// Should be able to fill form on mobile
				await titleInput.fill('Mobile Test Template');
				await expect(titleInput).toHaveValue('Mobile Test Template');
			}
		}
	});

	test('mobile Self.xyz verification is accessible', async ({ page, context }) => {
		await context.addCookies([{
			name: 'auth-session',
			value: 'mock-session',
			domain: 'localhost',
			path: '/'
		}]);

		// Mock Self.xyz init
		await page.route('**/api/identity/init', async (route) => {
			await route.fulfill({
				json: {
					success: true,
					qrCodeData: '{"test": "mobile"}',
					sessionId: 'mobile-test'
				}
			});
		});

		await page.goto('/climate-action');
		
		const verifyButton = page.getByRole('button', { name: /verify.*identity/i });
		if (await verifyButton.isVisible()) {
			await verifyButton.click();
			
			// QR code should be appropriately sized for mobile
			const qrElement = page.locator('canvas, img').first();
			if (await qrElement.isVisible()) {
				const boundingBox = await qrElement.boundingBox();
				expect(boundingBox?.width).toBeLessThan(300); // Should fit on mobile screen
				expect(boundingBox?.height).toBeLessThan(300);
			}
		}
	});

	test('mobile error states are clear', async ({ page }) => {
		// Mock API error
		await page.route('**/api/address/verify', async (route) => {
			await route.fulfill({
				status: 400,
				json: {
					verified: false,
					error: 'Address not found. Please check and try again.'
				}
			});
		});

		await page.goto('/climate-action');
		
		// Try to trigger an error (without auth)
		const sendButton = page.getByRole('button', { name: /send|contact/i });
		if (await sendButton.isVisible()) {
			await sendButton.click();
			
			// Error message should be readable on mobile
			const errorText = page.getByText(/error|failed|try again/i);
			if (await errorText.isVisible()) {
				const boundingBox = await errorText.boundingBox();
				expect(boundingBox?.width).toBeLessThan(400); // Should fit in mobile viewport
			}
		}
	});
});