import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/core/db';
import { cwcClient } from '$lib/core/congress/cwc-client';
import { getRepresentativesForAddress } from '$lib/core/congress/address-lookup';

/**
 * MVP CWC Submission Endpoint
 *
 * HACKATHON VERSION: Bypasses ZK proofs and directly submits to CWC API
 * This is a simplified version for demo purposes that:
 * 1. Accepts template + user address info
 * 2. Looks up congressional representatives
 * 3. Submits directly to CWC API
 * 4. Returns job ID for tracking
 *
 * TODO: Replace with proper Phase 2 ZK implementation post-hackathon
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Check authentication (optional for hackathon - can work with guest users)
		const session = locals.session;
		const userId = session?.userId;

		// Parse request body
		const body = await request.json();
		const {
			templateId,
			address,
			personalizedMessage,
			userEmail,
			userName
		} = body;

		// Validate required fields
		if (!templateId || !address || !address.street || !address.city || !address.state || !address.zip) {
			throw error(400, 'Missing required address fields');
		}

		// Validate template exists
		const template = await prisma.template.findUnique({
			where: { id: templateId },
			select: { 
				id: true, 
				title: true,
				message_body: true,
				slug: true
			}
		});

		if (!template) {
			throw error(404, 'Template not found');
		}

		// Get user's congressional representatives
		console.log('[CWC MVP] Looking up representatives for address:', address);
		const representatives = await getRepresentativesForAddress(address);
		
		if (!representatives || representatives.length === 0) {
			throw error(404, 'No congressional representatives found for this address');
		}

		console.log('[CWC MVP] Found representatives:', {
			count: representatives.length,
			representatives: representatives.map(r => ({ name: r.name, chamber: r.chamber, state: r.state }))
		});

		// Create a mock user object for CWC submission
		const user = {
			id: userId || `guest-${Date.now()}`,
			name: userName || 'Anonymous User',
			email: userEmail || 'user@example.com',
			street: address.street,
			city: address.city,
			state: address.state,
			zip: address.zip
		};

		// Create CWC job for tracking
		const job = await prisma.cWCJob.create({
			data: {
				user_id: userId,
				template_id: templateId,
				status: 'processing',
				metadata: {
					address,
					representatives: representatives.map(r => ({ name: r.name, chamber: r.chamber, bioguideId: r.bioguideId })),
					personalizedMessage
				}
			}
		});

		console.log('[CWC MVP] Created job:', job.id);

		// Submit to representatives synchronously for immediate demo feedback
		const results = await processCWCSubmissionsSync(job.id, template, user, representatives, personalizedMessage);

		// Calculate summary statistics
		const successful = results.filter(r => r.success).length;
		const failed = results.filter(r => !r.success).length;

		return json({
			success: true,
			jobId: job.id,
			representatives: representatives.map(r => ({ 
				name: r.name, 
				chamber: r.chamber, 
				state: r.state,
				district: r.district 
			})),
			results: results.map(r => ({
				office: r.office,
				chamber: r.chamber || (r.office.includes('Senator') ? 'senate' : 'house'),
				success: r.success,
				status: r.status,
				messageId: r.messageId,
				confirmationNumber: r.confirmationNumber,
				error: r.error,
				cwcResponse: r.cwcResponse // Include full CWC API response for proof
			})),
			summary: {
				total: results.length,
				successful,
				failed
			},
			message: successful === results.length ? 'All submissions successful!' : `${successful}/${results.length} submissions successful`
		});

	} catch (err) {
		console.error('[CWC MVP Submission] Error:', err);

		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'Failed to create CWC submission');
	}
};

/**
 * Process CWC submissions synchronously - straight to API for demo
 * HACKATHON: Bypasses queues for immediate feedback
 */
async function processCWCSubmissionsSync(
	jobId: string,
	template: any,
	user: any,
	representatives: any[],
	personalizedMessage: string
) {
	try {
		console.log(`[CWC MVP] Starting synchronous processing for job ${jobId}`);

		// Update job status
		await prisma.cWCJob.update({
			where: { id: jobId },
			data: { 
				status: 'processing',
				started_at: new Date()
			}
		});

		// Submit directly to CWC API (no queues for demo)
		const results = await cwcClient.submitToAllRepresentatives(
			template,
			user,
			representatives,
			personalizedMessage
		);

		console.log(`[CWC MVP] Completed direct API submissions for job ${jobId}:`, results);

		// Update job with results
		const successCount = results.filter(r => r.success).length;
		const failedCount = results.filter(r => !r.success).length;

		await prisma.cWCJob.update({
			where: { id: jobId },
			data: {
				status: failedCount === 0 ? 'completed' : 'partially_completed',
				completed_at: new Date(),
				results: results.map(r => ({
					office: r.office,
					status: r.status,
					success: r.success,
					messageId: r.messageId,
					confirmationNumber: r.confirmationNumber,
					error: r.error,
					cwcResponse: r.cwcResponse // Include full CWC API response for proof
				})),
				metadata: {
					successCount,
					failedCount,
					totalCount: results.length,
					directApi: true, // Mark as direct API for demo tracking
					processedAt: new Date().toISOString()
				}
			}
		});

		return results;

	} catch (error) {
		console.error(`[CWC MVP] Direct API processing failed for job ${jobId}:`, error);
		
		await prisma.cWCJob.update({
			where: { id: jobId },
			data: { 
				status: 'failed',
				completed_at: new Date(),
				error: error instanceof Error ? error.message : 'Unknown error'
			}
		});
		
		throw error;
	}
}