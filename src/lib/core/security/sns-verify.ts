/**
 * AWS SNS Message Signature Verification
 *
 * Verifies that incoming SNS messages are authentic by:
 * 1. Validating the SigningCertURL is from amazonaws.com (prevents SSRF)
 * 2. Fetching the X.509 certificate
 * 3. Reconstructing the canonical signing string per AWS SNS spec
 * 4. Verifying the RSA signature against the certificate's public key
 *
 * @see https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html
 */
import { createVerify, X509Certificate } from 'crypto';

interface SNSMessageFields {
	Type: string;
	MessageId: string;
	TopicArn: string;
	Timestamp: string;
	Message: string;
	Signature: string;
	SignatureVersion: string;
	SigningCertURL: string;
	Subject?: string;
	SubscribeURL?: string;
	Token?: string;
}

// Cache certificates to avoid refetching on every request
const certCache = new Map<string, { pem: string; fetchedAt: number }>();
const CERT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Validate that a SigningCertURL is a legitimate AWS SNS certificate URL.
 * Prevents SSRF by restricting to amazonaws.com over HTTPS.
 */
function validateCertURL(certURL: string): boolean {
	try {
		const url = new URL(certURL);
		return (
			url.protocol === 'https:' &&
			url.pathname.endsWith('.pem') &&
			/^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(url.hostname)
		);
	} catch {
		return false;
	}
}

/**
 * Build the canonical signing string for an SNS message.
 * Field order and inclusion depends on message Type per AWS spec.
 */
function buildSigningString(msg: SNSMessageFields): string {
	const lines: string[] = [];

	lines.push('Message', msg.Message);
	lines.push('MessageId', msg.MessageId);

	if (msg.Type === 'SubscriptionConfirmation' || msg.Type === 'UnsubscribeConfirmation') {
		lines.push('SubscribeURL', msg.SubscribeURL || '');
	}

	if (msg.Subject !== undefined) {
		lines.push('Subject', msg.Subject);
	}

	lines.push('Timestamp', msg.Timestamp);

	if (msg.Token !== undefined) {
		lines.push('Token', msg.Token);
	}

	lines.push('TopicArn', msg.TopicArn);
	lines.push('Type', msg.Type);

	return lines.join('\n') + '\n';
}

async function fetchCert(certURL: string): Promise<string> {
	const cached = certCache.get(certURL);
	if (cached && Date.now() - cached.fetchedAt < CERT_CACHE_TTL_MS) {
		return cached.pem;
	}

	const resp = await fetch(certURL);
	if (!resp.ok) {
		throw new Error(`Failed to fetch SNS signing certificate: ${resp.status}`);
	}

	const pem = await resp.text();

	// Validate it's actually a certificate
	try {
		new X509Certificate(pem);
	} catch {
		throw new Error('Invalid X.509 certificate from SigningCertURL');
	}

	certCache.set(certURL, { pem, fetchedAt: Date.now() });
	return pem;
}

export interface SNSVerifyResult {
	valid: boolean;
	error?: string;
}

/**
 * Verify an SNS message signature.
 *
 * @param msg - The parsed SNS message
 * @param expectedTopicArn - Optional: reject messages from unexpected topics
 */
export async function verifySNSSignature(
	msg: SNSMessageFields,
	expectedTopicArn?: string
): Promise<SNSVerifyResult> {
	// 1. Validate TopicArn if expected value is configured
	if (expectedTopicArn && msg.TopicArn !== expectedTopicArn) {
		return { valid: false, error: `Unexpected TopicArn: ${msg.TopicArn}` };
	}

	// 2. Validate SigningCertURL domain (SSRF prevention)
	if (!validateCertURL(msg.SigningCertURL)) {
		return { valid: false, error: `Invalid SigningCertURL: ${msg.SigningCertURL}` };
	}

	// 3. Only SignatureVersion "1" (SHA1WithRSA) and "2" (SHA256WithRSA) are valid
	if (msg.SignatureVersion !== '1' && msg.SignatureVersion !== '2') {
		return { valid: false, error: `Unsupported SignatureVersion: ${msg.SignatureVersion}` };
	}

	// 4. Fetch the signing certificate
	let pem: string;
	try {
		pem = await fetchCert(msg.SigningCertURL);
	} catch (err) {
		return { valid: false, error: `Certificate fetch failed: ${(err as Error).message}` };
	}

	// 5. Build canonical string and verify signature
	const signingString = buildSigningString(msg);
	const algorithm = msg.SignatureVersion === '2' ? 'SHA256' : 'SHA1';
	const verifier = createVerify(algorithm);
	verifier.update(signingString);

	const signatureValid = verifier.verify(pem, msg.Signature, 'base64');

	if (!signatureValid) {
		return { valid: false, error: 'Signature verification failed' };
	}

	return { valid: true };
}
