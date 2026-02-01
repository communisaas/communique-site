/**
 * Test script to examine Gemini API responses and grounding metadata
 * Run with: npx tsx scripts/test-gemini-grounding.ts
 */

import 'dotenv/config';
import { getGeminiClient, GEMINI_CONFIG } from '../src/lib/core/agents/gemini-client';

async function testGeminiGrounding() {
	const ai = getGeminiClient();

	const prompt = `Find the current Mayor of San Francisco and their email address.

Return JSON:
{
  "name": "full name",
  "title": "Mayor",
  "organization": "City of San Francisco",
  "source_url": "URL where you found this",
  "email": "their email"
}`;

	console.log('=== Testing Gemini with Google Search Grounding ===\n');

	const response = await ai.models.generateContent({
		model: GEMINI_CONFIG.model,
		contents: prompt,
		config: {
			temperature: 0.2,
			tools: [{ googleSearch: {} }]
		}
	});

	console.log('=== RAW RESPONSE TEXT ===');
	console.log(response.text);
	console.log('\n');

	console.log('=== GROUNDING METADATA ===');
	const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

	if (groundingMetadata) {
		console.log('\n--- Web Search Queries ---');
		console.log(JSON.stringify(groundingMetadata.webSearchQueries, null, 2));

		console.log('\n--- Grounding Chunks (REAL URLs from Google) ---');
		if (groundingMetadata.groundingChunks) {
			groundingMetadata.groundingChunks.forEach((chunk: any, i: number) => {
				console.log(`[${i}] ${chunk.web?.title || 'No title'}`);
				console.log(`    URL: ${chunk.web?.uri || 'No URI'}`);
			});
		}

		console.log('\n--- Grounding Supports (which text is supported by which chunk) ---');
		if (groundingMetadata.groundingSupports) {
			groundingMetadata.groundingSupports.slice(0, 5).forEach((support: any, i: number) => {
				console.log(`[${i}] Segment: char ${support.segment?.startIndex}-${support.segment?.endIndex}`);
				console.log(`    Supported by chunks: ${JSON.stringify(support.groundingChunkIndices)}`);
			});
			if (groundingMetadata.groundingSupports.length > 5) {
				console.log(`    ... and ${groundingMetadata.groundingSupports.length - 5} more supports`);
			}
		}
	} else {
		console.log('No grounding metadata returned!');
	}

	console.log('\n=== FULL GROUNDING METADATA (raw) ===');
	console.log(JSON.stringify(groundingMetadata, null, 2));
}

testGeminiGrounding().catch(console.error);
