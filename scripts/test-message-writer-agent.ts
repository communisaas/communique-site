/**
 * Quick test for message-writer agent
 * Run: npx tsx scripts/test-message-writer-agent.ts
 */

import { config } from 'dotenv';
config();

import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
	console.error('Missing GEMINI_API_KEY in .env');
	process.exit(1);
}

const MESSAGE_WRITER_PROMPT = `You write messages that land. Same message triggers the person sending it AND the person receiving it. That's the test.

## Voice

You receive a voice_sample and rawInput from the original complaint. Match their temperature. If they were direct, be direct. If they named specific absurdities, name them. The message should feel like it came from them.

## What Lands

Start with a human interaction where the system fails. Not a policy description. A moment: someone tries to do something reasonable, the system blocks them.

Then the contrast. One number against another. No commentary—the gap speaks.

Then what must change. Specific action. No hedging.

Short paragraphs. Air. Every sentence earns its place.

## What Dies

- Policy descriptions as openers ("The 90-day cap means...")
- Rhetorical questions
- Editorializing ("this mess", "this is outrageous")
- Dense paragraphs
- Statistics without human stakes
- Testimony language

## Structure

1. Human interaction where system fails
2. The contrast (numbers, no commentary)
3. What must change
4. "From [Address] where..." - always use literal [Address], system fills it
5. [Personal Connection] - always include this exact placeholder

## Research

Current data only (2024-2025). One surgical stat beats five. Cite inline with source name.

## Citations

Numbered markers [1], [2] mapping to sources array.
Sources: num, title, url, type (journalism/research/government/legal/advocacy)

## Constraints

Under 150 words. No "I urge" / "I respectfully" / "Thank you". No jargon. If it sounds like a report, cut it.`;

async function test() {
	// Full pipeline data
	const rawInput = `sf has this annoying 28-day policy for people in need of housing and this convoluted conversion to tenancy makes it hard for property owners trying to solve the housing crisis and for the people themselves in need of the fucking housing`;

	const subjectLineOutput = {
		subject_line: "SF's 28-Day Rule Blocks Housing, Traps Homeless in Crisis",
		core_issue:
			"San Francisco's restrictive 28-day policy and convoluted tenancy conversion rules hinder property owners from providing housing, exacerbating the crisis for people in need.",
		topics: ['housing', 'local-gov', 'policy', 'homelessness'],
		url_slug: 'sf-28-day-housing-trap',
		voice_sample:
			'this convoluted conversion to tenancy makes it hard for property owners trying to solve the housing crisis and for the people themselves in need of the fucking housing'
	};

	const decisionMakers = [
		{ name: 'Daniel Lurie', title: 'Mayor', organization: 'City and County of San Francisco' },
		{
			name: 'Sarah Dennis-Phillips',
			title: 'Planning Director',
			organization: 'San Francisco Planning Department'
		},
		{
			name: 'Aaron Peskin',
			title: 'President, Board of Supervisors',
			organization: 'City and County of San Francisco'
		},
		{
			name: 'Myrna Melgar',
			title: 'Supervisor, Chair of Land Use and Transportation Committee',
			organization: 'City and County of San Francisco'
		},
		{
			name: 'Shireen McSpadden',
			title: 'Executive Director',
			organization: 'Department of Homelessness and Supportive Housing'
		}
	];

	console.log('Testing message-writer agent...\n');
	console.log('Pipeline Context:');
	console.log(`  Subject: ${subjectLineOutput.subject_line}`);
	console.log(`  Topics: ${subjectLineOutput.topics.join(', ')}`);
	console.log(`  Decision Makers: ${decisionMakers.map((dm) => dm.name).join(', ')}`);
	console.log(`  Voice Sample: "${subjectLineOutput.voice_sample.substring(0, 60)}..."`);
	console.log(`  Raw Input: "${rawInput.substring(0, 60)}..."`);
	console.log('\n' + '='.repeat(60) + '\n');

	const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

	// Build decision-maker list
	const decisionMakerList = decisionMakers
		.map((dm) => `- ${dm.name}, ${dm.title} at ${dm.organization}`)
		.join('\n');

	// Build voice context block
	const voiceBlock = `
## Original Voice

Voice Sample (emotional peak):
"${subjectLineOutput.voice_sample}"

Raw Input (full texture):
"${rawInput}"

Channel this voice. The message should feel like it came from this person.
`;

	const prompt = `Write a compelling message about this issue:

Subject: ${subjectLineOutput.subject_line}
Core Issue: ${subjectLineOutput.core_issue}
Topics: ${subjectLineOutput.topics.join(', ')}

Decision-makers to address:
${decisionMakerList}
${voiceBlock}
Research current information and write a message that:
1. States the problem with specific, recent evidence
2. Cites credible sources using [1], [2], [3] notation
3. Makes a clear, actionable ask
4. Maintains a respectful but firm tone

Respond with a JSON object containing:
- message: string (the full message body)
- subject: string (refined subject line if needed)
- sources: array of {num, title, url, type}
- research_log: array of search queries used

Output ONLY valid JSON, no markdown or explanation.`;

	try {
		console.log('Calling Gemini with Google Search grounding...\n');

		const response = await ai.models.generateContent({
			model: 'gemini-2.5-flash',
			contents: prompt,
			config: {
				temperature: 0.4,
				systemInstruction: MESSAGE_WRITER_PROMPT,
				tools: [{ googleSearch: {} }]
			}
		});

		let output = response.text || '';

		// Clean up markdown code blocks
		if (output.includes('```json')) {
			output = output.replace(/```json\n?/g, '').replace(/```\n?/g, '');
		} else if (output.includes('```')) {
			output = output.replace(/```\n?/g, '');
		}
		output = output.trim();

		if (output) {
			const parsed = JSON.parse(output);

			console.log('Generated Message:\n');
			console.log('─'.repeat(60));
			console.log(parsed.message);
			console.log('─'.repeat(60));

			console.log('\nSubject: ' + parsed.subject);

			console.log('\nSources:');
			for (const src of parsed.sources || []) {
				console.log(`  [${src.num}] ${src.title}`);
				console.log(`      ${src.url}`);
				console.log(`      Type: ${src.type}`);
			}

			console.log('\nResearch Log:');
			for (const query of parsed.research_log || []) {
				console.log(`  • ${query}`);
			}

			console.log('\n' + '='.repeat(60));
			console.log('\nValidation:');
			console.log(`  ✓ Message length: ${parsed.message.length} chars`);
			console.log(`  ✓ Word count: ~${parsed.message.split(/\s+/).length} words`);
			console.log(`  ✓ Sources: ${(parsed.sources || []).length}`);
			console.log(`  ✓ Has [Address] placeholder: ${parsed.message.includes('[Address]')}`);
			console.log(
				`  ✓ Has [Personal Connection] placeholder: ${parsed.message.includes('[Personal Connection]')}`
			);
		}
	} catch (error) {
		console.error('Error:', error);
	}
}

test();
