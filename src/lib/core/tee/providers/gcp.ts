/**
 * GCP Confidential Space Provider
 *
 * Implementation of TEEProvider interface for Google Cloud Platform
 * Uses AMD SEV-SNP hardware encryption + OIDC attestation tokens
 *
 * References:
 * - https://cloud.google.com/confidential-computing/confidential-space/docs
 * - Updated October 2025 with latest APIs
 */

import { z } from 'zod';
import type {
	TEEProvider,
	TEEDeploymentConfig,
	TEEInstance,
	AttestationToken,
	EncryptedPayload,
	TEEResponse,
	TEEHealthStatus
} from '../provider';

// =============================================================================
// ZOD SCHEMA
// =============================================================================

const JWTClaimsSchema = z.object({
	submods: z
		.object({
			container: z
				.object({
					image_digest: z.string().optional(),
					image_reference: z.string().optional()
				})
				.optional()
		})
		.optional(),
	hwmodel: z.string().optional(),
	swversion: z.union([z.string(), z.array(z.string()), z.number()]).optional(),
	iat: z.number().optional(),
	exp: z.number().optional(),
	iss: z.string().optional(),
	aud: z.string().optional(),
	google: z
		.object({
			compute_engine: z
				.object({
					project_id: z.string().optional(),
					zone: z.string().optional(),
					instance_id: z.string().optional(),
					instance_name: z.string().optional()
				})
				.optional()
		})
		.optional()
});

/**
 * GCP-specific configuration
 */
export interface GCPProviderConfig {
	/** GCP project ID */
	projectId: string;

	/** Default region for deployments */
	region: string;

	/** Service account email for Workload Identity */
	serviceAccountEmail?: string;

	/** Workload Identity Pool ID */
	workloadIdentityPoolId?: string;

	/** Workload Identity Provider ID */
	workloadIdentityProviderId?: string;
}

/**
 * GCP Confidential Space TEE Provider
 */
export class GCPConfidentialSpaceProvider implements TEEProvider {
	readonly name = 'gcp' as const;

	constructor(private config: GCPProviderConfig) {}

	/**
	 * Deploy Confidential Space workload on GCP
	 */
	async deploy(deployConfig: TEEDeploymentConfig): Promise<TEEInstance> {
		// 1. Validate container image is in Artifact Registry or GCR
		const imageUri = this.validateAndFormatImageUri(deployConfig.containerImage);

		// 2. Create Confidential VM instance
		const instanceName = `communique-tee-${Date.now()}`;
		const zone = `${deployConfig.region}-a`; // Default to zone 'a'

		const instanceConfig = {
			name: instanceName,
			machineType: `zones/${zone}/machineTypes/n2d-standard-${deployConfig.resources.cpus}`,
			zone,
			disks: [
				{
					boot: true,
					autoDelete: true,
					initializeParams: {
						sourceImage:
							'projects/confidential-space-images-dev/global/images/family/confidential-space',
						diskSizeGb: '10'
					}
				}
			],
			networkInterfaces: [
				{
					network: 'global/networks/default',
					accessConfigs: [
						{
							name: 'External NAT',
							type: 'ONE_TO_ONE_NAT'
						}
					]
				}
			],
			// AMD SEV-SNP Confidential Computing
			confidentialInstanceConfig: {
				enableConfidentialCompute: true,
				confidentialInstanceType: 'SEV_SNP'
			},
			// Container specification
			metadata: {
				items: [
					{
						key: 'gce-container-declaration',
						value: JSON.stringify({
							spec: {
								containers: [
									{
										name: 'tee-workload',
										image: imageUri,
										env: Object.entries(deployConfig.env).map(([name, value]) => ({
											name,
											value
										})),
										ports: [
											{
												containerPort: 8080,
												hostPort: 8080,
												protocol: 'TCP'
											}
										]
									}
								],
								restartPolicy: 'Always'
							}
						})
					},
					{
						key: 'google-logging-enabled',
						value: 'true'
					},
					{
						key: 'google-monitoring-enabled',
						value: 'true'
					}
				]
			},
			// Service account for Workload Identity
			serviceAccounts: [
				{
					email: this.config.serviceAccountEmail || 'default',
					scopes: ['https://www.googleapis.com/auth/cloud-platform']
				}
			],
			tags: {
				items: [
					'tee-workload',
					'confidential-space',
					...(deployConfig.tags ? Object.keys(deployConfig.tags) : [])
				]
			}
		};

		// 3. Call Compute Engine API to create instance
		const instance = await this.createComputeInstance(instanceConfig);

		// 4. Wait for instance to be RUNNING
		await this.waitForInstanceRunning(instanceName, zone);

		// 5. Get instance IP address
		const ipAddress = await this.getInstanceIP(instanceName, zone);

		return {
			id: instanceName,
			providerMetadata: {
				zone,
				projectId: this.config.projectId,
				machineType: instanceConfig.machineType,
				createdAt: new Date().toISOString(),
				...instance
			},
			endpoint: `http://${ipAddress}:8080`,
			attestationEndpoint: `https://confidentialcomputing.googleapis.com/v1/projects/${this.config.projectId}/locations/${deployConfig.region}/attestations`,
			status: 'running'
		};
	}

	/**
	 * Get attestation token from Confidential Space workload
	 * Returns OIDC token with container image hash and hardware attestation
	 */
	async getAttestationToken(instanceId: string): Promise<AttestationToken> {
		// GCP Confidential Space automatically generates OIDC tokens via Workload Identity
		// The TEE workload can request its own attestation token

		// Request attestation token from instance metadata server
		const attestationEndpoint = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity`;

		const audience = this.getWorkloadIdentityAudience();

		const response = await fetch(
			`${attestationEndpoint}?audience=${encodeURIComponent(audience)}&format=full`,
			{
				headers: {
					'Metadata-Flavor': 'Google'
				}
			}
		);

		if (!response.ok) {
			throw new Error(`Failed to get attestation token: ${response.status}`);
		}

		const rawToken = await response.text();

		// Parse JWT to extract claims
		const claims = this.parseJWT(rawToken);

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
				// Include all GCP-specific claims
				projectId: claims.google?.compute_engine?.project_id,
				zone: claims.google?.compute_engine?.zone,
				instanceId: claims.google?.compute_engine?.instance_id,
				instanceName: claims.google?.compute_engine?.instance_name,
				containerImageReference: claims.submods?.container?.image_reference
			}
		};
	}

	/**
	 * Verify attestation token matches expected code hash
	 */
	async verifyAttestation(token: AttestationToken, expectedCodeHash: string): Promise<boolean> {
		try {
			// 1. Verify JWT signature (Google signs with public key)
			const isValidSignature = await this.verifyJWTSignature(token.rawToken);
			if (!isValidSignature) {
				console.error('TEE attestation: Invalid JWT signature');
				return false;
			}

			// 2. Verify issuer is GCP Confidential Computing
			const claims = this.parseJWT(token.rawToken);
			if (claims.iss !== 'https://confidentialcomputing.googleapis.com') {
				console.error('TEE attestation: Invalid issuer', claims.iss);
				return false;
			}

			// 3. Verify audience matches our Workload Identity Pool
			const expectedAudience = this.getWorkloadIdentityAudience();
			if (claims.aud !== expectedAudience) {
				console.error('TEE attestation: Invalid audience', claims.aud);
				return false;
			}

			// 4. Verify container image digest matches expected
			const actualDigest = claims.submods?.container?.image_digest;
			if (actualDigest !== expectedCodeHash) {
				console.error(
					'TEE attestation: Container image mismatch',
					actualDigest,
					'expected',
					expectedCodeHash
				);
				return false;
			}

			// 5. Verify hardware model is AMD SEV-SNP
			if (!claims.hwmodel?.includes('AMD_SEV')) {
				console.error('TEE attestation: Invalid hardware model', claims.hwmodel);
				return false;
			}

			// 6. Verify token is not expired
			const now = Math.floor(Date.now() / 1000);
			if (claims.exp && claims.exp < now) {
				console.error('TEE attestation: Token expired');
				return false;
			}

			return true;
		} catch (error) {
			console.error('TEE attestation verification error:', error);
			return false;
		}
	}

	/**
	 * Submit encrypted payload to TEE for decryption and CWC forwarding
	 */
	async submitEncryptedPayload(
		instanceId: string,
		payload: EncryptedPayload
	): Promise<TEEResponse> {
		// Get instance endpoint
		const instance = await this.getInstance(instanceId);

		// Generate attestation challenge to prevent replay attacks
		const challenge = this.generateAttestationChallenge();

		const response = await fetch(`${instance.endpoint}/decrypt-and-forward`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Attestation-Challenge': challenge
			},
			body: JSON.stringify(payload)
		});

		if (!response.ok) {
			throw new Error(`TEE submission failed: ${response.status} ${await response.text()}`);
		}

		const result = await response.json();

		// Verify attestation token from response
		const attestationToken = response.headers.get('x-attestation-token');
		if (!attestationToken) {
			throw new Error('TEE response missing attestation token');
		}

		return {
			success: result.success,
			cwcConfirmation: result.cwc_confirmation,
			error: result.error,
			attestationToken,
			timestamp: result.timestamp || new Date().toISOString()
		};
	}

	/**
	 * Terminate TEE instance
	 */
	async terminate(instanceId: string): Promise<void> {
		const instance = await this.getInstance(instanceId);
		const zone = instance.providerMetadata.zone as string;

		await this.deleteComputeInstance(instanceId, zone);
	}

	/**
	 * Health check for TEE instance
	 */
	async healthCheck(instanceId: string): Promise<TEEHealthStatus> {
		const instance = await this.getInstance(instanceId);

		try {
			const response = await fetch(`${instance.endpoint}/health`, {
				signal: AbortSignal.timeout(5000) // 5 second timeout
			});

			if (!response.ok) {
				return {
					healthy: false,
					lastHeartbeat: new Date(),
					cpuUsage: 0,
					memoryUsage: 0,
					queueDepth: 0
				};
			}

			const health = await response.json();

			return {
				healthy: true,
				lastHeartbeat: new Date(),
				cpuUsage: health.cpu_usage || 0,
				memoryUsage: health.memory_usage || 0,
				queueDepth: health.queue_depth || 0
			};
		} catch (error) {
			console.error('TEE health check error:', error);
			return {
				healthy: false,
				lastHeartbeat: new Date(),
				cpuUsage: 0,
				memoryUsage: 0,
				queueDepth: 0
			};
		}
	}

	// ==================== Private Helper Methods ====================

	/**
	 * Validate and format container image URI for GCP
	 */
	private validateAndFormatImageUri(image: string): string {
		// Support GCR and Artifact Registry formats
		const validPrefixes = ['gcr.io/', 'us-docker.pkg.dev/', 'europe-docker.pkg.dev/'];

		if (!validPrefixes.some((prefix) => image.startsWith(prefix))) {
			// Assume local image, prepend GCR
			return `gcr.io/${this.config.projectId}/${image}`;
		}

		return image;
	}

	/**
	 * Get Workload Identity audience for attestation
	 */
	private getWorkloadIdentityAudience(): string {
		const poolId = this.config.workloadIdentityPoolId || 'communique-tee-pool';
		const providerId = this.config.workloadIdentityProviderId || 'communique-tee-provider';

		return `//iam.googleapis.com/projects/${this.config.projectId}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`;
	}

	/**
	 * Parse JWT token to extract claims
	 */
	private parseJWT(token: string): z.infer<typeof JWTClaimsSchema> {
		const parts = token.split('.');
		if (parts.length !== 3) {
			throw new Error('Invalid JWT format');
		}

		const payload = parts[1];
		const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
		const parsed = JSON.parse(decoded);

		// Validate JWT claims structure
		const validationResult = JWTClaimsSchema.safeParse(parsed);
		if (!validationResult.success) {
			console.warn('[gcp-tee] Invalid JWT claims structure:', validationResult.error.flatten());
			// Return parsed data anyway but log warning
			return parsed as z.infer<typeof JWTClaimsSchema>;
		}

		return validationResult.data;
	}

	/**
	 * Verify JWT signature using Google's public keys
	 */
	private async verifyJWTSignature(token: string): Promise<boolean> {
		// TODO: Implement JWT signature verification
		// Fetch Google's public keys from https://www.googleapis.com/oauth2/v3/certs
		// Verify signature matches
		// For now, return true (will implement in Week 14)
		return true;
	}

	/**
	 * Generate random attestation challenge
	 */
	private generateAttestationChallenge(): string {
		return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
	}

	/**
	 * Create Compute Engine instance
	 */
	private async createComputeInstance(config: Record<string, unknown>): Promise<{
		id: string;
		status: string;
	}> {
		// TODO: Implement Compute Engine API call
		// POST https://compute.googleapis.com/compute/v1/projects/{project}/zones/{zone}/instances

		// For now, mock response
		console.log('Creating GCP Confidential VM:', config.name);
		return {
			id: config.name as string,
			status: 'PROVISIONING'
		};
	}

	/**
	 * Wait for instance to reach RUNNING state
	 */
	private async waitForInstanceRunning(instanceName: string, zone: string): Promise<void> {
		// TODO: Poll Compute Engine API until status === 'RUNNING'
		// GET https://compute.googleapis.com/compute/v1/projects/{project}/zones/{zone}/instances/{instance}

		console.log('Waiting for instance to be running:', instanceName);
		// Mock: assume 30 seconds
		await new Promise((resolve) => setTimeout(resolve, 30000));
	}

	/**
	 * Get instance external IP address
	 */
	private async getInstanceIP(instanceName: string, zone: string): Promise<string> {
		// TODO: Fetch from Compute Engine API
		// Extract networkInterfaces[0].accessConfigs[0].natIP

		// Mock IP for development
		return '34.123.45.67';
	}

	/**
	 * Get instance details
	 */
	private async getInstance(instanceId: string): Promise<TEEInstance> {
		// TODO: Fetch from Compute Engine API
		// GET https://compute.googleapis.com/compute/v1/projects/{project}/zones/{zone}/instances/{instance}

		// Mock instance
		return {
			id: instanceId,
			providerMetadata: {
				zone: `${this.config.region}-a`,
				projectId: this.config.projectId
			},
			endpoint: 'http://34.123.45.67:8080',
			attestationEndpoint: `https://confidentialcomputing.googleapis.com/v1/projects/${this.config.projectId}/locations/${this.config.region}/attestations`,
			status: 'running'
		};
	}

	/**
	 * Delete Compute Engine instance
	 */
	private async deleteComputeInstance(instanceName: string, zone: string): Promise<void> {
		// TODO: Implement Compute Engine API call
		// DELETE https://compute.googleapis.com/compute/v1/projects/{project}/zones/{zone}/instances/{instance}

		console.log('Deleting GCP Confidential VM:', instanceName);
	}
}
