import { generateSubjectLine } from '../src/lib/core/agents/agents/subject-line';
import { config } from 'dotenv';
config();

async function testSuggestions() {
	console.log('Testing ambiguous query for location suggestions...');

	// "Paris" is ambiguous (TX, France, TN, etc.)
	const result = await generateSubjectLine({
		description: "The traffic in Paris is terrible and the mayor isn't doing anything"
	});

	console.log('Result:', JSON.stringify(result.data, null, 2));

	if (
		result.data.needs_clarification &&
		result.data.clarification_questions?.[0]?.suggested_locations?.length > 0
	) {
		console.log('✅ SUCCESS: Agent returned suggested locations');
	} else {
		console.log('❌ FAILURE: No suggestions returned (or no clarification triggered)');
	}
}

testSuggestions();
