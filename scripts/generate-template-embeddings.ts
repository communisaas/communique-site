#!/usr/bin/env tsx
/**
 * Generate Google Gemini embeddings for all templates
 *
 * Phase 4: Semantic Search - Embedding Generation Script
 *
 * This script generates gemini-embedding-001 embeddings (768 dimensions) for:
 * 1. Location context (jurisdictions, geographic targeting)
 * 2. Topic/content (title, description, body)
 *
 * Usage:
 *   tsx scripts/generate-template-embeddings.ts
 *   tsx scripts/generate-template-embeddings.ts --dry-run    # Preview only
 *   tsx scripts/generate-template-embeddings.ts --force      # Regenerate existing
 *   tsx scripts/generate-template-embeddings.ts --template-id <id>  # Single template
 *
 * Requirements:
 *   GEMINI_API_KEY environment variable must be set
 *   Get key from: https://aistudio.google.com/apikey
 *
 * Cost Estimate:
 *   gemini-embedding-001: $0.15 per 1M tokens (or FREE in Google AI Studio)
 *   Average template: ~800 tokens (title + description + body)
 *   16 templates × 2 embeddings × 800 tokens = 25,600 tokens
 *   Cost: $0.00 (FREE tier) or $0.004 (paid tier)
 *
 * Benefits over OpenAI:
 *   - Better performance: 66.3% vs 64.6% MTEB benchmark
 *   - FREE tier: Unlimited in Google AI Studio
 *   - Multilingual: 100+ languages
 *   - 768 dimensions: 75% storage savings, 2.7x faster queries
 */

import { PrismaClient } from '@prisma/client';
import {
	generateEmbedding,
	estimateTokens,
	estimateCost
} from '$lib/core/search/gemini-embeddings';

const prisma = new PrismaClient();

interface EmbeddingStats {
	templatesProcessed: number;
	locationEmbeddingsGenerated: number;
	topicEmbeddingsGenerated: number;
	skipped: number;
	errors: number;
	totalCost: number;
	totalTokens: number;
}

/**
 * Generate location embedding from template jurisdictions and geographic context
 */
function buildLocationContext(template: {
	title: string;
	jurisdictions: Array<{
		jurisdiction_type: string;
		congressional_district?: string | null;
		state_code?: string | null;
		county_name?: string | null;
		city_name?: string | null;
	}>;
}): string {
	if (template.jurisdictions.length === 0) {
		return `Federal issue: ${template.title}`;
	}

	const jurisdictionDescriptions = template.jurisdictions.map((j) => {
		switch (j.jurisdiction_type) {
			case 'federal':
				return `Congressional District ${j.congressional_district}`;
			case 'state':
				return `State: ${j.state_code}`;
			case 'county':
				return `County: ${j.county_name}, ${j.state_code}`;
			case 'city':
				return `City: ${j.city_name}, ${j.state_code}`;
			default:
				return 'Unknown jurisdiction';
		}
	});

	return `Geographic targeting: ${jurisdictionDescriptions.join('; ')}. Issue: ${template.title}`;
}

/**
 * Generate topic embedding from template content
 */
function buildTopicContext(template: {
	title: string;
	description: string | null;
	message_body: string;
	category: string | null;
}): string {
	const parts: string[] = [`Title: ${template.title}`];

	if (template.category) {
		parts.push(`Category: ${template.category}`);
	}

	if (template.description) {
		parts.push(`Description: ${template.description}`);
	}

	// Truncate message_body to first 1000 characters to stay within token limits
	const bodyPreview =
		template.message_body.length > 1000
			? template.message_body.slice(0, 1000) + '...'
			: template.message_body;
	parts.push(`Content: ${bodyPreview}`);

	return parts.join('\n\n');
}

/**
 * Generate embeddings for a single template
 */
async function generateTemplateEmbeddings(
	templateId: string,
	force: boolean,
	dryRun: boolean
): Promise<{
	locationTokens: number;
	topicTokens: number;
	skipped: boolean;
	error?: string;
}> {
	// Fetch template with jurisdictions
	const template = await prisma.template.findUnique({
		where: { id: templateId },
		select: {
			id: true,
			slug: true,
			title: true,
			description: true,
			message_body: true,
			category: true,
			location_embedding: true,
			topic_embedding: true,
			jurisdictions: {
				select: {
					jurisdiction_type: true,
					congressional_district: true,
					state_code: true,
					county_name: true,
					city_name: true
				}
			}
		}
	});

	if (!template) {
		throw new Error(`Template not found: ${templateId}`);
	}

	// Skip if embeddings already exist (unless force flag)
	if (!force && template.location_embedding && template.topic_embedding) {
		console.log(
			`   ⏭️  Skipping ${template.slug} - embeddings already exist (use --force to regenerate)`
		);
		return { locationTokens: 0, topicTokens: 0, skipped: true };
	}

	console.log(`\n📍 ${template.title}`);
	console.log(`   Slug: ${template.slug}`);
	console.log(`   Jurisdictions: ${template.jurisdictions.length}`);

	// Build context for embeddings
	const locationContext = buildLocationContext(template);
	const topicContext = buildTopicContext(template);

	const locationTokens = estimateTokens(locationContext);
	const topicTokens = estimateTokens(topicContext);

	console.log(`   Location context: ${locationTokens} tokens (est.)`);
	console.log(`   Topic context: ${topicTokens} tokens (est.)`);

	if (dryRun) {
		console.log('   [DRY RUN] Would generate embeddings');
		return { locationTokens, topicTokens, skipped: false };
	}

	try {
		// Generate location embedding
		console.log('   Generating location embedding...');
		const locationEmbedding = await generateEmbedding(locationContext);

		// Generate topic embedding
		console.log('   Generating topic embedding...');
		const topicEmbedding = await generateEmbedding(topicContext);

		// Update template with embeddings
		await prisma.template.update({
			where: { id: template.id },
			data: {
				location_embedding: locationEmbedding,
				topic_embedding: topicEmbedding,
				embedding_version: 'v2-gemini-768',
				embeddings_updated_at: new Date()
			}
		});

		console.log('   ✅ Embeddings generated and stored');
		return { locationTokens, topicTokens, skipped: false };
	} catch (error) {
		console.error('   ❌ Error generating embeddings:', error);
		return {
			locationTokens,
			topicTokens,
			skipped: false,
			error: error instanceof Error ? error.message : String(error)
		};
	}
}

/**
 * Main script entry point
 */
async function main() {
	const args = process.argv.slice(2);
	const dryRun = args.includes('--dry-run');
	const force = args.includes('--force');
	const templateIdIndex = args.indexOf('--template-id');
	const singleTemplateId = templateIdIndex !== -1 ? args[templateIdIndex + 1] : null;

	console.log('\n════════════════════════════════════════════════════════════════');
	console.log('  Generate Google Gemini Embeddings for Templates');
	console.log('  Model: gemini-embedding-001 (768 dimensions)');
	console.log('════════════════════════════════════════════════════════════════\n');

	if (dryRun) {
		console.log('🔍 DRY RUN MODE - No embeddings will be generated\n');
	}

	if (force) {
		console.log('🔄 FORCE MODE - Regenerating existing embeddings\n');
	}

	// Check for Gemini API key
	if (!process.env.GEMINI_API_KEY) {
		console.error('❌ Error: GEMINI_API_KEY environment variable not set');
		console.error('\nPlease add to .env file:');
		console.error('  GEMINI_API_KEY=AIza...');
		console.error('\nGet key from: https://aistudio.google.com/apikey');
		console.error('FREE tier available!\n');
		process.exit(1);
	}

	const stats: EmbeddingStats = {
		templatesProcessed: 0,
		locationEmbeddingsGenerated: 0,
		topicEmbeddingsGenerated: 0,
		skipped: 0,
		errors: 0,
		totalCost: 0,
		totalTokens: 0
	};

	try {
		// Fetch templates to process
		const templates = singleTemplateId
			? await prisma.template.findMany({
					where: { id: singleTemplateId },
					select: { id: true, title: true }
				})
			: await prisma.template.findMany({
					select: { id: true, title: true }
				});

		if (templates.length === 0) {
			console.log('No templates found to process\n');
			return;
		}

		console.log(`Found ${templates.length} template(s) to process\n`);

		// Process each template
		for (const template of templates) {
			stats.templatesProcessed++;

			const result = await generateTemplateEmbeddings(template.id, force, dryRun);

			if (result.skipped) {
				stats.skipped++;
			} else if (result.error) {
				stats.errors++;
			} else {
				stats.locationEmbeddingsGenerated++;
				stats.topicEmbeddingsGenerated++;
				stats.totalTokens += result.locationTokens + result.topicTokens;
			}
		}

		stats.totalCost = estimateCost(stats.totalTokens);

		// Print summary
		console.log('\n════════════════════════════════════════════════════════════════');
		console.log('  Summary');
		console.log('════════════════════════════════════════════════════════════════\n');
		console.log(`Templates processed:          ${stats.templatesProcessed}`);
		console.log(`Location embeddings generated: ${stats.locationEmbeddingsGenerated}`);
		console.log(`Topic embeddings generated:    ${stats.topicEmbeddingsGenerated}`);
		console.log(`Templates skipped:            ${stats.skipped}`);
		console.log(`Errors:                       ${stats.errors}`);
		console.log(`Total tokens (estimated):     ${stats.totalTokens.toLocaleString()}`);
		console.log(`Total cost (estimated):       $${stats.totalCost.toFixed(4)}`);
		console.log('');

		if (dryRun) {
			console.log('💡 Run without --dry-run to generate embeddings\n');
		} else if (stats.errors === 0) {
			console.log('✅ Embedding generation complete!\n');
		} else {
			console.log(`⚠️  Embedding generation completed with ${stats.errors} error(s)\n`);
		}
	} catch (error) {
		console.error('\n❌ Script failed:', error);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

main();
