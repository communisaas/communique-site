/**
 * Delivery Platform SMTP Server
 * Receives mailto: messages and routes certified delivery through CWC API
 */

import { SMTPServer, type SMTPServerOptions, type SMTPServerSession } from 'smtp-server';
import { simpleParser, type ParsedMail } from 'mailparser';
import { Readable } from 'stream';
import type {
	CertifiedDeliveryMessage,
	ParsedIncomingMessage,
	UserProfile,
	TemplateData,
	CWCSubmissionData,
	CWCSubmissionResult,
	SMTPError
} from '$lib/services/delivery/types';
import { parseIncomingMessage, validateMessage } from './parser';
import { CWCClient } from '$lib/services/delivery/integrations/cwc';
import { CommuniqueClient } from '$lib/services/delivery/integrations/communique';
import { VOTERClient } from '$lib/services/delivery/integrations/voter';
import { N8NClient } from '$lib/services/delivery/integrations/n8n';
import { BounceHandler } from './bounce-handler';
import { getConfig } from '$lib/services/delivery/utils/config';

export class DeliveryPlatformSMTP {
	private server: SMTPServer;
	private cwcClient: CWCClient;
	private communiqueClient: CommuniqueClient;
	private voterClient: VOTERClient;
	private n8nClient: N8NClient;
	private bounceHandler: BounceHandler;
	private config = getConfig();

	constructor() {
		this.cwcClient = new CWCClient();
		this.communiqueClient = new CommuniqueClient();
		this.voterClient = new VOTERClient();
		this.n8nClient = new N8NClient();
		this.bounceHandler = new BounceHandler();

		const serverOptions: SMTPServerOptions = {
			banner: 'Delivery Platform',
			authOptional: true,
			secure: this.config.smtp.secure,

			onConnect: this.handleConnect.bind(this),
			onAuth: this.handleAuth.bind(this),
			onData: this.handleData.bind(this),

			// Size limits
			size: 25 * 1024 * 1024, // 25MB max message size

			// Error handling
			logger: this.config.nodeEnv === 'development',
			hideSTARTTLS: !this.config.smtp.secure
		};

		this.server = new SMTPServer(serverOptions);
	}

	/**
	 * Handle new SMTP connections
	 */
	private handleConnect(session: SMTPServerSession, callback: (err?: Error | null) => void): void {
		console.log(`New SMTP connection from ${session.remoteAddress}`);

		// Rate limiting could be implemented here
		// For now, accept all connections
		callback();
	}

	/**
	 * Handle SMTP authentication
	 */
	private handleAuth(
		auth: { username: string; password: string },
		session: SMTPServerSession,
		callback: (err: Error | null | undefined, response?: { user: string }) => void
	): void {
		if (this.config.smtp.auth?.user && this.config.smtp.auth?.pass) {
			if (
				auth.username === this.config.smtp.auth.user &&
				auth.password === this.config.smtp.auth.pass
			) {
				return callback(null, { user: auth.username });
			}
			return callback(new Error('Invalid username or password'));
		}

		// No auth configured, accept as anonymous
		callback(null, { user: 'anonymous' });
	}

	/**
	 * Handle incoming mail data
	 */
	private handleData(
		stream: Readable,
		session: SMTPServerSession,
		callback: (err?: Error | null) => void
	): void {
		this.processIncomingMail(stream, session)
			.then(() => {
				callback();
			})
			.catch((_error) => {
				console.error('Mail handling error:', _error);
				callback(new Error('Message processing failed'));
			});
	}

	/**
	 * Process incoming mail messages
	 */
	private async processIncomingMail(stream: Readable, session: SMTPServerSession): Promise<void> {
		try {
			console.log('Processing incoming message...');

			// Parse the raw email
			const parsedMail = await simpleParser(stream);

			// Extract structured data from the email
			const parsedMessage = await parseIncomingMessage(parsedMail);
			const { senderEmail, templateIdentifier } = parsedMessage;

			console.log(`Message from: ${senderEmail}, Template: ${templateIdentifier}`);

			// Check if this is a certified delivery message
			if (!this.isCertifiedDeliveryAddress(session.envelope.rcptTo)) {
				console.log('Non-certified message, skipping processing');
				return;
			}

			// Resolve user by email
			const userResult = await this.communiqueClient.resolveUserByEmail(senderEmail);

			if (!userResult?.user) {
				console.log(`No user found for email: ${senderEmail}`);
				await this.bounceHandler.handleUnmatchedSender(
					parsedMessage,
					senderEmail,
					templateIdentifier
				);
				return;
			}

			// Check if secondary email needs verification
			if (userResult.emailType === 'secondary' && !userResult.isVerified) {
				console.log(`Secondary email not verified: ${senderEmail}`);
				await this.bounceHandler.sendVerificationRequiredBounce(senderEmail, templateIdentifier);
				return;
			}

			// Fetch template data
			const templateData = await this.communiqueClient.fetchTemplateBySlug(templateIdentifier);
			if (!templateData) {
				console.error(`Template not found: ${templateIdentifier}`);
				await this.bounceHandler.sendGenericBounce(senderEmail, templateIdentifier);
				return;
			}

			// Process certified delivery
			await this.processCertifiedDelivery(parsedMessage, userResult.user, templateData);
		} catch (_error) {
			console.error('Error handling incoming mail:', _error);
			// Don't throw - we don't want to reject the SMTP connection
			// Log the error and continue
		}
	}

	/**
	 * Check if the recipient address indicates certified delivery
	 */
	private isCertifiedDeliveryAddress(recipients?: Array<{ address: string }>): boolean {
		if (!recipients || recipients.length === 0) {
			return false;
		}

		const certifiedPatterns = [/^congress@/i, /^certified@/i, /^cwc@/i];

		return recipients.some((recipient) =>
			certifiedPatterns.some((pattern) => pattern.test(recipient.address))
		);
	}

	/**
	 * Process certified delivery through CWC API
	 */
	private async processCertifiedDelivery(
		parsedMessage: ParsedIncomingMessage,
		userProfile: UserProfile,
		templateData: TemplateData
	): Promise<void> {
		try {
			console.log(
				`Processing certified delivery for template: ${templateData.id}, user: ${userProfile.id}`
			);

			// Trigger N8N workflow for AI-powered moderation
			if (this.config.features.enableN8NWorkflows) {
				const workflowResult = await this.n8nClient.triggerTemplateModeration({
					templateId: templateData.id,
					userId: userProfile.id,
					userEmail: userProfile.email,
					userName: userProfile.name,
					userAddress: userProfile.street,
					userZip: userProfile.zip,
					subject: templateData.subject,
					message_body: templateData.message_body,
					deliveryMethod: 'certified',
					timestamp: new Date().toISOString()
				});

				if (!workflowResult.success) {
					console.error('N8N workflow failed:', workflowResult.error);
					// Continue with direct submission as fallback
				}
			}

			// Prepare CWC submission data
			const cwcMessageData: CWCSubmissionData = {
				templateId: templateData.id,
				userId: userProfile.id,
				subject: templateData.subject || templateData.title,
				text: templateData.message_body,
				personalConnection: parsedMessage.personalConnection,
				userProfile: {
					firstName: userProfile.name?.split(' ')[0] || '',
					lastName: userProfile.name?.split(' ').slice(1).join(' ') || '',
					email: userProfile.email,
					address1: userProfile.street || '',
					address2: '',
					city: userProfile.city || '',
					state: userProfile.state || '',
					zip: userProfile.zip || ''
				},
				recipientOffice: this.determineRecipientOffice(userProfile),
				messageId: `${templateData.id}_${userProfile.id}_${Date.now()}`
			};

			// Submit to CWC API
			console.log('Submitting to CWC API...');
			const result = await this.cwcClient.submitMessage(cwcMessageData);

			if (result.success) {
				console.log(`CWC submission successful: ${result.submissionId}`);

				// Certify the delivery through VOTER Protocol if enabled
				if (this.config.features.enableVoterCertification && result.submissionId) {
					const certificationResult = await this.voterClient.certifyDelivery({
						userProfile,
						templateData,
						cwcResult: result,
						recipients: ['congress@communi.email']
					});

					if (certificationResult) {
						console.log(`VOTER certification successful: ${certificationResult.certificationHash}`);
						result.certificationHash = certificationResult.certificationHash;
						result.rewardAmount = certificationResult.rewardAmount;
					}
				}
			} else {
				console.error(`CWC submission failed: ${result.error}`);
			}

			// Notify Communiqué API of the result
			await this.communiqueClient.notifyDeliveryResult({
				templateId: templateData.id,
				userId: userProfile.id,
				deliveryStatus: result.success ? 'delivered' : 'failed',
				cwcResult: result,
				timestamp: new Date()
			});
		} catch (_error) {
			console.error('Error processing certified delivery:', _error);

			// Notify of the failure
			await this.communiqueClient.notifyDeliveryResult({
				templateId: templateData.id,
				userId: userProfile.id,
				deliveryStatus: 'failed',
				error: _error instanceof Error ? _error.message : 'Unknown error',
				timestamp: new Date()
			});
		}
	}

	/**
	 * Determine recipient office based on user profile
	 */
	private determineRecipientOffice(userProfile: UserProfile): string {
		// TODO: Implement congressional district lookup based on address
		// For now, return a placeholder that would be mapped to actual CWC office codes
		if (userProfile.congressionalDistrict) {
			return userProfile.congressionalDistrict;
		}
		return `DISTRICT_${userProfile.state || 'XX'}_AUTO`;
	}

	/**
	 * Start the SMTP server
	 */
	public start(): void {
		const { host, port } = this.config.smtp;

		this.server.listen(port, host, () => {
			console.log(`Communiqué Delivery Platform SMTP Server listening on ${host}:${port}`);
			console.log(`Ready to process certified delivery messages`);
			console.log(`CWC API: ${this.config.api.cwcUrl}`);
			console.log(`Communiqué API: ${this.config.api.communiqueUrl}`);
			console.log(
				`N8N Workflows: ${this.config.features.enableN8NWorkflows ? 'Enabled' : 'Disabled'}`
			);
			console.log(
				`VOTER Certification: ${this.config.features.enableVoterCertification ? 'Enabled' : 'Disabled'}`
			);
		});

		this.server.on('error', (err) => {
			console.error('SMTP Server error:', err);
		});
	}

	/**
	 * Stop the SMTP server gracefully
	 */
	public async stop(): Promise<void> {
		return new Promise((resolve) => {
			console.log('Shutting down SMTP server...');
			this.server.close(() => {
				console.log('SMTP server closed');
				resolve();
			});
		});
	}
}

// Graceful shutdown handlers
let smtpServer: DeliveryPlatformSMTP | null = null;

process.on('SIGTERM', async () => {
	console.log('Received SIGTERM, shutting down gracefully');
	if (smtpServer) {
		await smtpServer.stop();
	}
	process.exit(0);
});

process.on('SIGINT', async () => {
	console.log('Received SIGINT, shutting down gracefully');
	if (smtpServer) {
		await smtpServer.stop();
	}
	process.exit(0);
});

// Export for use as module
export function createSMTPServer(): DeliveryPlatformSMTP {
	smtpServer = new DeliveryPlatformSMTP();
	return smtpServer;
}
