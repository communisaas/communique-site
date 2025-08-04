import { test, expect } from '@playwright/test';

test.describe('Congressional Delivery Flow', () => {
	test.beforeEach(async ({ page, context }) => {
		// Mock authenticated user
		await context.addCookies([{
			name: 'auth-session',
			value: 'mock-session-token',
			domain: 'localhost',
			path: '/'
		}]);
	});

	test('congressional template shows enhanced features', async ({ page }) => {
		await page.goto('/climate-action');
		
		// Should show congressional delivery badge
		await expect(
			page.getByText(/certified|congressional|official/i)
		).toBeVisible();
		
		// Should show enhanced credibility messaging
		await expect(
			page.getByText(/direct.*congressional|official.*delivery/i)
		).toBeVisible();
	});

	test('congressional template requires address for delivery', async ({ page }) => {
		await page.goto('/climate-action');
		
		// Try to send without address
		const sendButton = page.getByRole('button', { name: /send|contact.*congress/i });
		await sendButton.click();
		
		// Should prompt for address
		await expect(
			page.getByText(/address.*required|need.*address|where.*live/i)
		).toBeVisible();
	});

	test('address collection modal validates input', async ({ page }) => {
		await page.goto('/climate-action');
		
		const sendButton = page.getByRole('button', { name: /send|contact/i });
		await sendButton.click();
		
		// Should show address form
		const streetInput = page.getByLabel(/street|address/i);
		if (await streetInput.isVisible()) {
			// Fill incomplete address
			await streetInput.fill('123 Main St');
			
			const verifyButton = page.getByRole('button', { name: /verify|find.*representatives/i });
			await verifyButton.click();
			
			// Should show validation error for incomplete address
			await expect(
				page.getByText(/city.*required|state.*required|zip.*required/i)
			).toBeVisible();
		}
	});

	test('valid address lookup finds representatives', async ({ page }) => {
		// Mock address verification API
		await page.route('**/api/address/verify', async (route) => {
			await route.fulfill({
				json: {
					verified: true,
					corrected: true,
					originalAddress: '1600 Pennsylvania Avenue NW, Washington, DC 20500',
					correctedAddress: '1600 PENNSYLVANIA AVE NW, WASHINGTON, DC, 20500',
					representatives: [
						{
							name: 'Eleanor Holmes Norton',
							office: 'House Representative, DC-AL',
							chamber: 'house',
							party: 'Democratic',
							district: 'DC-AL'
						}
					],
					district: 'DC-AL',
					message: 'Address verified successfully'
				}
			});
		});

		await page.goto('/climate-action');
		
		const sendButton = page.getByRole('button', { name: /send|contact/i });
		await sendButton.click();
		
		// Fill complete address
		await page.getByLabel(/street|address/i).fill('1600 Pennsylvania Avenue NW');
		await page.getByLabel(/city/i).fill('Washington');
		await page.getByLabel(/state/i).fill('DC');  
		await page.getByLabel(/zip/i).fill('20500');
		
		const verifyButton = page.getByRole('button', { name: /verify|find/i });
		await verifyButton.click();
		
		// Should show found representatives
		await expect(page.getByText(/Eleanor Holmes Norton/i)).toBeVisible();
		await expect(page.getByText(/DC-AL/i)).toBeVisible();
	});

	test('address verification shows corrected address', async ({ page }) => {
		// Mock address correction
		await page.route('**/api/address/verify', async (route) => {
			await route.fulfill({
				json: {
					verified: true,
					corrected: true,
					originalAddress: '350 5th Ave, New York, NY 10118',
					correctedAddress: '350 5TH AVE, NEW YORK, NY, 10118',
					representatives: [
						{
							name: 'Jerry Nadler',
							office: 'House Representative, NY-12',
							chamber: 'house',
							party: 'Democratic',
							district: 'NY-12'
						}
					],
					district: 'NY-12',
					message: 'Address corrected and verified'
				}
			});
		});

		await page.goto('/climate-action');
		
		const sendButton = page.getByRole('button', { name: /send|contact/i });
		await sendButton.click();
		
		// Fill address that needs correction
		await page.getByLabel(/street/i).fill('350 5th Ave');
		await page.getByLabel(/city/i).fill('New York');
		await page.getByLabel(/state/i).fill('NY');
		await page.getByLabel(/zip/i).fill('10118');
		
		const verifyButton = page.getByRole('button', { name: /verify/i });
		await verifyButton.click();
		
		// Should show corrected address
		await expect(page.getByText(/350 5TH AVE/i)).toBeVisible();
		await expect(page.getByText(/corrected|updated/i)).toBeVisible();
	});

	test('user can accept or modify corrected address', async ({ page }) => {
		// Mock address correction
		await page.route('**/api/address/verify', async (route) => {
			await route.fulfill({
				json: {
					verified: true,
					corrected: true,
					originalAddress: '123 main st, anytown, ca 12345',
					correctedAddress: '123 MAIN ST, ANYTOWN, CA, 12345',
					representatives: [
						{
							name: 'Test Representative',
							chamber: 'house',
							district: 'CA-01'
						}
					]
				}
			});
		});

		await page.goto('/climate-action');
		
		const sendButton = page.getByRole('button', { name: /send|contact/i });
		await sendButton.click();
		
		// Fill address
		await page.getByLabel(/street/i).fill('123 main st');
		await page.getByLabel(/city/i).fill('anytown');
		await page.getByLabel(/state/i).fill('ca');
		await page.getByLabel(/zip/i).fill('12345');
		
		const verifyButton = page.getByRole('button', { name: /verify/i });
		await verifyButton.click();
		
		// Should show accept/modify options
		await expect(
			page.getByRole('button', { name: /looks good|accept|use this/i })
		).toBeVisible();
		
		await expect(
			page.getByRole('button', { name: /modify|edit|change/i })
		).toBeVisible();
	});

	test('CWC delivery shows certified messaging', async ({ page }) => {
		// Mock successful address verification
		await page.route('**/api/address/verify', async (route) => {
			await route.fulfill({
				json: {
					verified: true,
					representatives: [
						{
							name: 'Test Senator',
							chamber: 'senate',
							state: 'CA'
						}
					]
				}
			});
		});

		await page.goto('/climate-action');
		
		// Complete address verification flow
		const sendButton = page.getByRole('button', { name: /send|contact/i });
		await sendButton.click();
		
		// Fill and verify address
		await page.getByLabel(/street/i).fill('123 Test St');
		await page.getByLabel(/city/i).fill('Test City');
		await page.getByLabel(/state/i).fill('CA');
		await page.getByLabel(/zip/i).fill('12345');
		
		const verifyButton = page.getByRole('button', { name: /verify/i });
		await verifyButton.click();
		
		// Accept address
		const acceptButton = page.getByRole('button', { name: /looks good|accept/i });
		if (await acceptButton.isVisible()) {
			await acceptButton.click();
		}
		
		// Should show certified delivery messaging
		await expect(
			page.getByText(/certified.*delivery|official.*channel|CWC/i)
		).toBeVisible();
	});

	test('address can be skipped for non-congressional templates', async ({ page }) => {
		// Go to direct email template instead
		await page.goto('/direct-action-template');
		
		const sendButton = page.getByRole('button', { name: /send|email/i });
		if (await sendButton.isVisible()) {
			await sendButton.click();
			
			// Should not require address verification
			await expect(
				page.getByText(/generating.*email|preparing.*message/i)
			).toBeVisible();
		}
	});

	test('congressional delivery handles multiple representatives', async ({ page }) => {
		// Mock multiple representatives
		await page.route('**/api/address/verify', async (route) => {
			await route.fulfill({
				json: {
					verified: true,
					representatives: [
						{
							name: 'House Representative',
							chamber: 'house',
							district: 'CA-12'
						},
						{
							name: 'Senator One',  
							chamber: 'senate',
							state: 'CA'
						},
						{
							name: 'Senator Two',
							chamber: 'senate', 
							state: 'CA'
						}
					]
				}
			});
		});

		await page.goto('/climate-action');
		
		const sendButton = page.getByRole('button', { name: /send|contact/i });
		await sendButton.click();
		
		// Complete address verification
		await page.getByLabel(/street/i).fill('123 Test St');
		await page.getByLabel(/city/i).fill('San Francisco');
		await page.getByLabel(/state/i).fill('CA');
		await page.getByLabel(/zip/i).fill('94102');
		
		const verifyButton = page.getByRole('button', { name: /verify/i });
		await verifyButton.click();
		
		// Should show all representatives
		await expect(page.getByText(/House Representative/i)).toBeVisible();
		await expect(page.getByText(/Senator One/i)).toBeVisible();
		await expect(page.getByText(/Senator Two/i)).toBeVisible();
		
		// Should show count
		await expect(page.getByText(/3.*representatives|multiple.*representatives/i)).toBeVisible();
	});
});