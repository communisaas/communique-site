import { chromium } from 'playwright';

(async () => {
	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

	await page.goto('http://localhost:5173');
	await page.waitForTimeout(3000);

	const locationHeader = page.locator('div.mx-auto.max-w-6xl.mb-8').first();
	if ((await locationHeader.count()) > 0) {
		await locationHeader.screenshot({ path: '/tmp/location-header-new.png' });
		console.log('✓ Screenshot saved: /tmp/location-header-new.png');
	} else {
		console.log('✗ Location header not found');
	}

	await browser.close();
})();
