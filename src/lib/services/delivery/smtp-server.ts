/**
 * Delivery Platform SMTP Server
 * Receives mailto: messages and routes certified delivery through CWC API
 */

import { SMTPServer } from 'smtp-server';
import { getConfig } from './utils/config.js';
import { parseIncomingMessage, validateMessage as _validateMessage } from './message-parser';
import { CWCClient } from './cwc-integration';
import { resolveUserByEmail, fetchTemplateBySlug, notifyDeliveryResult } from './user-resolution';
import {
	handleUnmatchedSender,
	sendVerificationRequiredBounce,
	sendGenericBounce
} from './bounce-handler';
import { certifyEmailDelivery } from './blockchain-certification';

// Type definitions for parsed message data
interface ParsedMessage {
	from: string | { text?: string; address?: string };
	templateId?: string | null;
	userId?: string | null;
	personalConnection?: string | null;
	subject?: string;
	text?: string;
	html?: string;
	to?: unknown;
	headers?: unknown;
	messageId?: string;
	date?: Date;
}

interface UserProfile {
	id: string;
	state?: string;
	[key: string]: unknown;
}

interface TemplateData {
	id: string;
	subject?: string;
	title?: string;
	message_body: string;
	[key: string]: unknown;
}

interface DeliveryResult {
	success: boolean;
	submissionId?: string;
	error?: string;
	certificationHash?: string;
	actionHash?: string;
}

// Initialize CWC client
const cwcClient = new CWCClient();

/**
 * SMTP Server Configuration
 */
const config = getConfig();
const server = new SMTPServer({
	// Server configuration
	banner: 'Delivery Platform',

	// Authentication (optional for now)
	authOptional: true,

	// Security options
	secure: config.smtp.secure,

	// Connection handling
	onConnect(session: { remoteAddress: string }, callback: () => void) {
		console.log(`New connection from ${session.remoteAddress}`);
		return callback(); // Accept all connections
	},

	// Authentication handler (if auth is enabled)
	onAuth(
		auth: { method: string; username?: string; password?: string },
		session: object,
		callback: (error?: Error | null, result?: { user: string }) => void
	) {
		if (config.smtp.auth && config.smtp.auth.user && config.smtp.auth.pass) {
			if (auth.username === config.smtp.auth.user && auth.password === config.smtp.auth.pass) {
				return callback(null, { user: auth.username });
			}
			return callback(new Error('Invalid username or password'));
		}
		return callback(null, { user: 'anonymous' });
	},

	// Mail handler - this is where the magic happens
	onData(
		stream: NodeJS.ReadableStream,
		session: { envelope: { rcptTo: { address: string }[] } },
		callback: (error?: Error) => void
	) {
		handleIncomingMail(stream, session)
			.then(() => callback())
			.catch((_error) => {
				console.error('Error occurred');
				callback(new Error('Message processing failed'));
			});
	}
});

/**
 * Handle incoming mail messages
 */
async function handleIncomingMail(
	stream: NodeJS.ReadableStream,
	session: { envelope: { rcptTo: { address: string }[] } }
): Promise<void> {
	try {
		console.log('Processing incoming message...');

		// Parse the incoming message
		const parsedMessage = await parseIncomingMessage(stream);
		const senderEmail =
			typeof parsedMessage.from === 'object' &&
			parsedMessage.from !== null &&
			'text' in parsedMessage.from
				? (parsedMessage.from as { text?: string }).text || ''
				: String(parsedMessage.from);
		const templateIdentifier = parsedMessage.templateId;

		// Validate that we have required data
		if (!templateIdentifier) {
			console.log('No template identifier found, skipping processing');
			return;
		}

		// Type assertion after null check
		const validTemplateId = String(templateIdentifier);

		console.log(`Message from: ${senderEmail}, Template: ${templateIdentifier}`);

		// Check if this is a certified delivery message
		if (!isCertifiedDeliveryAddress(session.envelope.rcptTo)) {
			console.log('Non-certified message, skipping processing');
			return;
		}

		// Resolve user by email
		const userResult = await resolveUserByEmail(senderEmail);

		if (!userResult?.user) {
			// No user found - send helpful bounce
			console.log(`No user found for email: ${senderEmail}`);
			await handleUnmatchedSender(parsedMessage, senderEmail, validTemplateId);
			return;
		}

		// Check if secondary email needs verification
		if (userResult.emailType === 'secondary' && !userResult.isVerified) {
			console.log(`Secondary email not verified: ${senderEmail}`);
			await sendVerificationRequiredBounce(senderEmail, validTemplateId);
			return;
		}

		// Fetch template data
		const templateData = await fetchTemplateBySlug(validTemplateId);
		if (!templateData) {
			console.error(`Template not found: ${templateIdentifier}`);
			// Send generic bounce since we can't identify the template
			await sendGenericBounce(senderEmail, validTemplateId);
			return;
		}

		// Process certified delivery
		await processCertifiedDelivery(parsedMessage, userResult.user, templateData);
	} catch (error) {
		console.error('Error processing incoming mail:', error instanceof Error ? error.message : 'Unknown error');
		// Don't throw - we don't want to reject the SMTP connection
		// Log the error and continue
	}
}

/**
 * Check if the recipient address indicates certified delivery
 */
function isCertifiedDeliveryAddress(recipients: { address: string }[]): boolean {
	const certifiedPatterns = [/^congress@/i, /^certified@/i, /^cwc@/i];

	return recipients.some((recipient) =>
		certifiedPatterns.some((pattern) => pattern.test(recipient.address))
	);
}

/**
 * Process certified delivery through CWC API
 */
async function processCertifiedDelivery(
	parsedMessage: ParsedMessage,
	userProfile: UserProfile,
	templateData: TemplateData
): Promise<void> {
	try {
		console.log(
			`Processing certified delivery for template: ${templateData.id}, user: ${userProfile.id}`
		);

		// Prepare CWC submission data
		const cwcMessageData = {
			templateId: templateData.id,
			userId: userProfile.id,
			subject: templateData.subject || templateData.title || 'Message from constituent',
			body: templateData.message_body,
			recipients: [determineRecipientOffice(userProfile)],
			metadata: {
				personalConnection: parsedMessage.personalConnection,
				recipientOffice: determineRecipientOffice(userProfile),
				messageId: `${templateData.id}_${userProfile.id}_${Date.now()}`
			}
		};

		// Submit to CWC API
		console.log('Submitting to CWC API...');
		const result = await cwcClient.submitMessage(cwcMessageData);

		if (result.success) {
			console.log(`CWC submission successful: ${result.submissionId}`);

			// Certify the delivery through VOTER Protocol
			const certificationResult = await certifyEmailDelivery({
				userAddress: userProfile.id,
				templateData,
				deliveryConfirmation: JSON.stringify(result)
			});

			if (certificationResult && certificationResult.success) {
				if ('transactionHash' in certificationResult) {
					console.log(`VOTER certification successful: ${certificationResult.transactionHash}`);
					// Include certification in the delivery result
					(result as DeliveryResult).certificationHash = certificationResult.transactionHash;
					(result as DeliveryResult).actionHash = certificationResult.actionHash;
				} else {
					console.log(`VOTER certification disabled: No details available`);
				}
			}
		} else {
			console.error(`CWC submission failed: ${result.error}`);
		}

		// Notify Communiqué API of the result (including certification if successful)
		await notifyDeliveryResult(templateData.id, userProfile.id, result);
	} catch (error) {
		console.error('Error processing certified delivery:', error instanceof Error ? error.message : 'Unknown error');

		// Notify of the failure
		await notifyDeliveryResult(templateData.id, userProfile.id, {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		});
	}
}

/**
 * Determine recipient office based on user profile
 * This would integrate with congressional district lookup
 */
function determineRecipientOffice(userProfile: UserProfile): string {
	// TODO: Implement congressional district lookup based on address
	// For now, return a placeholder that would be mapped to actual CWC office codes
	return `DISTRICT_${userProfile.state}_AUTO`;
}

/**
 * Start the SMTP server
 */
function startServer() {
	const port = config.smtp.port;
	const host = config.smtp.host;

	server.on('error', (err: Error) => {
		console.error('Failed to start SMTP server:', err);
		process.exit(1);
	});

	server.listen(Number(port), host, () => {
		console.log(`Communiqué SMTP Server listening on ${host}:${port}`);
		console.log(`Ready to process certified delivery messages`);
		console.log(`CWC API: ${config.api.cwcUrl}`);
		console.log(`Communiqué API: ${config.api.communiqueUrl}`);
	});
}

/**
 * Graceful shutdown
 */
process.on('SIGTERM', () => {
	console.log('Received SIGTERM, shutting down gracefully');
	server.close(() => {
		process.exit(0);
	});
});

process.on('SIGINT', () => {
	console.log('Received SIGINT, shutting down gracefully');
	server.close(() => {
		process.exit(0);
	});
});

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
	startServer();
}

export { server, startServer };
