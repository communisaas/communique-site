#!/usr/bin/env tsx

/**
 * Script to update district coverage metrics for all congressional templates
 * Run this periodically to keep metrics current with actual deliveries
 *
 * Usage: npm run update-district-metrics
 * Or: npx tsx src/scripts/update-district-metrics.ts
 */

import { updateAllCongressionalTemplateMetrics } from '$lib/core/server/district-metrics';

async function main() {
	try {
		await updateAllCongressionalTemplateMetrics();
		process.exit(0);
	} catch (_error) {
		process.exit(1);
	}
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
