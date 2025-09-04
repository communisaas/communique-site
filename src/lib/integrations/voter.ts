/**
 * VOTER Protocol Integration Helper
 * 
 * Provides easy integration with VOTER Protocol for existing Communiqué flows
 * without modifying core services
 */

import { browser } from '$app/environment';
import { certification } from '$lib/services/certification';
import { generateMessageHash } from '$lib/services/certification';
import type { Template } from '$lib/types/template';
import type { EmailServiceUser } from '$lib/types/user';

export interface VOTERIntegrationConfig {
	enabled: boolean;
	showNotifications: boolean;
	trackRewards: boolean;
}

// Default configuration
const DEFAULT_CONFIG: VOTERIntegrationConfig = {
	enabled: true, // Will check env vars
	showNotifications: true,
	trackRewards: true
};

class VOTERIntegration {
	private config: VOTERIntegrationConfig;

	constructor(config: Partial<VOTERIntegrationConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * Certify email delivery after successful launch
	 */
	async certifyEmailDelivery(params: {
		user?: EmailServiceUser;
		template: Template;
		mailtoUrl: string;
		recipients: string[];
	}): Promise<void> {
		if (!this.config.enabled || !browser || !params.user?.address) {
			return;
		}

		try {
			const emailDetails = this.parseMailtoUrl(params.mailtoUrl);
			const messageHash = generateMessageHash(
				emailDetails.to,
				emailDetails.subject || '',
				emailDetails.body || ''
			);

			const deliveryReceipt = JSON.stringify({
				launchId: this.generateLaunchId(),
				timestamp: Date.now(),
				recipients: params.recipients,
				templateId: params.template.id,
				userAgent: navigator?.userAgent || 'unknown'
			});

			// Determine action type
			const actionType = this.getActionType(params.template);

			// Submit certification
			const result = await certification.certifyAction(
				params.user.address,
				{
					actionType: actionType as any,
					deliveryReceipt,
					recipientEmail: emailDetails.to,
					recipientName: params.recipients[0] || emailDetails.to,
					subject: emailDetails.subject,
					messageHash,
					timestamp: new Date().toISOString(),
					metadata: {
						templateId: params.template.id,
						templateTitle: params.template.title,
						district: params.user.location?.district
					}
				}
			);

			if (result.success && this.config.showNotifications) {
				this.showRewardNotification(result.rewardAmount || 0);
			}

		} catch (error) {
			console.warn('[VOTER Integration] Certification failed:', error);
			// Don't throw - certification failure shouldn't break email flow
		}
	}

	/**
	 * Get action type based on template
	 */
	private getActionType(template: Template): string {
		// Check template properties to determine action type
		const title = template.title?.toLowerCase() || '';
		const id = template.id?.toLowerCase() || '';
		
		if (title.includes('congress') || title.includes('representative') || 
			title.includes('senator') || id.includes('cwc')) {
			return 'cwc_message';
		}
		
		if (title.includes('local') || title.includes('mayor') || 
			title.includes('council') || title.includes('city')) {
			return 'direct_action';
		}
		
		return 'direct_action'; // Default
	}

	/**
	 * Parse mailto URL
	 */
	private parseMailtoUrl(mailtoUrl: string): {
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
	 * Generate launch ID
	 */
	private generateLaunchId(): string {
		const timestamp = Date.now();
		const random = Math.random().toString(36).substring(2, 8);
		return `${timestamp}-${random}`;
	}

	/**
	 * Show reward notification
	 */
	private showRewardNotification(amount: number): void {
		if (amount <= 0) return;

		// Simple console log for now - can be enhanced with toast later
		console.log(`🎉 Earned ${amount / 10**18} VOTER tokens for civic engagement!`);
		
		// TODO: Integrate with Communiqué's toast system
		// toast.success(`Earned ${amount / 10**18} VOTER tokens!`);
	}
}

// Export singleton instance
export const voterIntegration = new VOTERIntegration();

/**
 * Utility function to easily integrate VOTER certification into existing email flows
 */
export async function withVOTERCertification<T extends {
	user?: EmailServiceUser;
	template: Template;
	mailtoUrl: string;
	recipients: string[];
}>(
	emailLaunchFn: () => any,
	context: T
): Promise<any> {
	// Launch email first
	const result = emailLaunchFn();
	
	// If successful, certify in background
	if (result?.success) {
		// Don't await - run in background
		voterIntegration.certifyEmailDelivery(context).catch(console.warn);
	}
	
	return result;
}