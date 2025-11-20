/**
 * Playwright test script to verify breadcrumb filtering behavior
 * Run with: node scripts/test-breadcrumb-filtering.js
 */

import { chromium } from 'playwright';

async function testBreadcrumbFiltering() {
	console.log('🚀 Starting breadcrumb filtering test...\n');

	const browser = await chromium.launch({
		headless: false,
		slowMo: 500 // Slow down for observation
	});

	const context = await browser.newContext();
	const page = await context.newPage();

	// Enable console logging from browser
	page.on('console', async (msg) => {
		const text = msg.text();
		if (text.includes('[LocationFilter]') || text.includes('[TemplateFilter]')) {
			console.log(`🔍 Browser: ${text}`);

			// Special handling for score breakdown - expand the arrays
			if (text.includes('Detailed score breakdown')) {
				try {
					const args = msg.args();
					if (args.length > 0) {
						const jsonValue = await args[0].jsonValue();
						if (jsonValue && jsonValue.scoreDetails) {
							console.log('   📊 Score details:');
							jsonValue.scoreDetails.forEach((detail, i) => {
								console.log(`      ${i + 1}. [${detail.level}] ${detail.score} - ${detail.title}`);
								console.log(`         → ${detail.matchReason}`);
							});
						}
					}
				} catch (e) {
					// Ignore if we can't parse
				}
			}
		}
	});

	try {
		// Step 1: Navigate to homepage
		console.log('📍 Step 1: Navigating to localhost:5173...');
		await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
		await page.waitForTimeout(2000);

		// Step 2: Check if location filter exists
		console.log('\n📍 Step 2: Checking for location filter...');
		const locationFilter = await page
			.locator('nav[aria-label="Filter by geographic scope"]')
			.count();
		console.log(`   Found ${locationFilter} location filter(s)`);

		if (locationFilter === 0) {
			console.log('⚠️  No location filter found - user may need to set location first');
			await page.screenshot({ path: 'test-no-location.png' });
		}

		// Step 3: Capture initial template list
		console.log('\n📍 Step 3: Capturing initial template list...');
		const initialTemplates = await page.locator('[data-testid^="template-button-"]').all();
		const initialTitles = await Promise.all(
			initialTemplates.map((t) => t.locator('h3').textContent())
		);
		console.log(`   Found ${initialTemplates.length} templates initially`);
		if (initialTitles.length > 0) {
			console.log(`   First 3 templates:\n     - ${initialTitles.slice(0, 3).join('\n     - ')}`);
		}

		// Step 4: Find breadcrumb buttons
		console.log('\n📍 Step 4: Looking for breadcrumb buttons...');
		const breadcrumbs = await page
			.locator('nav[aria-label="Filter by geographic scope"] button')
			.all();
		console.log(`   Found ${breadcrumbs.length} breadcrumb button(s)`);

		if (breadcrumbs.length === 0) {
			console.log('⚠️  No breadcrumb buttons found');
			await page.screenshot({ path: 'test-no-breadcrumbs.png' });
			return;
		}

		// Print all breadcrumb labels
		for (let i = 0; i < breadcrumbs.length; i++) {
			const text = await breadcrumbs[i].textContent();
			console.log(`   Breadcrumb ${i + 1}: "${text}"`);
		}

		// Step 5: Click first breadcrumb (should be country or state)
		console.log('\n📍 Step 5: Clicking first breadcrumb...');
		const firstBreadcrumb = breadcrumbs[0];
		const breadcrumbText = await firstBreadcrumb.textContent();
		console.log(`   Clicking: "${breadcrumbText}"`);

		await firstBreadcrumb.click();
		await page.waitForTimeout(1000);

		// Step 6: Check if breadcrumb is now selected (has bg-slate-100 class)
		console.log('\n📍 Step 6: Checking breadcrumb selection state...');
		const isSelected = await firstBreadcrumb.evaluate((el) => {
			return el.classList.contains('bg-slate-100');
		});
		console.log(`   Breadcrumb selected: ${isSelected}`);

		// Step 7: Capture template list after click
		console.log('\n📍 Step 7: Capturing template list after breadcrumb click...');
		await page.waitForTimeout(500);
		const afterTemplates = await page.locator('[data-testid^="template-button-"]').all();
		const afterTitles = await Promise.all(afterTemplates.map((t) => t.locator('h3').textContent()));
		console.log(`   Found ${afterTemplates.length} templates after click`);
		if (afterTitles.length > 0) {
			console.log(`   First 3 templates:\n     - ${afterTitles.slice(0, 3).join('\n     - ')}`);
		}

		// Step 8: Compare template lists
		console.log('\n📍 Step 8: Comparing template lists...');
		const templatesChanged = JSON.stringify(initialTitles) !== JSON.stringify(afterTitles);
		const countChanged = initialTemplates.length !== afterTemplates.length;
		console.log(
			`   Templates changed: ${templatesChanged} (count: ${initialTemplates.length} → ${afterTemplates.length})`
		);

		if (!templatesChanged && !countChanged) {
			console.log('   ⚠️  Templates did NOT change after breadcrumb click!');
			console.log('   This indicates the filtering is not working.');
			console.log('   Initial:', initialTitles.slice(0, 3));
			console.log('   After:', afterTitles.slice(0, 3));
		} else {
			console.log('   ✅ Templates DID change - filtering appears to be working!');
			console.log('   Difference:', {
				orderChanged: templatesChanged && !countChanged,
				countChanged,
				initialCount: initialTemplates.length,
				afterCount: afterTemplates.length
			});
		}

		// Step 9: Click breadcrumb again to deselect
		console.log('\n📍 Step 9: Clicking breadcrumb again to deselect...');
		await firstBreadcrumb.click();
		await page.waitForTimeout(1000);

		const isDeselected = await firstBreadcrumb.evaluate((el) => {
			return !el.classList.contains('bg-slate-100');
		});
		console.log(`   Breadcrumb deselected: ${isDeselected}`);

		// Step 10: Final screenshot
		console.log('\n📍 Step 10: Taking final screenshot...');
		await page.screenshot({ path: 'test-breadcrumb-final.png', fullPage: true });
		console.log('   Screenshot saved: test-breadcrumb-final.png');

		// Wait for observation
		console.log('\n⏳ Pausing 5 seconds for observation...');
		await page.waitForTimeout(5000);
	} catch (error) {
		console.error('❌ Test failed:', error);
		await page.screenshot({ path: 'test-error.png' });
	} finally {
		await browser.close();
		console.log('\n✅ Test complete!');
	}
}

testBreadcrumbFiltering().catch(console.error);
