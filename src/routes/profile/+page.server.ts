import { redirect } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Ensure user is authenticated
	if (!locals.user) {
		throw redirect(302, '/');
	}

	try {
		// Get comprehensive user data including templates
		const [user, templates] = await Promise.all([
			// User profile data
			db.user.findUnique({
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
					updatedAt: true,
					// Relations
					representatives: {
						select: {
							relationship: true,
							representative: {
								select: {
									id: true,
									name: true,
									party: true,
									state: true,
									district: true,
									chamber: true,
									phone: true,
									email: true
								}
							}
						}
					}
				}
			}),
			
			// User's templates with metrics
			db.template.findMany({
				where: { userId: locals.user.id },
				select: {
					id: true,
					slug: true,
					title: true,
					description: true,
					category: true,
					deliveryMethod: true,
					status: true,
					is_public: true,
					createdAt: true,
					updatedAt: true,
					metrics: true,
					// Template usage analytics
					template_campaign: {
						select: {
							id: true,
							status: true,
							sent_at: true,
							delivered_at: true
						}
					}
				},
				orderBy: { createdAt: 'desc' }
			})
		]);

		if (!user) {
			throw redirect(302, '/');
		}

		// Calculate template statistics
		const templateStats = templates.reduce((acc, template) => {
			acc.total++;
			if (template.status === 'published') acc.published++;
			if (template.is_public) acc.public++;
			
			// Count campaigns/uses
			const campaigns = template.template_campaign || [];
			acc.totalUses += campaigns.length;
			acc.totalSent += campaigns.filter(c => c.sent_at).length;
			acc.totalDelivered += campaigns.filter(c => c.delivered_at).length;
			
			return acc;
		}, {
			total: 0,
			published: 0,
			public: 0,
			totalUses: 0,
			totalSent: 0,
			totalDelivered: 0
		});

		return {
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
				representatives: user.representatives.map(ur => ({
					relationship: ur.relationship,
					...ur.representative
				})),
				timestamps: {
					created_at: user.createdAt,
					updated_at: user.updatedAt
				}
			},
			templates,
			templateStats
		};
		
	} catch (error) {
		console.error('Profile load error:', error);
		// Still allow access to profile page even if data loading fails
		return {
			user: {
				id: locals.user.id,
				name: locals.user.name,
				email: locals.user.email,
				avatar: null,
				phone: null,
				address: {},
				profile: {},
				verification: { is_verified: false },
				representatives: [],
				timestamps: { created_at: new Date(), updated_at: new Date() }
			},
			templates: [],
			templateStats: {
				total: 0,
				published: 0,
				public: 0,
				totalUses: 0,
				totalSent: 0,
				totalDelivered: 0
			}
		};
	}
};