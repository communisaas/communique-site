import { db } from '$lib/core/db';

/**
 * Basic Sentiment Classification - Safe Implementation
 *
 * Rule-based classifier that we can test without BERT infrastructure
 * This is the foundation that we'll later upgrade to full BERT
 */

export interface BasicSentiment {
	sentiment: 'pro' | 'anti' | 'neutral';
	confidence: number; // 0-1
	intensity: number; // 0-1
	keywords_found: string[];
}

/**
 * Simple rule-based sentiment classification
 * NO external dependencies, NO API calls, NO complex ML
 */
export function classifyBasicSentiment(text: string): BasicSentiment {
	const lowerText = text.toLowerCase();

	// Keywords organized by sentiment (improved for political messages)
	const proKeywords = [
		'support',
		'approve',
		'yes',
		'help',
		'relief',
		'benefit',
		'improve',
		'reform',
		'forward',
		'progress',
		'agree',
		'favor',
		'endorse',
		'back',
		'champion',
		'forgiveness',
		'cancel',
		'eliminate',
		'reduce',
		'lower',
		'fix',
		'solve'
	];

	const antiKeywords = [
		'oppose',
		'against',
		'no',
		'stop',
		'prevent',
		'reject',
		'wrong',
		'bad',
		'waste',
		'unfair',
		'disagree',
		'block',
		'deny',
		'refuse',
		'resist',
		'irresponsible',
		'unfair',
		'burden',
		'taxpayer',
		'bailout'
	];

	const intensityKeywords = [
		'very',
		'extremely',
		'really',
		'strongly',
		'completely',
		'absolutely',
		'definitely',
		'urgent',
		'crisis',
		'!'
	];

	// Count keyword matches
	const proMatches = proKeywords.filter((keyword) => lowerText.includes(keyword));
	const antiMatches = antiKeywords.filter((keyword) => lowerText.includes(keyword));
	const intensityMatches = intensityKeywords.filter((keyword) => lowerText.includes(keyword));

	// Determine sentiment
	let sentiment: 'pro' | 'anti' | 'neutral';
	let confidence: number;
	const keywords_found = [...proMatches, ...antiMatches];

	if (proMatches.length > antiMatches.length) {
		sentiment = 'pro';
		confidence = Math.min(0.9, 0.6 + proMatches.length * 0.1);
	} else if (antiMatches.length > proMatches.length) {
		sentiment = 'anti';
		confidence = Math.min(0.9, 0.6 + antiMatches.length * 0.1);
	} else {
		sentiment = 'neutral';
		confidence = keywords_found.length > 0 ? 0.6 : 0.3;
	}

	// Calculate intensity
	const baseIntensity = Math.min(1.0, keywords_found.length * 0.2);
	const intensityBoost = Math.min(0.4, intensityMatches.length * 0.15);
	const intensity = Math.min(1.0, baseIntensity + intensityBoost);

	return {
		sentiment,
		confidence,
		intensity,
		keywords_found
	};
}

/**
 * Test the classifier with sample messages
 * SAFE - just returns results, doesn't modify database
 */
export function testSentimentClassifier(): void {
	const testMessages = [
		'I strongly support student loan forgiveness!',
		'Oppose loan forgiveness - people should pay their debts',
		'Maybe we could lower interest rates',
		'This policy is completely wrong and unfair',
		'Please help families with student debt relief'
	];

	testMessages.forEach((message, index) => {
		const result = classifyBasicSentiment(message);
	});
}

/**
 * Get recent template messages for testing
 * SAFE - read-only operation
 */
export async function getRecentTemplateMessages(limit: number = 10): Promise<
	Array<{
		id: string;
		text: string;
		category: string;
		created_at: Date;
	}>
> {
	try {
		const campaigns = await db.template_campaign.findMany({
			where: {
				created_at: {
					gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
				}
			},
			include: {
				template: {
					select: {
						id: true,
						message_body: true,
						category: true,
						description: true
					}
				}
			},
			take: limit,
			orderBy: {
				created_at: 'desc'
			}
		});

		return campaigns
			.map((campaign) => ({
				id: campaign.id,
				text: campaign.template.message_body || campaign.template.description || '',
				category: campaign.template.category,
				created_at: campaign.created_at
			}))
			.filter((msg) => msg.text.length > 0);
	} catch (_error) {
		return [];
	}
}

/**
 * Test sentiment classification on REAL data
 * SAFE - read-only, just logs results
 */
export async function testOnRealData(): Promise<void> {
	const messages = await getRecentTemplateMessages(5);

	if (messages.length === 0) {
		return;
	}

	messages.forEach((message, index) => {
		const result = classifyBasicSentiment(message.text);
	});
}

// Export alias for backwards compatibility
export const analyzeSentimentBasic = classifyBasicSentiment;

/**
 * SAFE startup function - just runs tests, doesn't modify anything
 */
export async function runBasicSentimentTests(): Promise<void> {
	// Test 1: Hardcoded examples
	testSentimentClassifier();

	// Test 2: Real data (read-only)
	await testOnRealData();
}
