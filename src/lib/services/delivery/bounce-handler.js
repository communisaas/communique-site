/**
 * Bounce Email Handler
 * Sends helpful bounce emails when messages can't be processed
 */

const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const config = require('./config');
const { detectPotentialUser, fetchTemplateBySlug } = require('./user-resolution');

// Create reusable transporter
let transporter = null;

/**
 * Initialize email transporter
 */
function initTransporter() {
	if (!transporter) {
		// Use SendGrid, AWS SES, or another service in production
		// For now, using generic SMTP configuration
		transporter = nodemailer.createTransport({
			host: process.env.SMTP_RELAY_HOST || 'smtp.sendgrid.net',
			port: process.env.SMTP_RELAY_PORT || 587,
			secure: false,
			auth: {
				user: process.env.SMTP_RELAY_USER || 'apikey',
				pass: process.env.SMTP_RELAY_PASS || process.env.SENDGRID_API_KEY || ''
			}
		});
	}
	return transporter;
}

/**
 * Handle unmatched sender
 * Sends bounce email with actionable options
 */
async function handleUnmatchedSender(parsedMessage, senderEmail, templateSlug) {
	try {
		// Try to detect potential user
		const potentialUser = await detectPotentialUser(parsedMessage, templateSlug);

		if (potentialUser) {
			// User likely exists - offer to add email
			await sendAddEmailBounce(senderEmail, potentialUser.id, templateSlug);
		} else {
			// No user found - offer signup
			await sendNewUserBounce(senderEmail, templateSlug);
		}
	} catch (error) {
		console.error('Error handling unmatched sender:', error);
		// Send generic bounce as fallback
		await sendGenericBounce(senderEmail, templateSlug);
	}
}

/**
 * Send bounce email for adding email to existing account
 */
async function sendAddEmailBounce(senderEmail, userId, templateSlug) {
	const token = generateVerificationToken(senderEmail, userId, templateSlug);
	const addEmailUrl = `https://communique.app/api/user/emails/add-verified?token=${token}&redirect=/s/${templateSlug}`;

	const template = templateSlug ? await fetchTemplateBySlug(templateSlug) : null;
	const templateName = template?.title || 'your message';

	const mailOptions = {
		from: '"Communiqué" <noreply@communi.email>',
		to: senderEmail,
		subject: 'Email not recognized - Communiqué',
		html: `
<!DOCTYPE html>
<html>
<head>
	<style>
		body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 30px; }
		.button { 
			display: inline-block; 
			background: #10b981; 
			color: white; 
			padding: 12px 24px; 
			text-decoration: none; 
			border-radius: 6px; 
			margin: 20px 0;
		}
		.footer { 
			margin-top: 40px; 
			padding-top: 20px; 
			border-top: 1px solid #e5e7eb; 
			font-size: 12px; 
			color: #666; 
		}
		.info-box {
			background: #f3f4f6;
			border-left: 4px solid #10b981;
			padding: 15px;
			margin: 20px 0;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1 style="margin: 0; color: #10b981;">Communiqué</h1>
		</div>
		
		<h2>Email address not found</h2>
		
		<p>We received your attempt to send "${templateName}" but couldn't process it because <strong>${senderEmail}</strong> isn't connected to your Communiqué account.</p>
		
		<div class="info-box">
			<p style="margin: 0;"><strong>Quick fix:</strong> Add this email to your account with one click.</p>
		</div>
		
		<div style="text-align: center;">
			<a href="${addEmailUrl}" class="button">Add This Email to Your Account</a>
		</div>
		
		<p>This will:</p>
		<ul>
			<li>Add ${senderEmail} to your profile</li>
			<li>Mark it as verified automatically</li>
			<li>Return you to the template to resend</li>
		</ul>
		
		<div class="footer">
			<p>This link expires in 24 hours for security.</p>
			<p>Wrong account? <a href="https://communique.app/auth/signup?email=${encodeURIComponent(senderEmail)}">Create a new account</a> or <a href="https://communique.app/s/${templateSlug}">send from the website</a>.</p>
		</div>
	</div>
</body>
</html>
		`,
		text: `
Email address not found

We received your attempt to send "${templateName}" but couldn't process it because ${senderEmail} isn't connected to your Communiqué account.

Add this email to your account: ${addEmailUrl}

This link expires in 24 hours.
		`
	};

	const transport = initTransporter();
	await transport.sendMail(mailOptions);
	console.log(`Sent add-email bounce to ${senderEmail}`);
}

/**
 * Send bounce email for new user signup
 */
async function sendNewUserBounce(senderEmail, templateSlug) {
	const signupUrl = `https://communique.app/auth/signup?email=${encodeURIComponent(senderEmail)}&template=${templateSlug}`;
	const templateUrl = templateSlug
		? `https://communique.app/s/${templateSlug}`
		: 'https://communique.app';

	const template = templateSlug ? await fetchTemplateBySlug(templateSlug) : null;
	const templateName = template?.title || 'your message';

	const mailOptions = {
		from: '"Communiqué" <noreply@communi.email>',
		to: senderEmail,
		subject: 'No account found - Communiqué',
		html: `
<!DOCTYPE html>
<html>
<head>
	<style>
		body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 30px; }
		.button { 
			display: inline-block; 
			background: #10b981; 
			color: white; 
			padding: 12px 24px; 
			text-decoration: none; 
			border-radius: 6px; 
			margin: 20px 0;
		}
		.button-secondary {
			display: inline-block;
			border: 2px solid #10b981;
			color: #10b981;
			padding: 10px 20px;
			text-decoration: none;
			border-radius: 6px;
			margin: 10px;
		}
		.footer { 
			margin-top: 40px; 
			padding-top: 20px; 
			border-top: 1px solid #e5e7eb; 
			font-size: 12px; 
			color: #666; 
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1 style="margin: 0; color: #10b981;">Communiqué</h1>
		</div>
		
		<h2>No account found</h2>
		
		<p>We received your attempt to send "${templateName}" but no Communiqué account exists for <strong>${senderEmail}</strong>.</p>
		
		<p>To send messages to Congress and other decision makers, you'll need a Communiqué account.</p>
		
		<div style="text-align: center;">
			<a href="${signupUrl}" class="button">Create Account</a>
			<br>
			<a href="${templateUrl}" class="button-secondary">Send from Website</a>
		</div>
		
		<div class="footer">
			<p>Already have an account? You may have signed up with a different email address. <a href="https://communique.app/auth/login">Sign in</a> to check.</p>
		</div>
	</div>
</body>
</html>
		`,
		text: `
No account found

We received your attempt to send "${templateName}" but no Communiqué account exists for ${senderEmail}.

Create an account: ${signupUrl}
Or send from the website: ${templateUrl}

Already have an account? You may have signed up with a different email address.
		`
	};

	const transport = initTransporter();
	await transport.sendMail(mailOptions);
	console.log(`Sent new-user bounce to ${senderEmail}`);
}

/**
 * Send bounce for unverified secondary email
 */
async function sendVerificationRequiredBounce(senderEmail, templateSlug) {
	const verifyUrl = `https://communique.app/settings/emails`;

	const mailOptions = {
		from: '"Communiqué" <noreply@communi.email>',
		to: senderEmail,
		subject: 'Email verification required - Communiqué',
		html: `
<!DOCTYPE html>
<html>
<head>
	<style>
		body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 30px; }
		.button { 
			display: inline-block; 
			background: #10b981; 
			color: white; 
			padding: 12px 24px; 
			text-decoration: none; 
			border-radius: 6px; 
			margin: 20px 0;
		}
		.warning-box {
			background: #fef3c7;
			border-left: 4px solid #f59e0b;
			padding: 15px;
			margin: 20px 0;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1 style="margin: 0; color: #10b981;">Communiqué</h1>
		</div>
		
		<h2>Email verification required</h2>
		
		<div class="warning-box">
			<p style="margin: 0;"><strong>${senderEmail}</strong> is added to your account but needs verification for certified delivery.</p>
		</div>
		
		<p>For security, certified messages to Congress require verified email addresses.</p>
		
		<div style="text-align: center;">
			<a href="${verifyUrl}" class="button">Verify Your Email</a>
		</div>
		
		<p>Verification takes just a minute and ensures your messages are delivered properly.</p>
	</div>
</body>
</html>
		`,
		text: `
Email verification required

${senderEmail} is added to your account but needs verification for certified delivery.

Verify your email: ${verifyUrl}
		`
	};

	const transport = initTransporter();
	await transport.sendMail(mailOptions);
	console.log(`Sent verification-required bounce to ${senderEmail}`);
}

/**
 * Send generic bounce email
 */
async function sendGenericBounce(senderEmail, templateSlug) {
	const websiteUrl = templateSlug
		? `https://communique.app/s/${templateSlug}`
		: 'https://communique.app';

	const mailOptions = {
		from: '"Communiqué" <noreply@communi.email>',
		to: senderEmail,
		subject: 'Message could not be processed - Communiqué',
		html: `
<!DOCTYPE html>
<html>
<head>
	<style>
		body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 30px; }
		.button { 
			display: inline-block; 
			background: #10b981; 
			color: white; 
			padding: 12px 24px; 
			text-decoration: none; 
			border-radius: 6px; 
			margin: 20px 0;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1 style="margin: 0; color: #10b981;">Communiqué</h1>
		</div>
		
		<h2>Message could not be processed</h2>
		
		<p>We received your email but couldn't process it automatically.</p>
		
		<p>Please send your message directly from our website:</p>
		
		<div style="text-align: center;">
			<a href="${websiteUrl}" class="button">Send from Website</a>
		</div>
		
		<p>If you continue to have issues, please contact support@communique.app</p>
	</div>
</body>
</html>
		`,
		text: `
Message could not be processed

We received your email but couldn't process it automatically.

Please send your message directly from our website: ${websiteUrl}

If you continue to have issues, please contact support@communique.app
		`
	};

	const transport = initTransporter();
	await transport.sendMail(mailOptions);
	console.log(`Sent generic bounce to ${senderEmail}`);
}

/**
 * Generate verification token for email addition
 */
function generateVerificationToken(email, userId, templateSlug) {
	const payload = {
		email,
		userId,
		templateSlug,
		timestamp: Date.now(),
		purpose: 'email_verification'
	};

	const secret =
		process.env.EMAIL_VERIFICATION_SECRET || process.env.JWT_SECRET || 'development-secret';

	return jwt.sign(payload, secret, {
		expiresIn: '24h',
		issuer: 'communique.app',
		audience: 'email-verification'
	});
}

module.exports = {
	handleUnmatchedSender,
	sendAddEmailBounce,
	sendNewUserBounce,
	sendVerificationRequiredBounce,
	sendGenericBounce
};
