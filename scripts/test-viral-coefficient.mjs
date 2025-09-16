import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

console.log('🧪 Testing Templates for Viral Coefficient and Congressional Acceptance\n');
console.log('='.repeat(80));

const templates = await prisma.template.findMany({
	select: {
		title: true,
		message_body: true,
		category: true,
		deliveryMethod: true
	}
});

// Viral coefficient scoring criteria
function analyzeViralCoefficient(template) {
	let score = 0;
	const body = template.message_body;
	const title = template.title;

	// Neuroeconomic triggers
	if (body.includes("math doesn't work")) score += 15; // Cognitive dissonance trigger
	if (body.match(/\$[\d,]+/g)) score += 10; // Specific dollar amounts
	if (body.includes('The gap:') || body.includes('The transfer:')) score += 12; // Clear causation
	if (body.includes('Which') && body.includes('do you defend')) score += 15; // Forcing choice
	if (body.includes('From [Address] where')) score += 8; // Local relevance
	if (title.includes('vs') || title.includes('More Than') || title.includes('Less Than'))
		score += 10; // Contrast framing

	// Numerical contrasts (essential for viral sharing)
	const numberMatches = body.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) || [];
	if (numberMatches.length >= 3) score += 12; // Multiple numbers create contrast

	// Emotional intensity
	if (body.includes('Pay More') || body.includes('Get Less')) score += 8; // Loss aversion
	if (body.includes('Owns') || body.includes('Controls')) score += 6; // Power dynamics

	return Math.min(score, 100); // Cap at 100
}

// Congressional acceptance scoring
function analyzeCongressionalAcceptance(template) {
	let score = 100;
	const body = template.message_body;
	const title = template.title;

	// Deductions for problematic content
	if (body.includes('fucking') || body.includes('bullshit')) score -= 50; // Profanity
	if (body.includes('corrupt') || body.includes('bought')) score -= 20; // Direct accusations
	if (body.includes('revolution') || body.includes('overthrow')) score -= 40; // Incendiary language
	if (title.includes('Destroy') || title.includes('Kill')) score -= 30; // Violent imagery

	// Points for diplomatic framing
	if (body.includes('Please explain this to your constituents')) score += 5; // Respectful request
	if (body.includes('From [Address]')) score += 5; // Constituent identification
	if (body.includes('[Personal Connection]')) score += 5; // Personal stake
	if (body.includes('Sincerely')) score += 5; // Formal closure

	// Check for factual framing vs. opinion
	if (body.match(/\d+(?:,\d{3})*/) && !body.includes('I think') && !body.includes('I believe'))
		score += 10; // Fact-based

	return Math.max(score, 0); // Floor at 0
}

console.log('TEMPLATE ANALYSIS RESULTS:');
console.log('='.repeat(80));

let totalViral = 0;
let totalCongressional = 0;
let templateCount = 0;

templates.forEach((template) => {
	const viral = analyzeViralCoefficient(template);
	const congressional = analyzeCongressionalAcceptance(template);
	const balance = Math.min(viral, congressional); // Sweet spot is high on both

	totalViral += viral;
	totalCongressional += congressional;
	templateCount++;

	console.log(`\\n📊 ${template.title}`);
	console.log(`   Category: ${template.category} | Delivery: ${template.deliveryMethod}`);
	console.log(
		`   Viral Coefficient: ${viral}/100 ${viral >= 70 ? '🔥' : viral >= 50 ? '⚡' : '📈'}`
	);
	console.log(
		`   Congressional Acceptance: ${congressional}/100 ${congressional >= 80 ? '✅' : congressional >= 60 ? '⚠️' : '❌'}`
	);
	console.log(
		`   Balance Score: ${balance}/100 ${balance >= 60 ? '🎯' : balance >= 40 ? '⚖️' : '🔧'}`
	);

	// Recommendations
	if (viral < 50) {
		console.log(
			`   🔧 VIRAL FIX: Add numerical contrasts, "math doesn't work" opener, or forcing choice`
		);
	}
	if (congressional < 60) {
		console.log(`   🔧 CONGRESSIONAL FIX: Remove inflammatory language, add respectful framing`);
	}
	if (balance >= 60) {
		console.log(`   ✨ READY: This template hits the sweet spot - viral but congressional-safe`);
	}
});

console.log('\\n' + '='.repeat(80));
console.log('AGGREGATE ANALYSIS:');
console.log('='.repeat(80));

const avgViral = Math.round(totalViral / templateCount);
const avgCongressional = Math.round(totalCongressional / templateCount);
const avgBalance = Math.min(avgViral, avgCongressional);

console.log(`📈 Average Viral Coefficient: ${avgViral}/100`);
console.log(`🏛️ Average Congressional Acceptance: ${avgCongressional}/100`);
console.log(`⚖️ Average Balance Score: ${avgBalance}/100`);

console.log('\\n📋 VIRAL COEFFICIENT BREAKDOWN:');
console.log(
	`   🔥 High Viral (70+): ${templates.filter((t) => analyzeViralCoefficient(t) >= 70).length} templates`
);
console.log(
	`   ⚡ Medium Viral (50-69): ${templates.filter((t) => analyzeViralCoefficient(t) >= 50 && analyzeViralCoefficient(t) < 70).length} templates`
);
console.log(
	`   📈 Low Viral (<50): ${templates.filter((t) => analyzeViralCoefficient(t) < 50).length} templates`
);

console.log('\\n🏛️ CONGRESSIONAL ACCEPTANCE BREAKDOWN:');
console.log(
	`   ✅ High Acceptance (80+): ${templates.filter((t) => analyzeCongressionalAcceptance(t) >= 80).length} templates`
);
console.log(
	`   ⚠️ Medium Acceptance (60-79): ${templates.filter((t) => analyzeCongressionalAcceptance(t) >= 60 && analyzeCongressionalAcceptance(t) < 80).length} templates`
);
console.log(
	`   ❌ Low Acceptance (<60): ${templates.filter((t) => analyzeCongressionalAcceptance(t) < 60).length} templates`
);

console.log('\\n🎯 BALANCED TEMPLATES (High Viral + High Congressional):');
const balanced = templates.filter((t) => {
	const viral = analyzeViralCoefficient(t);
	const congressional = analyzeCongressionalAcceptance(t);
	return viral >= 60 && congressional >= 70;
});

balanced.forEach((t) => {
	console.log(`   ✨ ${t.title}`);
});

if (balanced.length === 0) {
	console.log('   🔧 No templates currently achieve optimal balance. Consider:');
	console.log('      • Adding more numerical contrasts to boost viral coefficient');
	console.log('      • Softening language to improve congressional acceptance');
	console.log('      • Using "math doesn\'t work" openers with respectful closures');
}

console.log('\\n💡 NEXT STEPS:');
if (avgViral < 60) {
	console.log('   🔥 Boost viral coefficient: Add devastating numerical contrasts');
}
if (avgCongressional < 70) {
	console.log('   🏛️ Improve congressional acceptance: Use respectful but firm language');
}
if (avgBalance >= 60) {
	console.log('   ✅ Templates are optimized for maximum impact within constraints');
} else {
	console.log('   🎯 Focus on the sweet spot: Messages that cut deep but pass filters');
}

await prisma.$disconnect();
