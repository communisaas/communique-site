/**
 * Shared template data types for safe property access
 * Prevents "Property 'toLowerCase' does not exist on type '{}'" errors
 */

// Safe template data interface for type-safe string operations
export interface SafeTemplateData {
	title?: string;
	id?: string;
	deliveryMethod?: string;
	message_body?: string;
	subject?: string;
	slug?: string;
	[key: string]: unknown;
}

// Type guard to check if an object has safe string properties
export function isSafeTemplateData(obj: unknown): obj is SafeTemplateData {
	return typeof obj === 'object' && obj !== null;
}

// Safe string getter utility
export function safeStringValue(value: unknown, defaultValue = ''): string {
	return typeof value === 'string' ? value : defaultValue;
}

// Safe toLowerCase utility
export function safeToLowerCase(value: unknown, defaultValue = ''): string {
	return typeof value === 'string' ? value.toLowerCase() : defaultValue;
}

// Template data validator for runtime type safety
export function validateTemplateData(data: unknown): SafeTemplateData {
	if (!isSafeTemplateData(data)) {
		throw new Error('Invalid template data: expected object');
	}
	
	return {
		title: safeStringValue(data.title),
		id: safeStringValue(data.id),
		deliveryMethod: safeStringValue(data.deliveryMethod),
		message_body: safeStringValue(data.message_body),
		subject: safeStringValue(data.subject),
		slug: safeStringValue(data.slug),
		...data
	};
}