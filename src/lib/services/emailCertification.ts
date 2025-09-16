/**
 * Email Certification Integration
 *
 * Integrates email delivery with VOTER Protocol certification
 * Called after successful email launches to earn civic rewards
 */

import { browser } from '$app/environment';
import { certification, generateMessageHash } from './certification';
import type { Template } from '$lib/types/template';
import type { EmailServiceUser } from '$lib/types/user';

export interface EmailDeliveryContext {
	template: Template;
	user?: EmailServiceUser;
	mailtoUrl: string;
	recipients: string[];
	timestamp: number;
}

export interface CertificationResult {
	success: boolean;
	certificationHash?: string;
	rewardAmount?: number;
	error?: string;
}

/**
 * Certify email delivery with VOTER Protocol
 * Called after successful email launch
 */
export async function certifyEmailDelivery(
	context: EmailDeliveryContext
): Promise<CertificationResult> {
	// Only run in browser and if user is authenticated
	if (!browser || !context.user?.street) {
		return { success: false, error: 'User not authenticated' };
	}

	try {
		// Extract email details from mailto URL
		const emailDetails = parseMailtoUrl(context.mailtoUrl);

		// Generate message hash for deduplication
		const messageHash = generateMessageHash(
			emailDetails.to,
			emailDetails.subject || '',
			emailDetails.body || ''
		);

		// Create delivery receipt
		const deliveryReceipt = JSON.stringify({
			launchId: generateLaunchId(),
			timestamp: context.timestamp,
			recipients: context.recipients,
			templateId: context.template.id,
			userAgent: navigator.userAgent,
			referrer: document.referrer
		});

		// Determine action type based on template
		let actionType = 'direct_action';
		if (
			context.template.id?.includes('cwc') ||
			context.template.title?.toLowerCase().includes('congress')
		) {
			actionType = 'cwc_message';
		}

		// Submit to VOTER Protocol
		const result = await certification.certifyAction(context.user.street || '', {
			actionType: actionType as 'direct_email' | 'cwc_message',
			deliveryReceipt,
			recipientEmail: emailDetails.to,
			recipientName: context.recipients[0] || emailDetails.to,
			subject: emailDetails.subject,
			messageHash,
			timestamp: new Date(context.timestamp).toISOString(),
			metadata: {
				templateId: context.template.id,
				templateTitle: context.template.title,
				district: context.user.congressional_district,
				jurisdiction: context.user.state
			}
		});

		if (result.success) {
			console.log('[Email Certification] Success:', {
				hash: result.certificationHash,
				reward: result.rewardAmount
			});
		} else {
			console.warn('[Email Certification] Failed:', result.error);
		}

		return result;
	} catch (error) {
		console.error('[Email Certification] Error:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Certification failed'
		};
	}
}

/**
 * Parse mailto URL to extract email components
 */
function parseMailtoUrl(mailtoUrl: string): {
	to: string;
	subject?: string;
	body?: string;
} {
	try {
		const url = new URL(mailtoUrl);
		return {
			to: url.pathname,
			subject: url.searchParams.get('subject') || undefined,
			body: url.searchParams.get('body') || undefined
		};
	} catch {
		return { to: mailtoUrl.replace('mailto:', '') };
	}
}

/**
 * Generate unique launch ID for tracking
 */
function generateLaunchId(): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 8);
	return `${timestamp}-${random}`;
}

/**
 * Enhanced email launch with VOTER Protocol integration
 * Wrapper around existing launchEmail function
 */
export async function launchEmailWithCertification(
	mailtoUrl: string,
	context: Omit<EmailDeliveryContext, 'mailtoUrl' | 'timestamp'>
): Promise<{
	launch: any;
	certification?: CertificationResult;
}> {
	// Import the original launch function to avoid circular dependencies
	const { launchEmail } = await import('./emailService');

	// Launch email first
	const launch = launchEmail(mailtoUrl, {
		analytics: true,
		redirectDelay: 2000 // Give time for certification
	});

	// If launch successful, attempt certification
	let certification: CertificationResult | undefined;

	if (launch.success) {
		certification = await certifyEmailDelivery({
			...context,
			mailtoUrl,
			timestamp: Date.now()
		});

		// Show success notification if certification worked
		if (certification.success && certification.rewardAmount) {
			// TODO: Show toast notification about earned rewards
			console.log(`🎉 Earned ${certification.rewardAmount} VOTER tokens!`);
		}
	}

	return { launch, certification };
}
