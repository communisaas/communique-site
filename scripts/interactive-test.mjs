import { chromium } from 'playwright';

(async () => {
	console.log('=== INTERACTIVE FUNCTIONALITY TEST ===\n');

	const browser = await chromium.launch({
		headless: false,
		slowMo: 500 // Slow down so we can see what's happening
	});

	const page = await browser.newPage({
		viewport: { width: 1400, height: 900 }
	});

	try {
		// 1. Load homepage
		console.log('1. Loading homepage...');
		await page.goto('http://localhost:5173');
		await page.waitForTimeout(3000);

		// 2. Check location header exists
		console.log('2. Checking location header...');
		const locationHeader = await page.locator('div.rounded-xl.bg-white.p-6').first();
		const headerExists = (await locationHeader.count()) > 0;
		console.log(`   Location header: ${headerExists ? '✓ FOUND' : '✗ NOT FOUND'}`);

		let breadcrumbs = 0;
		let templates = 0;

		if (headerExists) {
			// 3. Check H2 title
			const h2 = await page.locator('h2.text-3xl').first();
			const h2Text = await h2.textContent();
			console.log(`   H2 title: "${h2Text}"`);

			// 4. Check coordination count
			const coordText = await page.locator('p.text-base.font-medium').first().textContent();
			console.log(`   Coordination count: "${coordText}"`);

			// 5. Check breadcrumbs
			breadcrumbs = await page.locator('[aria-label="Location breadcrumb"]').count();
			console.log(`   Breadcrumbs: ${breadcrumbs > 0 ? '✓ FOUND' : '✗ NOT FOUND'}`);

			if (breadcrumbs > 0) {
				// 6. Test breadcrumb interaction (click state breadcrumb)
				console.log('3. Testing breadcrumb interaction...');
				const stateBreadcrumb = page.locator('[aria-label="Location breadcrumb"] button').first();
				await stateBreadcrumb.click();
				await page.waitForTimeout(1000);
				console.log('   ✓ State breadcrumb clicked');

				// Check if UI updated
				const activeClass = await stateBreadcrumb.getAttribute('class');
				const isActive = activeClass.includes('bg-blue-100');
				console.log(`   Breadcrumb active state: ${isActive ? '✓ ACTIVE' : '✗ INACTIVE'}`);
			}

			// 7. Check for "Change location" button
			const changeButton = await page.locator('text=Change location').count();
			console.log(`   Change location button: ${changeButton > 0 ? '✓ FOUND' : '✗ NOT FOUND'}`);

			// 8. Check progressive disclosure
			const detailsElement = await page
				.locator('details summary:has-text("How we determined this location")')
				.count();
			console.log(`   Progressive disclosure: ${detailsElement > 0 ? '✓ FOUND' : '✗ NOT FOUND'}`);

			if (detailsElement > 0) {
				// 9. Test progressive disclosure interaction
				console.log('4. Testing progressive disclosure...');
				await page.locator('details summary:has-text("How we determined this location")').click();
				await page.waitForTimeout(1000);

				const isOpen = (await page.locator('details[open]').count()) > 0;
				console.log(`   Details opened: ${isOpen ? '✓ YES' : '✗ NO'}`);
			}
		}

		// 10. Check template list renders
		console.log('5. Checking template list...');
		templates = await page
			.locator('[data-testid="template-card"], .template-card, article')
			.count();
		console.log(`   Templates found: ${templates} ${templates > 0 ? '✓' : '✗'}`);

		// 11. Take screenshot
		await page.screenshot({ path: '/tmp/interactive-test.png', fullPage: true });
		console.log('\n✓ Screenshot saved: /tmp/interactive-test.png');

		// 12. Summary
		console.log('\n=== TEST SUMMARY ===');
		console.log(`Location header: ${headerExists ? '✓ PASS' : '✗ FAIL'}`);
		console.log(`Breadcrumbs: ${breadcrumbs > 0 ? '✓ PASS' : '✗ FAIL'}`);
		console.log(`Templates: ${templates > 0 ? '✓ PASS' : '✗ FAIL'}`);

		const allPassed = headerExists && breadcrumbs > 0 && templates > 0;
		console.log(`\nOverall: ${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);

		// Keep browser open for manual inspection
		console.log('\nBrowser will stay open for 30 seconds for manual inspection...');
		await page.waitForTimeout(30000);
	} catch (error) {
		console.error('✗ Test error:', error.message);
	} finally {
		await browser.close();
	}
})();
