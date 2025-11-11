#!/usr/bin/env tsx
/**
 * Quick verification script for Phase 1 migration
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyMigration() {
	console.log('\n🔍 Verifying Phase 1 Migration...\n');

	// Check templates with jurisdictions
	const templatesWithJurisdictions = await prisma.template.findMany({
		where: {
			jurisdictions: {
				some: {}
			}
		},
		include: {
			jurisdictions: true
		}
	});

	console.log(`✅ Templates with jurisdictions: ${templatesWithJurisdictions.length}`);

	for (const template of templatesWithJurisdictions.slice(0, 5)) {
		console.log(`\n📍 ${template.title}`);
		console.log(`   Slug: ${template.slug}`);
		console.log(`   Jurisdictions: ${template.jurisdictions.length}`);
		for (const j of template.jurisdictions) {
			console.log(
				`   - ${j.jurisdiction_type}: ${j.city_name || j.state_code || j.congressional_district}`
			);
		}
	}

	// Check total jurisdiction records
	const totalJurisdictions = await prisma.templateJurisdiction.count();
	console.log(`\n✅ Total jurisdiction records: ${totalJurisdictions}`);

	// Check templates with embeddings (should be 0 initially)
	const templatesWithEmbeddings = await prisma.template.count({
		where: {
			OR: [{ location_embedding: { not: null } }, { topic_embedding: { not: null } }]
		}
	});

	console.log(`✅ Templates with embeddings: ${templatesWithEmbeddings} (expected: 0 initially)`);

	await prisma.$disconnect();
	console.log('\n✅ Migration verification complete!\n');
}

verifyMigration().catch((error) => {
	console.error('❌ Verification failed:', error);
	process.exit(1);
});
