/**
 * Cloud-Agnostic Attestation
 *
 * Generates attestation tokens for:
 * - GCP Confidential Space (OIDC tokens)
 * - AWS Nitro Enclaves (CBOR attestation documents)
 * - Azure Confidential VMs (MAA tokens)
 */

/**
 * Get attestation token from current cloud provider
 *
 * @returns {Promise<{provider: string, rawToken: string, claims: Object}>}
 */
/**
 * Get attestation token from current cloud provider
 *
 * @param {Buffer} publicKey - Enclave public key to include in attestation (optional)
 * @returns {Promise<{provider: string, rawToken: string, claims: Object}>}
 */
export async function getAttestationToken(publicKey) {
	const provider = detectCloudProvider();

	switch (provider) {
		case 'gcp':
			return getGCPAttestationToken(publicKey);
		case 'aws':
			return getAWSAttestationToken(publicKey);
		case 'azure':
			return getAzureAttestationToken(publicKey);
		default:
			// Local development - return mock token
			return getMockAttestationToken(publicKey);
	}
}

/**
 * Get GCP Confidential Space OIDC attestation token
 */
async function getGCPAttestationToken() {
	try {
		// GCP metadata server endpoint for OIDC tokens
		const metadataUrl =
			'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity';

		// Audience for Workload Identity Federation
		const audience =
			process.env.GCP_WORKLOAD_IDENTITY_AUDIENCE ||
			`//iam.googleapis.com/projects/${process.env.GCP_PROJECT_ID}/locations/global/workloadIdentityPools/communique-tee-pool/providers/communique-tee-provider`;

		const response = await fetch(
			`${metadataUrl}?audience=${encodeURIComponent(audience)}&format=full`,
			{
				headers: {
					'Metadata-Flavor': 'Google'
				}
			}
		);

		if (!response.ok) {
			throw new Error(`GCP metadata server error: ${response.status}`);
		}

		const rawToken = await response.text();
		const claims = parseJWT(rawToken);

		return {
			provider: 'gcp',
			rawToken,
			claims: {
				imageDigest: claims.submods?.container?.image_digest || '',
				hardware: claims.hwmodel || 'GCP_AMD_SEV_SNP',
				softwareVersion: Array.isArray(claims.swversion)
					? claims.swversion.join('.')
					: String(claims.swversion || ''),
				issuedAt: claims.iat || Math.floor(Date.now() / 1000),
				projectId: claims.google?.compute_engine?.project_id,
				zone: claims.google?.compute_engine?.zone,
				instanceId: claims.google?.compute_engine?.instance_id,
				instanceName: claims.google?.compute_engine?.instance_name
			}
		};
	} catch (error) {
		console.error('GCP attestation error:', error);
		throw new Error(`Failed to get GCP attestation token: ${error.message}`);
	}
}

/**
 * Get AWS Nitro Enclaves attestation document
 */
/**
 * Get AWS Nitro Enclaves attestation document
 */
async function getAWSAttestationToken(publicKey) {
	try {
		// AWS Nitro Enclaves use vsock to communicate with parent instance
		// Attestation document is CBOR-encoded, signed by AWS Nitro Attestation PKI

		// Dynamic import to avoid issues on non-AWS environments
		const { Client, Device } = await import('aws-nitro-enclaves-nsm-api');

		const client = new Client();

		// Generate random nonce (optional but recommended)
		// NSM API expects nonce as Buffer or Uint8Array
		// const nonce = crypto.randomBytes(16);

		// Request attestation document
		// We can optionally pass public key, nonce, and user data
		const attestation = client.getAttestation({
			publicKey: publicKey // Include enclave public key in attestation
		});

		// attestation.document is the CBOR-encoded document (Buffer)
		const rawToken = attestation.document.toString('base64');

		// Decode CBOR to extract claims (optional, for debugging/logging)
		// For now we just return the raw token as that's what the verifier needs

		return {
			provider: 'aws',
			rawToken,
			claims: {
				hardware: 'AWS_NITRO_ENCLAVE',
				// We can't easily decode CBOR here without a library like 'cbor'
				// The verifier will handle decoding
				note: 'Claims decoding requires CBOR parser'
			}
		};
	} catch (error) {
		console.error('AWS attestation error:', error);
		// Fallback for development if NSM is not available (e.g. running locally)
		if (process.env.NODE_ENV !== 'production') {
			console.warn('Falling back to mock attestation (NSM not available)');
			return getMockAttestationToken();
		}
		throw new Error(`Failed to get AWS attestation token: ${error.message}`);
	}
}

/**
 * Get Azure Confidential VM attestation token
 */
async function getAzureAttestationToken() {
	try {
		// Azure uses Microsoft Attestation service (MAA)
		const maaEndpoint =
			process.env.AZURE_ATTESTATION_ENDPOINT || 'https://sharedeus2.eus2.attest.azure.net';

		// TODO: Implement Azure MAA attestation when adding Azure support
		throw new Error('Azure Confidential VM attestation not yet implemented');
	} catch (error) {
		console.error('Azure attestation error:', error);
		throw new Error(`Failed to get Azure attestation token: ${error.message}`);
	}
}

/**
 * Get mock attestation token (local development only)
 */
function getMockAttestationToken(publicKey) {
	console.warn('Using MOCK attestation token - local development only!');

	const mockClaims = {
		imageDigest: 'sha256:mock-development-image',
		hardware: 'LOCAL_DEVELOPMENT',
		softwareVersion: '1.0.0-dev',
		issuedAt: Math.floor(Date.now() / 1000),
		warning: 'THIS IS A MOCK TOKEN - DO NOT USE IN PRODUCTION',
		publicKey: publicKey ? publicKey.toString('base64') : undefined
	};

	const mockToken = Buffer.from(JSON.stringify(mockClaims)).toString('base64');

	return {
		provider: 'mock',
		rawToken: mockToken,
		claims: mockClaims
	};
}

/**
 * Detect cloud provider from environment
 */
function detectCloudProvider() {
	// GCP detection
	if (
		process.env.GCP_PROJECT ||
		process.env.GOOGLE_CLOUD_PROJECT ||
		process.env.GCE_METADATA_HOST
	) {
		return 'gcp';
	}

	// AWS detection
	if (process.env.AWS_EXECUTION_ENV || process.env.AWS_REGION) {
		return 'aws';
	}

	// Azure detection
	if (process.env.AZURE_SUBSCRIPTION_ID || process.env.IDENTITY_ENDPOINT) {
		return 'azure';
	}

	// Local development
	return 'local';
}

/**
 * Parse JWT token to extract claims
 */
function parseJWT(token) {
	const parts = token.split('.');
	if (parts.length !== 3) {
		throw new Error('Invalid JWT format');
	}

	const payload = parts[1];

	// JWT uses base64url encoding (not standard base64)
	const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
	const paddedBase64 = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

	const decoded = Buffer.from(paddedBase64, 'base64').toString('utf-8');
	return JSON.parse(decoded);
}

/**
 * Test attestation token generation (for development)
 */
export async function testAttestation() {
	console.log('Running attestation test...');

	const provider = detectCloudProvider();
	console.log('Detected cloud provider:', provider);

	try {
		const token = await getAttestationToken();

		console.log('Attestation token generated:');
		console.log('  Provider:', token.provider);
		console.log('  Hardware:', token.claims.hardware);
		console.log('  Image digest:', token.claims.imageDigest);
		console.log('  Issued at:', new Date(token.claims.issuedAt * 1000).toISOString());

		return true;
	} catch (error) {
		console.error('Attestation test failed:', error);
		return false;
	}
}
