import { db } from '$lib/core/db';

/**
 * CIVIC ANALYTICS - PURE METHANE ENGINE
 *
 * Simple, effective civic intelligence analysis.
 * Real-time analysis of how information flows through communities.
 */

export interface CivicSentiment {
	category: string;
	pro_count: number;
	anti_count: number;
	neutral_count: number;
	sentiment_ratio: number; // -1 to +1
	total_messages: number;
}

export interface GeographicSentiment {
	state: string;
	district: string;
	sentiment_ratio: number;
	message_count: number;
	dominant_issues: string[];
}

export interface CommunityFlow {
	community: string;
	size: number;
	growth_rate: number; // messages this week vs last week
	top_issues: string[];
	sentiment_trend: 'rising' | 'falling' | 'stable';
}

/**
 * Count pro/anti keywords - simple and effective
 */
function analyzeSentiment(text: string): 'pro' | 'anti' | 'neutral' {
	const lowerText = text.toLowerCase();

	const proWords = [
		'support',
		'approve',
		'yes',
		'help',
		'relief',
		'benefit',
		'improve',
		'reform',
		'agree',
		'favor',
		'back'
	];
	const antiWords = [
		'oppose',
		'against',
		'no',
		'stop',
		'reject',
		'wrong',
		'bad',
		'waste',
		'unfair',
		'block'
	];

	const proCount = proWords.filter((word) => lowerText.includes(word)).length;
	const antiCount = antiWords.filter((word) => lowerText.includes(word)).length;

	if (proCount > antiCount) return 'pro';
	if (antiCount > proCount) return 'anti';
	return 'neutral';
}

/**
 * Get civic sentiment by issue category - pure SQL counting
 */
export async function getCivicSentimentByIssue(): Promise<CivicSentiment[]> {
	const templates = await db.template.findMany({
		where: {
			createdAt: {
				gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
			}
		},
		select: {
			category: true,
			description: true
		}
	});

	// Group by category and count sentiment
	const categoryStats: Record<string, { pro: number; anti: number; neutral: number }> = {};

	templates.forEach((template) => {
		const text = template.description || '';
		const sentiment = analyzeSentiment(text);
		const category = template.category;

		if (!categoryStats[category]) {
			categoryStats[category] = { pro: 0, anti: 0, neutral: 0 };
		}

		categoryStats[category][sentiment]++;
	});

	// Convert to civic sentiment format
	return Object.entries(categoryStats).map(([category, stats]) => {
		const total = stats.pro + stats.anti + stats.neutral;
		const sentiment_ratio = total > 0 ? (stats.pro - stats.anti) / total : 0;

		return {
			category,
			pro_count: stats.pro,
			anti_count: stats.anti,
			neutral_count: stats.neutral,
			sentiment_ratio,
			total_messages: total
		};
	});
}

/**
 * Geographic sentiment analysis - just group by location
 */
export async function getGeographicSentiment(): Promise<GeographicSentiment[]> {
	const results = (await db.$queryRaw`
    SELECT
      '' as state,
      '' as district,
      COUNT(*) as message_count,
      AVG(CASE
        WHEN t.body LIKE '%support%' OR t.body LIKE '%approve%' OR t.body LIKE '%yes%' THEN 1
        WHEN t.body LIKE '%oppose%' OR t.body LIKE '%against%' OR t.body LIKE '%no%' THEN -1
        ELSE 0
      END) as sentiment_ratio,
      GROUP_CONCAT(DISTINCT t.category) as issues
    FROM template t
    JOIN user u ON t.user_id = u.id
    WHERE t.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY u.id
    HAVING message_count >= 3
    ORDER BY message_count DESC
  `) as Array<Record<string, unknown>>;

	return results.map((row) => ({
		state: String(row.state || ''),
		district: String(row.district || ''),
		sentiment_ratio: Number(row.sentiment_ratio) || 0,
		message_count: Number(row.message_count) || 0,
		dominant_issues: row.issues ? String(row.issues).split(',') : []
	}));
}

/**
 * Community growth analysis - simple time-based counting
 */
export async function getCommunityFlow(): Promise<CommunityFlow[]> {
	const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
	const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

	// Get template counts by category for this week vs last week
	const [thisWeek, lastWeek] = await Promise.all([
		db.template.groupBy({
			by: ['category'],
			where: { createdAt: { gte: oneWeekAgo } },
			_count: { id: true }
		}),
		db.template.groupBy({
			by: ['category'],
			where: {
				createdAt: {
					gte: twoWeeksAgo,
					lt: oneWeekAgo
				}
			},
			_count: { id: true }
		})
	]);

	// Calculate growth rates
	const thisWeekMap = new Map(thisWeek.map((item) => [item.category, item._count.id]));
	const lastWeekMap = new Map(lastWeek.map((item) => [item.category, item._count.id]));

	const communities: CommunityFlow[] = [];

	// Process all categories
	const allCategories = new Set([...thisWeekMap.keys(), ...lastWeekMap.keys()]);

	for (const category of allCategories) {
		const thisWeekCount = thisWeekMap.get(category) || 0;
		const lastWeekCount = lastWeekMap.get(category) || 0;

		let growth_rate = 0;
		if (lastWeekCount > 0) {
			growth_rate = (thisWeekCount - lastWeekCount) / lastWeekCount;
		} else if (thisWeekCount > 0) {
			growth_rate = 1; // 100% growth from 0
		}

		let sentiment_trend: 'rising' | 'falling' | 'stable' = 'stable';
		if (growth_rate > 0.2) sentiment_trend = 'rising';
		if (growth_rate < -0.2) sentiment_trend = 'falling';

		communities.push({
			community: category,
			size: thisWeekCount,
			growth_rate,
			top_issues: [category], // Simple: category IS the issue
			sentiment_trend
		});
	}

	return communities.sort((a, b) => b.size - a.size);
}

/**
 * Information flow detection - where messages spread vs get blocked
 */
export async function detectInformationFlow(): Promise<{
	flowing: string[];
	blocked: string[];
	bridges: string[];
}> {
	// Get campaigns that succeeded (delivered) vs failed
	const campaigns = await db.template_campaign.findMany({
		where: {
			created_at: {
				gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
			}
		},
		include: {
			template: {
				select: {
					category: true,
					user: {
						select: {
							id: true
						}
					}
				}
			}
		}
	});

	// Analyze success rates by category and location
	const categorySuccess: Record<string, { total: number; delivered: number }> = {};
	const locationSuccess: Record<string, { total: number; delivered: number }> = {};

	campaigns.forEach((campaign) => {
		const category = campaign.template.category;
		const location = `${campaign.template.user?.id}`;
		const delivered = campaign.status === 'delivered';

		// Track category success
		if (!categorySuccess[category]) {
			categorySuccess[category] = { total: 0, delivered: 0 };
		}
		categorySuccess[category].total++;
		if (delivered) categorySuccess[category].delivered++;

		// Track location success
		if (!locationSuccess[location]) {
			locationSuccess[location] = { total: 0, delivered: 0 };
		}
		locationSuccess[location].total++;
		if (delivered) locationSuccess[location].delivered++;
	});

	// Classify as flowing, blocked, or bridge
	const flowing: string[] = [];
	const blocked: string[] = [];

	Object.entries(categorySuccess).forEach(([category, stats]) => {
		if (stats.total >= 5) {
			// Only analyze categories with enough data
			const successRate = stats.delivered / stats.total;
			if (successRate > 0.7) flowing.push(category);
			if (successRate < 0.3) blocked.push(category);
		}
	});

	// Bridge locations = places where blocked categories sometimes succeed
	const bridges: string[] = [];
	Object.entries(locationSuccess).forEach(([location, stats]) => {
		if (stats.total >= 3 && stats.delivered / stats.total > 0.5) {
			bridges.push(location);
		}
	});

	return { flowing, blocked, bridges };
}

/**
 * CIVIC DASHBOARD - Real civic intelligence
 */
export async function getCivicDashboard(): Promise<{
	sentiment_by_issue: CivicSentiment[];
	geographic_sentiment: GeographicSentiment[];
	community_flow: CommunityFlow[];
	information_flow: unknown;
	summary: {
		total_communities: number;
		growing_communities: number;
		declining_communities: number;
		most_active_state: string;
		dominant_sentiment: 'pro' | 'anti' | 'neutral';
	};
}> {
	const [sentimentByIssue, geographicSentiment, communityFlow, informationFlow] = await Promise.all(
		[
			getCivicSentimentByIssue(),
			getGeographicSentiment(),
			getCommunityFlow(),
			detectInformationFlow()
		]
	);

	// Generate summary statistics
	const growingCommunities = communityFlow.filter((c) => c.growth_rate > 0.1).length;
	const decliningCommunities = communityFlow.filter((c) => c.growth_rate < -0.1).length;

	const mostActiveState =
		geographicSentiment.length > 0
			? geographicSentiment.reduce((max, current) =>
					current.message_count > max.message_count ? current : max
				).state
			: 'none';

	const overallSentiment =
		sentimentByIssue.reduce((sum, issue) => sum + issue.sentiment_ratio, 0) /
		sentimentByIssue.length;
	const dominantSentiment =
		overallSentiment > 0.1 ? 'pro' : overallSentiment < -0.1 ? 'anti' : 'neutral';

	return {
		sentiment_by_issue: sentimentByIssue,
		geographic_sentiment: geographicSentiment,
		community_flow: communityFlow,
		information_flow: informationFlow,
		summary: {
			total_communities: communityFlow.length,
			growing_communities: growingCommunities,
			declining_communities: decliningCommunities,
			most_active_state: mostActiveState,
			dominant_sentiment: dominantSentiment
		}
	};
}
