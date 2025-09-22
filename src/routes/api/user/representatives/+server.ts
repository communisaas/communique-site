import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/core/db';
import type { Representative as _Representative } from '$lib/types/user';

interface RepresentativeData {
	bioguide_id: string;
	name: string;
	party: string;
	state: string;
	district: string;
	chamber: 'house' | 'senate';
	office_code: string;
}

interface UserRepsData {
	house: RepresentativeData;
	senate: RepresentativeData[];
	district: {
		state: string;
		district: string;
	};
}

// POST /api/user/representatives - Store user's representatives after onboarding
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// TODO: Add authentication check
		// const user = locals.user;
		// if (!user) {
		//     throw error(401, 'Authentication required');
		// }

		const data = await request.json();
		const { userId, representatives, userAddress } = data;

		// Validate required fields
		if (!userId) {
			throw error(400, 'userId is required');
		}

		if (!representatives || !representatives.house || !representatives.senate) {
			throw error(400, 'Representatives data is required (house and senate)');
		}

		// Validate representatives data structure
		const repsData: UserRepsData = representatives;

		// Start transaction to ensure data consistency
		const result = await db.$transaction(async (tx) => {
			// 1. Update user with address information if provided
			if (userAddress) {
				await tx.user.update({
					where: { id: userId },
					data: {
						street: userAddress.street,
						city: userAddress.city,
						state: userAddress.state,
						zip: userAddress.zip,
						congressional_district: `${repsData.district.state}-${repsData.district.district}`
					}
				});
			}

			// 2. Clear existing representatives for this user
			await tx.userrepresentatives.deleteMany({
				where: { user_id: userId }
			});

			// 3. Store/update representatives in representatives table
			const allReps = [repsData.house, ...repsData.senate];
			const storedReps = [];

			for (const rep of allReps) {
				const storedRep = await tx.representative.upsert({
					where: { bioguide_id: rep.bioguide_id },
					update: {
						name: rep.name,
						party: rep.party,
						state: rep.state,
						district: rep.district,
						chamber: rep.chamber,
						office_code: rep.office_code,
						is_active: true,
						last_updated: new Date()
					},
					create: {
						bioguide_id: rep.bioguide_id,
						name: rep.name,
						party: rep.party,
						state: rep.state,
						district: rep.district,
						chamber: rep.chamber,
						office_code: rep.office_code,
						is_active: true
					}
				});
				storedReps.push(storedRep);
			}

			// 4. Create user-representative relationships
			const userRepRelationships = [];

			// House representative
			const houseRep = storedReps.find((r) => r.chamber === 'house');
			if (houseRep) {
				userRepRelationships.push({
					user_id: userId,
					representative_id: houseRep.id,
					relationship: 'house',
					is_active: true
				});
			}

			// Senate representatives
			const senators = storedReps.filter((r) => r.chamber === 'senate');
			senators.forEach((senator, _index) => {
				userRepRelationships.push({
					user_id: userId,
					representative_id: senator.id,
					relationship: _index === 0 ? 'senate_senior' : 'senate_junior',
					is_active: true
				});
			});

			// Insert all relationships
			await tx.userrepresentatives.createMany({
				data: userRepRelationships
			});

			return {
				userId,
				representativesCount: storedReps.length,
				relationshipsCount: userRepRelationships.length,
				district: repsData.district
			};
		});

		return json({
			success: true,
			message: `Successfully stored ${result.representativesCount} representatives for user`,
			...result
		});
	} catch (err) {
		// Re-throw SvelteKit errors
		if (error && typeof error === 'object' && 'status' in error) {
			throw error;
		}

		throw error(500, 'Failed to store user representatives');
	}
};

// GET /api/user/representatives - Get user's current representatives
export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		// TODO: Add authentication check
		// const user = locals.user;
		// if (!user) {
		//     throw error(401, 'Authentication required');
		// }

		const userId = url.searchParams.get('userId');

		if (!userId) {
			throw error(400, 'userId parameter is required');
		}

		// Fetch user with their representatives
		const user = await db.user.findUnique({
			where: { id: userId },
			include: {
				representatives: {
					where: { is_active: true },
					include: {
						representative: true
					},
					orderBy: [
						{ relationship: 'asc' } // house, senate_junior, senate_senior
					]
				}
			}
		});

		if (!user) {
			throw error(404, 'User not found');
		}

		// Format response using unified Representative interface

		const representatives: {
			house: Representative | null;
			senate: Representative[];
		} = {
			house: null,
			senate: []
		};

		user.representatives.forEach((userRep) => {
			const rep: Representative = {
				id: userRep.representative.id,
				bioguide_id: userRep.representative.bioguide_id,
				name: userRep.representative.name,
				party: userRep.representative.party,
				state: userRep.representative.state,
				district: userRep.representative.district, // Keep as string
				chamber: userRep.representative.chamber,
				office_code: userRep.representative.office_code,
				is_active: userRep.representative.is_active ?? true,
				last_updated: userRep.representative.last_updated ?? new Date(),
				relationship: userRep.relationship,
				assigned_at: userRep.assigned_at,
				last_validated: userRep.last_validated
			};

			if (userRep.relationship === 'house') {
				representatives.house = rep;
			} else {
				representatives.senate.push(rep);
			}
		});

		return json({
			success: true,
			userId,
			userAddress: {
				street: user.street,
				city: user.city,
				state: user.state,
				zip: user.zip
			},
			district: user.congressional_district,
			representatives,
			totalReps: user.representatives.length
		});
	} catch (err) {
		if (error && typeof error === 'object' && 'status' in error) {
			throw error;
		}

		throw error(500, 'Failed to fetch user representatives');
	}
};

// PUT /api/user/representatives - Refresh/validate user's representatives
export const PUT: RequestHandler = async ({ request, locals }) => {
	try {
		// TODO: Add authentication check
		// const user = locals.user;
		// if (!user) {
		//     throw error(401, 'Authentication required');
		// }

		const data = await request.json();
		const { userId } = data;

		if (!userId) {
			throw error(400, 'userId is required');
		}

		// Get user's current address
		const user = await db.user.findUnique({
			where: { id: userId },
			select: {
				street: true,
				city: true,
				state: true,
				zip: true
			}
		});

		if (!user || !user.street || !user.city || !user.state || !user.zip) {
			throw error(400, 'User address information is incomplete');
		}

		// Re-lookup representatives using address lookup service
		const { addressLookupService } = await import('$lib/core/congress/address-lookup');
		const updatedReps = await addressLookupService.lookupRepsByAddress({
			street: user.street,
			city: user.city,
			state: user.state,
			zip: user.zip
		});

		// Update stored representatives (reuse POST logic)
		const updateData = {
			userId,
			representatives: {
				house: updatedReps.house,
				senate: updatedReps.senate,
				district: updatedReps.district
			}
		};

		// Reuse the POST logic for updating
		const updateRequest = new Request('', {
			method: 'POST',
			body: JSON.stringify(updateData),
			headers: { 'content-type': 'application/json' }
		});

		const postHandler = (await import('./+server')).POST;
		return await postHandler({ request: updateRequest, locals } as Parameters<
			typeof postHandler
		>[0]);
	} catch (err) {
		if (error && typeof error === 'object' && 'status' in error) {
			throw error;
		}

		throw error(500, 'Failed to refresh user representatives');
	}
};
