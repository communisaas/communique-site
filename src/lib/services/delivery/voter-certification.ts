/**
 * VOTER Protocol Certification Handler
 *
 * Handles certification of civic actions through VOTER Protocol
 * after successful email delivery to congressional offices.
 *
 * This runs server-side only, keeping API keys secure.
 */

import { getConfig } from './utils/config';

// Type for template data to prevent toLowerCase errors
interface TemplateData {
	title?: string;
	id?: string;
	deliveryMethod?: string;
	message_body?: string;
	subject?: string;
	slug?: string;
	[key: string]: unknown;
}

// Type for user profile
interface UserProfile {
	street?: string;
	zip?: string;
	address?: string;
	city?: string;
	state?: string;
	[key: string]: unknown;
}

// Type for CWC result
interface CwcResult {
	submissionId?: string;
	success?: boolean;
	trackingNumber?: string;
	[key: string]: unknown;
}

/**
 * Get action type based on template properties
 * Mirrors logic from main app for consistency
 */
function getVOTERActionType(templateData: TemplateData) {
	const title = typeof templateData.title === 'string' ? templateData.title.toLowerCase() : '';
	const id = typeof templateData.id === 'string' ? templateData.id.toLowerCase() : '';
	const method = typeof templateData.deliveryMethod === 'string' ? templateData.deliveryMethod.toLowerCase() : '';

	// Congressional messages
	if (
		method === 'certified' ||
		title.includes('congress') ||
		title.includes('representative') ||
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

/**
 * Generate message hash for certification
 */
function generateMessageHash(recipient: unknown, subject: unknown, body: unknown) {
	const content = `${String(recipient)}:${String(subject)}:${String(body)}`;
	// Simple hash for now - in production use crypto
	let hash = 0;
	for (let i = 0; i < content.length; i++) {
		const char = content.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Certify email delivery through VOTER Protocol
 * Called after successful CWC submission
 */
async function certifyEmailDelivery(params: {
	userProfile: UserProfile;
	templateData: TemplateData;
	cwcResult: CwcResult;
	recipients?: string[];
	[key: string]: unknown;
}) {
	const { userProfile, templateData, cwcResult, recipients = [] } = params;
	const config = getConfig();

	// Skip if certification is disabled
	if (!config.features.enableVoterCertification) {
		console.log('[VOTER] Certification disabled');
		return null;
	}

	// Skip if no user address (required for VOTER)
	if (!userProfile.street || !userProfile.zip) {
		console.log('[VOTER] Skipping certification - incomplete address');
		return null;
	}

	try {
		const actionType = getVOTERActionType(templateData);
		const messageHash = generateMessageHash(
			recipients[0] || 'congress@communi.email',
			templateData.subject || templateData.title || '',
			templateData.message_body || ''
		);

		const certificationData = {
			action_type: actionType,
			delivery_receipt: JSON.stringify({
				cwc_submission_id: cwcResult.submissionId,
				timestamp: Date.now(),
				recipients: recipients,
				template_id: templateData.id,
				success: cwcResult.success
			}),
			message_hash: messageHash,
			timestamp: new Date().toISOString(),
			metadata: {
				recipient_email: recipients[0] || 'congress@communi.email',
				recipient_name: 'Congressional Office',
				subject: templateData.subject || templateData.title,
				template_id: templateData.id,
				template_slug: templateData.slug,
				cwc_tracking: cwcResult.trackingNumber
			}
		};

		// Call VOTER Protocol API through Communiqué proxy
		const response = await fetch(`${config.api.communiqueUrl}/api/voter-proxy/certify`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Mail-Server-Key': config.api.mailServerKey || ''
			},
			body: JSON.stringify({
				userAddress:
					userProfile.address ||
					`${userProfile.street}, ${userProfile.city}, ${userProfile.state} ${userProfile.zip}`,
				...certificationData
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('[VOTER] Certification failed:', errorText);
			return null;
		}

		const result = await response.json();
		console.log('[VOTER] Certification successful:', {
			hash: result.certificationHash,
			reward: result.rewardAmount,
			reputation: result.reputationChange
		});

		return result;
	} catch (error: any) {
		console.error('[VOTER] Certification error:', error);
		// Don't throw - certification failure shouldn't break delivery
		return null;
	}
}

export { certifyEmailDelivery, getVOTERActionType, generateMessageHash };
