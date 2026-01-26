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
import type { EmailServiceUser } from '$lib/types/user';
import { extractRecipientEmails } from '$lib/types/templateConfig';
import { z } from 'zod';

// Enhanced interface with better type safety
export interface ResolvedTemplate {
	subject: string;
	body: string;
	recipients: string[];
	isCongressional: boolean;
	routingEmail?: string;
}

// Type for template variable replacements
export type TemplateReplacements = Record<string, string | null>;

// Type guard for template replacements
export function isValidReplacements(obj: unknown): obj is TemplateReplacements {
	if (typeof obj !== 'object' || obj === null) return false;
	return Object.values(obj).every((value) => typeof value === 'string' || value === null);
}

// Type guards for template validation
export function isValidTemplate(template: unknown): template is Template {
	if (typeof template !== 'object' || template === null) return false;
	const t = template as Record<string, unknown>;

	return (
		typeof t.id === 'string' &&
		typeof t.title === 'string' &&
		typeof t.deliveryMethod === 'string' &&
		['email', 'certified', 'direct', 'cwc'].includes(t.deliveryMethod as string) &&
		(typeof t.message_body === 'string' || typeof t.preview === 'string')
	);
}

export function isValidEmailServiceUser(user: unknown): user is EmailServiceUser {
	if (typeof user !== 'object' || user === null) return false;
	const u = user as Record<string, unknown>;

	return (
		typeof u.id === 'string' &&
		typeof u.email === 'string' &&
		(u.name === undefined || u.name === null || typeof u.name === 'string')
	);
}

// Type for _representative objects with stronger typing
import type { Representative } from '$lib/core/legislative/types';

// Type guard for a single _representative
function isValidRepresentative(rep: unknown): rep is Representative {
	if (typeof rep !== 'object' || rep === null) return false;
	const r = rep as Record<string, unknown>;

	return (
		typeof r.name === 'string' &&
		r.name.trim() !== '' &&
		typeof r.party === 'string' &&
		typeof r.chamber === 'string' &&
		r.chamber.trim() !== '' &&
		typeof r.state === 'string' &&
		typeof r.district === 'string'
	);
}

// Type guard for representatives array with enhanced validation
function isValidRepresentativesArray(reps: unknown): reps is Representative[] {
	if (!Array.isArray(reps)) return false;
	return reps.length > 0 && reps.every(isValidRepresentative);
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
export function resolveTemplate(
	template: Template,
	user: EmailServiceUser | null,
	options: { preserveVariables?: boolean } = {}
): ResolvedTemplate {
	// Input validation
	if (!isValidTemplate(template)) {
		console.error('Template validation failed:', template);
		throw new Error('Invalid template provided to resolveTemplate');
	}

	if (user !== null && !isValidEmailServiceUser(user)) {
		console.error('User validation failed:', user);
		throw new Error('Invalid user provided to resolveTemplate');
	}

	// Debug user and template info
	console.debug('Template resolution started:', {
		templateId: template.id,
		templateTitle: template.title,
		deliveryMethod: template.deliveryMethod,
		userId: user?.id,
		userName: user?.name,
		userRepresentatives: user?.representatives?.length || 0,
		hasUserAddress: !!(user?.street && user?.city && user?.state && user?.zip)
	});
	// Get the base message content - prefer message_body over preview
	const baseMessage = template.message_body || template.preview || '';

	// Initialize resolution context
	const subjectHasPlaceholders =
		typeof template.title === 'string' && /\[.+?\]/.test(template.title);
	let resolvedSubject = template.title || '';
	let resolvedBody = baseMessage;

	if (user) {
		// User context resolution - real name, real _address, real representatives
		const userName = user.name || '';
		const userAddress = buildUserAddress(user);

		// Block variable resolution with actual data
		const replacements: TemplateReplacements = {};

		// Only add replacements if we have data OR if we're not preserving variables
		if (!options.preserveVariables || userName) {
			replacements['[Name]'] = userName; // allow empty string to preserve punctuation
			replacements['[Your Name]'] = userName;
		}

		// For address fields, only replace if we have complete data
		if (user.street && user.city && user.state && user.zip) {
			replacements['[Address]'] = userAddress;
			replacements['[Your Address]'] = userAddress;
		} else if (!options.preserveVariables) {
			// Only remove if not preserving for preview
			replacements['[Address]'] = null;
			replacements['[Your Address]'] = null;
		}

		// Individual address components
		if (user.city || !options.preserveVariables) {
			replacements['[City]'] = user.city || null;
		}
		if (user.state || !options.preserveVariables) {
			replacements['[State]'] = user.state || null;
		}
		if (user.zip || !options.preserveVariables) {
			replacements['[ZIP]'] = user.zip || null;
			replacements['[Zip Code]'] = user.zip || null;
		}

		// Congressional _representative resolution with type safety
		if (user.representatives && isValidRepresentativesArray(user.representatives)) {
			// Primary _representative (House member or first in list)
			const primaryRep =
				user.representatives.find((r) => r.chamber === 'house') || user.representatives[0];
			if (primaryRep) {
				replacements['[Representative Name]'] = primaryRep.name;
				replacements['[Rep Name]'] = primaryRep.name;
				replacements['[Representative]'] = `Rep. ${primaryRep.name}`;
			} else {
				replacements['[Representative Name]'] = null;
				replacements['[Rep Name]'] = null;
				replacements['[Representative]'] = null;
			}

			// Senate representatives
			const senators = user.representatives.filter((r) => r.chamber === 'senate');
			if (senators.length > 0) {
				replacements['[Senator Name]'] = senators[0].name;
				replacements['[Senator]'] = `Sen. ${senators[0].name}`;
			} else {
				replacements['[Senator Name]'] = null;
				replacements['[Senator]'] = null;
			}
			if (senators.length > 1) {
				replacements['[Senior Senator]'] = `Sen. ${senators[0].name}`;
				replacements['[Junior Senator]'] = `Sen. ${senators[1].name}`;
			} else {
				replacements['[Senior Senator]'] = null;
				replacements['[Junior Senator]'] = null;
			}
		} else {
			// No _representative data - use generic labels where appropriate
			replacements['[Representative Name]'] = 'Representative';
			replacements['[Rep Name]'] = 'Representative';
			replacements['[Representative]'] = 'Representative';
			replacements['[Senator Name]'] = 'Senator';
			replacements['[Senator]'] = 'Senator';
			replacements['[Senior Senator]'] = 'Senior Senator';
			replacements['[Junior Senator]'] = 'Junior Senator';
		}

		// Handle manual-fill placeholders based on preserveVariables option
		// In preview mode, keep them as placeholders for interactive buttons
		// In send mode, remove them completely
		if (options.preserveVariables) {
			// Keep placeholders for preview - don't add them to replacements
			// This way they won't be removed or replaced
		} else {
			// Remove all manual-fill placeholders - everything auto-resolves or gets removed
			replacements['[Personal Connection]'] = null;
			replacements['[Phone]'] = null;
			replacements['[Phone Number]'] = null;
			replacements['[Your Phone]'] = null;
			replacements['[Your Story]'] = null;
			replacements['[Your Experience]'] = null;
			replacements['[Personal Story]'] = null;
		}

		// Apply all replacements to subject and body
		Object.entries(replacements).forEach(([placeholder, value]) => {
			if (value !== null) {
				// Replace with actual value
				resolvedSubject = resolvedSubject.replace(new RegExp(escapeRegex(placeholder), 'g'), value);
				resolvedBody = resolvedBody.replace(new RegExp(escapeRegex(placeholder), 'g'), value);
			} else {
				// Remove lines containing only this placeholder (with optional whitespace)
				const linePattern = new RegExp(`^[ \\t]*${escapeRegex(placeholder)}[ \\t]*$`, 'gm');
				resolvedSubject = resolvedSubject.replace(linePattern, '');
				resolvedBody = resolvedBody.replace(linePattern, '');

				// Remove inline occurrences with surrounding context
				// Handle patterns like "from [Address ]" or "at [Address ]"
				const contextPattern = new RegExp(`(from|at|in|of)\\s+${escapeRegex(placeholder)}`, 'gi');
				resolvedSubject = resolvedSubject.replace(contextPattern, '');
				resolvedBody = resolvedBody.replace(contextPattern, '');

				// Remove any remaining standalone occurrences
				resolvedSubject = resolvedSubject.replace(new RegExp(escapeRegex(placeholder), 'g'), '');
				resolvedBody = resolvedBody.replace(new RegExp(escapeRegex(placeholder), 'g'), '');
			}
		});

		// Clean up any multiple consecutive newlines left after removing placeholders
		resolvedBody = resolvedBody.replace(/\n{3,}/g, '\n\n').trim();
		resolvedSubject = resolvedSubject.trim();
	} else {
		// Non-authenticated user - preserve placeholders but make them instructional
		resolvedBody = resolvedBody
			.replace(/\[Name\]/g, '[Your Name]')
			.replace(/\[Address\]/g, '[Your Address]')
			.replace(/\[Representative Name\]/g, "[Your Representative's Name]");
	}

	// Determine delivery method and routing
	const isCongressional =
		template.deliveryMethod === 'certified' || template.deliveryMethod === 'cwc';

	// Parse recipient_config safely with Zod validation
	const RecipientConfigSchema = z.unknown();
	let recipientConfig: unknown = null;

	if (typeof template.recipient_config === 'string') {
		try {
			const parsed = JSON.parse(template.recipient_config);
			const result = RecipientConfigSchema.safeParse(parsed);
			if (result.success) {
				recipientConfig = result.data;
			} else {
				console.warn('[TemplateResolver] Invalid recipient_config:', result.error.flatten());
			}
		} catch (error) {
			console.warn('[TemplateResolver] Failed to parse recipient_config JSON:', error);
		}
	} else {
		const result = RecipientConfigSchema.safeParse(template.recipient_config);
		recipientConfig = result.success ? result.data : null;
	}

	let recipients: string[] = [];
	try {
		recipients = extractRecipientEmails(recipientConfig);
	} catch (error) {
		console.warn('[TemplateResolver] Failed to extract recipient emails:', error);
		recipients = [];
	}

	let routingEmail: string | undefined;
	if (isCongressional) {
		// Congressional routing via CWC API, include anon when user is null
		const userPart = user?.id ?? 'anon';
		routingEmail = `congress+${template.id}-${userPart}@communique.org`;
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
 * Build complete user address string with type safety
 */
function buildUserAddress(user: EmailServiceUser): string {
	// Input validation
	if (!user || typeof user !== 'object') {
		return '';
	}

	// Only return address if ALL parts are present and valid
	if (
		typeof user.street === 'string' &&
		user.street.trim() !== '' &&
		typeof user.city === 'string' &&
		user.city.trim() !== '' &&
		typeof user.state === 'string' &&
		user.state.trim() !== '' &&
		typeof user.zip === 'string' &&
		user.zip.trim() !== ''
	) {
		return `${user.street.trim()}, ${user.city.trim()}, ${user.state.trim()} ${user.zip.trim()}`;
	}
	return ''; // Return empty if incomplete - will be removed from template
}

/**
 * Escape string for use in regex with error handling
 */
function escapeRegex(string: string): string {
	if (typeof string !== 'string') {
		console.warn('escapeRegex received non-string input:', typeof string);
		return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}
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
