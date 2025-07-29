import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { v4 as uuidv4 } from 'uuid';

// In-memory storage for demo (use Redis/DB in production)
const verificationSessions = new Map<string, {
	userId: string;
	templateSlug: string;
	disclosures: any;
	qrCodeData: string;
	status: 'pending' | 'verified' | 'failed';
	credentialSubject?: any;
	createdAt: Date;
}>();

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { userId, templateSlug, requireAddress, disclosures } = await request.json();

		if (!userId || !templateSlug) {
			return json(
				{ success: false, error: 'Missing required fields' },
				{ status: 400 }
			);
		}

		// Generate Self.xyz app configuration
		const selfAppConfig = {
			appName: "Communiqué",
			scope: "communique-congressional-advocacy",
			endpoint: `${process.env.ORIGIN || 'http://localhost:5173'}/api/identity/verify`,
			userId,
			userIdType: 'uuid',
			version: 2,
			disclosures: {
				nationality: true,
				issuing_state: true,
				name: true,
				minimumAge: 18,
				ofac: true,
				...disclosures
			},
			userDefinedData: JSON.stringify({
				templateSlug,
				requireAddress,
				timestamp: Date.now()
			})
		};

		// For demo purposes, we'll create a mock QR code data
		// In production, you'd use the Self.xyz SDK to generate this
		const qrCodeData = `self://verify?config=${encodeURIComponent(JSON.stringify(selfAppConfig))}`;

		// Store session for polling
		verificationSessions.set(userId, {
			userId,
			templateSlug,
			disclosures,
			qrCodeData,
			status: 'pending',
			createdAt: new Date()
		});

		// Clean up old sessions (>1 hour)
		const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
		for (const [key, session] of verificationSessions.entries()) {
			if (session.createdAt < oneHourAgo) {
				verificationSessions.delete(key);
			}
		}

		return json({
			success: true,
			qrCodeData,
			sessionId: userId
		});

	} catch (error) {
		console.error('Self.xyz init error:', error);
		return json(
			{ success: false, error: 'Failed to initialize Self.xyz verification' },
			{ status: 500 }
		);
	}
};