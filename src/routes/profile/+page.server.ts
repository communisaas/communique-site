import { redirect } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
	// Ensure user is authenticated
	if (!locals.user) {
		throw redirect(302, '/');
	}

	// Get minimal user data from parent layout (already loaded)
	const parentData = await parent();
	
	// Stream ALL database queries - don't await anything
	const userDetailsPromise = db.user.findUnique({
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

	// Stream heavy data as deferred promises
	const templatesPromise = db.template.findMany({
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
	}).then(templates => {
		// Calculate template statistics after templates load
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

		return { templates, templateStats };
	});

	// Stream representatives data separately
	const representativesPromise = db.user.findUnique({
		where: { id: locals.user.id },
		select: {
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
	}).then(result => result?.representatives.map(ur => ({
		relationship: ur.relationship,
		...ur.representative
	})) || []);

	// Return immediately with parent data and ALL database queries as promises
	// This allows the page to render instantly while data loads in background
	return {
		// Use parent's minimal user data for immediate rendering
		user: parentData.user,
		// ALL database queries are streamed - nothing blocks
		streamed: {
			userDetails: userDetailsPromise.then(user => {
				if (!user) return null;
				return {
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
				};
			}).catch(error => {
				console.error('User details load error:', error);
				return null;
			}),
			templatesData: templatesPromise.catch(error => {
				console.error('Templates load error:', error);
				return { templates: [], templateStats: {
					total: 0, published: 0, public: 0,
					totalUses: 0, totalSent: 0, totalDelivered: 0
				}};
			}),
			representatives: representativesPromise.catch(error => {
				console.error('Representatives load error:', error);
				return [];
			})
		}
	};
};