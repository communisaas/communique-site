/**
 * Intelligence Service Layer (Prisma — replaces mongodb/service.ts)
 */

import { db } from '$lib/core/db';
import {
	queryIntelligence,
	insertIntelligenceItem,
	insertIntelligenceWithEmbedding,
	bulkInsertIntelligence
} from './queries';
import type { IntelligenceItem, IntelligenceCategory } from './types';

function createTTL(days: number): Date {
	const date = new Date();
	date.setDate(date.getDate() + days);
	return date;
}

export class IntelligenceService {
	static async storeIntelligence(data: {
		category: IntelligenceCategory;
		title: string;
		source: string;
		sourceUrl: string;
		publishedAt: Date;
		snippet: string;
		topics?: string[];
		entities?: string[];
		embedding?: number[];
		relevanceScore?: number;
		sentiment?: string;
		geographicScope?: string;
		retentionDays?: number;
	}): Promise<string> {
		const item = {
			category: data.category,
			title: data.title,
			source: data.source,
			source_url: data.sourceUrl,
			published_at: data.publishedAt,
			snippet: data.snippet,
			topics: data.topics || [],
			entities: data.entities || [],
			embedding: data.embedding,
			relevance_score: data.relevanceScore ?? null,
			sentiment: data.sentiment ?? null,
			geographic_scope: data.geographicScope ?? null,
			expires_at: createTTL(data.retentionDays || 90)
		};

		if (data.embedding) {
			return insertIntelligenceWithEmbedding(
				item as typeof item & { embedding: number[] }
			);
		}
		return insertIntelligenceItem(item);
	}

	static async bulkStoreIntelligence(
		items: Parameters<typeof IntelligenceService.storeIntelligence>[0][]
	): Promise<string[]> {
		const documents = items.map((item) => ({
			category: item.category,
			title: item.title,
			source: item.source,
			source_url: item.sourceUrl,
			published_at: item.publishedAt,
			snippet: item.snippet,
			topics: item.topics || [],
			entities: item.entities || [],
			embedding: item.embedding,
			relevance_score: item.relevanceScore ?? null,
			sentiment: item.sentiment ?? null,
			geographic_scope: item.geographicScope ?? null,
			expires_at: createTTL(item.retentionDays || 90)
		}));

		return bulkInsertIntelligence(documents);
	}

	static async getRelevantIntelligence(params: {
		topics: string[];
		categories?: IntelligenceCategory[];
		minRelevanceScore?: number;
		limit?: number;
	}): Promise<IntelligenceItem[]> {
		const items: IntelligenceItem[] = [];
		const categories = params.categories || ['news', 'legislative', 'regulatory'];

		for (const category of categories) {
			const results = await queryIntelligence({
				category,
				topics: params.topics,
				minRelevanceScore: params.minRelevanceScore || 0.5,
				limit: Math.ceil((params.limit || 10) / categories.length)
			});
			items.push(...results);
		}

		return items
			.sort((a, b) => {
				const scoreA = a.relevance_score || 0;
				const scoreB = b.relevance_score || 0;
				if (scoreA !== scoreB) return scoreB - scoreA;
				return b.published_at.getTime() - a.published_at.getTime();
			})
			.slice(0, params.limit || 10);
	}

	static async getStatistics(): Promise<{ intelligence: number }> {
		const count = await db.intelligence.count();
		return { intelligence: count };
	}
}
