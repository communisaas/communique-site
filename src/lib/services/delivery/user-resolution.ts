/**
 * User Resolution Service
 * Resolves users by email via API
 */

import axios from 'axios';
import config from './config';

/**
 * Resolve user by email address
 * Checks both primary and secondary emails
 */
async function resolveUserByEmail(email: any) {
	try {
		const response = await axios.get(
			`${config.communique.apiUrl}/delivery-platform/user-by-email`,
			{
				params: { email },
				headers: {
					Authorization: `Bearer ${config.communique.apiKey}`,
					'Content-Type': 'application/json'
				},
				timeout: 10000
			}
		);

		return response.data;
	} catch (error: any) {
		console.error('Failed to resolve user by email:', error.message);
		return { user: null, emailType: null };
	}
}

/**
 * Fetch user by ID
 */
async function fetchUserById(userId: any) {
	try {
		const response = await axios.get(`${config.communique.apiUrl}/users/${userId}`, {
			headers: {
				Authorization: `Bearer ${config.communique.apiKey}`,
				'Content-Type': 'application/json'
			},
			timeout: 10000
		});

		return response.data.user;
	} catch (error: any) {
		console.error('Failed to fetch user by ID:', error.message);
		return null;
	}
}

/**
 * Fetch template by slug
 */
async function fetchTemplateBySlug(slug: any) {
	try {
		const response = await axios.get(`${config.communique.apiUrl}/delivery-platform/template`, {
			params: { slug },
			headers: {
				Authorization: `Bearer ${config.communique.apiKey}`,
				'Content-Type': 'application/json'
			},
			timeout: 10000
		});

		return response.data.template;
	} catch (error: any) {
		console.error('Failed to fetch template by slug:', error.message);
		return null;
	}
}

/**
 * Detect potential user from message content
 * Uses various heuristics to identify likely account owner
 */
async function detectPotentialUser(parsedMessage: any, templateSlug: any) {
	// Strategy 1: Check if template has an owner
	if (templateSlug) {
		const template = await fetchTemplateBySlug(templateSlug);
		if (template?.userId) {
			const templateOwner = await fetchUserById(template.userId);
			if (templateOwner) {
				console.log(`Detected template owner: ${templateOwner.id}`);
				return templateOwner;
			}
		}
	}

	// Strategy 2: Extract name from email and search
	const emailParts = parsedMessage.senderEmail?.split('@')[0];
	if (emailParts) {
		// Clean up common email patterns (john.doe, john_doe, johndoe)
		const nameParts = emailParts.replace(/[._-]/g, ' ').split(' ');

		// TODO: Implement fuzzy user search by name parts
		// This would require a new API endpoint
		console.log(`Could search for user with name parts: ${nameParts.join(' ')}`);
	}

	// Strategy 3: Check message signature for identifying info
	const userName = extractNameFromMessage(parsedMessage);
	if (userName) {
		// TODO: Implement user search by full name
		console.log(`Could search for user with name: ${userName}`);
	}

	return null;
}

/**
 * Extract potential name from message content
 * Looks for common signature patterns
 */
function extractNameFromMessage(parsedMessage: any) {
	const text = parsedMessage.text || '';

	// Look for common signature patterns
	const patterns = [
		/Sincerely,?\s+([A-Z][a-z]+ [A-Z][a-z]+)/,
		/Best,?\s+([A-Z][a-z]+ [A-Z][a-z]+)/,
		/Thanks,?\s+([A-Z][a-z]+ [A-Z][a-z]+)/,
		/Regards,?\s+([A-Z][a-z]+ [A-Z][a-z]+)/,
		/^([A-Z][a-z]+ [A-Z][a-z]+)$/m // Name on its own line
	];

	for (const pattern of patterns) {
		const match = text.match(pattern);
		if (match) {
			return match[1].trim();
		}
	}

	return null;
}

/**
 * Notify API of delivery result
 */
async function notifyDeliveryResult(templateId: any, userId: any, result: any) {
	try {
		await axios.post(
			`${config.communique.apiUrl}/delivery-platform/delivery-result`,
			{
				templateId,
				userId,
				deliveryMethod: 'certified',
				success: result.success,
				submissionId: result.submissionId,
				error: result.error,
				metadata: {
					timestamp: new Date().toISOString(),
					...result.metadata
				}
			},
			{
				headers: {
					Authorization: `Bearer ${config.communique.apiKey}`,
					'Content-Type': 'application/json'
				},
				timeout: 10000
			}
		);

		console.log('Delivery result notification sent successfully');
	} catch (error: any) {
		console.error('Failed to notify delivery result:', error.message);
	}
}

export {
	resolveUserByEmail,
	fetchUserById,
	fetchTemplateBySlug,
	detectPotentialUser,
	extractNameFromMessage,
	notifyDeliveryResult
};
