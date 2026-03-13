/**
 * Twilio client wrapper — SMS sending + patch-through calling.
 *
 * Follows the lazy-init client pattern from ses.ts.
 * Uses dynamic import to avoid bundling in non-Twilio deployments.
 */
import { env } from '$env/dynamic/private';
import type { SmsSendResult, CallInitResult } from './types';

let twilioClient: any = null;

async function getClient() {
	if (!twilioClient) {
		const accountSid = env.TWILIO_ACCOUNT_SID;
		const authToken = env.TWILIO_AUTH_TOKEN;
		if (!accountSid || !authToken) {
			throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN env vars are required');
		}
		// Dynamic import to avoid bundling in non-Twilio deployments
		const twilio = await import('twilio');
		twilioClient = twilio.default(accountSid, authToken);
	}
	return twilioClient;
}

function getFromNumber(): string {
	const num = env.TWILIO_PHONE_NUMBER;
	if (!num) throw new Error('TWILIO_PHONE_NUMBER env var is required');
	return num;
}

/**
 * Validate E.164 phone number format
 */
export function isValidE164(phone: string): boolean {
	return /^\+[1-9]\d{1,14}$/.test(phone);
}

/**
 * Send a single SMS via Twilio
 */
export async function sendSms(to: string, body: string, fromNumber?: string): Promise<SmsSendResult> {
	if (!isValidE164(to)) {
		return { success: false, error: 'Invalid phone number format (E.164 required)' };
	}
	try {
		const client = await getClient();
		const message = await client.messages.create({
			to,
			from: fromNumber || getFromNumber(),
			body,
			statusCallback: `${env.PUBLIC_BASE_URL || ''}/api/sms/webhook`
		});
		return { success: true, sid: message.sid };
	} catch (err) {
		const error = err instanceof Error ? err.message : 'Unknown Twilio error';
		return { success: false, error };
	}
}

/**
 * Initiate a patch-through call connecting a supporter to a decision-maker.
 * Flow: Twilio calls the supporter -> plays message -> dials the target.
 */
export async function initiatePatchThroughCall(
	callerPhone: string,
	targetPhone: string,
	callbackUrl: string,
	targetName?: string,
	districtInfo?: string
): Promise<CallInitResult> {
	if (!isValidE164(callerPhone) || !isValidE164(targetPhone)) {
		return { success: false, error: 'Invalid phone number format (E.164 required)' };
	}
	try {
		const client = await getClient();
		const greeting = targetName
			? `Connecting you with ${targetName}.`
			: 'Connecting you with your representative.';
		const districtMsg = districtInfo
			? ` You are a verified constituent from ${districtInfo}.`
			: '';

		const twiml = `<Response><Say>${greeting}${districtMsg} Please hold.</Say><Dial callerId="${getFromNumber()}">${targetPhone}</Dial></Response>`;

		const call = await client.calls.create({
			to: callerPhone,
			from: getFromNumber(),
			twiml,
			statusCallback: callbackUrl,
			statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
		});
		return { success: true, callSid: call.sid };
	} catch (err) {
		const error = err instanceof Error ? err.message : 'Unknown Twilio error';
		return { success: false, error };
	}
}

/**
 * Validate Twilio webhook signature
 */
export async function validateTwilioSignature(
	signature: string,
	url: string,
	params: Record<string, string>
): Promise<boolean> {
	try {
		const authToken = env.TWILIO_AUTH_TOKEN;
		if (!authToken) return false;
		const twilio = await import('twilio');
		return twilio.validateRequest(authToken, signature, url, params);
	} catch {
		return false;
	}
}
