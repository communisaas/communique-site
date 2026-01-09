/**
 * Subject Line Generator Agent
 *
 * Transforms raw issue descriptions into structured subject lines with
 * multi-turn refinement support via Gemini Interactions API.
 *
 * Design:
 * - Agent has full autonomy to formulate clarifying questions
 * - Answers are flexible key-value pairs, interpreted by the agent
 * - Conversation, not forms
 */

import { interact } from '../gemini-client';
import { SUBJECT_LINE_SCHEMA } from '../schemas';
import { SUBJECT_LINE_PROMPT } from '../prompts/subject-line';
import type {
	SubjectLineResponseWithClarification,
	ClarificationAnswers,
	ConversationContext
} from '../types';

export interface GenerateSubjectOptions {
	description: string;
	previousInteractionId?: string;
	refinementFeedback?: string;
	clarificationAnswers?: ClarificationAnswers;
	/** Full context for clarification turns (replaces broken multi-turn) */
	conversationContext?: ConversationContext;
}

export interface GenerateSubjectResult {
	data: SubjectLineResponseWithClarification;
	interactionId: string;
}

/**
 * Generate a subject line with structured metadata
 *
 * Supports multi-turn refinement and clarification:
 * 1. First call: Pass description, may get clarification questions or output
 * 2. Clarification: Pass same interactionId with clarificationAnswers
 * 3. Refinement: Pass same interactionId with refinementFeedback
 *
 * The agent maintains conversation state across turns.
 */
export async function generateSubjectLine(
	options: GenerateSubjectOptions
): Promise<GenerateSubjectResult> {
	let prompt: string;

	if (options.conversationContext) {
		// NEW: Full context reconstruction
		const ctx = options.conversationContext;

		const answerLines = Object.entries(ctx.answers)
			.filter(([, v]: [string, string]) => v?.trim())
			.map(([questionId, answer]: [string, string]) => {
				const question = ctx.questionsAsked.find((q) => q.id === questionId);
				return `- "${question?.question || questionId}": ${answer}`;
			})
			.join('\n');

		prompt = `## Original Issue
${ctx.originalDescription}

## Clarification Conversation

I asked:
${ctx.questionsAsked.map((q) => `- ${q.question}`).join('\n')}

User clarified:
${answerLines || '(User skipped - use your best judgment based on the original issue)'}

## My Previous Analysis
- Detected location: ${ctx.inferredContext.detected_location || 'unknown'}
- Detected scope: ${ctx.inferredContext.detected_scope || 'unknown'}
- Detected target: ${ctx.inferredContext.detected_target_type || 'unknown'}
- Reasoning: ${ctx.inferredContext.reasoning || 'none'}

Now generate the final subject_line, core_issue, topics, url_slug, and voice_sample using this complete context.
Do not ask for more clarification - generate the output now.`;
	} else if (options.clarificationAnswers && options.previousInteractionId) {
		// LEGACY: Keep for backwards compatibility (but this path is broken)
		// User provided clarification - format all answers for the agent
		const answers = options.clarificationAnswers;
		const answerParts = Object.entries(answers)
			.filter(([, value]) => value && value.trim())
			.map(([key, value]) => `${key}: ${value}`);

		if (answerParts.length > 0) {
			prompt = `The user has clarified:

${answerParts.join('\n')}

Now generate the subject line with this additional context.`;
		} else {
			// Empty answers = user skipped, use best guess
			prompt = `The user skipped clarification. Use your best guesses and generate the subject line.`;
		}
	} else if (options.refinementFeedback && options.previousInteractionId) {
		// Multi-turn refinement
		prompt = `The user wants changes: "${options.refinementFeedback}"

Please generate a new subject line based on this feedback.`;
	} else {
		// Initial generation
		prompt = `Analyze this issue and generate a subject line:

${options.description}`;
	}

	const response = await interact(prompt, {
		systemInstruction: SUBJECT_LINE_PROMPT,
		responseSchema: SUBJECT_LINE_SCHEMA,
		temperature: 0.4, // Moderate creativity
		thinkingLevel: 'low', // Fast reasoning (not research-heavy)
		previousInteractionId: options.previousInteractionId
	});

	let data = JSON.parse(response.outputs) as SubjectLineResponseWithClarification;
	let currentInteractionId = response.id;

	// Validate: if needs_clarification is true but no questions provided
	// Retry specifically asking for the clarification questions
	if (
		data.needs_clarification &&
		(!data.clarification_questions || data.clarification_questions.length === 0)
	) {
		console.log(
			'[subject-line] Agent said needs_clarification but provided no questions - asking for questions explicitly'
		);

		const clarifyRetryResponse = await interact(
			`You indicated you need clarification about: "${options.description}"

Your reasoning was: ${data.inferred_context?.reasoning || 'routing would change based on answers'}

Now provide the clarification_questions array. You MUST include 1-2 questions in this exact JSON format:
{
  "needs_clarification": true,
  "clarification_questions": [
    {
      "id": "location",
      "question": "Which city's 6th street are you talking about?",
      "type": "location_picker",
      "location_level": "city",
      "required": true
    }
  ],
  "inferred_context": { ... }
}

What questions do you need answered to route this correctly?`,
			{
				systemInstruction: SUBJECT_LINE_PROMPT,
				responseSchema: SUBJECT_LINE_SCHEMA,
				temperature: 0.3,
				thinkingLevel: 'low',
				previousInteractionId: currentInteractionId
			}
		);

		const clarifyRetryData = JSON.parse(
			clarifyRetryResponse.outputs
		) as SubjectLineResponseWithClarification;

		// If we got questions this time, use them
		if (clarifyRetryData.clarification_questions?.length) {
			console.log('[subject-line] Clarification retry got questions:', {
				count: clarifyRetryData.clarification_questions.length
			});
			data = clarifyRetryData;
			currentInteractionId = clarifyRetryResponse.id;
		} else {
			// Still no questions - agent can't formulate them, force generation
			console.log('[subject-line] Clarification retry still no questions - forcing generation');
			data.needs_clarification = false;
		}
	}

	// If agent returned neither clarification questions nor a subject line, retry with explicit instruction
	if (!data.needs_clarification && !data.subject_line) {
		console.log(
			'[subject-line] Agent returned empty response - retrying with explicit instruction'
		);

		const retryResponse = await interact(
			`You must generate a subject line now. The user said: "${options.description}"

Generate the output with subject_line, core_issue, topics, url_slug, and voice_sample. Do not ask for clarification.`,
			{
				systemInstruction: SUBJECT_LINE_PROMPT,
				responseSchema: SUBJECT_LINE_SCHEMA,
				temperature: 0.5, // Slightly higher for more output
				thinkingLevel: 'low',
				previousInteractionId: currentInteractionId
			}
		);

		data = JSON.parse(retryResponse.outputs) as SubjectLineResponseWithClarification;
		currentInteractionId = retryResponse.id;
		data.needs_clarification = false; // Force no clarification on retry

		console.log('[subject-line] Retry result:', {
			has_subject_line: !!data.subject_line
		});
	}

	console.log('[subject-line] Result:', {
		needs_clarification: data.needs_clarification,
		question_count: data.clarification_questions?.length ?? 0,
		has_subject_line: !!data.subject_line
	});

	return {
		data,
		interactionId: currentInteractionId
	};
}
