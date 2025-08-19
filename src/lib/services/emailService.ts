/**
 * UNIFIED EMAIL SERVICE
 * 
 * Single source of truth for all mailto generation and auth flow.
 * Eliminates redundant logic across 4+ components.
 */

import type { Template } from '$lib/types/template';
import { extractRecipientEmails } from '$lib/types/templateConfig';
import { resolveTemplate } from '$lib/utils/templateResolver';

export interface User {
	id: string;
	name?: string | null;
	email?: string;  // Added for compatibility with resolveTemplate
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

	// Enforce address gating for congressional delivery
	const isCongressional = template.deliveryMethod === 'both';
	const hasCompleteAddress = Boolean(user.street && user.city && user.state && user.zip);
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
    const resolved = resolveTemplate(template, user);
    const subject = encodeURIComponent(resolved.subject);
    const body = encodeURIComponent(resolved.body);

	if (resolved.isCongressional && resolved.routingEmail) {
		return `mailto:${resolved.routingEmail}?subject=${subject}&body=${body}`;
	}

	const recipients = resolved.recipients.length > 0 ? resolved.recipients.join(',') : 'test@example.com';
	return `mailto:${recipients}?subject=${subject}&body=${body}`;
}

// Removed fillTemplateVariables - now using resolveTemplate from templateResolver.ts
// which properly handles all variable substitution with user data

export function launchEmail(mailtoUrl: string, redirectUrl?: string): void {
	// Create a temporary anchor element and simulate a click
	// This reliably opens the mail app without redirecting the page
	const mailLink = document.createElement('a');
	mailLink.href = mailtoUrl;
	mailLink.click();
	
	// If a redirect URL is provided, navigate to it after a short delay
	// to allow the mail app to open first
	if (redirectUrl) {
		setTimeout(() => {
			window.location.href = redirectUrl;
		}, 500);
	}
}