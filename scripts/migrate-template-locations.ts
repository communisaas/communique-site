#!/usr/bin/env tsx
/**
 * Data Migration Script: Template Locations → TemplateJurisdiction
 *
 * Migrates existing template location data from unstructured string arrays
 * to structured TemplateJurisdiction table.
 *
 * Phase 1: Parse existing location strings and create jurisdiction records
 * Phase 2: Generate OpenAI embeddings for semantic search
 *
 * Usage:
 *   tsx scripts/migrate-template-locations.ts
 *   tsx scripts/migrate-template-locations.ts --dry-run  # Preview changes only
 *   tsx scripts/migrate-template-locations.ts --embeddings  # Also generate embeddings
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MigrationStats {
	templatesProcessed: number;
	jurisdictionsCreated: number;
	parseErrors: number;
	skipped: number;
}

/**
 * Parse location strings like:
 * - "Austin, TX"
 * - "TX-18" (congressional district)
 * - "Harris County, TX"
 * - "Texas" (state-level)
 */
function parseLocationString(location: string): {
	jurisdiction_type: string;
	congressional_district?: string;
	state_code?: string;
	county_name?: string;
	city_name?: string;
} | null {
	const trimmed = location.trim();

	// Known city mapping (city name only → city + state)
	const knownCities: Record<string, { city: string; state: string }> = {
		'San Francisco': { city: 'San Francisco', state: 'CA' },
		'Los Angeles': { city: 'Los Angeles', state: 'CA' },
		'New York': { city: 'New York', state: 'NY' },
		'Chicago': { city: 'Chicago', state: 'IL' },
		'Houston': { city: 'Houston', state: 'TX' },
		'Austin': { city: 'Austin', state: 'TX' },
		'Seattle': { city: 'Seattle', state: 'WA' },
		'Boston': { city: 'Boston', state: 'MA' },
		'Denver': { city: 'Denver', state: 'CO' },
		'Portland': { city: 'Portland', state: 'OR' }
	};

	// Check known cities
	if (knownCities[trimmed]) {
		const cityInfo = knownCities[trimmed];
		return {
			jurisdiction_type: 'city',
			city_name: cityInfo.city,
			state_code: cityInfo.state
		};
	}

	// Congressional district pattern: "TX-18", "CA-12"
	const districtMatch = trimmed.match(/^([A-Z]{2})-(\d+)$/);
	if (districtMatch) {
		return {
			jurisdiction_type: 'federal',
			congressional_district: trimmed,
			state_code: districtMatch[1]
		};
	}

	// County pattern: "Harris County, TX", "Travis County, Texas"
	const countyMatch = trimmed.match(/^([\w\s]+)\s+County,\s+([A-Z]{2}|[A-Za-z\s]+)$/);
	if (countyMatch) {
		const stateCode = countyMatch[2].length === 2 ? countyMatch[2] : stateNameToCode(countyMatch[2]);
		return {
			jurisdiction_type: 'county',
			county_name: countyMatch[1].trim(),
			state_code: stateCode
		};
	}

	// City pattern: "Austin, TX", "San Francisco, CA"
	const cityMatch = trimmed.match(/^([\w\s]+),\s+([A-Z]{2})$/);
	if (cityMatch) {
		return {
			jurisdiction_type: 'city',
			city_name: cityMatch[1].trim(),
			state_code: cityMatch[2]
		};
	}

	// State pattern: "TX", "Texas", "CA", "California"
	if (trimmed.length === 2 && /^[A-Z]{2}$/.test(trimmed)) {
		return {
			jurisdiction_type: 'state',
			state_code: trimmed
		};
	}

	const stateCode = stateNameToCode(trimmed);
	if (stateCode) {
		return {
			jurisdiction_type: 'state',
			state_code: stateCode
		};
	}

	// Unknown format
	console.warn(`Unable to parse location: "${location}"`);
	return null;
}

/**
 * Convert state name to 2-letter code
 */
function stateNameToCode(stateName: string): string | null {
	const states: Record<string, string> = {
		Alabama: 'AL',
		Alaska: 'AK',
		Arizona: 'AZ',
		Arkansas: 'AR',
		California: 'CA',
		Colorado: 'CO',
		Connecticut: 'CT',
		Delaware: 'DE',
		Florida: 'FL',
		Georgia: 'GA',
		Hawaii: 'HI',
		Idaho: 'ID',
		Illinois: 'IL',
		Indiana: 'IN',
		Iowa: 'IA',
		Kansas: 'KS',
		Kentucky: 'KY',
		Louisiana: 'LA',
		Maine: 'ME',
		Maryland: 'MD',
		Massachusetts: 'MA',
		Michigan: 'MI',
		Minnesota: 'MN',
		Mississippi: 'MS',
		Missouri: 'MO',
		Montana: 'MT',
		Nebraska: 'NE',
		Nevada: 'NV',
		'New Hampshire': 'NH',
		'New Jersey': 'NJ',
		'New Mexico': 'NM',
		'New York': 'NY',
		'North Carolina': 'NC',
		'North Dakota': 'ND',
		Ohio: 'OH',
		Oklahoma: 'OK',
		Oregon: 'OR',
		Pennsylvania: 'PA',
		'Rhode Island': 'RI',
		'South Carolina': 'SC',
		'South Dakota': 'SD',
		Tennessee: 'TN',
		Texas: 'TX',
		Utah: 'UT',
		Vermont: 'VT',
		Virginia: 'VA',
		Washington: 'WA',
		'West Virginia': 'WV',
		Wisconsin: 'WI',
		Wyoming: 'WY'
	};

	const normalized = stateName.trim();
	return states[normalized] || null;
}

/**
 * Main migration function
 */
async function migrateTemplateLocations(dryRun = false): Promise<MigrationStats> {
	const stats: MigrationStats = {
		templatesProcessed: 0,
		jurisdictionsCreated: 0,
		parseErrors: 0,
		skipped: 0
	};

	console.log('🔍 Fetching templates with location data...\n');

	// Fetch all templates with old location format
	const templates = await prisma.template.findMany({
		where: {
			OR: [
				{ specific_locations: { isEmpty: false } },
				{ jurisdiction_level: { not: null } },
				{ applicable_countries: { isEmpty: false } }
			]
		},
		select: {
			id: true,
			slug: true,
			title: true,
			specific_locations: true,
			jurisdiction_level: true,
			applicable_countries: true,
			jurisdictions: true // Check existing jurisdictions
		}
	});

	console.log(`Found ${templates.length} templates with location data\n`);

	for (const template of templates) {
		stats.templatesProcessed++;

		// Skip if already migrated
		if (template.jurisdictions.length > 0) {
			console.log(`⏭️  Skipping ${template.slug} - already has ${template.jurisdictions.length} jurisdictions`);
			stats.skipped++;
			continue;
		}

		console.log(`📍 Processing: ${template.slug}`);
		console.log(`   Title: ${template.title}`);
		console.log(`   Locations: ${template.specific_locations.join(', ')}`);

		const jurisdictionsToCreate: Array<{
			template_id: string;
			jurisdiction_type: string;
			congressional_district?: string;
			state_code?: string;
			county_name?: string;
			city_name?: string;
		}> = [];

		// Parse each location string
		for (const location of template.specific_locations) {
			const parsed = parseLocationString(location);
			if (parsed) {
				jurisdictionsToCreate.push({
					template_id: template.id,
					...parsed
				});
			} else {
				stats.parseErrors++;
			}
		}

		if (jurisdictionsToCreate.length > 0) {
			console.log(`   → Creating ${jurisdictionsToCreate.length} jurisdiction records`);

			if (!dryRun) {
				await prisma.templateJurisdiction.createMany({
					data: jurisdictionsToCreate
				});
			}

			stats.jurisdictionsCreated += jurisdictionsToCreate.length;
		}

		console.log('');
	}

	return stats;
}

/**
 * Generate OpenAI embeddings for templates (Phase 2)
 * This will be implemented separately as it requires OpenAI API calls
 */
async function generateEmbeddings(dryRun = false): Promise<void> {
	console.log('\n📊 Embedding generation will be implemented in Phase 2');
	console.log('This requires:');
	console.log('  1. OpenAI API integration');
	console.log('  2. Batch job processing');
	console.log('  3. Rate limiting for API calls');
	console.log('  4. Embedding storage and versioning');
	console.log('\nFor now, embeddings will be generated on-demand during template search.\n');
}

/**
 * Main CLI entry point
 */
async function main() {
	const args = process.argv.slice(2);
	const dryRun = args.includes('--dry-run');
	const withEmbeddings = args.includes('--embeddings');

	console.log('\n════════════════════════════════════════════════════════════════');
	console.log('  Template Location Migration → TemplateJurisdiction Table');
	console.log('════════════════════════════════════════════════════════════════\n');

	if (dryRun) {
		console.log('🔍 DRY RUN MODE - No database changes will be made\n');
	}

	try {
		const stats = await migrateTemplateLocations(dryRun);

		console.log('\n════════════════════════════════════════════════════════════════');
		console.log('  Migration Summary');
		console.log('════════════════════════════════════════════════════════════════\n');
		console.log(`Templates processed:      ${stats.templatesProcessed}`);
		console.log(`Jurisdictions created:    ${stats.jurisdictionsCreated}`);
		console.log(`Templates skipped:        ${stats.skipped} (already migrated)`);
		console.log(`Parse errors:             ${stats.parseErrors}`);
		console.log('');

		if (withEmbeddings) {
			await generateEmbeddings(dryRun);
		}

		if (dryRun) {
			console.log('\n💡 Run without --dry-run to apply changes to database\n');
		} else {
			console.log('\n✅ Migration completed successfully!\n');
		}
	} catch (error) {
		console.error('\n❌ Migration failed:', error);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

main();
