import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/core/db';

export const POST: RequestHandler = async ({ request, locals }) => {
    try {
        // Ensure user is authenticated
        if (!locals.user) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { address, street, city, state, zip } = body;

        // Parse address if provided as a single string
        let addressData = { street: '', city: '', state: '', zip: '' };

        if (address) {
            // Parse address string like "123 Main St, San Francisco, CA 94102"
            const parts = address.split(',').map((p: string) => p.trim());
            if (parts.length >= 3) {
                addressData.street = parts[0];
                addressData.city = parts[1];
                // Split last part into state and zip
                const lastPart = parts[2].split(' ').filter((p: string) => p);
                if (lastPart.length >= 2) {
                    addressData.state = lastPart[0];
                    addressData.zip = lastPart.slice(1).join(' ');
                }
            }
        } else {
            // Use individual fields if provided
            addressData = {
                street: street || '',
                city: city || '',
                state: state || '',
                zip: zip || ''
            };
        }

        // Validate required fields
        if (!addressData.street || !addressData.city || !addressData.state || !addressData.zip) {
            return json(
                { error: 'Street, city, state, and ZIP code are required' },
                { status: 400 }
            );
        }

        // Update user with address information
        const updatedUser = await db.user.update({
            where: { id: locals.user.id },
            data: {
                street: addressData.street,
                city: addressData.city,
                state: addressData.state,
                zip: addressData.zip,
                updatedAt: new Date()
            }
        });

        return json({
            success: true,
            message: 'Address saved successfully',
            user: {
                id: updatedUser.id,
                street: updatedUser.street,
                city: updatedUser.city,
                state: updatedUser.state,
                zip: updatedUser.zip
            }
        });
    } catch (error) {
        console.error('[API] Address update error:', error);
        return json(
            {
                error: 'Failed to save address'
            },
            { status: 500 }
        );
    }
};
