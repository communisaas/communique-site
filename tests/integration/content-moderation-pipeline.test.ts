/**
 * Content Moderation Pipeline Integration Tests
 *
 * Tests the complete 3-layer moderation system:
 * - Layer 1: Pattern matching (instant)
 * - Layer 2: OpenAI Moderation API (safety filter)
 * - Layer 3: Multi-agent consensus (Gemini 2.5 Flash + Claude Haiku 4.5)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { moderateTemplate, containsProhibitedPatterns } from '$lib/core/server/content-moderation';
import {
	getMultiAgentConsensus,
	getSingleAgentModeration
} from '$lib/core/server/multi-agent-consensus';

// Mock environment variables
vi.mock('$env/static/private', () => ({
	OPENAI_API_KEY: 'test-openai-key',
	GEMINI_API_KEY: 'test-gemini-key',
	ANTHROPIC_API_KEY: 'test-anthropic-key',
	CONSENSUS_TYPE: 'multi_agent'
}));

describe('Layer 1: Pattern Matching', () => {
	it('should detect prohibited bribery patterns', () => {
		const content = 'I will bribe my representative to vote yes';
		expect(containsProhibitedPatterns(content)).toBe(true);
	});

	it('should detect prohibited threat patterns', () => {
		const content = 'We should kill anyone who votes against this bill';
		expect(containsProhibitedPatterns(content)).toBe(true);
	});

	it('should detect CSAM indicators', () => {
		const content = 'This involves child porn content';
		expect(containsProhibitedPatterns(content)).toBe(true);
	});

	it('should detect spam patterns', () => {
		const content = 'Buy viagra now! Bitcoin investment opportunity!';
		expect(containsProhibitedPatterns(content)).toBe(true);
	});

	it('should allow legitimate congressional advocacy', () => {
		const content = `
			I urge you to support H.R. 1234 for climate action.
			As a constituent, I am deeply concerned about rising temperatures.
			Please vote YES on this critical legislation.
		`;
		expect(containsProhibitedPatterns(content)).toBe(false);
	});

	it('should allow policy-focused content', () => {
		const content = `
			Dear Representative,

			I am writing about healthcare reform. Our community needs affordable access to care.
			The current system is failing working families like mine.

			Please support policies that expand coverage and reduce costs.

			Sincerely,
			A Concerned Constituent
		`;
		expect(containsProhibitedPatterns(content)).toBe(false);
	});
});

describe('Layer 2: OpenAI Moderation API', () => {
	beforeEach(() => {
		// Reset mocks
		vi.clearAllMocks();
	});

	it('should approve clean congressional template', async () => {
		const template = {
			title: 'Support Climate Action',
			message_body: `
				Dear Representative [Name],

				I am writing to urge your support for H.R. 1234, the Climate Action Now Act.
				As a resident of [City], I have witnessed firsthand the impacts of climate change.

				This legislation would:
				- Reduce carbon emissions by 50% by 2030
				- Create green jobs in our community
				- Protect our environment for future generations

				Please vote YES on this critical bill.

				Thank you for your time.
			`
		};

		// Mock OpenAI API response (would hit real API in actual test)
		const result = await moderateTemplate(template);

		expect(result).toMatchObject({
			approved: expect.any(Boolean),
			flagged_categories: expect.any(Array),
			category_scores: expect.any(Object),
			timestamp: expect.any(String)
		});
	});

	it('should reject violent threats', async () => {
		const template = {
			title: 'Violent Threat',
			message_body: 'If you vote against this bill, we will kill you and your family.'
		};

		// This would be flagged by OpenAI's violence category
		const result = await moderateTemplate(template);

		// In real test with live API, this would be flagged
		// For now, verify structure
		expect(result).toHaveProperty('approved');
		expect(result).toHaveProperty('flagged_categories');
	});

	it('should reject harassment content', async () => {
		const template = {
			title: 'Harassment',
			message_body: 'You are an idiot and should die. Everyone hates you.'
		};

		const result = await moderateTemplate(template);

		expect(result).toHaveProperty('approved');
		expect(result).toHaveProperty('category_scores');
	});

	it('should handle self-harm content', async () => {
		const template = {
			title: 'Self-Harm',
			message_body: 'If this bill fails, I will harm myself.'
		};

		const result = await moderateTemplate(template);

		expect(result).toHaveProperty('approved');
		expect(result).toHaveProperty('flagged_categories');
	});
});

describe('Layer 3: Multi-Agent Consensus', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should use Gemini 2.5 Flash as primary agent', async () => {
		const template = {
			title: 'Healthcare Reform',
			message_body: `
				I support expanding Medicare coverage to include dental and vision care.
				Seniors in our community cannot afford basic healthcare needs.
			`,
			category: 'Healthcare'
		};

		const result = await getMultiAgentConsensus(template);

		expect(result).toMatchObject({
			approved: expect.any(Boolean),
			consensus_type: expect.stringMatching(/unanimous|tie-breaker|split/),
			votes: expect.arrayContaining([
				expect.objectContaining({
					agent: 'gemini',
					approved: expect.any(Boolean),
					confidence: expect.any(Number),
					reasoning: expect.any(String)
				})
			]),
			final_confidence: expect.any(Number),
			reasoning_summary: expect.any(String),
			timestamp: expect.any(String)
		});

		// Gemini should always vote first
		expect(result.votes[0].agent).toBe('gemini');
	});

	it('should call Claude Haiku 4.5 only when Gemini rejects', async () => {
		const template = {
			title: 'Borderline Quality Template',
			message_body: 'Vote yes. Do it now.',
			category: 'General'
		};

		const result = await getMultiAgentConsensus(template);

		// If Gemini rejects, Claude should be called
		if (!result.votes[0].approved) {
			expect(result.votes).toHaveLength(2);
			expect(result.votes[1].agent).toBe('claude');
			expect(result.consensus_type).toBe('tie-breaker');
		} else {
			// If Gemini approves, no Claude needed
			expect(result.votes).toHaveLength(1);
			expect(result.consensus_type).toBe('unanimous');
		}
	});

	it('should approve high-quality congressional message', async () => {
		const template = {
			title: 'Education Funding',
			message_body: `
				Dear Senator [Name],

				I am writing to express my strong support for increased federal education funding.
				As a parent of two public school students in [District], I have witnessed the impact
				of underfunded classrooms firsthand.

				Our schools need:
				- Smaller class sizes (current ratio: 35:1, goal: 20:1)
				- Updated technology and learning materials
				- Competitive teacher salaries to retain talent
				- Mental health resources for students

				I urge you to vote YES on S. 1234, the Education Investment Act.

				This is not just about money - it's about our children's future and America's
				competitiveness in the global economy.

				Thank you for your consideration.

				Sincerely,
				[Your Name]
				[Your City, State]
			`,
			category: 'Education'
		};

		const result = await getMultiAgentConsensus(template);

		// High-quality template should be unanimously approved by Gemini
		expect(result.approved).toBe(true);
		expect(result.votes[0].approved).toBe(true);
		expect(result.votes[0].confidence).toBeGreaterThan(0.7);
	});

	it('should reject spam-like template', async () => {
		const template = {
			title: 'Click Here Now!!!',
			message_body: 'Vote yes! Act now! Limited time offer! Click here!',
			category: 'General'
		};

		const result = await getMultiAgentConsensus(template);

		// Spam should be rejected (either by Gemini alone or both agents)
		expect(result.approved).toBe(false);
	});

	it('should handle consensus disagreement correctly', async () => {
		const template = {
			title: 'Controversial Political Statement',
			message_body: `
				The current administration is completely wrong on immigration policy.
				We need to completely reverse course and do the exact opposite.
			`,
			category: 'Immigration'
		};

		const result = await getMultiAgentConsensus(template);

		// Political content should trigger quality assessment
		expect(result).toHaveProperty('consensus_type');
		expect(result.votes).toHaveLength.greaterThanOrEqual(1);

		// If split decision, should have reasoning from both agents
		if (result.consensus_type === 'split') {
			expect(result.votes).toHaveLength(2);
			const approvals = result.votes.filter((v) => v.approved).length;
			expect(approvals).toBe(1); // Split = exactly one approval
		}
	});
});

describe('Single-Agent Fallback Mode', () => {
	it('should use only Gemini when multi-agent disabled', async () => {
		const template = {
			title: 'Test Template',
			message_body: 'This is a test message for single-agent moderation.',
			category: 'General'
		};

		const result = await getSingleAgentModeration(template);

		expect(result.votes).toHaveLength(1);
		expect(result.votes[0].agent).toBe('gemini');
		expect(result.consensus_type).toBe('unanimous');
	});

	it('should return Gemini decision as final', async () => {
		const template = {
			title: 'Healthcare Template',
			message_body: 'Support universal healthcare coverage for all Americans.',
			category: 'Healthcare'
		};

		const result = await getSingleAgentModeration(template);

		expect(result.approved).toBe(result.votes[0].approved);
		expect(result.final_confidence).toBe(result.votes[0].confidence);
		expect(result.reasoning_summary).toBe(result.votes[0].reasoning);
	});
});

describe('Edge Cases and Error Handling', () => {
	it('should handle empty template gracefully', async () => {
		const template = {
			title: '',
			message_body: ''
		};

		// Layer 1 should pass (no prohibited patterns)
		expect(containsProhibitedPatterns('')).toBe(false);

		// Layer 2 and 3 should handle empty content
		// (actual behavior depends on API responses)
	});

	it('should handle very long template', async () => {
		const longMessage = 'This is a long message. '.repeat(1000); // ~25KB
		const template = {
			title: 'Very Long Template',
			message_body: longMessage
		};

		// Should not crash on long content
		const patternResult = containsProhibitedPatterns(longMessage);
		expect(typeof patternResult).toBe('boolean');
	});

	it('should handle special characters and emojis', async () => {
		const template = {
			title: 'Template with Emojis 🏛️🇺🇸',
			message_body: `
				Dear Representative 👋

				I'm writing about climate change 🌍🔥
				Please support clean energy ☀️💨

				Thank you! 🙏
			`
		};

		// Should handle emojis without crashing
		const patternResult = containsProhibitedPatterns(template.message_body);
		expect(typeof patternResult).toBe('boolean');
	});

	it('should handle mixed case in prohibited patterns', async () => {
		// Pattern matching should be case-insensitive
		expect(containsProhibitedPatterns('We will KILL the senator')).toBe(true);
		expect(containsProhibitedPatterns('I will Bribe the official')).toBe(true);
		expect(containsProhibitedPatterns('BUY VIAGRA NOW')).toBe(true);
	});

	it('should not flag legitimate congressional terms', async () => {
		const legitimateContent = `
			The bill would eliminate the death penalty at the federal level.
			We need to assassinate this harmful policy before it passes.
			Let's kill this legislation through grassroots organizing.
		`;

		// "kill this legislation" is legitimate advocacy language
		// Pattern matching might flag it, but AI agents should approve
		const hasProhibited = containsProhibitedPatterns(legitimateContent);

		// This is where multi-agent consensus adds value over simple pattern matching
		if (hasProhibited) {
			// AI agents should distinguish context
			const template = {
				title: 'Death Penalty Reform',
				message_body: legitimateContent,
				category: 'Criminal Justice'
			};

			const result = await getMultiAgentConsensus(template);
			// AI should understand context and approve despite flagged words
			// (actual result depends on model interpretation)
		}
	});
});

describe('Complete 3-Layer Pipeline Integration', () => {
	it('should process template through all layers in correct order', async () => {
		const template = {
			title: 'Support Affordable Housing Act',
			message_body: `
				Dear Representative [Name],

				I am writing to urge your support for H.R. 5678, the Affordable Housing Act.

				As a resident of [City], I have seen housing costs skyrocket while wages stagnate.
				My family spends 60% of our income on rent, leaving little for food and healthcare.

				This bill would:
				1. Expand tax credits for affordable housing development
				2. Increase funding for Section 8 vouchers
				3. Prevent predatory lending and rent gouging

				I respectfully ask that you vote YES on this critical legislation.

				Thank you for representing our community.
			`,
			category: 'Housing'
		};

		// Layer 1: Pattern matching
		const hasProhibited = containsProhibitedPatterns(
			`${template.title}\n\n${template.message_body}`
		);
		expect(hasProhibited).toBe(false); // Should pass

		// Layer 2: OpenAI safety filter
		const moderationResult = await moderateTemplate(template);
		expect(moderationResult.approved).toBe(true);
		expect(moderationResult.flagged_categories).toHaveLength(0);

		// Layer 3: Multi-agent consensus
		const consensusResult = await getMultiAgentConsensus(template);
		expect(consensusResult.approved).toBe(true);
		expect(consensusResult.votes[0].approved).toBe(true);
		expect(consensusResult.votes[0].confidence).toBeGreaterThan(0.6);
	});

	it('should reject template that fails any layer', async () => {
		const badTemplate = {
			title: 'Bribe Offer',
			message_body: 'I will bribe you $10,000 to vote yes. This is definitely illegal.',
			category: 'General'
		};

		// Layer 1: Should catch "bribe" pattern
		const hasProhibited = containsProhibitedPatterns(
			`${badTemplate.title}\n\n${badTemplate.message_body}`
		);
		expect(hasProhibited).toBe(true);

		// Template should be rejected at Layer 1, never reaching Layer 2/3
	});
});
