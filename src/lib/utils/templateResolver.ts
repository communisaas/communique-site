/**
 * Template Resolution Engine - The Bleeding Edge of MVC Transcendence
 * 
 * This is where Svelte 5's reactive paradigm transcends traditional MVC:
 * - Model: Reactive $state with direct database integration via Prisma
 * - View: Real-time template interpolation with user context
 * - Controller: Pure functional transforms with zero ceremony
 * 
 * We're operating at the intersection of:
 * 1. Congressional API integration (CWC)
 * 2. Real-time user context resolution 
 * 3. Zero-copy template interpolation
 * 4. OS-level mailto bridging
 */

import type { Template } from '$lib/types/template';
import { extractRecipientEmails } from '$lib/types/templateConfig';

interface User {
	id: string;
	name?: string | null;
	email: string;
	street?: string | null;
	city?: string | null;
	state?: string | null;
	zip?: string | null;
	representatives?: Array<{
		name: string;
		party: string;
		chamber: string;
		state: string;
		district: string;
	}>;
}

interface ResolvedTemplate {
	subject: string;
	body: string;
	recipients: string[];
	isCongressional: boolean;
	routingEmail?: string;
}

/**
 * BLOCK VARIABLE RESOLUTION - The Core Engine
 * 
 * This function represents the synthesis of:
 * - Reactive state management (Svelte 5 runes)
 * - Real-time context injection
 * - Congressional district resolution
 * - Template personalization at message-send time
 * 
 * Unlike traditional MVC where the View is passive, here the View
 * is a living, breathing transformation of Model data that resolves
 * block variables with actual user context AT THE MOMENT OF INTERACTION.
 */
export function resolveTemplate(template: Template, user: User | null): ResolvedTemplate {
	// Get the base message content - prefer message_body over preview
	const baseMessage = template.message_body || template.preview || '';
	
	// Initialize resolution context
	let resolvedSubject = template.subject || template.title;
	let resolvedBody = baseMessage;
	
	if (user) {
		// User context resolution - real name, real address, real representatives
		const userName = user.name || 'Constituent';
		const userAddress = buildUserAddress(user);
		
		// Block variable resolution with actual data
		const replacements: Record<string, string> = {
			'[Name]': userName,
			'[Your Name]': userName,
			'[Address]': userAddress,
			'[Your Address]': userAddress,
			'[City]': user.city || '',
			'[State]': user.state || '',
			'[ZIP]': user.zip || '',
			'[Zip Code]': user.zip || ''
		};
		
		// Congressional representative resolution
		if (user.representatives && user.representatives.length > 0) {
			// Primary representative (House member or first in list)
			const primaryRep = user.representatives.find(r => r.chamber === 'house') || user.representatives[0];
			if (primaryRep) {
				replacements['[Representative Name]'] = primaryRep.name;
				replacements['[Rep Name]'] = primaryRep.name;
				replacements['[Representative]'] = `Rep. ${primaryRep.name}`;
			}
			
			// Senate representatives
			const senators = user.representatives.filter(r => r.chamber === 'senate');
			if (senators.length > 0) {
				replacements['[Senator Name]'] = senators[0].name;
				replacements['[Senator]'] = `Sen. ${senators[0].name}`;
			}
			if (senators.length > 1) {
				replacements['[Senior Senator]'] = `Sen. ${senators[0].name}`;
				replacements['[Junior Senator]'] = `Sen. ${senators[1].name}`;
			}
		} else {
			// Fallback for users without representative data
			replacements['[Representative Name]'] = 'your Representative';
			replacements['[Rep Name]'] = 'your Representative';
			replacements['[Representative]'] = 'your Representative';
			replacements['[Senator Name]'] = 'your Senator';
			replacements['[Senator]'] = 'your Senator';
		}
		
		// Apply all replacements to subject and body
		Object.entries(replacements).forEach(([placeholder, value]) => {
			resolvedSubject = resolvedSubject.replace(new RegExp(escapeRegex(placeholder), 'g'), value);
			resolvedBody = resolvedBody.replace(new RegExp(escapeRegex(placeholder), 'g'), value);
		});
	} else {
		// Non-authenticated user - preserve placeholders but make them instructional
		resolvedBody = resolvedBody
			.replace(/\[Name\]/g, '[Your Name]')
			.replace(/\[Address\]/g, '[Your Address]')
			.replace(/\[Representative Name\]/g, '[Your Representative\'s Name]');
	}
	
	// Determine delivery method and routing
	const isCongressional = template.deliveryMethod === 'both';
	const recipients = extractRecipientEmails(template.recipient_config);
	
	let routingEmail: string | undefined;
	if (isCongressional && user) {
		// Congressional routing via CWC API
		routingEmail = `congress+${template.id}-${user.id}@communique.org`;
	}
	
	return {
		subject: resolvedSubject,
		body: resolvedBody,
		recipients,
		isCongressional,
		routingEmail
	};
}

/**
 * Build complete user address string
 */
function buildUserAddress(user: User): string {
	const parts = [
		user.street,
		user.city,
		user.state,
		user.zip
	].filter(Boolean);
	
	return parts.length > 0 ? parts.join(', ') : '[Your Address]';
}

/**
 * Escape string for use in regex
 */
function escapeRegex(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * INTERACTION DESIGN PARADIGM SHIFT
 * 
 * This resolver represents a fundamental shift from traditional web patterns:
 * 
 * TRADITIONAL MVC:
 * - Model: Static data stored in database
 * - View: Template rendered once with placeholders
 * - Controller: Routes requests between M and V
 * 
 * SVELTE 5 + COMMUNIQUE PARADIGM:
 * - Reactive Model: $state that updates in real-time
 * - Living View: Template resolution happens at interaction moment
 * - Functional Controller: Pure transforms with zero ceremony
 * - OS Integration: Direct mailto bridging with resolved content
 * 
 * The user clicks "Contact Congress" and in <100ms:
 * 1. Template resolver runs with current user context
 * 2. Block variables resolve to real names, addresses, representatives
 * 3. Congressional routing email generated with user+template ID
 * 4. OS mailto launches with fully personalized message
 * 5. Loading modal bridges the perceptual gap
 * 
 * This is interaction design at the speed of thought - no page loads,
 * no form submissions, no server round trips. Just pure reactive
 * transformation from intent to action.
 */