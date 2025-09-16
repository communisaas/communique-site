import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(_config: FullConfig) {
	console.log('🎭 Setting up Playwright MCP Integration...');

	// Start the application server for testing
	const browser = await chromium.launch();
	const context = await browser.newContext();
	const page = await context.newPage();

	try {
		// Health check - ensure the app is running
		console.log('🔍 Performing application health check...');
		await page.goto('http://localhost:4173');
		await page.waitForLoadState('networkidle');

		console.log('✅ Application is ready for MCP-enhanced testing');
	} catch (_error) {
		console.log('⚠️  Application not yet ready, tests will handle startup');
	} finally {
		await context.close();
		await browser.close();
	}

	// Setup MCP debugging utilities
	process.env.PLAYWRIGHT_MCP_DEBUG = 'true';
	process.env.PLAYWRIGHT_SCREENSHOTS = 'true';
	process.env.PLAYWRIGHT_TRACES = 'true';

	console.log('🚀 MCP Integration ready - enhanced UI inspection enabled!');
}

export default globalSetup;
