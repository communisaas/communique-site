/**
 * UNIFIED EMAIL SERVICE
 * 
 * Single source of truth for all mailto generation and auth flow.
 * Eliminates redundant logic across 4+ components.
 */

import type { Template } from '$lib/types/template';
import { extractRecipientEmails } from '$lib/types/templateConfig';

export interface User {
	id: string;
	name?: string | null;
	street?: string | null;
	city?: string | null;
	state?: string | null;
	zip?: string | null;
}

export interface EmailFlowResult {
	requiresAuth: boolean;
	requiresAddress?: boolean;
	mailtoUrl?: string;
	nextAction: 'auth' | 'address' | 'email';
}

export function analyzeEmailFlow(template: Template, user: User | null): EmailFlowResult {
	// No user = auth required
	if (!user) {
		return {
			requiresAuth: true,
			nextAction: 'auth'
		};
	}

	const isCongressional = template.deliveryMethod === 'both';
	const hasCompleteAddress = user.street && user.city && user.state && user.zip;

	// Congressional template without address = address required
	if (isCongressional && !hasCompleteAddress) {
		return {
			requiresAuth: false,
			requiresAddress: true,
			nextAction: 'address'
		};
	}

	// Ready to send email
	const mailtoUrl = generateMailtoUrl(template, user);
	return {
		requiresAuth: false,
		requiresAddress: false,
		mailtoUrl,
		nextAction: 'email'
	};
}

export function generateMailtoUrl(template: Template, user: User | null): string {
    const subject = encodeURIComponent(template.title);
    // Use the full message body when available; fall back to preview
    const bodySource = (template as any).message_body || template.preview || '';
    const body = encodeURIComponent(fillTemplateVariables(bodySource, user));

	if (template.deliveryMethod === 'both') {
		// Congressional routing
		const routingEmail = `congress+${template.id}-${user?.id || 'anon'}@communique.org`;
		return `mailto:${routingEmail}?subject=${subject}&body=${body}`;
	} else {
		// Direct email
		const recipients = extractRecipientEmails(template.recipient_config).join(',');
		return `mailto:${recipients}?subject=${subject}&body=${body}`;
	}
}

function fillTemplateVariables(bodyText: string, user: User | null): string {
	if (!user) return bodyText;

	let filledBody = bodyText;

	// Replace [Name] with user's name
	if (user.name) {
		filledBody = filledBody.replace(/\[Name\]/g, user.name);
	}

	// Replace [Address] with user's address if available
	if (user.street && user.city && user.state && user.zip) {
		const userAddress = `${user.street}, ${user.city}, ${user.state} ${user.zip}`;
		filledBody = filledBody.replace(/\[Address\]/g, userAddress);
	} else {
		// Remove lines that contain only [Address]
		filledBody = filledBody.replace(/^[ \t]*\[Address\][ \t]*\r?\n/gm, '');
		// Remove remaining inline [Address]
		filledBody = filledBody.replace(/\[Address\]/g, '');
	}

	// For congressional templates, [Representative Name] gets filled server-side
	filledBody = filledBody.replace(/^[ \t]*\[Representative Name\][ \t]*\r?\n/gm, '');
	filledBody = filledBody.replace(/\[Representative Name\]/g, 'Representative');

	// Remove empty [Personal Connection] blocks and lines
	filledBody = filledBody.replace(/^[ \t]*\[Personal Connection\][ \t]*\r?\n/gm, '');
	filledBody = filledBody.replace(/\[Personal Connection\]/g, '');

	// Clean up any extra newlines
	filledBody = filledBody.replace(/\n{3,}/g, '\n\n').trim();

	return filledBody;
}

export function launchEmail(mailtoUrl: string): void {
	window.location.href = mailtoUrl;
}