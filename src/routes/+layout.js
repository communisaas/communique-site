/**
 * Root layout JavaScript - handles global client-side initialization
 *
 * This runs on every page load and handles:
 * - Analytics initialization
 * - Global client-side setup
 */

import { browser } from '$app/environment';
import { analytics } from '$lib/core/analytics/database';
import { page } from '$app/stores';

// Initialize analytics on client-side
if (browser) {
	// Track page views automatically
	page.subscribe(($page) => {
		if (analytics.isReady && $page?.url?.href) {
			analytics.trackPageView($page.url.href);
		}
	});

	// Track errors automatically
	window.addEventListener('error', (event) => {
		analytics.trackError(event.error, {
			filename: event.filename,
			lineno: event.lineno,
			colno: event.colno
		});
	});

	// Track unhandled promise rejections
	window.addEventListener('unhandledrejection', (event) => {
		analytics.trackError(new Error(event.reason), {
			type: 'unhandled_promise_rejection'
		});
	});
}

// Pass server data to client if needed
/**
 * @param {{ data: any }} params
 */
export async function load({ data }) {
	return {
		...data
	};
}
