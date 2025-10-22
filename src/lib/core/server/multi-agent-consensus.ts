/**
 * Multi-Agent Consensus System (Phase 1)
 *
 * 3-layer content moderation with AI agent voting:
 * - Layer 1: OpenAI Moderation API (safety filter - already done in content-moderation.ts)
 * - Layer 2: Gemini 2.5 Flash - primary quality assessment (lowest cost, best reasoning)
 * - Layer 3: Claude Haiku 4.5 - tie-breaker only (fast, cost-effective)
 *
 * Current models (October 2025):
 * - Gemini 2.5 Flash (best cost/performance for quality assessment)
 * - Claude Haiku 4.5 (fast tie-breaking when needed)
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

import { GEMINI_API_KEY, ANTHROPIC_API_KEY } from '$env/static/private';

export interface AgentVote {
	agent: 'gemini' | 'claude';
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
 * Get moderation decision from Gemini 2.5 Flash (primary quality assessment)
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
		`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
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
 * Get moderation decision from Claude Haiku 4.5 (tie-breaker only)
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
			model: 'claude-haiku-4.5-20250514',
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
 * Voting strategy (Layer 2 + Layer 3):
 * - Gemini 2.5 Flash approves: Unanimous approval (no Claude needed)
 * - Gemini 2.5 Flash rejects: Call Claude Haiku 4.5 as tie-breaker
 *
 * Note: OpenAI already used in Layer 1 (safety filter in content-moderation.ts)
 *
 * @param template - Template to moderate
 * @param consensusThreshold - Not used in 2-layer system (kept for API compatibility)
 * @returns ConsensusResult with final decision
 */
export async function getMultiAgentConsensus(
	template: TemplateModerationInput,
	consensusThreshold: number = 0.67
): Promise<ConsensusResult> {
	const votes: AgentVote[] = [];

	// Primary agent: Gemini 2.5 Flash (Layer 2)
	const geminiVote = await getGeminiVote(template).catch((error) => {
		console.error('Gemini vote error:', error);
		return {
			agent: 'gemini' as const,
			approved: false,
			confidence: 0,
			reasoning: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
			timestamp: new Date().toISOString()
		};
	});

	votes.push(geminiVote);

	let consensusType: ConsensusResult['consensus_type'];

	// Determine if we need Claude as second opinion
	if (geminiVote.approved) {
		// Gemini approved - unanimous (no need for Claude)
		consensusType = 'unanimous';
	} else {
		// Gemini rejected - call Claude Haiku 4.5 for tie-breaker (Layer 3)
		console.log('Gemini rejected, calling Claude Haiku 4.5 tie-breaker...');
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

	// Final decision based on votes
	const finalApprovalCount = votes.filter((v) => v.approved).length;
	const finalTotalVotes = votes.length;
	const approved = finalApprovalCount > 0; // At least one agent approves

	// Update consensus type based on final vote count
	if (finalTotalVotes === 1) {
		// Only Gemini voted
		consensusType = geminiVote.approved ? 'unanimous' : 'unanimous';
	} else if (finalTotalVotes === 2) {
		// Both Gemini and Claude voted
		if (finalApprovalCount === 2) consensusType = 'unanimous';
		else if (finalApprovalCount === 1) consensusType = 'split';
		else consensusType = 'unanimous'; // Both rejected
	}

	// Calculate weighted confidence from approved votes only
	const approvedVotes = votes.filter((v) => v.approved);
	const totalConfidence = approvedVotes.reduce((sum, v) => sum + v.confidence, 0);
	const finalConfidence = approvedVotes.length > 0 ? totalConfidence / approvedVotes.length : 0;

	// Generate reasoning summary
	const approvedReasons = votes.filter((v) => v.approved).map((v) => v.reasoning);
	const rejectedReasons = votes.filter((v) => !v.approved).map((v) => v.reasoning);

	const reasoningSummary = approved
		? `Approved: ${approvedReasons.join('; ')}`
		: `Rejected: ${rejectedReasons.join('; ')}`;

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
 * Simplified consensus for testing/fallback - uses only Gemini 2.5 Flash
 */
export async function getSingleAgentModeration(
	template: TemplateModerationInput
): Promise<ConsensusResult> {
	const vote = await getGeminiVote(template);

	return {
		approved: vote.approved,
		consensus_type: 'unanimous', // Single agent always unanimous
		votes: [vote],
		final_confidence: vote.confidence,
		reasoning_summary: vote.reasoning,
		timestamp: new Date().toISOString()
	};
}
