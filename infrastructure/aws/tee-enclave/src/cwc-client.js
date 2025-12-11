/**
 * CWC API Client
 *
 * Forwards plaintext messages to Congressional offices via CWC API
 */

/**
 * Forward decrypted message to CWC API
 *
 * @param {Object} params - Forwarding parameters
 * @param {string} params.message - Decrypted plaintext message
 * @param {Object} params.recipient - Congressional office recipient
 * @param {string} params.templateId - Template identifier
 * @returns {Promise<string>} CWC confirmation ID
 */
export async function forwardToCWC({ message, recipient, templateId, attestationToken }) {
	const cwcApiKey = process.env.CWC_API_KEY;

	if (!cwcApiKey) {
		throw new Error('CWC_API_KEY environment variable not set');
	}

	// Build CWC XML payload
	const xmlPayload = buildCWCXML({ message, recipient, templateId });

	// Determine CWC API endpoint based on office type
	let endpoint =
		recipient.office === 'senate'
			? process.env.CWC_SENATE_ENDPOINT || 'https://soapbox.senate.gov/api/submit'
			: process.env.CWC_HOUSE_ENDPOINT || 'https://forms.house.gov/api/submit';

	const gcpProxyUrl = process.env.GCP_PROXY_URL;
	let headers = {
		'Content-Type': 'application/xml',
		Authorization: `Bearer ${cwcApiKey}`,
		'User-Agent': 'Communique-TEE/1.0'
	};

	// If GCP proxy is configured, route through it
	if (gcpProxyUrl) {
		console.log(`Routing via GCP Proxy: ${gcpProxyUrl}`);
		// We send the target endpoint in a header or as part of the body
		// For simplicity, let's use a header 'X-Target-Endpoint'
		headers['X-Target-Endpoint'] = endpoint;

		// Add attestation token for proxy verification
		if (attestationToken) {
			headers['X-Attestation-Token'] = attestationToken;
		} else {
			console.warn('No attestation token provided for proxy authentication');
		}

		endpoint = gcpProxyUrl;
	}

	console.log('Forwarding to CWC API (via ' + (gcpProxyUrl ? 'Proxy' : 'Direct') + '):', {
		endpoint,
		recipient: recipient.name,
		office: recipient.office,
		state: recipient.state,
		headers: JSON.stringify(headers)
	});

	try {
		const response = await fetch(endpoint, {
			method: 'POST',
			headers,
			body: xmlPayload
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`CWC API error: ${response.status} - ${errorText}`);
		}

		const responseText = await response.text();

		// Extract confirmation ID from CWC response
		const confirmationId = extractConfirmationId(responseText);

		console.log('CWC submission successful:', confirmationId);

		return confirmationId;
	} catch (error) {
		console.error('CWC forwarding error:', error);
		throw new Error(`Failed to forward to CWC API: ${error.message}`);
	}
}

/**
 * Build CWC XML payload
 *
 * Format specified by Communicating With Congress (CWC) API
 */
function buildCWCXML({ message, recipient, templateId }) {
	// Escape XML special characters
	const escapeXML = (str) =>
		str
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;');

	const escapedMessage = escapeXML(message);
	const escapedRecipientName = escapeXML(recipient.name);

	// CWC XML format (v1.0)
	return `<?xml version="1.0" encoding="UTF-8"?>
<Contact xmlns="http://www.house.gov/schemas/ContactForm/v1">
  <Subject>${templateId}</Subject>
  <Message>${escapedMessage}</Message>
  <Recipient>
    <Name>${escapedRecipientName}</Name>
    <Office>${recipient.office}</Office>
    <State>${recipient.state}</State>
    ${recipient.district ? `<District>${recipient.district}</District>` : ''}
  </Recipient>
  <Metadata>
    <Source>Communique-TEE</Source>
    <Timestamp>${new Date().toISOString()}</Timestamp>
    <TemplateId>${templateId}</TemplateId>
  </Metadata>
</Contact>`;
}

/**
 * Extract confirmation ID from CWC API response
 */
function extractConfirmationId(responseXML) {
	// Parse XML response to extract confirmation ID
	// CWC response format: <Response><ConfirmationId>ABC123</ConfirmationId></Response>

	const match = responseXML.match(/<ConfirmationId>(.*?)<\/ConfirmationId>/);

	if (match && match[1]) {
		return match[1];
	}

	// Fallback: use timestamp-based ID if CWC doesn't return one
	return `cwc-${Date.now()}`;
}

/**
 * Test CWC forwarding with sample data (for development)
 */
export async function testCWCForwarding() {
	const testMessage = `Dear Senator Smith,

I am writing to express my support for H.R. 1234, the Climate Action Now Act.

As a constituent from San Francisco, I urge you to vote YES on this critical legislation.

Thank you for your time.`;

	const testRecipient = {
		name: 'Senator Jane Smith',
		office: 'senate',
		state: 'CA',
		district: null
	};

	console.log('Running CWC forwarding test...');

	try {
		const confirmationId = await forwardToCWC({
			message: testMessage,
			recipient: testRecipient,
			templateId: 'test-template-123'
		});

		console.log('CWC test successful:', confirmationId);
		return true;
	} catch (error) {
		console.error('CWC test failed:', error);
		return false;
	}
}
