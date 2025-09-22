/**
 * Template Intelligence Service
 * Provides AI-powered assistance for template creation
 */

export interface VariableSuggestion {
	variable: string;
	label: string;
	description: string;
	examples: string[];
	category: 'personal' | 'location' | 'data' | 'emotion' | 'action';
	relevanceScore: number;
}

export interface ContentEnhancement {
	original: string;
	enhanced: string;
	explanation: string;
	improvements: string[];
}

export interface PerformancePrediction {
	engagementScore: number; // 0-100
	viralPotential: number; // 0-100
	readabilityScore: number; // 0-100
	emotionalImpact: number; // 0-100
	callToActionStrength: number; // 0-100
	predictedReach: number;
	predictedShares: number;
	suggestions: string[];
}

// Smart variable suggestions based on context
export function getVariableSuggestions(
	content: string,
	_category: string,
	existingVariables: string[]
): VariableSuggestion[] {
	const suggestions: VariableSuggestion[] = [];
	const contentLower = content.toLowerCase();

	// Personal variables
	if (!existingVariables.includes('{name}')) {
		suggestions.push({
			variable: '{name}',
			label: 'Recipient Name',
			description: "Personalizes the message with the recipient's name",
			examples: ['Dear {name}', 'Hello {name}', '{name}, I need your help'],
			category: 'personal',
			relevanceScore: 95
		});
	}

	if (contentLower.includes('story') || contentLower.includes('experience')) {
		suggestions.push({
			variable: '{personal_story}',
			label: 'Personal Story',
			description: 'Share a relevant personal experience',
			examples: [
				'When {personal_story}, I realized how important this issue is',
				'My experience with {personal_story} showed me firsthand'
			],
			category: 'personal',
			relevanceScore: 85
		});
	}

	// Location variables
	if (contentLower.includes('community') || contentLower.includes('district')) {
		suggestions.push({
			variable: '{location}',
			label: 'Location/District',
			description: "References the recipient's area",
			examples: ['In {location}', 'Our {location} community', 'Here in {location}'],
			category: 'location',
			relevanceScore: 80
		});
	}

	// Data variables
	if (
		contentLower.includes('data') ||
		contentLower.includes('statistic') ||
		contentLower.includes('fact')
	) {
		suggestions.push({
			variable: '{data_point}',
			label: 'Data/Statistic',
			description: 'Include relevant data to support your argument',
			examples: [
				'Studies show that {data_point}',
				'According to research, {data_point}',
				'{data_point} of Americans support this'
			],
			category: 'data',
			relevanceScore: 75
		});
	}

	// Issue-specific variables
	if (!existingVariables.includes('{issue}')) {
		suggestions.push({
			variable: '{issue}',
			label: 'Specific Issue',
			description: 'The main topic or bill being discussed',
			examples: ['regarding {issue}', 'to support {issue}', 'about {issue}'],
			category: 'action',
			relevanceScore: 90
		});
	}

	// Time-sensitive variables
	if (
		contentLower.includes('urgent') ||
		contentLower.includes('deadline') ||
		contentLower.includes('vote')
	) {
		suggestions.push({
			variable: '{deadline}',
			label: 'Deadline/Date',
			description: 'Important date or deadline',
			examples: ['before {deadline}', 'by {deadline}', 'The vote on {deadline}'],
			category: 'action',
			relevanceScore: 70
		});
	}

	// Sort by relevance
	return suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// Enhance content with AI-like improvements
export function enhanceContent(
	content: string,
	tone: 'professional' | 'passionate' | 'conversational' | 'urgent'
): ContentEnhancement {
	const improvements: string[] = [];
	let enhanced = content;

	// Add personalization
	if (!content.includes('{name}')) {
		enhanced = enhanced.replace(/^(Dear|Hello|Hi)(\s+)/i, '$1 {name}$2');
		improvements.push('Added name personalization');
	}

	// Improve call to action
	const hasCallToAction = /please|urge|ask|request|support|vote/i.test(content);
	if (!hasCallToAction) {
		enhanced +=
			'\n\nI urge you to support {issue} and would appreciate hearing your position on this matter.';
		improvements.push('Added clear call to action');
	}

	// Add emotional appeal based on tone
	if (tone === 'passionate' && !content.includes('personal')) {
		enhanced = enhanced.replace(/this issue/gi, 'this deeply personal issue');
		improvements.push('Enhanced emotional appeal');
	}

	// Add urgency markers
	if (tone === 'urgent' && !content.includes('urgent')) {
		enhanced = 'URGENT: ' + enhanced;
		improvements.push('Added urgency indicator');
	}

	// Make it more conversational
	if (tone === 'conversational') {
		enhanced = enhanced
			.replace(/I am writing/gi, "I'm reaching out")
			.replace(/I would like/gi, "I'd love");
		improvements.push('Made language more conversational');
	}

	return {
		original: content,
		enhanced,
		explanation: `Enhanced your message with ${improvements.length} improvements to increase engagement`,
		improvements
	};
}

// Predict template performance
export function predictPerformance(
	content: string,
	variables: string[],
	category: string
): PerformancePrediction {
	const wordCount = content.split(/\s+/).filter((w) => w).length;
	const sentences = content.split(/[.!?]+/).filter((s) => s.trim()).length;

	// Calculate various scores
	const engagementScore = calculateEngagementScore(content, variables);
	const readabilityScore = calculateReadabilityScore(wordCount, sentences);
	const emotionalImpact = calculateEmotionalImpact(content);
	const callToActionStrength = calculateCallToActionStrength(content);
	const viralPotential = calculateViralPotential(engagementScore, emotionalImpact, category);

	// Generate suggestions
	const suggestions: string[] = [];

	if (wordCount < 150) {
		suggestions.push('Expand your message with more details or a personal story');
	}
	if (wordCount > 400) {
		suggestions.push('Consider shortening for better engagement');
	}
	if (variables.length < 2) {
		suggestions.push('Add more personalization variables');
	}
	if (emotionalImpact < 50) {
		suggestions.push('Include more emotional language or personal connection');
	}
	if (callToActionStrength < 50) {
		suggestions.push('Strengthen your call to action');
	}

	// Predict reach based on scores
	const baseReach = 100;
	const reachMultiplier = (engagementScore + viralPotential) / 100;
	const predictedReach = Math.floor(baseReach * reachMultiplier * (1 + Math.random() * 0.5));
	const predictedShares = Math.floor(predictedReach * 0.15 * (viralPotential / 100));

	return {
		engagementScore,
		viralPotential,
		readabilityScore,
		emotionalImpact,
		callToActionStrength,
		predictedReach,
		predictedShares,
		suggestions
	};
}

// Helper functions
function calculateEngagementScore(content: string, variables: string[]): number {
	let score = 50; // Base score

	// Personalization bonus
	score += variables.length * 5;

	// Question bonus (engages reader)
	const questions = (content.match(/\?/g) || []).length;
	score += Math.min(questions * 5, 15);

	// "You" usage (direct address)
	const youCount = (content.match(/\byou\b/gi) || []).length;
	score += Math.min(youCount * 2, 10);

	return Math.min(score, 100);
}

function calculateReadabilityScore(wordCount: number, sentences: number): number {
	// Simple readability based on average sentence length
	const avgWordsPerSentence = wordCount / Math.max(sentences, 1);

	if (avgWordsPerSentence >= 15 && avgWordsPerSentence <= 20) {
		return 90; // Optimal
	} else if (avgWordsPerSentence >= 10 && avgWordsPerSentence <= 25) {
		return 70; // Good
	} else {
		return 50; // Could be improved
	}
}

function calculateEmotionalImpact(content: string): number {
	const emotionalWords = [
		'urgent',
		'critical',
		'important',
		'crucial',
		'vital',
		'please',
		'help',
		'need',
		'must',
		'essential',
		'family',
		'children',
		'future',
		'community',
		'together',
		'hope',
		'believe',
		'dream',
		'fight',
		'stand'
	];

	let score = 40; // Base score
	const contentLower = content.toLowerCase();

	emotionalWords.forEach((word) => {
		if (contentLower.includes(word)) {
			score += 5;
		}
	});

	// Personal pronouns increase emotional connection
	const personalPronouns = (content.match(/\b(I|we|us|our|my)\b/gi) || []).length;
	score += Math.min(personalPronouns * 3, 15);

	return Math.min(score, 100);
}

function calculateCallToActionStrength(content: string): number {
	const actionWords = [
		'please',
		'urge',
		'ask',
		'request',
		'support',
		'vote',
		'contact',
		'call',
		'write',
		'email',
		'visit',
		'help',
		'join',
		'stand',
		'act',
		'demand',
		'insist'
	];

	let score = 30; // Base score
	const contentLower = content.toLowerCase();

	actionWords.forEach((word) => {
		if (contentLower.includes(word)) {
			score += 10;
		}
	});

	// Bonus for clear action at the end
	const lastSentence = content.split(/[.!?]/).pop()?.toLowerCase() || '';
	if (actionWords.some((word) => lastSentence.includes(word))) {
		score += 20;
	}

	return Math.min(score, 100);
}

function calculateViralPotential(
	engagementScore: number,
	emotionalImpact: number,
	category: string
): number {
	// Some categories naturally have higher viral potential
	const categoryMultipliers: Record<string, number> = {
		environment: 1.2,
		healthcare: 1.15,
		education: 1.1,
		justice: 1.25,
		technology: 0.9,
		economy: 0.95,
		community: 1.05,
		advocacy: 1.0
	};

	const multiplier = categoryMultipliers[category] || 1.0;
	const baseScore = (engagementScore + emotionalImpact) / 2;

	return Math.min(Math.floor(baseScore * multiplier), 100);
}

// Generate smart title suggestions
export function generateTitleSuggestions(
	content: string,
	_category: string,
	tone: string
): string[] {
	const keywords = extractKeywords(content);
	const suggestions: string[] = [];

	// Action-oriented titles
	if (tone === 'urgent') {
		suggestions.push(`URGENT: Support ${keywords[0]} Now`);
		suggestions.push(`Time-Sensitive: ${keywords[0]} Needs Your Action`);
	}

	// Emotional titles
	if (tone === 'passionate') {
		suggestions.push(`Our ${keywords[0]} Depends on Your Support`);
		suggestions.push(`Stand with Us for ${keywords[0]}`);
	}

	// Professional titles
	if (tone === 'professional') {
		suggestions.push(`Support for ${keywords[0]} Legislation`);
		suggestions.push(`Request for Action on ${keywords[0]}`);
	}

	// Conversational titles
	if (tone === 'conversational') {
		suggestions.push(`Let's Talk About ${keywords[0]}`);
		suggestions.push(`Your Thoughts on ${keywords[0]}?`);
	}

	return suggestions.slice(0, 3);
}

function extractKeywords(content: string): string[] {
	// Simple keyword extraction - in production, use NLP
	const words = content
		.toLowerCase()
		.split(/\W+/)
		.filter((word) => word.length > 4)
		.filter((word) => !commonWords.includes(word));

	// Count frequency
	const frequency: Record<string, number> = {};
	words.forEach((word) => {
		frequency[word] = (frequency[word] || 0) + 1;
	});

	// Sort by frequency and return top keywords
	return Object.entries(frequency)
		.sort(([, a], [, b]) => b - a)
		.map(([word]) => word)
		.slice(0, 5);
}

const commonWords = [
	'about',
	'after',
	'again',
	'against',
	'because',
	'before',
	'being',
	'between',
	'during',
	'every',
	'having',
	'other',
	'should',
	'since',
	'their',
	'there',
	'these',
	'those',
	'through',
	'under',
	'where',
	'which',
	'while',
	'would'
];
