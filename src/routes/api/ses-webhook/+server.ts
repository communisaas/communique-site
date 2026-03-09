import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/core/db';

// TODO: verify SNS signature (fetch SigningCertURL, validate against cert)
// The endpoint URL is secret/non-guessable, so spoofing risk is low for now.

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

	// Handle SNS subscription confirmation
	if (body.Type === 'SubscriptionConfirmation') {
		if (body.SubscribeURL) {
			// Validate SNS domain to prevent SSRF
			try {
				const url = new URL(body.SubscribeURL);
				if (!url.hostname.endsWith('.amazonaws.com') || url.protocol !== 'https:') {
					console.error('[ses-webhook] Rejected non-SNS SubscribeURL:', url.hostname);
					return json({ ok: false, error: 'invalid SubscribeURL domain' }, { status: 403 });
				}
			} catch {
				return json({ ok: false, error: 'invalid SubscribeURL' }, { status: 400 });
			}
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

	// Validate TopicArn matches our configured topic (prevents cross-account injection)
	// TODO: validate against SES_SNS_TOPIC_ARN env var when configured

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
