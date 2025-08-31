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
		
		// Update user with profile information
		// Since we don't have dedicated fields for this in the current schema,
		// we'll store it in a JSON field or add new fields as needed
		const updatedUser = await db.user.update({
			where: { id: locals.user.id },
			data: {
				// Store profile info - we'll need to extend the schema or use existing fields creatively
				// For now, let's use the phone field to store a JSON string of profile data
				// In production, you'd want dedicated fields in the schema
				phone: JSON.stringify({
					role,
					organization: organization || null,
					location: location || null,
					connection,
					connectionDetails: connectionDetails || null,
					completedAt: new Date().toISOString()
				}),
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
		return json({ 
			error: 'Failed to save profile' 
		}, { status: 500 });
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
				phone: true // Contains our profile JSON
			}
		});
		
		if (!user) {
			return json({ error: 'User not found' }, { status: 404 });
		}
		
		// Parse profile data from phone field
		let profile = null;
		if (user.phone) {
			try {
				profile = JSON.parse(user.phone);
			} catch (error) {
				// phone field might contain actual phone number, not profile data
				profile = null;
			}
		}
		
		return json({
			user: {
				id: user.id,
				name: user.name,
				email: user.email,
				profile
			}
		});
		
	} catch (error) {
		return json({ 
			error: 'Failed to fetch profile' 
		}, { status: 500 });
	}
}