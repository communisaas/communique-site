/**
 * Variable styling utilities for consistent template variable appearance
 * across the template creation flow.
 *
 * Based on patterns from src/lib/components/landing/template/MessagePreview.svelte
 */

export interface VariableMatch {
	variable: string;
	placeholder: string;
	start: number;
	end: number;
	type: 'system' | 'user-editable' | 'unknown';
	isEmpty: boolean;
	hasValue: boolean;
}

// Define which variables are system-populated vs user-editable
// Based on templateResolver.ts - these get auto-filled with user data
const systemVariables = new Set([
	'Name',
	'Your Name',
	'Address',
	'Your Address',
	'City',
	'State',
	'ZIP',
	'Zip Code',
	'Representative Name',
	'Rep Name',
	'Representative',
	'Senator Name',
	'Senator',
	'Senior Senator',
	'Junior Senator'
]);

// These require user input and remain editable
const userEditableVariables = new Set([
	'Personal Connection',
	'Phone',
	'Phone Number',
	'Your Phone',
	'Your Story',
	'Your Experience',
	'Personal Story'
]);

/**
 * Get CSS classes for styling template variables (matches MessagePreview.svelte exactly)
 */
export function getVariableClasses(variableName: string, isEmpty: boolean = true): string {
	const isSystemVariable = systemVariables.has(variableName);
	const isUserEditable = userEditableVariables.has(variableName);

	if (isSystemVariable) {
		return `
			inline-flex items-center gap-1
			px-1 py-0.5 rounded-sm
			font-mono text-xs leading-none
			transition-colors duration-150
			bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200
			cursor-default align-baseline
		`
			.replace(/\s+/g, ' ')
			.trim();
	} else if (isUserEditable) {
		const baseClasses = `
			inline-flex items-center gap-1
			px-1 py-0.5 rounded-sm
			font-mono text-xs leading-none
			cursor-pointer transition-all duration-150
			align-baseline transform
		`
			.replace(/\s+/g, ' ')
			.trim();

		if (isEmpty) {
			return (
				baseClasses +
				' bg-purple-50 text-purple-700 ring-1 ring-purple-200 hover:bg-purple-100 hover:ring-purple-300'
			);
		} else {
			return (
				baseClasses +
				' bg-participation-primary-50 text-participation-primary-700 ring-1 ring-participation-primary-200 hover:bg-participation-primary-100 hover:ring-participation-primary-300'
			);
		}
	} else {
		// Default styling for unknown variables
		return `
			inline-flex items-center
			px-1 py-0.5 rounded-sm
			font-mono text-xs leading-none
			cursor-pointer transition-colors duration-150
			bg-slate-50 text-slate-600 ring-1 ring-slate-200
			align-baseline
		`
			.replace(/\s+/g, ' ')
			.trim();
	}
}

/**
 * Parse template content and extract variable information (matches MessagePreview.svelte)
 */
export function parseTemplateVariables(
	content: string,
	variableValues: Record<string, string | null> = {}
): VariableMatch[] {
	if (!content) return [];

	const variableRegex = /\[([^\]]+)\]/g;
	const matches: VariableMatch[] = [];
	let match;

	while ((match = variableRegex.exec(content)) !== null) {
		const variable = match[1];
		const type = getVariableType(variable);
		const value = variableValues[variable];
		const isEmpty = !value || (typeof value === 'string' && value.trim() === '');

		matches.push({
			variable,
			placeholder: match[0], // Full [variable] text
			start: match.index,
			end: match.index + match[0].length,
			type,
			isEmpty,
			hasValue: !isEmpty
		});
	}

	return matches;
}

/**
 * Determine if a variable is system-provided or user-editable
 */
function getVariableType(variable: string): 'system' | 'user-editable' | 'unknown' {
	if (systemVariables.has(variable)) {
		return 'system';
	} else if (userEditableVariables.has(variable)) {
		return 'user-editable';
	} else {
		return 'unknown';
	}
}

/**
 * Get simple text indicator for variable type (no SVG to avoid corruption)
 */
export function getVariableIcon(variableName: string, isEmpty: boolean = true): string {
	const isSystemVariable = systemVariables.has(variableName);
	const isUserEditable = userEditableVariables.has(variableName);

	// Use simple text indicators instead of SVG to avoid HTML corruption
	if (isSystemVariable) {
		return '👤'; // User icon for system variables
	} else if (isUserEditable) {
		if (!isEmpty) {
			return '✏️'; // Edit icon for filled user variables
		} else {
			return '✨'; // Sparkles for empty user variables
		}
	}
	return '';
}

/**
 * Convert plain template text with variables into styled HTML with exact text alignment
 */
export function styleTemplateVariables(
	content: string,
	_variableValues: Record<string, string | null> = {}
): string {
	if (!content) return '';

	// Replace variables with styled spans that maintain exact text spacing
	return content.replace(/\[([^\]]+)\]/g, (match, variableName) => {
		const isSystemVariable = systemVariables.has(variableName);
		const isUserEditable = userEditableVariables.has(variableName);

		let bgColor = 'bg-slate-50';
		let textColor = 'text-slate-600';
		let icon = '';

		if (isSystemVariable) {
			bgColor = 'bg-emerald-50';
			textColor = 'text-emerald-700';
			icon = '👤';
		} else if (isUserEditable) {
			bgColor = 'bg-purple-50';
			textColor = 'text-purple-700';
			icon = '✨';
		}

		// Create a styled span that takes up exactly the same space as the original text
		// Use invisible characters to pad to exact match with original text width
		const originalText = match; // [Variable Name]
		const displayText = `${icon}${variableName}`;

		// Calculate padding needed to match original text width
		// This is approximate but should help with alignment
		const paddingNeeded = Math.max(0, originalText.length - displayText.length);
		const padding = '\u00A0'.repeat(Math.floor(paddingNeeded / 2)); // Non-breaking spaces

		return `<span class="inline-block px-1 py-0.5 rounded-sm font-mono text-xs ${bgColor} ${textColor}" data-variable="${variableName}" style="min-width: ${originalText.length * 0.6}em;">${padding}${displayText}${padding}</span>`;
	});
}

/**
 * Get placeholder text for a variable (for display purposes)
 */
export function getVariablePlaceholder(variable: string): string {
	const placeholders: Record<string, string> = {
		name: 'Your Name',
		address: 'Your Address',
		email: 'Your Email',
		phone: 'Your Phone',
		congressionalDistrict: 'District 5',
		state: 'California',
		representative: 'Rep. Smith',
		senator1: 'Sen. Johnson',
		senator2: 'Sen. Williams',
		zipCode: '90210',
		city: 'Los Angeles',
		county: 'Los Angeles County'
	};

	return placeholders[variable] || `{${variable}}`;
}

/**
 * Get tip message for a variable (matches MessagePreview.svelte)
 */
export function getVariableTipMessage(variable: string): string {
	switch (variable) {
		case 'Personal Connection':
			return 'Your template users will add their personal story';
		case 'Name':
		case 'Your Name':
			return "Auto-filled from user's profile";
		case 'Address':
		case 'Your Address':
			return "Auto-filled from user's verified address";
		case 'Representative':
		case 'Representative Name':
		case 'Rep Name':
			return "Auto-filled based on user's location";
		case 'Senator':
		case 'Senator Name':
		case 'Senior Senator':
		case 'Junior Senator':
			return "Auto-filled based on user's location";
		case 'City':
		case 'State':
		case 'ZIP':
		case 'Zip Code':
			return "Auto-filled from user's address";
		default:
			return 'This placeholder will be filled automatically';
	}
}

/**
 * Check if a variable is user-editable (for tip system)
 */
export function isUserEditableVariable(variable: string): boolean {
	return userEditableVariables.has(variable);
}

/**
 * Check if a variable is system-populated (for tip system)
 */
export function isSystemVariable(variable: string): boolean {
	return systemVariables.has(variable);
}
