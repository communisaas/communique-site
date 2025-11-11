import { chromium } from 'playwright';

(async () => {
	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
	const page = await context.newPage();

	console.log('\n=== Navigating to homepage ===');
	await page.goto('http://localhost:5173');
	await page.waitForTimeout(3000);

	console.log('Taking screenshots...');
	await page.screenshot({ path: '/tmp/communique-homepage.png', fullPage: true });
	console.log('✓ Full page screenshot: /tmp/communique-homepage.png');

	// Take screenshot of location filter area
	const locationFilter = page.locator('[aria-label="Location breadcrumb"]').first();
	if ((await locationFilter.count()) > 0) {
		await locationFilter.screenshot({ path: '/tmp/location-breadcrumb.png' });
		console.log('✓ Breadcrumb screenshot: /tmp/location-breadcrumb.png');
	}

	console.log('\n=== Browser open for visual inspection ===');
	console.log('Inspect the layout, composition, spacing, visual hierarchy');
	console.log('Press Ctrl+C when done analyzing\n');

	// Keep browser open for manual inspection
	await page.waitForTimeout(300000);

	await browser.close();
})();
