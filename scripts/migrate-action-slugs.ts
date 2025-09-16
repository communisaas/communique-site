/**
 * Migration script to convert existing template slugs to action-oriented URLs
 * Run with: npm run tsx scripts/migrate-action-slugs.ts
 */

import { db } from '../src/lib/server/db';
import { generateActionSlug, isSlugReserved } from '../src/lib/server/reserved-slugs';

interface SlugMigration {
	id: string;
	currentSlug: string;
	newSlug: string;
	title: string;
	deliveryMethod: string;
}

async function migrateToActionSlugs() {
	console.log('🔄 Starting template slug migration to action-oriented URLs...\n');

	try {
		// Get all templates that don't already have action-oriented slugs
		const templates = await db.template.findMany({
			select: {
				id: true,
				slug: true,
				title: true,
				deliveryMethod: true
			},
			where: {
				// Find templates that don't start with action prefixes
				slug: {
					not: {
						startsWith: 'tell-congress-'
					}
				}
			}
		});

		console.log(`📊 Found ${templates.length} templates to potentially migrate\n`);

		const migrations: SlugMigration[] = [];
		const conflicts: string[] = [];

		// Generate new action-oriented slugs
		for (const template of templates) {
			const newSlug = generateActionSlug(template.title, template.deliveryMethod);

			// Skip if already action-oriented or would be reserved
			if (newSlug === template.slug || isSlugReserved(newSlug)) {
				continue;
			}

			// Check if new slug conflicts with existing templates
			const existingTemplate = await db.template.findUnique({
				where: { slug: newSlug },
				select: { id: true }
			});

			if (existingTemplate) {
				conflicts.push(`${template.slug} → ${newSlug} (conflict with existing template)`);
				continue;
			}

			migrations.push({
				id: template.id,
				currentSlug: template.slug,
				newSlug: newSlug,
				title: template.title,
				deliveryMethod: template.deliveryMethod
			});
		}

		// Show migration plan
		console.log('📋 Migration Plan:');
		console.log('================\n');

		if (migrations.length === 0) {
			console.log('✅ No migrations needed - all templates already have action-oriented slugs!\n');
			return;
		}

		migrations.forEach((migration, index) => {
			console.log(`${index + 1}. "${migration.title}"`);
			console.log(`   ${migration.currentSlug} → ${migration.newSlug}`);
			console.log(`   Type: ${migration.deliveryMethod}\n`);
		});

		if (conflicts.length > 0) {
			console.log('⚠️  Conflicts (will be skipped):');
			conflicts.forEach((conflict) => console.log(`   ${conflict}`));
			console.log('');
		}

		// Ask for confirmation in production
		if (process.env.NODE_ENV === 'production') {
			console.log('🚨 PRODUCTION MODE: Dry run only - no changes will be made');
			console.log(
				'To apply changes, run with: NODE_ENV=development npm run tsx scripts/migrate-action-slugs.ts\n'
			);
			return;
		}

		// Apply migrations
		console.log(`🚀 Applying ${migrations.length} migrations...\n`);

		for (const migration of migrations) {
			try {
				await db.template.update({
					where: { id: migration.id },
					data: { slug: migration.newSlug }
				});

				console.log(`✅ Updated: ${migration.currentSlug} → ${migration.newSlug}`);
			} catch (error) {
				console.error(`❌ Failed to update ${migration.currentSlug}:`, error);
			}
		}

		console.log(`\n🎉 Migration complete! Updated ${migrations.length} template slugs.`);
		console.log('\n📝 New URL Examples:');
		console.log('====================');

		migrations.slice(0, 3).forEach((migration) => {
			console.log(`https://communi.email/${migration.newSlug}`);
		});

		if (migrations.length > 3) {
			console.log(`... and ${migrations.length - 3} more`);
		}
	} catch (error) {
		console.error('❌ Migration failed:', error);
		process.exit(1);
	} finally {
		await db.$disconnect();
	}
}

// Example URL showcases
function showExampleUrls() {
	console.log('\n🌟 Action-Oriented URL Examples:');
	console.log('================================');
	console.log('Before: https://communi.email/climate-change-bill');
	console.log('After:  https://communi.email/tell-congress-climate-change-bill\n');

	console.log('Before: https://communi.email/healthcare-reform');
	console.log('After:  https://communi.email/demand-healthcare-reform\n');

	console.log('Before: https://communi.email/voting-rights');
	console.log('After:  https://communi.email/support-voting-rights\n');

	console.log('🎯 Benefits:');
	console.log('• URLs clearly show the action being taken');
	console.log('• Creates urgency and engagement when shared');
	console.log('• Improves SEO with action-oriented keywords');
	console.log('• Better social media sharing experience\n');
}

if (require.main === module) {
	showExampleUrls();
	migrateToActionSlugs();
}
