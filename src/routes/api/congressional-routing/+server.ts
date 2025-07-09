import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';
import { resolveVariables } from '$lib/services/personalization';

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

		if (isGuest) {
			// Handle anonymous user flow
			return await handleGuestCongressionalRequest({
				templateId,
				sessionToken,
				senderEmail: from,
				subject,
				body
			});
		} else {
			// Handle authenticated user flow
			return await handleAuthenticatedCongressionalRequest({
				templateId,
				userId,
				subject,
				body
			});
		}

	} catch (err) {
		console.error('Congressional routing error:', err);
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
	// 1. Look up user and their address
	const user = await db.user.findUnique({
		where: { id: userId },
		include: {
			representatives: {
				include: {
					representative: true
				}
			}
		}
	});

	if (!user) {
		return error(404, 'User not found');
	}

	// 2. Get user's representatives (if not cached, look them up)
	let representatives = user.representatives.map((r) => r.representative);
	if (!representatives.length && user.zip) {
		// Look up representatives based on user's address
		// This is a placeholder, as lookupRepresentativesByAddress is not fully implemented
		representatives = await lookupRepresentativesByAddress({
			street: user.street || '',
			city: user.city || '',
			state: user.state || '',
			zip: user.zip
		});
	}

	// 3. Route to representatives via CWC
	const deliveryResults = await routeToRepresentatives({
		templateId,
		user,
		representatives,
		subject,
		body
	});

	return json({
		success: true,
		message: 'Congressional messages queued for delivery',
		deliveryCount: deliveryResults.length
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

// Helper functions (to be implemented)
async function lookupRepresentativesByAddress(address: any) {
	// TODO: Implement address-to-representative lookup
	return [];
}

async function routeToRepresentatives({
	templateId,
	user,
	representatives,
	subject,
	body
}: {
	templateId: string;
	user: any;
	representatives: any[];
	subject: string;
	body: string;
}) {
	const deliveryResults = [];

	// Fetch the original template to ensure variables are present
	const template = await db.template.findUnique({
		where: { id: templateId },
		select: { body: true }
	});

	if (!template) {
		console.error(`Template with ID ${templateId} not found.`);
		// Continue with the user-provided body as a fallback
	}

	// Use the database template body for variable resolution, but preserve user's custom message.
	// We assume the user's custom message replaces the '[Personal Connection]' variable.
	const bodyForResolution = template
		? template.body.replace(/\[Personal Connection\]/g, body)
		: body;

	for (const rep of representatives) {
		const personalizedBody = resolveVariables(bodyForResolution, user, rep);

		// TODO: Replace with actual CWC submission logic
		console.log(`Routing to ${rep.name} at ${rep.official_url}`);
		console.log(`Subject: ${subject}`);
		console.log(`Body: ${personalizedBody}`);

		deliveryResults.push({
			representative: rep.name,
			status: 'queued'
		});
	}

	return deliveryResults;
}

async function storeGuestCongressionalRequest(params: any) {
	// TODO: Store pending request in database
}

async function sendOnboardingEmail(params: any) {
	// TODO: Send onboarding email with account creation link
} 