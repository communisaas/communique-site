/**
 * Re-verification Prompt Service
 *
 * Determines when and how to prompt users to re-verify their address.
 *
 * This service provides UI-facing logic for the credential policy system,
 * generating appropriate prompts based on credential age and intended actions.
 *
 * Usage:
 * - Call getReverificationPrompt() before high-stakes actions
 * - Display the returned prompt in the UI when show === true
 * - Respect dismissable flag for user experience
 */

import {
	shouldPromptReverification,
	isCredentialValidForAction,
	getValidActionsForCredential,
	getDaysUntilExpiry,
	type CredentialAction,
	type SessionCredentialForPolicy,
	CREDENTIAL_TTL_DISPLAY,
	ACTION_DESCRIPTIONS
} from './credential-policy';

// ============================================================================
// Types
// ============================================================================

/**
 * Re-verification prompt configuration
 */
export interface ReverificationPrompt {
	/** Should the prompt be displayed? */
	show: boolean;
	/** Visual severity level */
	severity: 'info' | 'warning' | 'error';
	/** Prompt title */
	title: string;
	/** Detailed message for the user */
	message: string;
	/** Call-to-action button */
	action: {
		label: string;
		url: string;
	};
	/** Can the user dismiss this prompt? */
	dismissable: boolean;
	/** Unique key for dismissal tracking */
	dismissKey?: string;
}

/**
 * Context for determining the verification URL
 */
export interface VerificationContext {
	/** Current route/page */
	currentPath?: string;
	/** Template being viewed (if any) */
	templateId?: string;
	/** Template slug (if any) */
	templateSlug?: string;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Get the appropriate re-verification prompt for a user
 *
 * @param credential - User's session credential (null if not verified)
 * @param attemptedAction - The action the user is trying to perform
 * @param context - Additional context for URL generation
 * @returns Prompt configuration or null if no prompt needed
 */
export function getReverificationPrompt(
	credential: SessionCredentialForPolicy | null,
	attemptedAction?: CredentialAction,
	context?: VerificationContext
): ReverificationPrompt | null {
	// No credential at all - need initial verification
	if (!credential) {
		return {
			show: true,
			severity: 'error',
			title: 'Verification Required',
			message: 'You need to verify your address to access this feature.',
			action: {
				label: 'Verify Address',
				url: buildVerificationUrl(context, attemptedAction)
			},
			dismissable: false
		};
	}

	// Check if credential is valid for the attempted action
	if (attemptedAction) {
		const validation = isCredentialValidForAction(credential, attemptedAction);

		if (!validation.valid) {
			const daysOld = Math.floor(validation.age / (24 * 60 * 60 * 1000));

			return {
				show: true,
				severity: 'error',
				title: 'Re-verification Required',
				message:
					validation.message ||
					`Your verification is ${daysOld} days old. ${ACTION_DESCRIPTIONS[attemptedAction]} requires verification within ${CREDENTIAL_TTL_DISPLAY[attemptedAction]}.`,
				action: {
					label: 'Re-verify Address',
					url: buildVerificationUrl(context, attemptedAction)
				},
				dismissable: false
			};
		}
	}

	// Check if we should show a warning (approaching expiry)
	if (shouldPromptReverification(credential, attemptedAction)) {
		const daysOld = Math.floor(
			(Date.now() - new Date(credential.createdAt).getTime()) / (24 * 60 * 60 * 1000)
		);

		// Determine what's expiring soon
		const validActions = getValidActionsForCredential(credential);
		const expiringActions = (['official_petition', 'constituent_message'] as CredentialAction[])
			.filter((a) => !validActions.includes(a) || getDaysUntilExpiry(credential, a) <= 7);

		let warningMessage: string;

		if (expiringActions.length > 0) {
			const actionNames = expiringActions.map((a) => ACTION_DESCRIPTIONS[a]).join(' and ');
			warningMessage =
				`Your address verification is ${daysOld} days old. ` +
				`Access to ${actionNames} may be limited soon. ` +
				`Consider re-verifying to ensure uninterrupted access.`;
		} else {
			warningMessage =
				`Your address verification is ${daysOld} days old. ` +
				`Consider re-verifying to ensure uninterrupted access to all features.`;
		}

		return {
			show: true,
			severity: 'warning',
			title: 'Address Verification Expiring',
			message: warningMessage,
			action: {
				label: 'Re-verify Now',
				url: buildVerificationUrl(context)
			},
			dismissable: true,
			dismissKey: `reverify-prompt-${credential.userId}-${Math.floor(daysOld / 7)}`
		};
	}

	return null;
}

/**
 * Get a prompt specifically for blocking high-stakes actions
 *
 * Use this when a user tries to perform an action their credential doesn't support.
 *
 * @param credential - User's session credential
 * @param action - The blocked action
 * @param context - Verification URL context
 * @returns Blocking prompt configuration
 */
export function getBlockingPrompt(
	credential: SessionCredentialForPolicy | null,
	action: CredentialAction,
	context?: VerificationContext
): ReverificationPrompt {
	if (!credential) {
		return {
			show: true,
			severity: 'error',
			title: 'Verification Required',
			message: `You need to verify your address before ${ACTION_DESCRIPTIONS[action]}.`,
			action: {
				label: 'Verify Address',
				url: buildVerificationUrl(context, action)
			},
			dismissable: false
		};
	}

	const validation = isCredentialValidForAction(credential, action);
	const daysOld = Math.floor(validation.age / (24 * 60 * 60 * 1000));

	return {
		show: true,
		severity: 'error',
		title: 'Re-verification Required',
		message:
			`Your verification is ${daysOld} days old. ` +
			`${capitalizeFirst(ACTION_DESCRIPTIONS[action])} requires verification within ${CREDENTIAL_TTL_DISPLAY[action]}. ` +
			`This helps ensure you're still in the same district.`,
		action: {
			label: 'Re-verify Address',
			url: buildVerificationUrl(context, action)
		},
		dismissable: false
	};
}

/**
 * Get an informational prompt about credential expiration
 *
 * Use this for profile/settings pages to show credential status.
 *
 * @param credential - User's session credential
 * @returns Informational prompt or null
 */
export function getCredentialStatusPrompt(
	credential: SessionCredentialForPolicy | null
): ReverificationPrompt | null {
	if (!credential) {
		return {
			show: true,
			severity: 'info',
			title: 'Address Not Verified',
			message: 'Verify your address to participate in community discussions and contact your representatives.',
			action: {
				label: 'Verify Address',
				url: '/profile?tab=verification'
			},
			dismissable: true,
			dismissKey: 'credential-status-unverified'
		};
	}

	const validActions = getValidActionsForCredential(credential);
	const daysOld = Math.floor(
		(Date.now() - new Date(credential.createdAt).getTime()) / (24 * 60 * 60 * 1000)
	);

	// Check which high-value actions are still available
	const canMessage = validActions.includes('constituent_message');
	const canPetition = validActions.includes('official_petition');

	if (!canMessage && !canPetition) {
		return {
			show: true,
			severity: 'warning',
			title: 'Limited Access',
			message:
				`Your verification is ${daysOld} days old. ` +
				`Re-verify to restore access to contacting representatives and signing petitions.`,
			action: {
				label: 'Re-verify Address',
				url: '/profile?tab=verification'
			},
			dismissable: true,
			dismissKey: `credential-status-limited-${Math.floor(daysOld / 7)}`
		};
	}

	if (!canPetition) {
		const daysLeft = getDaysUntilExpiry(credential, 'constituent_message');

		return {
			show: true,
			severity: 'info',
			title: 'Petition Access Expired',
			message:
				`Your verification is ${daysOld} days old. ` +
				`You can still contact representatives for ${daysLeft} more days. ` +
				`Re-verify to restore access to official petitions.`,
			action: {
				label: 'Re-verify Address',
				url: '/profile?tab=verification'
			},
			dismissable: true,
			dismissKey: `credential-status-no-petition-${Math.floor(daysOld / 7)}`
		};
	}

	// All is well, but show expiring warning if applicable
	const daysLeftMessage = getDaysUntilExpiry(credential, 'official_petition');
	if (daysLeftMessage <= 3) {
		return {
			show: true,
			severity: 'info',
			title: 'Verification Expiring Soon',
			message:
				`Your petition access expires in ${daysLeftMessage} day${daysLeftMessage === 1 ? '' : 's'}. ` +
				`Re-verify to maintain full access.`,
			action: {
				label: 'Re-verify Address',
				url: '/profile?tab=verification'
			},
			dismissable: true,
			dismissKey: `credential-status-expiring-${daysLeftMessage}`
		};
	}

	return null;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Build a verification URL with context
 */
function buildVerificationUrl(context?: VerificationContext, action?: CredentialAction): string {
	const params = new URLSearchParams();

	if (action) {
		params.set('action', action);
	}

	if (context?.currentPath) {
		params.set('returnTo', context.currentPath);
	}

	if (context?.templateSlug) {
		params.set('template', context.templateSlug);
	}

	const queryString = params.toString();
	return queryString ? `/profile?tab=verification&${queryString}` : '/profile?tab=verification';
}

/**
 * Capitalize the first letter of a string
 */
function capitalizeFirst(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Actions sorted by TTL (shortest first)
 * Useful for UI that shows action tiers
 */
export const ACTIONS_BY_STRICTNESS: CredentialAction[] = [
	'official_petition',
	'constituent_message',
	'community_discussion',
	'view_content'
];

/**
 * Actions sorted by TTL (longest first)
 * Useful for progressive disclosure
 */
export const ACTIONS_BY_PERMISSIVENESS: CredentialAction[] = [
	'view_content',
	'community_discussion',
	'constituent_message',
	'official_petition'
];

/**
 * Check if a dismissal key should still be considered dismissed
 *
 * Keys are designed to expire/reset based on credential age milestones
 *
 * @param key - The dismiss key to check
 * @param dismissedKeys - Set of currently dismissed keys
 * @returns Whether the prompt should still be hidden
 */
export function isDismissed(key: string | undefined, dismissedKeys: Set<string>): boolean {
	if (!key) return false;
	return dismissedKeys.has(key);
}
