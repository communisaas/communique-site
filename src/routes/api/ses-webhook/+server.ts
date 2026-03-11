import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { db } from '$lib/core/db';
import { verifySNSSignature } from '$lib/core/security/sns-verify';

interface SNSMessage {
	Type: 'SubscriptionConfirmation' | 'Notification' | 'UnsubscribeConfirmation';
	MessageId: string;
	TopicArn: string;
	Subject?: string;
	Message: string;
	Timestamp: string;
	SignatureVersion: string;
	Signature: string;
	SigningCertURL: string;
	SubscribeURL?: string;
	Token?: string;
}

interface SESBounceMessage {
	notificationType: 'Bounce';
	bounce: {
		bounceType: 'Permanent' | 'Transient';
		bouncedRecipients: Array<{ emailAddress: string }>;
	};
}

interface SESComplaintMessage {
	notificationType: 'Complaint';
	complaint: {
		complainedRecipients: Array<{ emailAddress: string }>;
	};
}

type SESMessage = SESBounceMessage | SESComplaintMessage | { notificationType: string };

export const POST: RequestHandler = async ({ request }) => {
	let body: SNSMessage;

	try {
		// SNS sends Content-Type: text/plain, so we parse the raw text as JSON
		const raw = await request.text();
		body = JSON.parse(raw);
	} catch {
		return json({ ok: false, error: 'invalid JSON' }, { status: 400 });
	}

	// F1: Reject messages from unexpected SNS topics before signature verification.
	// SES_SNS_TOPIC_ARN must be configured — without it, any valid SNS topic could
	// subscribe and inject fake bounce/complaint data.
	const allowedTopic = env.SES_SNS_TOPIC_ARN;
	if (!allowedTopic) {
		console.error('[ses-webhook] SES_SNS_TOPIC_ARN not configured — rejecting all SNS messages');
		return json({ ok: false, error: 'webhook not configured' }, { status: 403 });
	}
	if (body.TopicArn !== allowedTopic) {
		console.error('[ses-webhook] Unexpected TopicArn:', body.TopicArn);
		return json({ ok: false, error: 'topic not allowed' }, { status: 403 });
	}

	// Verify SNS message signature to prevent spoofed notifications
	const verifyResult = await verifySNSSignature(body);
	if (!verifyResult.valid) {
		console.error('[ses-webhook] SNS signature verification failed:', verifyResult.error);
		return json({ ok: false, error: 'signature verification failed' }, { status: 403 });
	}

	// Handle SNS subscription confirmation
	if (body.Type === 'SubscriptionConfirmation') {
		if (body.SubscribeURL) {
			console.log('[ses-webhook] Confirming SNS subscription:', body.TopicArn);
			try {
				await fetch(body.SubscribeURL);
			} catch (err) {
				console.error('[ses-webhook] Failed to confirm subscription:', err);
			}
		}
		return json({ ok: true });
	}

	// Only process Notification type from here on
	if (body.Type !== 'Notification') {
		return json({ ok: true });
	}

	let message: SESMessage;
	try {
		message = JSON.parse(body.Message);
	} catch {
		return json({ ok: false, error: 'invalid Message JSON' }, { status: 400 });
	}

	if (message.notificationType === 'Bounce') {
		const bounce = (message as SESBounceMessage).bounce;

		// Only process permanent bounces — transient bounces are retried by SES
		if (bounce.bounceType !== 'Permanent') {
			return json({ ok: true });
		}

		const emails = bounce.bouncedRecipients.map((r) => r.emailAddress.toLowerCase());
		console.log('[ses-webhook] Bounce:', emails.length, 'emails', emails);

		if (emails.length > 0) {
			// Cross-org update is intentional: a bounced address is bounced everywhere,
			// and complaints are the strongest suppression signal regardless of org.
			await db.supporter.updateMany({
				where: {
					email: { in: emails },
					// Don't downgrade a complaint to a bounce
					emailStatus: { not: 'complained' }
				},
				data: { emailStatus: 'bounced' }
			});
		}
	} else if (message.notificationType === 'Complaint') {
		const complaint = (message as SESComplaintMessage).complaint;
		const emails = complaint.complainedRecipients.map((r) => r.emailAddress.toLowerCase());
		console.log('[ses-webhook] Complaint:', emails.length, 'emails', emails);

		if (emails.length > 0) {
			// Cross-org update is intentional: a bounced address is bounced everywhere,
			// and complaints are the strongest suppression signal regardless of org.
			// Complaints always win — once complained, never re-emailed
			await db.supporter.updateMany({
				where: { email: { in: emails } },
				data: { emailStatus: 'complained' }
			});
		}
	}

	return json({ ok: true });
};
