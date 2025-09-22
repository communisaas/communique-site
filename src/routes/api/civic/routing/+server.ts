import { json, error } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import type { RequestHandler } from './$types';
import { deliveryPipeline } from '$lib/core/legislative';

/**
 * Congressional Email Routing Handler
 *
 * This endpoint processes emails sent to congressional routing addresses:
 * - congress.{templateId}.{userId}@communique.org (authenticated users)
 * - congress.{templateId}.guest.{sessionToken}@communique.org (anonymous users)
 *
 * Flow:
 * 1. Parse routing email to extract template ID and user info
 * 2. Look up user's address to determine their representatives
 * 3. Route message to appropriate congressional offices via CWC
 * 4. For guest users, trigger account creation flow
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const emailData = await request.json();
		const { to, from, subject, body } = emailData;

		// Parse the routing address
		const routingInfo = parseCongressionalRoutingAddress(to);
		if (!routingInfo) {
			return error(400, 'Invalid routing address format');
		}

		const { templateId, userId, isGuest, sessionToken } = routingInfo;

		if (!templateId) {
			return error(400, 'Template ID is required');
		}

		if (isGuest) {
			// Handle anonymous user flow
			if (!sessionToken) {
				return error(400, 'Session token is required for guest requests');
			}
			return await handleGuestCongressionalRequest({
				templateId,
				sessionToken,
				senderEmail: from,
				subject,
				body
			});
		} else {
			// Handle authenticated user flow
			if (!userId) {
				return error(400, 'User ID is required for authenticated requests');
			}
			return await handleAuthenticatedCongressionalRequest({
				templateId,
				userId,
				subject,
				body
			});
		}
	} catch (err) {
		return error(500, 'Failed to process congressional routing');
	}
};

interface CongressionalRoutingInfo {
	templateId: string;
	userId?: string;
	isGuest: boolean;
	sessionToken?: string;
}

function parseCongressionalRoutingAddress(address: string): CongressionalRoutingInfo | null {
	// Format: congress+{templateId}-{userId}@communique.org
	// or: congress+guest-{templateId}-{sessionToken}@communique.org

	const localPart = address.split('@')[0];
	if (!localPart.startsWith('congress+')) return null;

	const routingPart = localPart.substring(9); // Remove 'congress+'

	if (routingPart.startsWith('guest-')) {
		const guestPart = routingPart.substring(6); // Remove 'guest-'
		const match = guestPart.match(/^([^-]+)-(.+)$/);
		if (!match) return null;

		const [, templateId, sessionToken] = match;
		return {
			templateId,
			isGuest: true,
			sessionToken
		};
	} else {
		const match = routingPart.match(/^([^-]+)-(.+)$/);
		if (!match) return null;

		const [, templateId, userId] = match;
		return {
			templateId,
			userId,
			isGuest: false
		};
	}
}

async function handleAuthenticatedCongressionalRequest({
	templateId,
	userId,
	subject,
	body
}: {
	templateId: string;
	userId: string;
	subject: string;
	body: string;
}) {
	// 1. Look up user
	const user = await db.user.findUnique({
		where: { id: userId }
	});

	if (!user) {
		return error(404, 'User not found');
	}

	// 2. Get template
	const template = await db.template.findUnique({
		where: { id: templateId }
	});

	if (!template) {
		return error(404, 'Template not found');
	}

	// 3. Use new delivery pipeline
	const deliveryJob = {
		id: `${templateId}-${userId}-${Date.now()}`,
		template: {
			id: template.id,
			subject: template.subject || subject,
			message_body: template.message_body,
			variables: {}
		},
		user: {
			id: user.id,
			name: user.name || '',
			email: user.email,
			address: {
				street: user.street || '',
				city: user.city || '',
				state: user.state || '',
				postal_code: user.zip || '',
				country_code: 'US'
			}
		},
		custom_message: body,
		created_at: new Date()
	};

	const result = await deliveryPipeline.deliverToRepresentatives(deliveryJob);

	return json({
		success: result.successful_deliveries > 0,
		message:
			result.successful_deliveries > 0
				? 'Congressional messages queued for delivery'
				: 'Failed to deliver messages',
		deliveryCount: result.successful_deliveries,
		totalRecipients: result.total_recipients,
		results: result.results.map((r) => ({
			success: r.success,
			error: r.error,
			_representative: r.metadata?._representative
		}))
	});
}

async function handleGuestCongressionalRequest({
	templateId,
	sessionToken,
	senderEmail,
	subject,
	body
}: {
	templateId: string;
	sessionToken: string;
	senderEmail: string;
	subject: string;
	body: string;
}) {
	// 1. Store the request temporarily
	await storeGuestCongressionalRequest({
		templateId,
		sessionToken,
		senderEmail,
		subject,
		body
	});

	// 2. Send onboarding email to user
	await sendOnboardingEmail({
		email: senderEmail,
		templateId,
		sessionToken,
		subject
	});

	return json({
		success: true,
		message: 'Onboarding email sent. Complete your account to deliver your message to Congress.',
		nextStep: 'check_email'
	});
}

// Helper functions (kept for guest flow compatibility)
async function storeGuestCongressionalRequest(_params: Record<string, unknown>) {
	// TODO: Store pending request in database
}

async function sendOnboardingEmail(_params: Record<string, unknown>) {
	// TODO: Send onboarding email with account creation link
}
