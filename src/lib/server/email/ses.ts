import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { env } from '$env/dynamic/private';

let client: SESv2Client | null = null;

function getClient(): SESv2Client {
	if (!client) {
		client = new SESv2Client({
			region: env.AWS_REGION ?? 'us-east-1',
			credentials: {
				accessKeyId: env.AWS_ACCESS_KEY_ID ?? '',
				secretAccessKey: env.AWS_SECRET_ACCESS_KEY ?? ''
			}
		});
	}
	return client;
}

export interface SendResult {
	success: boolean;
	messageId?: string;
	error?: string;
}

/**
 * Send a single email via SES v2.
 * No retries here -- the batch layer handles retry logic.
 */
export async function sendEmail(
	to: string,
	from: string,
	fromName: string,
	subject: string,
	htmlBody: string,
	unsubscribeUrl?: string
): Promise<SendResult> {
	try {
		const ses = getClient();
		const command = new SendEmailCommand({
			FromEmailAddress: `${fromName} <${from}>`,
			Destination: {
				ToAddresses: [to]
			},
			Content: {
				Simple: {
					Subject: { Data: subject, Charset: 'UTF-8' },
					Body: {
						Html: { Data: htmlBody, Charset: 'UTF-8' }
					},
					Headers: unsubscribeUrl
						? [
								{ Name: 'List-Unsubscribe', Value: `<${unsubscribeUrl}>` },
								{ Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' }
							]
						: undefined
				}
			}
		});

		const result = await ses.send(command);
		return {
			success: true,
			messageId: result.MessageId
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown SES error';
		return {
			success: false,
			error: message
		};
	}
}
