/**
 * UNIFIED EMAIL SERVICE - Enhanced Consolidation
 *
 * Single source of truth for email flow management, template resolution,
 * and mailto generation. Eliminates redundant logic across 4+ components
 * while providing comprehensive error handling and flow analytics.
 *
 * Key Features:
 * - Unified email flow analysis (auth → address → email)
 * - Template-aware mailto URL generation
 * - Congressional routing for verified delivery
 * - Comprehensive error handling and validation
 * - Flow analytics and conversion tracking
 */

import type { Template } from '$lib/types/template';
import type { EmailServiceUser } from '$lib/types/user';
import { extractRecipientEmails as _extractRecipientEmails } from '$lib/types/templateConfig';
import { resolveTemplate } from '$lib/utils/templateResolver';
// VOTER certification now handled by mail server - removed client-side integration

// Re-export the unified User interface for backward compatibility
export type { EmailServiceUser as User } from '$lib/types/user';

/**
 * Email Flow Analysis Result
 *
 * Represents the outcome of analyzing a user's eligibility
 * to send an email using a specific template.
 */
export interface EmailFlowResult {
	/** Whether user authentication is required */
	requiresAuth: boolean;

	/** Whether address collection is required (for congressional routing) */
	requiresAddress?: boolean;

	/** Generated mailto URL if ready to send */
	mailtoUrl?: string;

	/** Next required action in the flow */
	nextAction: 'auth' | 'address' | 'email';

	/** Error details if flow analysis failed */
	error?: {
		code: string;
		message: string;
		details?: unknown;
	};

	/** Analytics metadata for flow tracking */
	analytics?: {
		flowId: string;
		step: string;
		timestamp: number;
		templatePath: string;
	};
}

/**
 * Email Launch Result
 *
 * Represents the outcome of attempting to launch an email client.
 */
export interface EmailLaunchResult {
	/** Whether the launch was successful */
	success: boolean;

	/** Error details if launch failed */
	error?: {
		code: string;
		message: string;
		details?: unknown;
	};

	/** Mailto URL that was launched */
	mailtoUrl?: string;

	/** Analytics metadata */
	analytics?: {
		launchId: string;
		timestamp: number;
		userAgent: string;
	};
}

/**
 * Analyze Email Flow Requirements
 *
 * Determines what steps are needed before a user can send an email
 * using the specified template. Handles authentication, address collection,
 * and template compatibility requirements.
 *
 * @param template - The email template to analyze
 * @param user - Current user context (null for guest users)
 * @returns EmailFlowResult indicating next required action
 *
 * @example
 * ```typescript
 * const flow = analyzeEmailFlow(template, user);
 * if (flow.nextAction === 'auth') {
 *   // Redirect to authentication
 * } else if (flow.nextAction === 'address') {
 *   // Collect user address
 * } else if (flow.nextAction === 'email') {
 *   // Launch email client with flow.mailtoUrl
 * }
 * ```
 */
export function analyzeEmailFlow(
	template: Template,
	user: EmailServiceUser | null
): EmailFlowResult {
	try {
		// Generate analytics metadata
		const analytics = {
			flowId: generateFlowId(),
			step: 'analyze',
			timestamp: Date.now(),
			templatePath: `${template.slug || template.id}`
		};

		// Validate template
		if (!template || !template.id) {
			return {
				requiresAuth: false,
				nextAction: 'email' as const,
				error: {
					code: 'INVALID_TEMPLATE',
					message: 'Template is missing or invalid',
					details: { templateId: template?.id }
				},
				analytics
			};
		}

		// No user = auth required
		if (!user) {
			return {
				requiresAuth: true,
				nextAction: 'auth',
				analytics: { ...analytics, step: 'require_auth' }
			};
		}

		// Enforce address gating for congressional delivery
		const isCongressional = template.deliveryMethod === 'cwc';
		const hasCompleteAddress = Boolean(user.street && user.city && user.state && user.zip);

		if (isCongressional && !hasCompleteAddress) {
			return {
				requiresAuth: false,
				requiresAddress: true,
				nextAction: 'address',
				analytics: { ...analytics, step: 'require_address' }
			};
		}

		// Ready to send email
		const mailtoResult = generateMailtoUrl(template, user);
		if (mailtoResult.error) {
			return {
				requiresAuth: false,
				nextAction: 'email',
				error: mailtoResult.error,
				analytics: { ...analytics, step: 'mailto_generation_failed' }
			};
		}

		return {
			requiresAuth: false,
			requiresAddress: false,
			mailtoUrl: mailtoResult.url!,
			nextAction: 'email',
			analytics: { ...analytics, step: 'ready_to_send' }
		};
	} catch (error) {
		return {
			requiresAuth: false,
			nextAction: 'email',
			error: {
				code: 'FLOW_ANALYSIS_ERROR',
				message: 'Unknown error analyzing email flow',
				details: { originalError: 'Unknown error' }
			}
		};
	}
}

/**
 * Mailto URL Generation Result
 */
interface MailtoUrlResult {
	url?: string;
	error?: {
		code: string;
		message: string;
		details?: unknown;
	};
}

/**
 * Generate Mailto URL for Template
 *
 * Creates a properly formatted mailto URL with resolved template content.
 * Handles both congressional routing and direct recipient delivery.
 *
 * @param template - The email template to generate URL for
 * @param user - User context for template personalization
 * @returns MailtoUrlResult with URL or error details
 *
 * @example
 * ```typescript
 * const result = generateMailtoUrl(template, user);
 * if (result.error) {
 *   console.error('Failed to generate mailto:', result.error.message);
 * } else {
 *   window.location.href = result.url;
 * }
 * ```
 */
export function generateMailtoUrl(
	template: Template,
	user: EmailServiceUser | null
): MailtoUrlResult {
	try {
		// Resolve template with user context
		const resolved = resolveTemplate(template, user);

		// Validate resolved content
		if (!resolved.subject && !resolved.body) {
			return {
				error: {
					code: 'EMPTY_TEMPLATE',
					message: 'Template resolved to empty subject and body',
					details: { templateId: template.id }
				}
			};
		}

		// URL encode components safely
		const subject = encodeURIComponent(resolved.subject || '');
		const body = encodeURIComponent(resolved.body || '');

		// Congressional routing takes precedence
		if (resolved.isCongressional && resolved.routingEmail) {
			// For certified delivery, include template slug in subject for mail server parsing
			const enhancedSubject = template.slug
				? `[${template.slug}] ${resolved.subject || template.title || ''}`
				: resolved.subject || template.title || '';

			const encodedSubject = encodeURIComponent(enhancedSubject);

			// Add metadata footer to help mail server identify template
			const enhancedBody =
				resolved.body +
				'\n\n---\n' +
				`[Template: ${template.slug || template.id}]\n` +
				`[From: ${user?.email || 'Guest'}]`;

			const encodedBody = encodeURIComponent(enhancedBody);

			// Use congress@communi.email for certified delivery
			const recipientEmail = 'congress@communi.email';
			const url = `mailto:${recipientEmail}?subject=${encodedSubject}&body=${encodedBody}`;

			// Validate URL length (mailto URLs have practical limits)
			if (url.length > 8000) {
				return {
					error: {
						code: 'URL_TOO_LONG',
						message: 'Generated mailto URL exceeds maximum length',
						details: { urlLength: url.length }
					}
				};
			}

			return { url };
		}

		// Direct recipient delivery
		const recipients =
			resolved.recipients.length > 0 ? resolved.recipients.join(',') : 'test@example.com'; // Fallback for development

		const url = `mailto:${recipients}?subject=${subject}&body=${body}`;

		// Validate URL length
		if (url.length > 8000) {
			return {
				error: {
					code: 'URL_TOO_LONG',
					message: 'Generated mailto URL exceeds maximum length',
					details: { urlLength: url.length }
				}
			};
		}

		return { url };
	} catch (error) {
		return {
			error: {
				code: 'MAILTO_GENERATION_ERROR',
				message: error instanceof Error ? error.message : 'Unknown error generating mailto URL',
				details: { originalError: error instanceof Error ? error.message : 'Unknown error' }
			}
		};
	}
}

// =============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// =============================================================================

/**
 * @deprecated Use generateMailtoUrl instead. Will be removed in next major version.
 */
export function buildMailtoUrl(template: Template, user: EmailServiceUser | null): string {
	console.warn('buildMailtoUrl is deprecated. Use generateMailtoUrl instead.');
	const result = generateMailtoUrl(template, user);
	return result.url || '';
}

/**
 * @deprecated Template resolution is now handled internally. Will be removed in next major version.
 */
export function fillTemplateVariables(
	template: Template,
	_user: EmailServiceUser | null
): Template {
	console.warn('fillTemplateVariables is deprecated. Template resolution is handled internally.');
	return template; // Return unchanged for backward compatibility
}

// =============================================================================
// ADVANCED EMAIL FLOW FUNCTIONS
// =============================================================================

/**
 * Validate Email Flow Compatibility
 *
 * Performs comprehensive validation of template and user compatibility
 * before attempting email flow analysis.
 *
 * @param template - Template to validate
 * @param user - User context to validate
 * @returns Validation result with detailed error information
 */
export function validateEmailFlow(
	template: Template,
	user: EmailServiceUser | null
): { isValid: boolean; errors: Array<{ code: string; message: string; field?: string }> } {
	const errors: Array<{ code: string; message: string; field?: string }> = [];

	// Template validation
	const templateValidation = validateTemplate(template);
	if (!templateValidation.isValid) {
		templateValidation.errors.forEach((_error) => {
			errors.push({
				code: 'INVALID_TEMPLATE',
				message: _error,
				field: 'template'
			});
		});
	}

	// User validation for congressional templates
	if (template.deliveryMethod === 'cwc' && user) {
		if (!user.street)
			errors.push({
				code: 'MISSING_STREET',
				message: 'Street address required for congressional delivery',
				field: 'user.street'
			});
		if (!user.city)
			errors.push({
				code: 'MISSING_CITY',
				message: 'City required for congressional delivery',
				field: 'user.city'
			});
		if (!user.state)
			errors.push({
				code: 'MISSING_STATE',
				message: 'State required for congressional delivery',
				field: 'user.state'
			});
		if (!user.zip)
			errors.push({
				code: 'MISSING_ZIP',
				message: 'ZIP code required for congressional delivery',
				field: 'user.zip'
			});
	}

	return {
		isValid: errors.length === 0,
		errors
	};
}

/**
 * Get Email Flow Analytics
 *
 * Provides detailed analytics about the current email flow state.
 * Useful for debugging and conversion optimization.
 */
export function getEmailFlowAnalytics(
	template: Template,
	user: EmailServiceUser | null
): {
	flowStage: string;
	blockers: string[];
	metadata: Record<string, unknown>;
} {
	const blockers: string[] = [];
	let flowStage = 'unknown';

	if (!user) {
		flowStage = 'authentication_required';
		blockers.push('user_not_authenticated');
	} else if (
		template.deliveryMethod === 'cwc' &&
		!(user.street && user.city && user.state && user.zip)
	) {
		flowStage = 'address_collection_required';
		blockers.push('incomplete_address');
	} else {
		flowStage = 'ready_to_send';
	}

	const validation = validateEmailFlow(template, user);
	if (!validation.isValid) {
		blockers.push(...validation.errors.map((e) => e.code));
	}

	return {
		flowStage,
		blockers,
		metadata: {
			templateId: template.id,
			deliveryMethod: template.deliveryMethod,
			userHasAddress: user ? Boolean(user.street && user.city && user.state && user.zip) : false,
			userIsAuthenticated: Boolean(user),
			timestamp: Date.now()
		}
	};
}

/**
 * Launch Email Client
 *
 * Reliably opens the user's default email client with the provided mailto URL.
 * Includes error handling, analytics tracking, and optional page redirection.
 *
 * @param mailtoUrl - The mailto URL to launch
 * @param options - Launch configuration options
 * @returns EmailLaunchResult indicating success or failure
 *
 * @example
 * ```typescript
 * const result = launchEmail(mailtoUrl, {
 *   redirectUrl: '/success',
 *   redirectDelay: 1000
 * });
 *
 * if (!result.success) {
 *   console.error('Email launch failed:', result.error?.message);
 * }
 * ```
 */
export function launchEmail(
	mailtoUrl: string,
	options?: {
		redirectUrl?: string;
		redirectDelay?: number;
		analytics?: boolean;
	}
): EmailLaunchResult {
	try {
		// Validate inputs
		if (!mailtoUrl || !mailtoUrl.startsWith('mailto:')) {
			return {
				success: false,
				error: {
					code: 'INVALID_MAILTO_URL',
					message: 'Invalid or missing mailto URL',
					details: { providedUrl: mailtoUrl }
				}
			};
		}

		// Generate analytics metadata if enabled
		const analytics =
			options?.analytics !== false
				? {
						launchId: generateLaunchId(),
						timestamp: Date.now(),
						userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
					}
				: undefined;

		// Create temporary anchor element for reliable email client launch
		// This method works consistently across all browsers and platforms
		const mailLink = document.createElement('a');
		mailLink.href = mailtoUrl;
		mailLink.style.display = 'none';

		// Add to DOM temporarily (required for some browsers)
		document.body.appendChild(mailLink);
		mailLink.click();

		// Clean up
		setTimeout(() => {
			try {
				document.body.removeChild(mailLink);
			} catch (error) {
				// Ignore cleanup errors
			}
		}, 100);

		// Handle optional page redirection
		if (options?.redirectUrl) {
			const delay = options.redirectDelay ?? 500;
			setTimeout(() => {
				try {
					window.location.href = options.redirectUrl!;
				} catch (error) {
					console.warn('Failed to redirect after email launch:', error);
				}
			}, delay);
		}

		// VOTER Protocol certification now handled by mail server after email is sent
		// This ensures certification only happens for actually delivered messages

		return {
			success: true,
			mailtoUrl,
			analytics
		};
	} catch (error) {
		return {
			success: false,
			error: {
				code: 'EMAIL_LAUNCH_ERROR',
				message: error instanceof Error ? error.message : 'Unknown error',
				details: { originalError: error }
			}
		};
	}
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Generate unique flow ID for analytics tracking
 */
function generateFlowId(): string {
	return `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate unique launch ID for analytics tracking
 */
function generateLaunchId(): string {
	return `launch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate email address format
 */
function _isValidEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}

/**
 * Validate template has required fields
 */
function validateTemplate(template: Template): { isValid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (!template.id) {
		errors.push('Template missing required id field');
	}

	if (!template.title && !template.title) {
		errors.push('Template missing both title and subject');
	}

	if (!template.preview && !template.message_body) {
		errors.push('Template missing both preview and message_body');
	}

	return {
		isValid: errors.length === 0,
		errors
	};
}
