/**
 * Multi-Agent Consensus System (Phase 1)
 *
 * 3-layer content moderation with AI agent voting:
 * - OpenAI (GPT-4o mini)
 * - Gemini (2.5 Flash)
 * - Claude (3.5 Haiku) - tie-breaker only
 *
 * Phase 1: Off-chain consensus for template quality assessment
 * Phase 2: On-chain verification with challenge markets
 *
 * NOT fact-checking - focuses on:
 * - Policy relevance
 * - Message quality
 * - Congressional appropriateness
 * - Spam/abuse detection
 */

import OpenAI from 'openai';
import { OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY } from '$env/static/private';

export interface AgentVote {
	agent: 'openai' | 'gemini' | 'claude';
	approved: boolean;
	confidence: number; // 0-1
	reasoning: string;
	category_scores?: Record<string, number>;
	timestamp: string;
}

export interface ConsensusResult {
	approved: boolean;
	consensus_type: 'unanimous' | 'majority' | 'split' | 'tie-breaker';
	votes: AgentVote[];
	final_confidence: number;
	reasoning_summary: string;
	timestamp: string;
}

export interface TemplateModerationInput {
	title: string;
	message_body: string;
	category?: string;
}

/**
 * Get moderation decision from OpenAI
 */
async function getOpenAIVote(template: TemplateModerationInput): Promise<AgentVote> {
	const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

	const prompt = `You are a content moderator for congressional correspondence. Evaluate this template for:
1. Policy relevance and appropriateness for congressional offices
2. Message quality and professionalism
3. Absence of spam, abuse, or manipulation
4. NOT fact-checking claims - focus on form, not content

Template Title: ${template.title}
Category: ${template.category || 'General'}

Message:
${template.message_body}

Respond in JSON format:
{
  "approved": boolean,
  "confidence": number (0-1),
  "reasoning": "brief explanation"
}`;

	const response = await openai.chat.completions.create({
		model: 'gpt-4o-mini',
		messages: [{ role: 'user', content: prompt }],
		response_format: { type: 'json_object' },
		temperature: 0.3 // Lower temperature for more consistent moderation
	});

	const result = JSON.parse(response.choices[0].message.content || '{}');

	return {
		agent: 'openai',
		approved: result.approved ?? false,
		confidence: result.confidence ?? 0.5,
		reasoning: result.reasoning || 'No reasoning provided',
		timestamp: new Date().toISOString()
	};
}

/**
 * Get moderation decision from Gemini
 */
async function getGeminiVote(template: TemplateModerationInput): Promise<AgentVote> {
	if (!GEMINI_API_KEY) {
		// Fallback if Gemini not configured
		return {
			agent: 'gemini',
			approved: true,
			confidence: 0.5,
			reasoning: 'Gemini API key not configured - abstaining',
			timestamp: new Date().toISOString()
		};
	}

	const prompt = `You are a content moderator for congressional correspondence. Evaluate this template for:
1. Policy relevance and appropriateness for congressional offices
2. Message quality and professionalism
3. Absence of spam, abuse, or manipulation
4. NOT fact-checking claims - focus on form, not content

Template Title: ${template.title}
Category: ${template.category || 'General'}

Message:
${template.message_body}

Respond in JSON format:
{
  "approved": boolean,
  "confidence": number (0-1),
  "reasoning": "brief explanation"
}`;

	const response = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				contents: [{ parts: [{ text: prompt }] }],
				generationConfig: {
					temperature: 0.3,
					responseMimeType: 'application/json'
				}
			})
		}
	);

	const data = await response.json();
	const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
	const result = JSON.parse(content);

	return {
		agent: 'gemini',
		approved: result.approved ?? false,
		confidence: result.confidence ?? 0.5,
		reasoning: result.reasoning || 'No reasoning provided',
		timestamp: new Date().toISOString()
	};
}

/**
 * Get moderation decision from Claude (tie-breaker only)
 */
async function getClaudeVote(template: TemplateModerationInput): Promise<AgentVote> {
	if (!ANTHROPIC_API_KEY) {
		// Fallback if Claude not configured
		return {
			agent: 'claude',
			approved: true,
			confidence: 0.5,
			reasoning: 'Claude API key not configured - abstaining',
			timestamp: new Date().toISOString()
		};
	}

	const prompt = `You are a content moderator for congressional correspondence. Evaluate this template for:
1. Policy relevance and appropriateness for congressional offices
2. Message quality and professionalism
3. Absence of spam, abuse, or manipulation
4. NOT fact-checking claims - focus on form, not content

Template Title: ${template.title}
Category: ${template.category || 'General'}

Message:
${template.message_body}

Respond in JSON format:
{
  "approved": boolean,
  "confidence": number (0-1),
  "reasoning": "brief explanation"
}`;

	const response = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': ANTHROPIC_API_KEY,
			'anthropic-version': '2023-06-01'
		},
		body: JSON.stringify({
			model: 'claude-3-5-haiku-20241022',
			max_tokens: 1024,
			temperature: 0.3,
			messages: [{ role: 'user', content: prompt }]
		})
	});

	const data = await response.json();
	const content = data.content?.[0]?.text || '{}';
	const result = JSON.parse(content);

	return {
		agent: 'claude',
		approved: result.approved ?? false,
		confidence: result.confidence ?? 0.5,
		reasoning: result.reasoning || 'No reasoning provided',
		timestamp: new Date().toISOString()
	};
}

/**
 * Get consensus from multiple AI agents
 *
 * Voting strategy:
 * - 2/2 approve (OpenAI + Gemini): Unanimous approval
 * - 1/2 approve: Use Claude as tie-breaker
 * - 0/2 approve: Unanimous rejection
 *
 * @param template - Template to moderate
 * @param consensusThreshold - Minimum approval rate (default: 0.67 = 67%)
 * @returns ConsensusResult with final decision
 */
export async function getMultiAgentConsensus(
	template: TemplateModerationInput,
	consensusThreshold: number = 0.67
): Promise<ConsensusResult> {
	const votes: AgentVote[] = [];

	// Run OpenAI and Gemini in parallel (primary agents)
	const [openaiVote, geminiVote] = await Promise.all([
		getOpenAIVote(template).catch((error) => {
			console.error('OpenAI vote error:', error);
			return {
				agent: 'openai' as const,
				approved: false,
				confidence: 0,
				reasoning: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
				timestamp: new Date().toISOString()
			};
		}),
		getGeminiVote(template).catch((error) => {
			console.error('Gemini vote error:', error);
			return {
				agent: 'gemini' as const,
				approved: false,
				confidence: 0,
				reasoning: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
				timestamp: new Date().toISOString()
			};
		})
	]);

	votes.push(openaiVote, geminiVote);

	// Calculate initial approval rate
	const approvalCount = votes.filter((v) => v.approved).length;
	const totalVotes = votes.length;
	let consensusType: ConsensusResult['consensus_type'];

	// Determine if we need Claude as tie-breaker
	if (approvalCount === totalVotes) {
		// Unanimous approval (2/2)
		consensusType = 'unanimous';
	} else if (approvalCount === 0) {
		// Unanimous rejection (0/2)
		consensusType = 'unanimous';
	} else {
		// Split decision (1/2) - call Claude
		console.log('Split decision detected, calling Claude tie-breaker...');
		const claudeVote = await getClaudeVote(template).catch((error) => {
			console.error('Claude vote error:', error);
			return {
				agent: 'claude' as const,
				approved: false,
				confidence: 0,
				reasoning: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
				timestamp: new Date().toISOString()
			};
		});
		votes.push(claudeVote);
		consensusType = 'tie-breaker';
	}

	// Final decision based on all votes
	const finalApprovalCount = votes.filter((v) => v.approved).length;
	const finalTotalVotes = votes.length;
	const approvalRate = finalApprovalCount / finalTotalVotes;
	const approved = approvalRate >= consensusThreshold;

	// Update consensus type if needed
	if (consensusType !== 'tie-breaker') {
		if (approvalRate === 1) consensusType = 'unanimous';
		else if (approvalRate >= consensusThreshold) consensusType = 'majority';
		else consensusType = 'split';
	}

	// Calculate weighted confidence
	const totalConfidence = votes.reduce((sum, v) => sum + (v.approved ? v.confidence : 0), 0);
	const finalConfidence = approvalCount > 0 ? totalConfidence / approvalCount : 0;

	// Generate reasoning summary
	const approvedReasons = votes.filter((v) => v.approved).map((v) => v.reasoning);
	const rejectedReasons = votes.filter((v) => !v.approved).map((v) => v.reasoning);

	const reasoningSummary = approved
		? `Approved (${approvalRate.toFixed(0)}% consensus): ${approvedReasons.join('; ')}`
		: `Rejected (${(1 - approvalRate).toFixed(0)}% rejection): ${rejectedReasons.join('; ')}`;

	return {
		approved,
		consensus_type: consensusType,
		votes,
		final_confidence: finalConfidence,
		reasoning_summary: reasoningSummary,
		timestamp: new Date().toISOString()
	};
}

/**
 * Simplified consensus for testing/fallback - uses only OpenAI
 */
export async function getSingleAgentModeration(
	template: TemplateModerationInput
): Promise<ConsensusResult> {
	const vote = await getOpenAIVote(template);

	return {
		approved: vote.approved,
		consensus_type: 'unanimous', // Single agent always unanimous
		votes: [vote],
		final_confidence: vote.confidence,
		reasoning_summary: vote.reasoning,
		timestamp: new Date().toISOString()
	};
}
