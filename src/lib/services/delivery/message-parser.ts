/**
 * Email Message Parser
 * Extracts template metadata and content from incoming emails
 */

import { simpleParser } from 'mailparser';

/**
 * Parse incoming email to extract template data
 */
async function parseIncomingMessage(stream: any) {
	try {
		const parsed = await simpleParser(stream);

		// Extract template metadata from headers or subject
		const templateId = extractTemplateId(parsed);
		const userId = extractUserId(parsed);
		const personalConnection = extractPersonalConnection(parsed);

		return {
			templateId,
			userId,
			personalConnection,
			subject: parsed.subject,
			text: parsed.text,
			html: parsed.html,
			from: parsed.from,
			to: parsed.to,
			headers: parsed.headers,
			messageId: parsed.messageId,
			date: parsed.date
		};
	} catch (error: any) {
		console.error('Error parsing message:', error);
		throw new Error('Failed to parse incoming email');
	}
}

/**
 * Extract template ID from email headers or subject
 */
function extractTemplateId(parsed: any) {
	// Check for custom header first
	const headerTemplateId = parsed.headers.get('x-template-id');
	if (headerTemplateId) {
		return headerTemplateId;
	}

	// Try to extract from subject line
	// Expected format: [TEMPLATE:template-id] Subject
	const subjectMatch = parsed.subject?.match(/\[TEMPLATE:([^\]]+)\]/);
	if (subjectMatch) {
		return subjectMatch[1];
	}

	// Try to extract from message-id
	// Expected format: template-id.user-id.timestamp@communi.email
	const messageIdMatch = parsed.messageId?.match(/^([^.]+)\.([^.]+)\.(\d+)@/);
	if (messageIdMatch) {
		return messageIdMatch[1];
	}

	return null;
}

/**
 * Extract user ID from email headers or message ID
 */
function extractUserId(parsed: any) {
	// Check for custom header
	const headerUserId = parsed.headers.get('x-user-id');
	if (headerUserId) {
		return headerUserId;
	}

	// Extract from message-id
	const messageIdMatch = parsed.messageId?.match(/^([^.]+)\.([^.]+)\.(\d+)@/);
	if (messageIdMatch) {
		return messageIdMatch[2];
	}

	return null;
}

/**
 * Extract personal connection from email body
 */
function extractPersonalConnection(parsed: any) {
	const text = parsed.text || '';

	// Look for personal connection marker
	// Expected format: [PERSONAL_CONNECTION_START]content[PERSONAL_CONNECTION_END]
	const personalConnectionMatch = text.match(
		/\[PERSONAL_CONNECTION_START\]([\s\S]*?)\[PERSONAL_CONNECTION_END\]/
	);
	if (personalConnectionMatch) {
		return personalConnectionMatch[1].trim();
	}

	// If no markers, assume the first paragraph is personal connection
	// This is a fallback for simple mailto: links
	const paragraphs = text.split('\n\n');
	if (paragraphs.length > 1) {
		return paragraphs[0].trim();
	}

	return null;
}

/**
 * Validate that message contains required metadata
 */
function validateMessage(parsedMessage: any) {
	const errors = [];

	if (!parsedMessage.templateId) {
		errors.push('Template ID not found in message headers or subject');
	}

	if (!parsedMessage.userId) {
		errors.push('User ID not found in message headers');
	}

	if (!parsedMessage.subject) {
		errors.push('Message subject is required');
	}

	if (!parsedMessage.text && !parsedMessage.html) {
		errors.push('Message content is required');
	}

	return {
		isValid: errors.length === 0,
		errors
	};
}

export { parseIncomingMessage, validateMessage };
