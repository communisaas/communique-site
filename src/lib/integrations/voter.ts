/**
 * VOTER Protocol Integration Types
 * 
 * VOTER Protocol certification is now handled server-side through the mail server.
 * Client code should not directly interact with VOTER Protocol APIs.
 * 
 * This file now only exports shared types used across the application.
 */

import type { Template } from '$lib/types/template';

/**
 * Get action type based on template properties
 * Shared utility for consistent action type determination
 */
export function getVOTERActionType(template: Template): string {
	// Check template properties to determine action type
	const title = template.title?.toLowerCase() || '';
	const id = template.id?.toLowerCase() || '';
	const method = template.deliveryMethod?.toLowerCase() || '';
	
	// Congressional messages
	if (method === 'certified' || 
	    title.includes('congress') || 
	    title.includes('representative') || 
	    title.includes('senator') || 
	    id.includes('cwc')) {
		return 'cwc_message';
	}
	
	// Local government
	if (title.includes('local') || 
	    title.includes('mayor') || 
	    title.includes('council') || 
	    title.includes('city')) {
		return 'local_action';
	}
	
	// Direct email to officials
	if (method === 'direct') {
		return 'direct_email';
	}
	
	return 'direct_action'; // Default
}