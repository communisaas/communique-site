import { chromium } from 'playwright';

(async () => {
	const browser = await chromium.launch({ headless: false });
	const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

	await page.goto('http://localhost:5173');
	await page.waitForTimeout(3000);

	console.log('\n=== LOCATION COMPONENT INSPECTION ===\n');

	// Find LocationFilter component
	const locationSection = page.locator('[aria-label="Location breadcrumb"]');
	const breadcrumbExists = await locationSection.count();
	console.log(`Breadcrumb navigation: ${breadcrumbExists > 0 ? '✓ EXISTS' : '✗ NOT FOUND'}`);

	// Check for the main location header
	const headers = await page.locator('h2').allTextContents();
	console.log(`\nH2 headers found: ${headers.length}`);
	headers.forEach((h, i) => console.log(`  ${i + 1}. "${h}"`));

	// Check for coordination count
	const coordText = await page.locator('text=/\\d+ coordinating/').count();
	console.log(`\nCoordination count: ${coordText > 0 ? '✓ FOUND' : '✗ NOT FOUND'}`);

	// Check for preview card
	const previewCard = await page
		.locator('text=/county-level templates|district-level templates/')
		.count();
	console.log(`Preview card: ${previewCard > 0 ? '✓ FOUND' : '✗ NOT FOUND'}`);

	// Get the template section layout
	const templateSection = page.locator('#template-section');
	const templateSectionExists = await templateSection.count();
	console.log(`\nTemplate section: ${templateSectionExists > 0 ? '✓ EXISTS' : '✗ NOT FOUND'}`);

	if (templateSectionExists > 0) {
		const bbox = await templateSection.boundingBox();
		console.log(
			`Template section position: x=${bbox?.x}, y=${bbox?.y}, w=${bbox?.width}, h=${bbox?.height}`
		);

		// Screenshot just the template section
		await templateSection.screenshot({ path: '/tmp/template-section.png' });
		console.log('✓ Template section screenshot: /tmp/template-section.png');
	}

	// Scroll to template section
	await page.evaluate(() => {
		const section = document.querySelector('#template-section');
		if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
	});

	await page.waitForTimeout(1000);
	await page.screenshot({ path: '/tmp/template-section-viewport.png' });
	console.log('✓ Template section in viewport: /tmp/template-section-viewport.png');

	console.log('\n=== Browser open for manual inspection ===');
	console.log('Keeping browser open...\n');

	await page.waitForTimeout(300000);
	await browser.close();
})();
