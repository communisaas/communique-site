/**
 * CWC (Communicating With Congress) Submission Endpoint
 *
 * Handles verified template submission to Congressional offices via async SQS queuing
 * Called by N8N workflow after verification and consensus stages
 *
 * NEW BEHAVIOR: Uses async SQS queuing instead of direct CWC submission
 * - Check rate limits and idempotency BEFORE queuing
 * - Send messages to appropriate SQS queues (Senate vs House)
 * - Return job IDs immediately without waiting for CWC responses
 * - Log all operations for observability
 * - Handle partial failures gracefully
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cwcSQSClient } from '$lib/services/aws/sqs-client';
import { createRateLimiter, extractChamber } from '$lib/services/aws/dynamodb-rate-limiter';
import type { IdempotencyKey } from '$lib/services/aws/dynamodb-rate-limiter';
import { db } from '$lib/core/db';
import { randomBytes } from 'crypto';

export const POST: RequestHandler = async ({ request, url: _url }) => {
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
		if (templateId && (!template.title || !template.body)) {
			const dbTemplate = await db.template.findUnique({
				where: { id: templateId },
				include: {
					user: true
				}
			});

			if (!dbTemplate) {
				return json({ error: 'Template not found' }, { status: 404 });
			}

			template = {
				...dbTemplate,
				...template,
				// Use corrected content if available from verification fields on template
				subject:
					dbTemplate.corrected_subject ||
					verification?.corrections?.subject ||
					template.title ||
					dbTemplate.subject,
				body:
					dbTemplate.corrected_body ||
					verification?.corrections?.body ||
					template.body ||
					dbTemplate.message_body
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
			targetRecipients = reps.map(
				(rep: {
					bioguideId: string;
					name: string;
					role: string;
					state: string;
					district?: string;
					party?: string;
				}) => ({
					bioguideId: rep.bioguideId,
					name: rep.name,
					chamber: rep.role.includes('Senator') ? 'senate' : 'house',
					officeCode: rep.bioguideId,
					state: rep.state,
					district: rep.district || '00',
					party: rep.party || 'Unknown'
				})
			);
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

		// Initialize services
		const environment =
			(process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development';
		const rateLimiter = createRateLimiter(environment);
		const jobId = `job-${randomBytes(8).toString('hex')}-${Date.now()}`;
		const timestamp = new Date().toISOString();

		// Create CWCJob record for status tracking
		await db.cWCJob.create({
			data: {
				id: jobId,
				templateId,
				userId: user.id,
				status: 'queued',
				submissionCount: targetRecipients.length,
				messageIds: [], // Will be updated as messages are queued
				results: {}
			}
		});

		// Track async operations
		const queuedSubmissions: Array<{
			recipient: string;
			chamber: string;
			messageId: string;
			status: string;
		}> = [];
		const rateLimitedRecipients: string[] = [];
		const duplicateSubmissions: string[] = [];
		const errors: string[] = [];
		const allMessageIds: string[] = [];

		// Process each recipient with rate limiting and idempotency checks
		for (const recipient of targetRecipients) {
			try {
				const chamber = extractChamber(recipient.bioguideId);
				const today = new Date().toISOString().split('T')[0];

				// Check idempotency (prevent duplicate submissions)
				const idempotencyKey: IdempotencyKey = {
					templateId,
					recipientOfficeId: recipient.bioguideId,
					userId: user.id,
					date: today
				};

				const idempotencyResult = await rateLimiter.checkIdempotency(idempotencyKey);
				if (idempotencyResult.isDuplicate) {
					duplicateSubmissions.push(recipient.name);
					console.log(`Duplicate submission detected for ${recipient.name}:`, {
						templateId,
						userId: user.id,
						recipientId: recipient.bioguideId,
						originalMessageId: idempotencyResult.originalMessageId,
						timestamp
					});
					continue;
				}

				// Check rate limits
				const rateLimitResult = await rateLimiter.checkRateLimit(
					chamber,
					recipient.bioguideId,
					user.id
				);

				if (!rateLimitResult.allowed) {
					rateLimitedRecipients.push(recipient.name);
					console.log(`Rate limit exceeded for ${recipient.name}:`, {
						chamber,
						tokensRemaining: rateLimitResult.tokensRemaining,
						resetAt: new Date(rateLimitResult.resetAt).toISOString(),
						retryAfterMs: rateLimitResult.retryAfterMs,
						timestamp
					});
					continue;
				}

				// Convert template to SQS format
				const sqsTemplate = {
					id: template.id || templateId,
					slug: template.slug || 'unknown-slug',
					title: template.title,
					message_body: template.body,
					category: template.category,
					subject: template.subject
				};

				// Convert user to SQS format
				const sqsUser = {
					id: user.id,
					name: user.name,
					email: user.email,
					phone: user.phone || '',
					address: {
						street: user.street || '',
						city: user.city || '',
						state: user.state || '',
						zip: user.zip || ''
					}
				};

				// Convert recipient to CongressionalOffice format
				const congressionalOffice = {
					bioguideId: recipient.bioguideId,
					name: recipient.name,
					chamber: recipient.chamber,
					officeCode: recipient.officeCode,
					state: recipient.state,
					district: recipient.district || '00',
					party: recipient.party || 'Unknown'
				};

				// Queue the message
				let sqsResult;
				if (chamber === 'senate') {
					sqsResult = await cwcSQSClient.sendToSenateQueue(
						sqsTemplate,
						sqsUser,
						congressionalOffice,
						template.body,
						'normal'
					);
				} else {
					sqsResult = await cwcSQSClient.sendToHouseQueue(
						sqsTemplate,
						sqsUser,
						congressionalOffice,
						template.body,
						'normal'
					);
				}

				if (sqsResult.success && sqsResult.messageId) {
					queuedSubmissions.push({
						recipient: recipient.name,
						chamber: recipient.chamber,
						messageId: sqsResult.messageId,
						status: 'queued'
					});

					// Collect message ID for CWCJob update
					allMessageIds.push(sqsResult.messageId);

					// Record idempotency for successful queue submission
					await rateLimiter.recordSubmission(idempotencyKey, sqsResult.messageId);

					// Store initial delivery record with queued status
					await db.template_campaign.create({
						data: {
							id: `cwc_${templateId}_${user.id}_${recipient.bioguideId}_${Date.now()}`,
							template_id: templateId,
							user_id: user.id,
							delivery_type: 'cwc',
							recipient_id: recipient.bioguideId,
							cwc_delivery_id: sqsResult.messageId,
							status: 'queued',
							sent_at: new Date(),
							metadata: {
								recipient_name: recipient.name,
								chamber: recipient.chamber,
								job_id: jobId,
								sqs_message_id: sqsResult.messageId,
								md5_of_body: sqsResult.md5OfBody,
								sequence_number: sqsResult.sequenceNumber
							}
						}
					});

					console.log(`Message queued successfully for ${recipient.name}:`, {
						chamber: recipient.chamber,
						messageId: sqsResult.messageId,
						recipientName: recipient.name,
						templateId,
						userId: user.id,
						jobId,
						timestamp
					});
				} else {
					errors.push(
						`Failed to queue message for ${recipient.name}: ${sqsResult.error || 'Unknown SQS error'}`
					);
					console.error(`SQS queue failed for ${recipient.name}:`, {
						chamber: recipient.chamber,
						error: sqsResult.error,
						templateId,
						userId: user.id,
						timestamp
					});
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				errors.push(`Error processing ${recipient.name}: ${errorMessage}`);
				console.error(`Error processing recipient ${recipient.name}:`, {
					error: errorMessage,
					templateId,
					userId: user.id,
					timestamp
				});
			}
		}

		// Update CWCJob with collected message IDs and final status
		if (allMessageIds.length > 0) {
			try {
				const finalStatus =
					queuedSubmissions.length === targetRecipients.length
						? 'processing'
						: queuedSubmissions.length > 0
							? 'partial'
							: 'failed';

				await db.cWCJob.update({
					where: { id: jobId },
					data: {
						messageIds: allMessageIds,
						status: finalStatus,
						submissionCount: queuedSubmissions.length
					}
				});

				console.log(
					`CWCJob ${jobId} updated: ${allMessageIds.length} message IDs, status: ${finalStatus}`
				);
			} catch (updateError) {
				console.error('Failed to update CWCJob with message IDs:', updateError);
				// Don't fail the request for tracking errors
			}
		}

		// Update template usage tracking
		if (queuedSubmissions.length > 0) {
			try {
				// Update template usage count (if schema supports it)
				await db.template.update({
					where: { id: templateId },
					data: {
						send_count: {
							increment: queuedSubmissions.length
						},
						last_sent_at: new Date()
					}
				});
				console.log(
					`Template ${templateId} usage updated: ${queuedSubmissions.length} new submissions queued`
				);
			} catch (updateError) {
				console.error('Failed to update template usage tracking:', updateError);
				// Don't fail the request for tracking errors
			}
		}

		// Prepare async response with new format
		const response = {
			success: queuedSubmissions.length > 0,
			jobId,
			queuedSubmissions: queuedSubmissions.length,
			rateLimitedRecipients,
			duplicateSubmissions,
			errors: errors.length > 0 ? errors : undefined,
			timestamp
		};

		// Log comprehensive operation summary
		console.log(`CWC async submission summary:`, {
			jobId,
			templateId,
			userId: user.id,
			totalRecipients: targetRecipients.length,
			queued: queuedSubmissions.length,
			rateLimited: rateLimitedRecipients.length,
			duplicates: duplicateSubmissions.length,
			errors: errors.length,
			timestamp
		});

		// Return success if any messages were queued, partial success if some failed
		if (
			queuedSubmissions.length === 0 &&
			(rateLimitedRecipients.length > 0 || duplicateSubmissions.length > 0 || errors.length > 0)
		) {
			// No messages queued, but not necessarily an error (could be rate limited or duplicates)
			return json(
				{
					...response,
					message:
						rateLimitedRecipients.length > 0
							? 'All submissions were rate limited. Please try again later.'
							: duplicateSubmissions.length > 0
								? 'All submissions were duplicates of previous submissions.'
								: 'All submissions failed due to errors.',
					details: {
						rateLimited: rateLimitedRecipients,
						duplicates: duplicateSubmissions,
						errors
					}
				},
				{ status: rateLimitedRecipients.length > 0 ? 429 : errors.length > 0 ? 500 : 409 }
			);
		}

		return json(response);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		console.error('CWC async submission failed:', {
			error: errorMessage,
			stack: error instanceof Error ? error.stack : undefined,
			timestamp: new Date().toISOString()
		});

		return json(
			{
				success: false,
				jobId: `error-${randomBytes(4).toString('hex')}-${Date.now()}`,
				queuedSubmissions: 0,
				rateLimitedRecipients: [],
				duplicateSubmissions: [],
				errors: [`CWC async submission failed: ${errorMessage}`],
				timestamp: new Date().toISOString()
			},
			{ status: 500 }
		);
	}
};

// GET endpoint for testing async CWC configuration
export const GET: RequestHandler = async () => {
	try {
		// Test SQS configuration
		const sqsConfig = cwcSQSClient.getConfiguration();
		const sqsConnectivity = await cwcSQSClient.testConnection();

		// Test rate limiter configuration
		const environment =
			(process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development';

		const configured =
			sqsConnectivity.connected && sqsConnectivity.senateQueue && sqsConnectivity.houseQueue;

		return json({
			status: configured ? 'async_configured' : 'async_not_configured',
			configured,
			mode: 'async_sqs_queuing',
			sqs: {
				region: sqsConfig.region,
				senateQueue: sqsConfig.senateQueueUrl !== 'NOT_SET',
				houseQueue: sqsConfig.houseQueueUrl !== 'NOT_SET',
				credentialsConfigured: sqsConfig.credentialsConfigured
			},
			rateLimiting: {
				environment,
				enabled: true,
				tableName: `${environment}-communique-rate-limits`
			},
			idempotency: {
				enabled: true,
				tableName: `${environment}-communique-idempotency`
			},
			message: configured
				? 'CWC async SQS integration is configured and ready'
				: 'SQS queue URLs or AWS credentials not properly configured',
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error('CWC async configuration check failed:', error);
		return json(
			{
				status: 'async_error',
				configured: false,
				mode: 'async_sqs_queuing',
				error: error instanceof Error ? error.message : 'Unknown configuration error',
				timestamp: new Date().toISOString()
			},
			{ status: 500 }
		);
	}
};
