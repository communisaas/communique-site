import { prisma } from '$lib/core/db';
import { getRateLimiter } from '$lib/core/security/rate-limiter';

/**
 * CWC (Communicating with Congress) Delivery Client
 *
 * Delivers verified constituent messages to congressional offices via the CWC API.
 * Called after blockchain verification succeeds in queueBlockchainSubmission().
 *
 * Privacy model:
 * - Message body comes from the template (not decrypted from encrypted_message)
 * - The ZK proof proves district membership without revealing the constituent's identity
 * - CWC receives the message + proof metadata, NOT the constituent's address
 *
 * CWC API:
 * - XML-based POST to CWC_API_URL
 * - Authenticated via CWC_API_KEY header
 * - Two formats: House (CWC 2.0) and Senate (simplified)
 *
 * Rate limits:
 * - Per-office: 10 deliveries/hour (prevents flooding a single congressional office)
 *
 * Env vars: CWC_API_URL, CWC_API_KEY
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface CWCDeliveryRequest {
	submissionId: string;
	districtId: string; // e.g., "CA-12"
	templateId: string;
	verificationTxHash: string;
}

export interface CWCDeliveryResult {
	success: boolean;
	cwcSubmissionId?: string;
	error?: string;
}

interface CWCConfig {
	officeCode?: string;
	chamber?: 'house' | 'senate';
	topic?: string;
}

// ── XML Builders ───────────────────────────────────────────────────────────

/**
 * Parse district ID into state and district number.
 * "CA-12" -> { state: "CA", district: "12" }
 * "CA" (Senate) -> { state: "CA", district: null }
 */
function parseDistrictId(districtId: string): { state: string; district: string | null } {
	const parts = districtId.split('-');
	return {
		state: parts[0],
		district: parts.length > 1 ? parts[1] : null
	};
}

/**
 * Determine chamber from district ID format.
 * "CA-12" = House, "CA" = Senate
 */
function inferChamber(districtId: string): 'house' | 'senate' {
	return districtId.includes('-') ? 'house' : 'senate';
}

/**
 * Derive office code from district ID.
 * House: "CA12_HOUSE", Senate: "CA_SENATE"
 */
function deriveOfficeCode(districtId: string): string {
	const { state, district } = parseDistrictId(districtId);
	if (district) {
		return `${state}${district}_HOUSE`;
	}
	return `${state}_SENATE`;
}

/**
 * Escape XML special characters to prevent injection.
 */
function escapeXml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/**
 * Build CWC House format XML (CWC 2.0).
 */
function buildHouseXml(
	messageId: string,
	officeCode: string,
	subject: string,
	body: string,
	txHash: string
): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<CWC version="2.0">
    <MessageHeader>
        <MessageId>${escapeXml(messageId)}</MessageId>
        <Timestamp>${new Date().toISOString()}</Timestamp>
        <DeliveryAgent>
            <Name>Commons Advocacy Platform</Name>
        </DeliveryAgent>
        <OfficeCode>${escapeXml(officeCode)}</OfficeCode>
    </MessageHeader>
    <MessageData>
        <Subject>${escapeXml(subject)}</Subject>
        <Body>${escapeXml(body)}</Body>
        <MessageMetadata>
            <IntegrityHash>scroll:${escapeXml(txHash)}</IntegrityHash>
        </MessageMetadata>
    </MessageData>
</CWC>`;
}

/**
 * Build CWC Senate format XML (simplified).
 */
function buildSenateXml(
	messageId: string,
	officeCode: string,
	subject: string,
	body: string,
	txHash: string
): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<CWC>
    <DeliveryId>${escapeXml(messageId)}</DeliveryId>
    <DeliveryAgent>
        <Name>Commons Advocacy Platform</Name>
    </DeliveryAgent>
    <Message>
        <Subject>${escapeXml(subject)}</Subject>
        <ConstituentMessage>${escapeXml(body)}</ConstituentMessage>
    </Message>
    <OfficeCode>${escapeXml(officeCode)}</OfficeCode>
    <MessageMetadata>
        <IntegrityHash>scroll:${escapeXml(txHash)}</IntegrityHash>
    </MessageMetadata>
</CWC>`;
}

// ── Core Delivery ──────────────────────────────────────────────────────────

/**
 * Generate a unique CWC message ID.
 * Format: comm_{timestamp}_{submissionId}_{templateId}
 */
function generateMessageId(submissionId: string, templateId: string): string {
	const timestamp = Math.floor(Date.now() / 1000);
	return `comm_${timestamp}_${submissionId}_${templateId}`;
}

/**
 * Submit XML payload to CWC API endpoint.
 *
 * Uses fetch (CF Workers compatible). Retries with exponential backoff
 * on transient errors (5xx, network). Does NOT retry on validation errors (4xx).
 */
async function postToCWC(xml: string, maxRetries: number = 3): Promise<CWCDeliveryResult> {
	const apiUrl = process.env.CWC_API_URL;
	const apiKey = process.env.CWC_API_KEY;

	if (!apiUrl || !apiKey) {
		return {
			success: false,
			error: 'CWC_API_URL or CWC_API_KEY not configured'
		};
	}

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const response = await fetch(apiUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/xml',
					'Authorization': `Bearer ${apiKey}`,
					'Accept': 'application/xml'
				},
				body: xml
			});

			if (response.ok) {
				// Parse CWC response for submission ID
				const responseText = await response.text();
				const submissionIdMatch = responseText.match(/<SubmissionId>([^<]+)<\/SubmissionId>/);
				return {
					success: true,
					cwcSubmissionId: submissionIdMatch?.[1] || `cwc_${Date.now()}`
				};
			}

			// Don't retry client errors (validation failures, auth errors)
			if (response.status >= 400 && response.status < 500) {
				const errorText = await response.text();
				return {
					success: false,
					error: `CWC API error ${response.status}: ${errorText.slice(0, 200)}`
				};
			}

			// Server error — retry with backoff
			if (attempt === maxRetries) {
				return {
					success: false,
					error: `CWC API server error ${response.status} after ${maxRetries} attempts`
				};
			}

			// Exponential backoff: 1s, 2s, 4s
			await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
		} catch (error) {
			if (attempt === maxRetries) {
				return {
					success: false,
					error: `CWC API network error: ${error instanceof Error ? error.message : 'Unknown'}`
				};
			}
			await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
		}
	}

	return { success: false, error: 'Max retries exceeded' };
}

/**
 * Deliver a verified submission to Congress via CWC API.
 *
 * Called after blockchain verification succeeds. This is fire-and-forget
 * from the caller's perspective — errors are recorded on the submission
 * record but do not propagate.
 *
 * Steps:
 * 1. Fetch template data for subject/body
 * 2. Determine chamber (House/Senate) from districtId
 * 3. Check per-office rate limit (10/hour)
 * 4. Build XML payload
 * 5. POST to CWC endpoint with retry
 * 6. Update submission record with delivery status
 */
export async function deliverToCWC(request: CWCDeliveryRequest): Promise<CWCDeliveryResult> {
	const { submissionId, districtId, templateId, verificationTxHash } = request;

	console.debug('[CWCDelivery] Starting delivery:', { submissionId, districtId, templateId });

	try {
		// 1. Fetch template for message content
		const template = await prisma.template.findUnique({
			where: { id: templateId },
			select: { title: true, message_body: true, cwc_config: true }
		});

		if (!template) {
			const error = `Template ${templateId} not found`;
			console.error('[CWCDelivery]', error);
			await updateDeliveryStatus(submissionId, 'delivery_failed', error);
			return { success: false, error };
		}

		const { title: subject, message_body: body } = template;
		const cwcConfig = template.cwc_config as CWCConfig | null;

		// 2. Determine chamber and office code
		const chamber = cwcConfig?.chamber || inferChamber(districtId);
		const officeCode = cwcConfig?.officeCode || deriveOfficeCode(districtId);

		// 3. Per-office rate limit check (10 deliveries/hour per office)
		const rateLimiter = getRateLimiter();
		const officeRateKey = `cwc:office:${officeCode}`;
		const rateCheck = await rateLimiter.check(officeRateKey, {
			maxRequests: 10,
			windowMs: 60 * 60 * 1000 // 1 hour
		});

		if (!rateCheck.allowed) {
			const error = `Per-office rate limit exceeded for ${officeCode}. Retry after ${rateCheck.retryAfter}s`;
			console.warn('[CWCDelivery] Rate limited:', { officeCode, retryAfter: rateCheck.retryAfter });
			await updateDeliveryStatus(submissionId, 'delivery_failed', error);
			return { success: false, error };
		}

		// 4. Build XML payload
		const messageId = generateMessageId(submissionId, templateId);
		const xml =
			chamber === 'house'
				? buildHouseXml(messageId, officeCode, subject, body, verificationTxHash)
				: buildSenateXml(messageId, officeCode, subject, body, verificationTxHash);

		// 5. POST to CWC
		const result = await postToCWC(xml);

		// 6. Update submission record
		if (result.success) {
			await updateDeliveryStatus(submissionId, 'delivered', undefined, result.cwcSubmissionId);
			console.debug('[CWCDelivery] Delivery successful:', {
				submissionId,
				cwcSubmissionId: result.cwcSubmissionId
			});
		} else {
			await updateDeliveryStatus(submissionId, 'delivery_failed', result.error);
			console.error('[CWCDelivery] Delivery failed:', {
				submissionId,
				error: result.error
			});
		}

		return result;
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown delivery error';
		console.error('[CWCDelivery] Unexpected error:', { submissionId, error: message });
		await updateDeliveryStatus(submissionId, 'delivery_failed', message).catch((e) =>
			console.error('[CWCDelivery] Failed to update status:', e)
		);
		return { success: false, error: message };
	}
}

// ── Database Helpers ───────────────────────────────────────────────────────

/**
 * Update the delivery status on a submission record.
 */
async function updateDeliveryStatus(
	submissionId: string,
	status: string,
	error?: string,
	cwcSubmissionId?: string
): Promise<void> {
	await prisma.submission.update({
		where: { id: submissionId },
		data: {
			delivery_status: status,
			delivery_error: error || null,
			cwc_submission_id: cwcSubmissionId || undefined,
			delivered_at: status === 'delivered' ? new Date() : undefined
		}
	});
}
