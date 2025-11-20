/**
 * Inspect score distribution after breadcrumb click
 */

import { chromium } from 'playwright';

async function inspectScores() {
	console.log('🔍 Inspecting score distribution...\n');

	const browser = await chromium.launch({
		headless: false,
		slowMo: 500
	});

	const context = await browser.newContext();
	const page = await context.newPage();

	try {
		console.log('1. Navigating to localhost:5173...');
		await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
		await page.waitForTimeout(3000);

		console.log('\n2. Waiting for templates to load...');
		await page.waitForSelector('[data-testid^="template-button-"]', { timeout: 10000 });
		const initialCount = await page.locator('[data-testid^="template-button-"]').count();
		console.log(`   Found ${initialCount} templates`);

		console.log('\n3. Finding breadcrumbs...');
		const breadcrumbs = await page
			.locator('nav[aria-label="Filter by geographic scope"] button')
			.all();
		console.log(`   Found ${breadcrumbs.length} breadcrumb(s)`);

		if (breadcrumbs.length > 0) {
			const breadcrumbText = await breadcrumbs[0].textContent();
			console.log(`   First breadcrumb: "${breadcrumbText.trim()}"`);

			console.log('\n4. Clicking first breadcrumb...');
			await breadcrumbs[0].click();
			await page.waitForTimeout(2000);

			console.log('\n5. Extracting score data from window...');
			const scoreData = await page.evaluate(() => {
				// Check if there's a global debug object we can use
				// Otherwise we'll need to intercept the console.log calls
				return {
					timestamp: new Date().toISOString(),
					note: 'Score data would be in console logs'
				};
			});
			console.log('   Score data:', scoreData);

			console.log('\n6. Checking template count after click...');
			const afterCount = await page.locator('[data-testid^="template-button-"]').count();
			console.log(`   Found ${afterCount} templates after click`);
			console.log(`   Template count changed: ${initialCount !== afterCount}`);

			console.log('\n7. Extracting template titles...');
			const titles = await page.evaluate(() => {
				const templateButtons = document.querySelectorAll('[data-testid^="template-button-"]');
				return Array.from(templateButtons)
					.slice(0, 10)
					.map((btn) => {
						const h3 = btn.querySelector('h3');
						return h3 ? h3.textContent : 'Unknown';
					});
			});
			console.log('   First 10 templates:');
			titles.forEach((title, i) => {
				console.log(`      ${i + 1}. ${title}`);
			});
		}

		console.log('\n8. Taking screenshot...');
		await page.screenshot({ path: 'inspect-scores.png', fullPage: true });
		console.log('   Screenshot saved: inspect-scores.png');

		await page.waitForTimeout(3000);
	} catch (error) {
		console.error('❌ Error:', error);
		await page.screenshot({ path: 'inspect-error.png' });
	} finally {
		await browser.close();
		console.log('\n✅ Inspection complete!');
	}
}

inspectScores().catch(console.error);
