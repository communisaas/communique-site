import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/core/db';
import { cwcClient } from '$lib/core/congress/cwc-client';
import { getRepresentativesForAddress } from '$lib/core/congress/address-lookup';

/**
 * MVP CWC Submission Endpoint
 *
 * Submits messages directly to CWC API:
 * 1. Accepts template + user address info
 * 2. Looks up congressional representatives
 * 3. Submits directly to CWC API
 * 4. Returns job ID for tracking
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Authentication is REQUIRED to contact Congress
		if (!locals.user) {
			return json({ error: 'Authentication required to contact Congress' }, { status: 401 });
		}
		const userId = locals.user.id;

		// Parse request body
		const body = await request.json();
		const { templateId, address, personalizedMessage, userEmail, userName } = body;

		// Validate required fields
		if (
			!templateId ||
			!address ||
			!address.street ||
			!address.city ||
			!address.state ||
			!address.zip
		) {
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
			representatives: representatives.map((r) => ({
				name: r.name,
				chamber: r.chamber,
				state: r.state
			}))
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
				userId: userId,
				templateId: templateId,
				status: 'processing'
			}
		});

		console.log('[CWC MVP] Created job:', job.id);

		// Submit to representatives synchronously for immediate demo feedback
		const results = await processCWCSubmissionsSync(
			job.id,
			template,
			user,
			representatives,
			personalizedMessage
		);

		// Calculate summary statistics
		const successful = results.filter((r) => r.success).length;
		const failed = results.filter((r) => !r.success).length;

		return json({
			success: true,
			jobId: job.id,
			representatives: representatives.map((r) => ({
				name: r.name,
				chamber: r.chamber,
				state: r.state,
				district: r.district
			})),
			results: results.map((r) => ({
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
			message:
				successful === results.length
					? 'All submissions successful!'
					: `${successful}/${results.length} submissions successful`
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

interface TemplateData {
	id: string;
	title: string;
	message_body: string;
	slug: string;
	[key: string]: unknown;
}

interface UserData {
	id: string;
	name: string;
	email: string;
	street: string;
	city: string;
	state: string;
	zip: string;
	[key: string]: unknown;
}

interface RepresentativeData {
	name: string;
	chamber: string;
	bioguideId: string;
	state?: string;
	district?: string;
	[key: string]: unknown;
}

/**
 * Process CWC submissions synchronously - straight to API for demo
 * HACKATHON: Bypasses queues for immediate feedback
 */
async function processCWCSubmissionsSync(
	jobId: string,
	template: TemplateData,
	user: UserData,
	representatives: RepresentativeData[],
	personalizedMessage: string
) {
	try {
		console.log(`[CWC MVP] Starting synchronous processing for job ${jobId}`);

		// Update job status
		await prisma.cWCJob.update({
			where: { id: jobId },
			data: {
				status: 'processing'
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
		const successCount = results.filter((r) => r.success).length;
		const failedCount = results.filter((r) => !r.success).length;

		await prisma.cWCJob.update({
			where: { id: jobId },
			data: {
				status: failedCount === 0 ? 'completed' : 'partial',
				completedAt: new Date(),
				submissionCount: results.length,
				results: results.map((r) => ({
					office: r.office,
					status: r.status,
					success: r.success,
					messageId: r.messageId,
					confirmationNumber: r.confirmationNumber,
					error: r.error,
					cwcResponse: r.cwcResponse
				}))
			}
		});

		return results;
	} catch (error) {
		console.error(`[CWC MVP] Direct API processing failed for job ${jobId}:`, error);

		await prisma.cWCJob.update({
			where: { id: jobId },
			data: {
				status: 'failed',
				completedAt: new Date(),
				results: { error: error instanceof Error ? error.message : 'Unknown error' }
			}
		});

		throw error;
	}
}
