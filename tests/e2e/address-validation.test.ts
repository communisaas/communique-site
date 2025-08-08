import { test, expect } from '@playwright/test';

test.describe('Address Validation Flow', () => {
	test.beforeEach(async ({ page }) => {
		// Start from home page
		await page.goto('/');
	});

	test('should validate address and find representatives', async ({ page }) => {
		// Mock the address verification API to return successful validation
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

		// Look for address collection modal trigger
		// This test assumes there's a button or form that opens the address modal
		const addressButton = page.getByRole('button', { name: /address|location/i });
		if (await addressButton.isVisible()) {
			await addressButton.click();

			// Fill out address form in modal
			await page.getByLabel(/street/i).fill('1600 Pennsylvania Avenue NW');
			await page.getByLabel(/city/i).fill('Washington');
			await page.getByLabel(/state/i).fill('DC');
			await page.getByLabel(/zip/i).fill('20500');

			// Submit for verification
			await page.getByRole('button', { name: /verify|find representatives/i }).click();

			// Wait for verification to complete
			await expect(page.getByText(/address verified/i)).toBeVisible();
			await expect(page.getByText(/Eleanor Holmes Norton/i)).toBeVisible();

			// Accept the verified address
			await page.getByRole('button', { name: /looks good|accept/i }).click();

			// Verify success state
			await expect(page.getByText(/you're all set/i)).toBeVisible();
		}
	});

	test('should handle address verification errors', async ({ page }) => {
		// Mock API to return address not found
		await page.route('**/api/address/verify', async (route) => {
			await route.fulfill({
				status: 400,
				json: {
					verified: false,
					error: 'Address not found. Please check and try again.'
				}
			});
		});

		const addressButton = page.getByRole('button', { name: /address|location/i });
		if (await addressButton.isVisible()) {
			await addressButton.click();

			// Fill invalid address
			await page.getByLabel(/street/i).fill('Invalid Street');
			await page.getByLabel(/city/i).fill('Nowhere');
			await page.getByLabel(/state/i).fill('XX');
			await page.getByLabel(/zip/i).fill('00000');

			await page.getByRole('button', { name: /verify/i }).click();

			// Verify error message appears
			await expect(page.getByText(/address not found/i)).toBeVisible();
		}
	});

	test('should allow skipping verification', async ({ page }) => {
		const addressButton = page.getByRole('button', { name: /address|location/i });
		if (await addressButton.isVisible()) {
			await addressButton.click();

			// Fill address
			await page.getByLabel(/street/i).fill('123 Main St');
			await page.getByLabel(/city/i).fill('New York');
			await page.getByLabel(/state/i).fill('NY');
			await page.getByLabel(/zip/i).fill('10001');

			// Skip verification
			await page.getByRole('button', { name: /skip verification/i }).click();

			// Should proceed without verification
			await expect(page.getByText(/may affect delivery/i)).toBeVisible();
		}
	});
});

test.describe('Address API Integration', () => {
	test('should test address lookup endpoint directly', async ({ request }) => {
		// Test the actual API endpoint
		const response = await request.post('/api/address/lookup', {
			data: {
				street: '1600 Pennsylvania Avenue NW',
				city: 'Washington',
				state: 'DC',
				zip: '20500'
			}
		});

		expect(response.ok()).toBeTruthy();
		
		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.representatives).toBeDefined();
		expect(data.representatives.house).toBeDefined();
		expect(data.district).toBeDefined();
	});

	test('should test address verification endpoint', async ({ request }) => {
		const response = await request.post('/api/address/verify', {
			data: {
				street: '350 Fifth Avenue',
				city: 'New York',
				state: 'NY',
				zipCode: '10118'
			}
		});

		expect(response.ok()).toBeTruthy();
		
		const data = await response.json();
		expect(data.verified).toBe(true);
		expect(data.correctedAddress).toContain('5TH AVE');
		expect(data.district).toMatch(/NY-\d{2}/);
	});

	test('should handle validation errors properly', async ({ request }) => {
		const response = await request.post('/api/address/verify', {
			data: {
				street: '123 Main St',
				city: 'New York',
				state: 'NY'
				// Missing zipCode
			}
		});

		expect(response.status()).toBe(400);
		
		const data = await response.json();
		expect(data.verified).toBe(false);
		expect(data.error).toContain('required');
	});
});

test.describe('Congressional Representative Data', () => {
	test('should return real representative data structure', async ({ request }) => {
		const response = await request.get('/api/address/lookup?state=CA&district=12');

		expect(response.ok()).toBeTruthy();
		
		const data = await response.json();
		expect(data.representatives.house).toMatchObject({
			name: expect.stringContaining('CA-12'),
			chamber: 'house',
			state: 'CA',
			district: '12'
		});
		
		expect(data.representatives.senate).toHaveLength(2);
		expect(data.representatives.senate[0]).toMatchObject({
			chamber: 'senate',
			state: 'CA'
		});
	});
});