/**
 * VOTER Protocol Integration Types
 *
 * VOTER Protocol certification is now handled server-side through the mail server.
 * Client code should not directly interact with VOTER Protocol APIs.
 *
 * This file now only exports shared types used across the application.
 */

import type { Template } from '$lib/types/template';

// Type for template data to prevent toLowerCase errors
interface SafeTemplateData {
	title?: unknown;
	id?: unknown;
	deliveryMethod?: unknown;
	[key: string]: unknown;
}

/**
 * Get action type based on template properties
 * Shared utility for consistent action type determination
 */
export function getVOTERActionType(template: Template | SafeTemplateData): string {
	// Check template properties to determine action type with safe type checking
	const title = typeof template.title === 'string' ? template.title.toLowerCase() : '';
	const id = typeof template.id === 'string' ? template.id.toLowerCase() : '';
	const method =
		typeof template.deliveryMethod === 'string' ? template.deliveryMethod.toLowerCase() : '';

	// Congressional messages
	if (
		method === 'certified' ||
		title.includes('congress') ||
		title.includes('_representative') ||
		title.includes('senator') ||
		id.includes('cwc')
	) {
		return 'cwc_message';
	}

	// Local government
	if (
		title.includes('local') ||
		title.includes('mayor') ||
		title.includes('council') ||
		title.includes('city')
	) {
		return 'local_action';
	}

	// Direct email to officials
	if (method === 'direct') {
		return 'direct_email';
	}

	return 'direct_action'; // Default
}
