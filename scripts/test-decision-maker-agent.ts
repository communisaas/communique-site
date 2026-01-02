/**
 * Quick test for decision-maker agent
 * Run: npx tsx scripts/test-decision-maker-agent.ts
 */

import { config } from 'dotenv';
config();

import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
	console.error('Missing GEMINI_API_KEY in .env');
	process.exit(1);
}

const DECISION_MAKER_SCHEMA = {
	type: 'object',
	properties: {
		decision_makers: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					name: { type: 'string', description: 'Full name of the decision-maker' },
					title: { type: 'string', description: 'Current title/position' },
					organization: { type: 'string', description: 'Organization name' },
					reasoning: { type: 'string', description: 'Why this person has power over this issue' },
					source_url: { type: 'string', description: 'URL verifying this person and position' },
					confidence: { type: 'number', description: 'Confidence score 0-1' }
				},
				required: ['name', 'title', 'organization', 'reasoning', 'confidence']
			},
			minItems: 3,
			maxItems: 5
		},
		research_summary: { type: 'string', description: 'Summary of research process' }
	},
	required: ['decision_makers', 'research_summary']
};

const DECISION_MAKER_PROMPT = `You research and identify REAL people with power over social issues.

## Original Voice

The voice_sample carries the human stakes. When researching decision-makers, keep this voice in your peripheral awareness. The people you identify should have power over THIS specific grievance, not abstract policy areas.

If the voice says "my mom was denied coverage," find the specific executives who approve denials.
If the voice says "I was evicted with 3 days notice," find who enforces tenant law.

The voice anchors your research to real human harm.

## Research Protocol

1. **Google Search required** - Use grounding to find REAL, CURRENT people
2. **Verify each person** - Only include people you can prove exist with credible sources
3. **Explain the power** - Why does THIS person matter for THIS issue?
4. **Provide sources** - Every decision-maker needs a verification URL

## Output Requirements

- 3-5 decision-makers with direct power over the issue
- Each must have: name, title, organization, reasoning, source_url, confidence
- Never invent names. Never guess positions. Only VERIFIED people.

## Confidence Scoring

- 0.9-1.0: Government official with public record, verified in last 6 months
- 0.7-0.9: Executive/official from credible news source
- 0.5-0.7: Person referenced in relevant context, may need verification
- Below 0.5: Don't include - not confident enough`;

async function test() {
	// Output from subject-line agent
	const subjectLineOutput = {
		subject_line: "SF's 28-Day Rule Blocks Housing, Traps Homeless in Crisis",
		core_issue:
			"San Francisco's restrictive 28-day policy and convoluted tenancy conversion rules hinder property owners from providing housing, exacerbating the crisis for people in need.",
		topics: ['housing', 'local-gov', 'policy', 'homelessness'],
		url_slug: 'sf-28-day-housing-trap',
		voice_sample:
			'this convoluted conversion to tenancy makes it hard for property owners trying to solve the housing crisis and for the people themselves in need of the fucking housing'
	};

	console.log('Testing decision-maker agent...\n');
	console.log('Input from subject-line agent:');
	console.log(`  Subject: ${subjectLineOutput.subject_line}`);
	console.log(`  Core Issue: ${subjectLineOutput.core_issue}`);
	console.log(`  Topics: ${subjectLineOutput.topics.join(', ')}`);
	console.log(`  Voice Sample: "${subjectLineOutput.voice_sample}"`);
	console.log('\n' + '='.repeat(60) + '\n');

	const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

	// Build voice block
	const voiceBlock = subjectLineOutput.voice_sample
		? `\nVoice Sample (the human stakes):\n"${subjectLineOutput.voice_sample}"\n`
		: '';

	const prompt = `Find the decision-makers for this issue:

Subject: ${subjectLineOutput.subject_line}
Core Issue: ${subjectLineOutput.core_issue}
Topics: ${subjectLineOutput.topics.join(', ')}
${voiceBlock}
Research and identify 3-5 specific people who have direct power over this issue.
For each person, explain WHY they have power and provide source URLs proving it.

Use Google Search to find current, verifiable information. Only include REAL people
you can verify through credible sources. Never invent names or guess positions.`;

	try {
		console.log('Calling Gemini with Google Search grounding...\n');
		console.log('(Note: Grounding and JSON mode are mutually exclusive in Gemini API)\n');

		// First call: Use Google Search grounding without JSON schema (get research)
		const groundedResponse = await ai.models.generateContent({
			model: 'gemini-2.5-flash',
			contents:
				prompt +
				`\n\nRespond with a JSON object containing:
- decision_makers: array of {name, title, organization, reasoning, source_url, confidence}
- research_summary: string

Output ONLY valid JSON, no markdown or explanation.`,
			config: {
				temperature: 0.2,
				systemInstruction: DECISION_MAKER_PROMPT,
				// Use Google Search grounding (no JSON mode)
				tools: [{ googleSearch: {} }]
			}
		});

		// Extract JSON from the response (may be wrapped in markdown)
		let output = groundedResponse.text || '';

		// Clean up markdown code blocks if present
		if (output.includes('```json')) {
			output = output.replace(/```json\n?/g, '').replace(/```\n?/g, '');
		} else if (output.includes('```')) {
			output = output.replace(/```\n?/g, '');
		}
		output = output.trim();

		if (output) {
			const parsed = JSON.parse(output);
			console.log('Decision Makers Found:\n');

			for (const dm of parsed.decision_makers) {
				console.log(`  ${dm.name}`);
				console.log(`    Title: ${dm.title}`);
				console.log(`    Org: ${dm.organization}`);
				console.log(`    Why: ${dm.reasoning}`);
				console.log(`    Source: ${dm.source_url || 'N/A'}`);
				console.log(`    Confidence: ${dm.confidence}`);
				console.log('');
			}

			console.log('='.repeat(60));
			console.log('\nResearch Summary:');
			console.log(`  ${parsed.research_summary}`);

			console.log('\n' + '='.repeat(60));
			console.log('\nValidation:');
			console.log(`  ✓ Decision makers: ${parsed.decision_makers.length} found`);
			console.log(
				`  ✓ Avg confidence: ${(parsed.decision_makers.reduce((sum: number, dm: { confidence: number }) => sum + dm.confidence, 0) / parsed.decision_makers.length).toFixed(2)}`
			);
		}
	} catch (error) {
		console.error('Error:', error);
	}
}

test();
