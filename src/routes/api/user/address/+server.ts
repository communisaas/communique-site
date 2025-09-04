import { json } from '@sveltejs/kit';
import { db } from '$lib/core/db';

export async function POST({ request, locals }) {
	try {
		// Ensure user is authenticated
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
		
		const { address, verified, representatives, street, city, state, zip, zipCode, countryCode, latitude, longitude, congressional_district } = await request.json();
		
		// Address can be provided as a single string or as separate components
		let addressComponents = { street: '', city: '', state: '', zip: '' };
		
		if (street && city && state && (zipCode || zip)) {
			// Separate components provided
			addressComponents = { street, city, state, zip: zipCode || zip };
		} else if (address) {
			// Parse full address string into components
			addressComponents = parseAddressString(address);
		} else {
			return json({ error: 'Address information is required' }, { status: 400 });
		}
		
		// Update user with address components
		const updatedUser = await db.user.update({
			where: { id: locals.user.id },
			data: {
				street: addressComponents.street,
				city: addressComponents.city,
				state: addressComponents.state,
				zip: addressComponents.zip,
				congressional_district: congressional_district || undefined,
				updatedAt: new Date()
			}
		});
		
		// If representatives were found, store them for this user
		if (representatives && representatives.length > 0) {
			// First, clear any existing representatives for this user
			await db.user_representatives.deleteMany({
				where: { user_id: locals.user.id }
			});
			
			// Store new representatives
			for (const rep of representatives) {
				// First, ensure the representative exists in the database
				const existingRep = await db.representative.findFirst({
					where: {
						name: rep.name,
						state: rep.state,
						chamber: rep.chamber
					}
				});
				
				let representativeId;
				
				if (existingRep) {
					representativeId = existingRep.id;
				} else {
					// Create new representative record
					const newRep = await db.representative.create({
						data: {
							name: rep.name,
							state: rep.state,
							district: rep.district,
							chamber: rep.chamber,
							party: 'Unknown', // Would be filled from actual API
							email: rep.email || '',
							phone: rep.phone || '',
							office: rep.office || '',
							website: ''
						}
					});
					representativeId = newRep.id;
				}
				
				// Link representative to user
				await db.user_representatives.create({
					data: {
						user_id: locals.user.id,
						representative_id: representativeId
					}
				});
			}
		}
		
		return json({ 
			success: true, 
			message: 'Address saved successfully',
			user: {
				id: updatedUser.id,
				street: updatedUser.street,
				city: updatedUser.city,
				state: updatedUser.state,
				zip: updatedUser.zip,
				congressional_district: updatedUser.congressional_district
			}
		});
		
	} catch (error) {
		return json({ 
			error: 'Failed to save address' 
		}, { status: 500 });
	}
}

function parseAddressString(address: string): { street: string; city: string; state: string; zip: string } {
	// Basic address parsing - in production you'd want more robust parsing
	const parts = address.split(',').map(part => part.trim());
	
	if (parts.length >= 3) {
		const street = parts[0];
		const city = parts[1];
		const stateZip = parts[2];
		
		// Extract state and ZIP from "STATE ZIP" format
		const stateZipMatch = stateZip.match(/^([A-Z]{2})\s+(\d{5}(-\d{4})?)$/);
		if (stateZipMatch) {
			return {
				street,
				city,
				state: stateZipMatch[1],
				zip: stateZipMatch[2]
			};
		}
	}
	
	// Fallback - return the address as street with empty other fields
	return {
		street: address,
		city: '',
		state: '',
		zip: ''
	};
}