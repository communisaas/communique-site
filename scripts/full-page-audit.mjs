import { chromium } from 'playwright';

(async () => {
	const browser = await chromium.launch({ headless: false });
	const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

	await page.goto('http://localhost:5173');
	await page.waitForTimeout(3000);

	console.log('\n=== FULL PAGE VISUAL AUDIT ===\n');

	// Take full page screenshot
	await page.screenshot({ path: '/tmp/communique-full-page.png', fullPage: true });
	console.log('✓ Full page screenshot: /tmp/communique-full-page.png');

	// Find the location filter section
	const locationHeader = page.locator('div.mx-auto.max-w-6xl.mb-8').first();
	const locationHeaderExists = await locationHeader.count();
	console.log(
		`\nLocation header section: ${locationHeaderExists > 0 ? '✓ EXISTS' : '✗ NOT FOUND'}`
	);

	if (locationHeaderExists > 0) {
		const bbox = await locationHeader.boundingBox();
		console.log(
			`Location header position: x=${bbox?.x}, y=${bbox?.y}, w=${bbox?.width}, h=${bbox?.height}`
		);
		await locationHeader.screenshot({ path: '/tmp/location-header.png' });
		console.log('✓ Location header screenshot: /tmp/location-header.png');
	}

	// Check what text is in the location header
	const locationText = await page.locator('div.mx-auto.max-w-6xl.mb-8').first().textContent();
	console.log(`\nLocation header text: "${locationText}"`);

	// Check for h2 with location name
	const locationH2 = await page.locator('div.mx-auto.max-w-6xl.mb-8 h2').count();
	console.log(`Location H2 header: ${locationH2 > 0 ? '✓ FOUND' : '✗ NOT FOUND'}`);

	// Check for breadcrumb nav
	const breadcrumb = await page.locator('[aria-label="Location breadcrumb"]').count();
	console.log(`Breadcrumb navigation: ${breadcrumb > 0 ? '✓ FOUND' : '✗ NOT FOUND'}`);

	// Check for "Enter your address" button
	const addressButton = await page.locator('text="Enter your address"').count();
	console.log(`"Enter your address" button: ${addressButton > 0 ? '✓ FOUND' : '✗ NOT FOUND'}`);

	// Scroll to top
	await page.evaluate(() => window.scrollTo(0, 0));
	await page.waitForTimeout(1000);
	await page.screenshot({ path: '/tmp/homepage-top.png' });
	console.log('✓ Homepage top screenshot: /tmp/homepage-top.png');

	console.log('\n=== Browser open for manual inspection ===');
	console.log('Keeping browser open...\n');

	await page.waitForTimeout(300000);
	await browser.close();
})();
