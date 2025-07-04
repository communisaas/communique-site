import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

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
	// Format: congress.{templateId}.{userId}@communique.org
	// or: congress.{templateId}.guest.{sessionToken}@communique.org
	
	const match = address.match(/^congress\.([^.]+)\.(.+)@communique\.org$/);
	if (!match) return null;

	const [, templateId, userPart] = match;
	
	if (userPart.startsWith('guest.')) {
		const sessionToken = userPart.substring(6); // Remove 'guest.' prefix
		return {
			templateId,
			isGuest: true,
			sessionToken
		};
	} else {
		return {
			templateId,
			userId: userPart,
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
		include: { representatives: true }
	});

	if (!user) {
		return error(404, 'User not found');
	}

	// 2. Get user's representatives (if not cached, look them up)
	let representatives = user.representatives;
	if (!representatives.length && user.zip) {
		// Look up representatives based on user's address
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

async function routeToRepresentatives(params: any) {
	// TODO: Implement CWC routing
	return [];
}

async function storeGuestCongressionalRequest(params: any) {
	// TODO: Store pending request in database
}

async function sendOnboardingEmail(params: any) {
	// TODO: Send onboarding email with account creation link
} 