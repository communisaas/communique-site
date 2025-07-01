#!/usr/bin/env tsx

/**
 * Script to update district coverage metrics for all congressional templates
 * Run this periodically to keep metrics current with actual deliveries
 * 
 * Usage: npm run update-district-metrics
 * Or: npx tsx src/scripts/update-district-metrics.ts
 */

import { updateAllCongressionalTemplateMetrics } from '../lib/server/district-metrics';

async function main() {
    console.log('🗳️  Starting district metrics update...');
    
    try {
        await updateAllCongressionalTemplateMetrics();
        console.log('✅ District metrics update completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating district metrics:', error);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
} 