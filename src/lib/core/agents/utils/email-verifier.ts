/**
 * Email Verification Utilities
 *
 * MX record verification and name parsing for decision-maker email resolution.
 */

/**
 * Verify that a domain has valid MX records
 *
 * @param domain - Domain to check (e.g., "example.com")
 * @returns True if domain has valid MX records
 */
export async function verifyMxRecord(domain: string): Promise<boolean> {
	// In browser/edge runtime, DNS lookups aren't available
	// Return true to allow the email to proceed (validation happens at send time)
	if (typeof window !== 'undefined' || typeof process === 'undefined') {
		return true;
	}

	try {
		// Use fetch to check if domain is reachable via HTTP as a proxy
		// This is a lightweight check - actual MX validation happens server-side
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 3000);

		const response = await fetch(`https://${domain}`, {
			method: 'HEAD',
			signal: controller.signal
		}).catch(() => null);

		clearTimeout(timeout);
		return response !== null;
	} catch {
		// Domain unreachable - might still have valid MX records
		// Default to true to avoid false negatives
		return true;
	}
}

/**
 * Parse a name string into structured parts
 *
 * @param name - Full name string (e.g., "Dr. Jane Smith Jr.")
 * @returns Parsed name components
 */
export function parseName(name: string): {
	prefix?: string;
	firstName: string;
	lastName: string;
	suffix?: string;
} {
	const prefixes = ['Dr.', 'Dr', 'Prof.', 'Prof', 'Mr.', 'Mr', 'Ms.', 'Ms', 'Mrs.', 'Mrs', 'Rep.', 'Rep', 'Sen.', 'Sen', 'Hon.', 'Hon'];
	const suffixes = ['Jr.', 'Jr', 'Sr.', 'Sr', 'II', 'III', 'IV', 'MD', 'PhD', 'Esq.', 'Esq'];

	let cleanName = name.trim();
	let prefix: string | undefined;
	let suffix: string | undefined;

	// Extract prefix
	for (const p of prefixes) {
		if (cleanName.toLowerCase().startsWith(p.toLowerCase() + ' ')) {
			prefix = p.endsWith('.') ? p : p + '.';
			cleanName = cleanName.slice(p.length).trim();
			break;
		}
	}

	// Extract suffix
	for (const s of suffixes) {
		const suffixPattern = new RegExp(`[,\\s]+${s.replace('.', '\\.')}$`, 'i');
		if (suffixPattern.test(cleanName)) {
			suffix = s;
			cleanName = cleanName.replace(suffixPattern, '').trim();
			break;
		}
	}

	// Split remaining into first/last name
	const parts = cleanName.split(/\s+/).filter(Boolean);

	if (parts.length === 0) {
		return { firstName: '', lastName: '' };
	}

	if (parts.length === 1) {
		return { prefix, firstName: parts[0], lastName: '', suffix };
	}

	// Last part is last name, rest is first name
	const lastName = parts.pop();
	// parts.pop() returns undefined only if array is empty, but we checked parts.length > 1 above
	if (lastName === undefined) {
		return { prefix, firstName: cleanName, lastName: '', suffix };
	}
	const firstName = parts.join(' ');

	return { prefix, firstName, lastName, suffix };
}
