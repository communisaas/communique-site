/**
 * Delivery Platform SMTP Server
 * Receives mailto: messages and routes certified delivery through CWC API
 */

import { SMTPServer } from 'smtp-server';
import config from './config';
import { parseIncomingMessage, validateMessage } from './message-parser';
import { CWCClient } from './cwc-integration';
const {
	resolveUserByEmail,
	fetchTemplateBySlug,
	notifyDeliveryResult
} = require('./user-resolution');
import { handleUnmatchedSender, sendVerificationRequiredBounce } from './bounce-handler';
import { certifyEmailDelivery } from './blockchain-certification';

// Initialize CWC client
const cwcClient = new CWCClient();

/**
 * SMTP Server Configuration
 */
const server = new SMTPServer({
	// Server configuration
	banner: 'Delivery Platform',

	// Authentication (optional for now)
	authOptional: true,

	// Security options
	secure: config.smtp.secure,

	// Connection handling
	onConnect(session, callback) {
		console.log(`New connection from ${session.remoteAddress}`);
		return callback(); // Accept all connections
	},

	// Authentication handler (if auth is enabled)
	onAuth(auth, session, callback) {
		if (config.smtp.auth.user && config.smtp.auth.pass) {
			if (auth.username === config.smtp.auth.user && auth.password === config.smtp.auth.pass) {
				return callback(null, { user: auth.username });
			}
			return callback(new Error('Invalid username or password'));
		}
		return callback(null, { user: 'anonymous' });
	},

	// Mail handler - this is where the magic happens
	onData(stream, session, callback) {
		handleIncomingMail(stream, session)
			.then(() => callback())
			.catch((error) => {
				console.error('Mail handling error:', error);
				callback(new Error('Message processing failed'));
			});
	}
});

/**
 * Handle incoming mail messages
 */
async function handleIncomingMail(stream: any, session: any) {
	try {
		console.log('Processing incoming message...');

		// Parse the incoming message
		const parsedMessage = await parseIncomingMessage(stream);
		const senderEmail = parsedMessage.senderEmail;
		const templateIdentifier = parsedMessage.templateIdentifier;

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
			await handleUnmatchedSender(parsedMessage, senderEmail, templateIdentifier);
			return;
		}

		// Check if secondary email needs verification
		if (userResult.emailType === 'secondary' && !userResult.isVerified) {
			console.log(`Secondary email not verified: ${senderEmail}`);
			await sendVerificationRequiredBounce(senderEmail, templateIdentifier);
			return;
		}

		// Fetch template data
		const templateData = await fetchTemplateBySlug(templateIdentifier);
		if (!templateData) {
			console.error(`Template not found: ${templateIdentifier}`);
			// Send generic bounce since we can't identify the template
			import { sendGenericBounce } from './bounce-handler';
			await sendGenericBounce(senderEmail, templateIdentifier);
			return;
		}

		// Process certified delivery
		await processCertifiedDelivery(parsedMessage, userResult.user, templateData);
	} catch (error: any) {
		console.error('Error handling incoming mail:', error);
		// Don't throw - we don't want to reject the SMTP connection
		// Log the error and continue
	}
}

/**
 * Check if the recipient address indicates certified delivery
 */
function isCertifiedDeliveryAddress(recipients: any) {
	const certifiedPatterns = [/^congress@/i, /^certified@/i, /^cwc@/i];

	return recipients.some((recipient) =>
		certifiedPatterns.some((pattern) => pattern.test(recipient.address))
	);
}

/**
 * Process certified delivery through CWC API
 */
async function processCertifiedDelivery(parsedMessage: any, userProfile: any, templateData: any) {
	try {
		console.log(
			`Processing certified delivery for template: ${templateData.id}, user: ${userProfile.id}`
		);

		// Prepare CWC submission data
		const cwcMessageData = {
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
				address2: '', // TODO: Add address2 field to user model
				city: userProfile.city || '',
				state: userProfile.state || '',
				zip: userProfile.zip || ''
			},
			recipientOffice: determineRecipientOffice(userProfile),
			messageId: `${templateData.id}_${userProfile.id}_${Date.now()}`
		};

		// Submit to CWC API
		console.log('Submitting to CWC API...');
		const result = await cwcClient.submitMessage(cwcMessageData);

		if (result.success) {
			console.log(`CWC submission successful: ${result.submissionId}`);

			// Certify the delivery through VOTER Protocol
			const certificationResult = await certifyEmailDelivery({
				userProfile,
				templateData,
				cwcResult: result,
				recipients: ['congress@communi.email']
			});

			if (certificationResult) {
				console.log(`VOTER certification successful: ${certificationResult.certificationHash}`);
				// Include certification in the delivery result
				result.certificationHash = certificationResult.certificationHash;
				result.rewardAmount = certificationResult.rewardAmount;
			}
		} else {
			console.error(`CWC submission failed: ${result.error}`);
		}

		// Notify Communiqué API of the result (including certification if successful)
		await notifyDeliveryResult(templateData.id, userProfile.id, result);
	} catch (error: any) {
		console.error('Error processing certified delivery:', error);

		// Notify of the failure
		await notifyDeliveryResult(templateData.id, userProfile.id, {
			success: false,
			error: error.message
		});
	}
}

/**
 * Determine recipient office based on user profile
 * This would integrate with congressional district lookup
 */
function determineRecipientOffice(userProfile: any) {
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

	server.listen(port, host, (err) => {
		if (err) {
			console.error('Failed to start SMTP server:', err);
			process.exit(1);
		}

		console.log(`Communiqué SMTP Server listening on ${host}:${port}`);
		console.log(`Ready to process certified delivery messages`);
		console.log(`CWC API: ${config.cwc.apiUrl}`);
		console.log(`Communiqué API: ${config.communique.apiUrl}`);
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
if (require.main === module) {
	startServer();
}

export {  server, startServer  };
