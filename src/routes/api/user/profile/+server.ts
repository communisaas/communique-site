import { json } from '@sveltejs/kit';
import { db } from '$lib/core/db';

export async function POST({ request, locals }) {
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
		const updatedUser = await db.user.update({
			where: { id: locals.user.id },
			data: {
				role,
				organization: organization || null,
				location: location || null,
				connection,
				connection_details: connectionDetails || null,
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
	} catch (error) {
		return json(
			{
				error: 'Failed to save profile'
			},
			{ status: 500 }
		);
	}
}

export async function GET({ locals }) {
	try {
		// Ensure user is authenticated
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Get user's profile information
		const user = await db.user.findUnique({
			where: { id: locals.user.id },
			select: {
				id: true,
				name: true,
				email: true,
				avatar: true,
				phone: true,
				street: true,
				city: true,
				state: true,
				zip: true,
				congressional_district: true,
				role: true,
				organization: true,
				location: true,
				connection: true,
				connection_details: true,
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
				phone: user.phone,
				address: {
					street: user.street,
					city: user.city,
					state: user.state,
					zip: user.zip,
					congressional_district: user.congressional_district
				},
				profile: {
					role: user.role,
					organization: user.organization,
					location: user.location,
					connection: user.connection,
					connection_details: user.connection_details,
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
	} catch (error) {
		return json(
			{
				error: 'Failed to fetch profile'
			},
			{ status: 500 }
		);
	}
}
