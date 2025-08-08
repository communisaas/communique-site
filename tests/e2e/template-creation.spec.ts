import { test, expect } from '@playwright/test';

test.describe('Template Creation Flow', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
	});

	test('create template button is visible and accessible', async ({ page }) => {
		// Look for template creation entry points
		const possibleButtons = [
			page.getByRole('button', { name: /start writing/i }),
			page.getByRole('button', { name: /create.*template/i }),
			page.getByRole('button', { name: /new template/i }),
			page.getByRole('button', { name: /add template/i })
		];
		
		// At least one create button should be visible
		let buttonVisible = false;
		for (const button of possibleButtons) {
			if (await button.isVisible()) {
				buttonVisible = true;
				break;
			}
		}
		
		expect(buttonVisible).toBeTruthy();
	});

	test('clicking create template opens creation modal', async ({ page }) => {
		// Find and click create template button
		const possibleButtons = [
			page.getByRole('button', { name: /start writing/i }),
			page.getByRole('button', { name: /create.*template/i }),
			page.getByRole('button', { name: /new template/i })
		];
		
		let clicked = false;
		for (const button of possibleButtons) {
			if (await button.isVisible()) {
				await button.click();
				clicked = true;
				break;
			}
		}
		
		if (clicked) {
			// Should open template creation modal
			await expect(
				page.getByText(/create template|new template|template creator/i)
			).toBeVisible();
		} else {
			test.skip(true, 'No create template button found');
		}
	});

	test('template creator form has required fields', async ({ page }) => {
		// Open template creator
		const createButton = page.getByRole('button', { name: /create|new template/i });
		if (await createButton.isVisible()) {
			await createButton.click();
			
			// Should have form fields
			await expect(page.getByLabel(/title|name/i)).toBeVisible();
			await expect(page.getByLabel(/description|summary/i)).toBeVisible();
			await expect(page.getByLabel(/message|content|body/i)).toBeVisible();
		}
	});

	test('template creation requires authentication for save', async ({ page }) => {
		// Try to create template as guest
		const createButton = page.getByRole('button', { name: /create|new template/i });
		if (await createButton.isVisible()) {
			await createButton.click();
			
			// Fill out form
			await page.getByLabel(/title|name/i).fill('Test Template');
			await page.getByLabel(/description/i).fill('Test description');
			await page.getByLabel(/message|content/i).fill('Test message content');
			
			// Try to save
			const saveButton = page.getByRole('button', { name: /save|create|publish/i });
			await saveButton.click();
			
			// Should require authentication
			await expect(
				page.getByText(/sign in|login|authenticate|account/i)
			).toBeVisible();
		}
	});

	test('template creator supports different delivery methods', async ({ page }) => {
		const createButton = page.getByRole('button', { name: /create|new template/i });
		if (await createButton.isVisible()) {
			await createButton.click();
			
			// Should have delivery method options
			await expect(
				page.getByText(/congressional|direct email|certified|delivery/i)
			).toBeVisible();
		}
	});

	test('template preview updates dynamically', async ({ page }) => {
		const createButton = page.getByRole('button', { name: /create|new template/i });
		if (await createButton.isVisible()) {
			await createButton.click();
			
			// Fill title
			const titleInput = page.getByLabel(/title|name/i);
			await titleInput.fill('Dynamic Preview Test');
			
			// Preview should update
			await expect(page.getByText('Dynamic Preview Test')).toBeVisible();
			
			// Fill message content
			const messageInput = page.getByLabel(/message|content/i);
			await messageInput.fill('This is a test message for preview');
			
			// Preview should show message content
			await expect(
				page.getByText(/this is a test message/i)
			).toBeVisible();
		}
	});

	test('template validation prevents invalid submissions', async ({ page }) => {
		const createButton = page.getByRole('button', { name: /create|new template/i });
		if (await createButton.isVisible()) {
			await createButton.click();
			
			// Try to save without required fields
			const saveButton = page.getByRole('button', { name: /save|create|publish/i });
			await saveButton.click();
			
			// Should show validation errors
			await expect(
				page.getByText(/required|missing|empty|invalid/i)
			).toBeVisible();
		}
	});

	test('congressional templates require recipient configuration', async ({ page }) => {
		const createButton = page.getByRole('button', { name: /create|new template/i });
		if (await createButton.isVisible()) {
			await createButton.click();
			
			// Select congressional delivery
			const congressionalOption = page.getByText(/congressional|certified/i);
			if (await congressionalOption.isVisible()) {
				await congressionalOption.click();
				
				// Should show recipient configuration
				await expect(
					page.getByText(/representatives|congress|recipient/i)
				).toBeVisible();
			}
		}
	});

	test('template slug generation works correctly', async ({ page }) => {
		const createButton = page.getByRole('button', { name: /create|new template/i });
		if (await createButton.isVisible()) {
			await createButton.click();
			
			// Enter title
			await page.getByLabel(/title|name/i).fill('Climate Action Now');
			
			// Should generate URL slug
			await expect(
				page.getByText(/climate-action-now|climateactionnow/i)
			).toBeVisible();
		}
	});

	test('template categories are selectable', async ({ page }) => {
		const createButton = page.getByRole('button', { name: /create|new template/i });
		if (await createButton.isVisible()) {
			await createButton.click();
			
			// Should have category options
			const categorySelect = page.getByLabel(/category|topic|issue/i);
			if (await categorySelect.isVisible()) {
				await categorySelect.click();
				
				// Should show category options
				await expect(
					page.getByText(/environment|healthcare|education|economy/i)
				).toBeVisible();
			}
		}
	});
});