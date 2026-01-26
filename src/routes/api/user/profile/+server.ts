import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/core/db';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Ensure user is authenticated
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { role, organization, location, connection, connectionDetails } = await request.json();

		if (!role || !connection) {
			return json({ error: 'Role and connection are required' }, { status: 400 });
		}

		// Update user with profile information using proper fields
		// Note: connection_details removed - field does not exist in schema
		const updatedUser = await db.user.update({
			where: { id: locals.user.id },
			data: {
				role,
				organization: organization || null,
				location: location || null,
				connection,
				profile_completed_at: new Date(),
				updatedAt: new Date()
			}
		});

		return json({
			success: true,
			message: 'Profile saved successfully',
			user: {
				id: updatedUser.id,
				profileComplete: true
			}
		});
	} catch {
		return json(
			{
				error: 'Failed to save profile'
			},
			{ status: 500 }
		);
	}
};

export const GET: RequestHandler = async ({ locals }) => {
	try {
		// CVE-INTERNAL-004 FIX: Corrected parameter name from _locals to locals
		// Ensure user is authenticated
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Get user's profile information
		// Note: PII fields (street, city, state, zip, phone) removed per privacy architecture
		// Address data is encrypted in EncryptedDeliveryData, not stored on User
		const user = await db.user.findUnique({
			where: { id: locals.user.id },
			select: {
				id: true,
				name: true,
				email: true,
				avatar: true,
				role: true,
				organization: true,
				location: true,
				connection: true,
				profile_completed_at: true,
				profile_visibility: true,
				is_verified: true,
				createdAt: true,
				updatedAt: true
			}
		});

		if (!user) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		return json({
			user: {
				id: user.id,
				name: user.name,
				email: user.email,
				avatar: user.avatar,
				// Note: address and phone removed per privacy architecture
				// PII is encrypted in EncryptedDeliveryData, not exposed via API
				profile: {
					role: user.role,
					organization: user.organization,
					location: user.location,
					connection: user.connection,
					completed_at: user.profile_completed_at,
					visibility: user.profile_visibility
				},
				verification: {
					is_verified: user.is_verified
				},
				timestamps: {
					created_at: user.createdAt,
					updated_at: user.updatedAt
				}
			}
		});
	} catch {
		return json(
			{
				error: 'Failed to fetch profile'
			},
			{ status: 500 }
		);
	}
};
