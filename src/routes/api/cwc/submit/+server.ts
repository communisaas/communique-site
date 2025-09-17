/**
 * CWC (Communicating With Congress) Submission Endpoint
 *
 * Handles verified template submission to Congressional offices
 * Called by N8N workflow after verification and consensus stages
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cwcClient } from '$lib/core/congress/cwc-client';
import { CWCGenerator } from '$lib/core/congress/cwc-generator';
import { db } from '$lib/core/db';

export const POST: RequestHandler = async ({ request, url }) => {
	try {
		// Verify webhook secret if provided
		const webhookSecret = request.headers.get('x-webhook-secret');
		const expectedSecret = process.env.N8N_WEBHOOK_SECRET;

		if (expectedSecret && webhookSecret !== expectedSecret) {
			return json({ error: 'Invalid webhook secret' }, { status: 401 });
		}

		const body = await request.json();
		const {
			templateId,
			verification,
			template: templateData,
			user: userData,
			recipients = []
		} = body;

		// Validate required fields
		if (!templateId || !templateData || !userData) {
			return json(
				{
					error: 'Missing required fields',
					required: ['templateId', 'template', 'user']
				},
				{ status: 400 }
			);
		}

		// Fetch template from database if not provided fully
		let template = templateData;
		if (templateId && (!template.subject || !template.body)) {
			const dbTemplate = await db.template.findUnique({
				where: { id: templateId },
				include: {
					user: true,
					verification: true
				}
			});

			if (!dbTemplate) {
				return json({ error: 'Template not found' }, { status: 404 });
			}

			template = {
				...dbTemplate,
				...template,
				// Use corrected content if available from verification
				subject: verification?.corrections?.subject || template.subject || dbTemplate.subject,
				body: verification?.corrections?.body || template.body || dbTemplate.message_body
			};
		}

		// Prepare user data
		const user = {
			id: userData.id || 'n8n-user',
			name: userData.name || userData.userName,
			email: userData.email || userData.userEmail,
			phone: userData.phone || '',
			street: userData.address || userData.userAddress || '',
			city: userData.city || '',
			state: userData.state || '',
			zip: userData.zip || userData.userZip || ''
		};

		// If recipients not provided, look them up based on user address
		let targetRecipients = recipients;
		if (targetRecipients.length === 0 && user.zip) {
			// Look up representatives based on zip code
			const { addressLookup } = await import('$lib/core/congress/address-lookup');
			const reps = await addressLookup(user.zip);
			targetRecipients = reps.map((rep) => ({
				bioguideId: rep.bioguideId,
				name: rep.name,
				chamber: rep.role.includes('Senator') ? 'senate' : 'house',
				officeCode: rep.bioguideId,
				state: rep.state,
				district: rep.district || '00',
				party: rep.party
			}));
		}

		if (targetRecipients.length === 0) {
			return json(
				{
					error: 'No recipients specified and unable to determine from address',
					hint: 'Provide recipients array or valid user address/zip'
				},
				{ status: 400 }
			);
		}

		// Track submissions
		const submissions = [];
		const errors = [];

		// Submit to each recipient
		for (const recipient of targetRecipients) {
			try {
				let result;

				if (recipient.chamber === 'senate') {
					result = await cwcClient.submitToSenate(template, user, recipient, template.body);
				} else {
					result = await cwcClient.submitToHouse(template, user, recipient, template.body);
				}

				if (result.success) {
					submissions.push({
						recipient: recipient.name,
						chamber: recipient.chamber,
						messageId: result.messageId,
						confirmationNumber: result.confirmationNumber,
						status: result.status
					});

					// Store delivery record
					await db.templateDelivery.create({
						data: {
							template_id: templateId,
							user_id: user.id,
							recipient_id: recipient.bioguideId,
							recipient_name: recipient.name,
							chamber: recipient.chamber,
							delivery_method: 'cwc',
							delivery_status: 'sent',
							confirmation_number: result.confirmationNumber,
							message_id: result.messageId,
							delivered_at: new Date()
						}
					});
				} else {
					errors.push({
						recipient: recipient.name,
						error: result.error || 'Submission failed'
					});
				}
			} catch (_error) {
				console.error('Error:' , _error);
				errors.push({
					recipient: recipient.name,
					error: _error.message
				});
			}
		}

		// Update template usage tracking
		if (submissions.length > 0) {
			await db.template.update({
				where: { id: templateId },
				data: {
					send_count: {
						increment: submissions.length
					},
					last_sent_at: new Date()
				}
			});
		}

		// Prepare response
		const response = {
			success: submissions.length > 0,
			templateId,
			submissionCount: submissions.length,
			submissions,
			errors: errors.length > 0 ? errors : undefined,
			confirmationNumber: submissions[0]?.confirmationNumber, // Primary confirmation for N8N
			timestamp: new Date().toISOString()
		};

		// If all submissions failed, return error
		if (submissions.length === 0 && errors.length > 0) {
			return json(
				{
					...response,
					error: 'All submissions failed',
					details: errors
				},
				{ status: 500 }
			);
		}

		return json(response);
	} catch (_error) {
		console.error('Error:' , _error);
		return json(
			{
				success: false,
				error: 'CWC submission failed',
				details: _error instanceof Error ? _error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

// GET endpoint for testing CWC configuration
export const GET: RequestHandler = async () => {
	const configured = !!process.env.CWC_API_KEY;
	const baseUrl = process.env.CWC_API_BASE_URL || 'https://www.house.gov/htbin/formproc';

	return json({
		status: configured ? 'configured' : 'not_configured',
		configured,
		baseUrl,
		message: configured
			? 'CWC integration is configured and ready'
			: 'CWC_API_KEY environment variable not set',
		timestamp: new Date().toISOString()
	});
};
