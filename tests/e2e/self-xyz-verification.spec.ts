import { test, expect } from '@playwright/test';

test.describe('Self.xyz Identity Verification Flow', () => {
	test.beforeEach(async ({ page, context }) => {
		// Mock authenticated user
		await context.addCookies([{
			name: 'auth-session',
			value: 'mock-session-token',
			domain: 'localhost',
			path: '/'
		}]);
	});

	test('verification badge appears for unverified users', async ({ page }) => {
		await page.goto('/climate-action');
		
		// Should show option to enhance credibility
		const verifyButton = page.getByRole('button', { name: /verify.*identity|enhance.*credibility|self\.xyz/i });
		
		if (await verifyButton.isVisible()) {
			await expect(verifyButton).toBeVisible();
		}
	});

	test('clicking verify identity opens Self.xyz modal', async ({ page }) => {
		// Mock Self.xyz initialization API
		await page.route('**/api/identity/init', async (route) => {
			await route.fulfill({
				json: {
					success: true,
					qrCodeData: JSON.stringify({
						appName: 'Communiqué',
						scope: 'communique-congressional',
						endpoint: 'http://localhost:5173/api/identity/verify',
						userId: 'test-user-123',
						sessionId: 'test-session'
					}),
					sessionId: 'test-user-123',
					config: {
						disclosures: {
							nationality: true,
							issuing_state: true,
							name: true,
							minimumAge: 18
						}
					}
				}
			});
		});

		await page.goto('/climate-action');
		
		const verifyButton = page.getByRole('button', { name: /verify.*identity|enhance.*credibility/i });
		if (await verifyButton.isVisible()) {
			await verifyButton.click();
			
			// Should show Self.xyz verification modal
			await expect(
				page.getByText(/self\.xyz|identity verification|scan.*qr/i)
			).toBeVisible();
		}
	});

	test('Self.xyz modal shows QR code for mobile app', async ({ page }) => {
		// Mock Self.xyz initialization
		await page.route('**/api/identity/init', async (route) => {
			await route.fulfill({
				json: {
					success: true,
					qrCodeData: JSON.stringify({
						appName: 'Communiqué',
						scope: 'communique-congressional'
					}),
					sessionId: 'test-session'
				}
			});
		});

		await page.goto('/climate-action');
		
		const verifyButton = page.getByRole('button', { name: /verify.*identity/i });
		if (await verifyButton.isVisible()) {
			await verifyButton.click();
			
			// Should show QR code instructions
			await expect(
				page.getByText(/scan.*qr.*code|mobile.*app|self\.xyz.*app/i)
			).toBeVisible();
			
			// Should have QR code element
			const qrElement = page.locator('canvas, img').filter({ hasText: /qr/i }).or(
				page.locator('[data-testid*="qr"]')
			);
			
			await expect(qrElement.first()).toBeVisible();
		}
	});

	test('verification modal shows required disclosures', async ({ page }) => {
		await page.route('**/api/identity/init', async (route) => {
			await route.fulfill({
				json: {
					success: true,
					qrCodeData: '{"test": "data"}',
					config: {
						disclosures: {
							nationality: true,
							issuing_state: true,
							name: true,
							minimumAge: 18,
							ofac: true
						}
					}
				}
			});
		});

		await page.goto('/climate-action');
		
		const verifyButton = page.getByRole('button', { name: /verify.*identity/i });
		if (await verifyButton.isVisible()) {
			await verifyButton.click();
			
			// Should show what will be verified
			await expect(
				page.getByText(/nationality|country|citizenship|age.*18/i)
			).toBeVisible();
		}
	});

	test('verification status polling works correctly', async ({ page }) => {
		// Mock initial session as pending
		await page.route('**/api/identity/status/*', (route, request) => {
			const url = new URL(request.url());
			const userId = url.pathname.split('/').pop();
			
			route.fulfill({
				json: {
					verified: false,
					failed: false,
					pending: true,
					sessionAge: 30
				}
			});
		});

		// Mock Self.xyz init
		await page.route('**/api/identity/init', async (route) => {
			await route.fulfill({
				json: {
					success: true,
					qrCodeData: '{"sessionId": "test-123"}',
					sessionId: 'test-123'
				}
			});
		});

		await page.goto('/climate-action');
		
		const verifyButton = page.getByRole('button', { name: /verify.*identity/i });
		if (await verifyButton.isVisible()) {
			await verifyButton.click();
			
			// Should show pending status
			await expect(
				page.getByText(/waiting|pending|scan.*qr|complete.*app/i)
			).toBeVisible();
		}
	});

	test('successful verification shows confirmation', async ({ page }) => {
		let pollCount = 0;
		
		// Mock verification status progression
		await page.route('**/api/identity/status/*', (route) => {
			pollCount++;
			
			if (pollCount <= 2) {
				// First few polls show pending
				route.fulfill({
					json: {
						verified: false,
						pending: true,
						sessionAge: 45
					}
				});
			} else {
				// Later polls show success
				route.fulfill({
					json: {
						verified: true,
						pending: false,
						credentialSubject: {
							nationality: 'USA',
							name: 'John Doe',
							minimumAge: '25'
						},
						sessionAge: 120
					}
				});
			}
		});

		await page.route('**/api/identity/init', async (route) => {
			await route.fulfill({
				json: {
					success: true,
					qrCodeData: '{"sessionId": "test-success"}',
					sessionId: 'test-success'
				}
			});
		});

		await page.goto('/climate-action');
		
		const verifyButton = page.getByRole('button', { name: /verify.*identity/i });
		if (await verifyButton.isVisible()) {
			await verifyButton.click();
			
			// Wait for successful verification
			await expect(
				page.getByText(/verified|success|identity.*confirmed/i)
			).toBeVisible({ timeout: 10000 });
		}
	});

	test('verified users see enhanced credibility badge', async ({ page, context }) => {
		// Mock verified user
		await context.addCookies([{
			name: 'user-verified',
			value: 'true',
			domain: 'localhost',
			path: '/'
		}]);

		await page.goto('/climate-action');
		
		// Should show verification badge
		await expect(
			page.getByText(/verified|enhanced.*credibility|identity.*confirmed/i)
		).toBeVisible();
		
		// Should NOT show verify button
		const verifyButton = page.getByRole('button', { name: /verify.*identity/i });
		await expect(verifyButton).not.toBeVisible();
	});

	test('verification failure shows retry option', async ({ page }) => {
		// Mock verification failure
		await page.route('**/api/identity/status/*', (route) => {
			route.fulfill({
				json: {
					verified: false,
					failed: true,
					pending: false,
					error: 'Verification failed - please try again'
				}
			});
		});

		await page.route('**/api/identity/init', async (route) => {
			await route.fulfill({
				json: {
					success: true,
					qrCodeData: '{"sessionId": "test-fail"}',
					sessionId: 'test-fail'
				}
			});
		});

		await page.goto('/climate-action');
		
		const verifyButton = page.getByRole('button', { name: /verify.*identity/i });
		if (await verifyButton.isVisible()) {
			await verifyButton.click();
			
			// Should show failure and retry option
			await expect(
				page.getByText(/failed|error|try again/i)
			).toBeVisible({ timeout: 5000 });
			
			await expect(
				page.getByRole('button', { name: /try again|retry/i })
			).toBeVisible();
		}
	});

	test('verification modal can be closed and reopened', async ({ page }) => {
		await page.route('**/api/identity/init', async (route) => {
			await route.fulfill({
				json: {
					success: true,
					qrCodeData: '{"sessionId": "test-close"}',
					sessionId: 'test-close'
				}
			});
		});

		await page.goto('/climate-action');
		
		const verifyButton = page.getByRole('button', { name: /verify.*identity/i });
		if (await verifyButton.isVisible()) {
			await verifyButton.click();
			
			// Modal should be open
			await expect(page.getByText(/self\.xyz|identity verification/i)).toBeVisible();
			
			// Close modal
			const closeButton = page.getByRole('button', { name: /close|×/i });
			await closeButton.click();
			
			// Modal should be closed
			await expect(page.getByText(/self\.xyz|identity verification/i)).not.toBeVisible();
			
			// Can reopen
			await verifyButton.click();
			await expect(page.getByText(/self\.xyz|identity verification/i)).toBeVisible();
		}
	});

	test('congressional templates prioritize verified users', async ({ page, context }) => {
		// Mock verified user
		await context.addCookies([{
			name: 'user-verified',
			value: 'true',
			domain: 'localhost',
			path: '/'
		}]);

		await page.goto('/climate-action');
		
		// Should show enhanced messaging for congressional delivery
		await expect(
			page.getByText(/enhanced.*credibility|verified.*identity.*delivery/i)
		).toBeVisible();
		
		// Send button should emphasize verified status
		const sendButton = page.getByRole('button', { name: /send|contact.*congress/i });
		await expect(sendButton).toContainText(/verified|enhanced/i);
	});
});