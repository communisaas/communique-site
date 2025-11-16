import type { ProcessedDecisionMaker, CustomRecipient } from '$lib/types/template';

/**
 * Process raw decision-maker data from Toolhouse agent
 */
export function processDecisionMakers(
	rawDecisionMakers: Array<{
		name: string;
		title: string;
		organization: string;
		email?: string;
		provenance: string;
	}>
): ProcessedDecisionMaker[] {
	return rawDecisionMakers.map((dm) => ({
		...dm,
		reasoning: extractReasoning(dm.provenance),
		source: extractSource(dm.provenance),
		powerLevel: inferPowerLevel(dm.title),
		isAiResolved: true
	}));
}

/**
 * Extract reasoning (why this person matters) from provenance
 * Returns text before "Source:" or first sentence
 */
export function extractReasoning(provenance: string): string {
	// Split on common provenance markers
	const parts = provenance.split(/Source:|Email format verified|His role|Her role/i);
	const reasoning = parts[0].trim();

	// Return first sentence or first 150 chars
	const firstSentence = reasoning.match(/^[^.!?]+[.!?]/);
	if (firstSentence) {
		return firstSentence[0];
	}

	return reasoning.substring(0, 150) + (reasoning.length > 150 ? '...' : '');
}

/**
 * Extract verification URL from provenance
 */
export function extractSource(provenance: string): string | undefined {
	const urlMatch = provenance.match(/https?:\/\/[^\s)]+/);
	return urlMatch?.[0];
}

/**
 * Infer power level from job title
 */
export function inferPowerLevel(title: string): 'primary' | 'secondary' | 'supporting' {
	const titleLower = title.toLowerCase();

	// Primary: C-suite, President
	if (
		titleLower.includes('ceo') ||
		titleLower.includes('president') ||
		titleLower.includes('chief')
	) {
		return 'primary';
	}

	// Secondary: VPs, Directors, Heads
	if (
		titleLower.includes('vice president') ||
		titleLower.includes('director') ||
		titleLower.includes('head of')
	) {
		return 'secondary';
	}

	// Supporting: Everyone else (press, coordinators, etc.)
	return 'supporting';
}

/**
 * Convert decision-makers to recipient emails for template
 */
export function extractRecipientEmails(
	decisionMakers: ProcessedDecisionMaker[],
	customRecipients: CustomRecipient[],
	includesCongress: boolean
): string[] {
	const emails: string[] = [];

	// AI-resolved decision-makers
	decisionMakers.forEach((dm) => {
		if (dm.email) emails.push(dm.email);
	});

	// Custom recipients
	customRecipients.forEach((cr) => {
		emails.push(cr.email);
	});

	// Congressional marker
	if (includesCongress) {
		emails.push('__CONGRESSIONAL__');
	}

	return emails;
}

/**
 * Check if email already exists in recipient lists
 */
export function isDuplicateEmail(
	email: string,
	decisionMakers: ProcessedDecisionMaker[],
	customRecipients: CustomRecipient[]
): boolean {
	const normalizedEmail = email.toLowerCase().trim();

	// Check decision-makers
	const inDecisionMakers = decisionMakers.some(
		(dm) => dm.email?.toLowerCase().trim() === normalizedEmail
	);

	// Check custom recipients
	const inCustomRecipients = customRecipients.some(
		(cr) => cr.email.toLowerCase().trim() === normalizedEmail
	);

	return inDecisionMakers || inCustomRecipients;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}
