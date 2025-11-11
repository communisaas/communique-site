import { chromium } from 'playwright';

(async () => {
	const browser = await chromium.launch({ headless: false });
	const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

	// Capture console logs
	page.on('console', (msg) => {
		const type = msg.type();
		const text = msg.text();

		// Filter for location-related logs
		if (
			text.includes('Location') ||
			text.includes('location') ||
			text.includes('IP') ||
			text.includes('signal')
		) {
			console.log(`[${type.toUpperCase()}] ${text}`);
		}
	});

	// Capture errors
	page.on('pageerror', (error) => {
		console.log(`[PAGE ERROR] ${error.message}`);
	});

	console.log('\n=== LOADING PAGE AND MONITORING CONSOLE ===\n');

	await page.goto('http://localhost:5173');

	// Wait for location inference to complete
	await page.waitForTimeout(5000);

	console.log('\n=== Checking IndexedDB for location data ===\n');

	const indexedDBData = await page.evaluate(async () => {
		return new Promise((resolve) => {
			const request = indexedDB.open('communique-location', 1);

			request.onsuccess = () => {
				const db = request.result;
				const results = {
					signals: [],
					inferred: null
				};

				// Get signals
				const signalTx = db.transaction(['location-signals'], 'readonly');
				const signalStore = signalTx.objectStore('location-signals');
				const signalRequest = signalStore.getAll();

				signalRequest.onsuccess = () => {
					results.signals = signalRequest.result;

					// Get inferred location
					const inferredTx = db.transaction(['inferred-location'], 'readonly');
					const inferredStore = inferredTx.objectStore('inferred-location');
					const inferredRequest = inferredStore.get('current');

					inferredRequest.onsuccess = () => {
						results.inferred = inferredRequest.result;
						resolve(results);
					};
				};
			};

			request.onerror = () => {
				resolve({ error: 'IndexedDB failed to open' });
			};
		});
	});

	console.log('IndexedDB Data:', JSON.stringify(indexedDBData, null, 2));

	console.log('\n=== Browser open for inspection ===');
	console.log('Press Ctrl+C to exit\n');

	await page.waitForTimeout(300000);
	await browser.close();
})();
