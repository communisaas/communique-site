/**
 * Unified TEE Manager
 *
 * Manages TEE instances across multiple cloud providers
 * Handles provider selection, failover, and health monitoring
 */

import type {
	TEEProvider,
	TEEDeploymentConfig,
	TEEInstance,
	EncryptedPayload,
	TEEResponse
} from './provider';
import { AWSNitroEnclavesProvider, type AWSProviderConfig } from './providers/aws';
import { GCPConfidentialSpaceProvider, type GCPProviderConfig } from './providers/gcp';

/**
 * TEE Manager configuration
 */
export interface TEEManagerConfig {
	/** AWS Nitro Enclaves configuration (PRIMARY - Phase 1) */
	aws?: AWSProviderConfig;

	/** GCP Confidential Space configuration (DEPRECATED - kept for fallback only) */
	gcp?: GCPProviderConfig;

	/** Azure Confidential VMs configuration (future) */
	azure?: {
		subscriptionId: string;
		resourceGroup: string;
		region: string;
	};

	/** Preferred provider (defaults to AWS) */
	preferredProvider?: 'aws' | 'gcp' | 'azure';
}

/**
 * Unified TEE Manager
 *
 * Abstracts TEE operations across cloud providers
 */
export class TEEManager {
	private providers: Map<string, TEEProvider> = new Map();
	private activeInstances: Map<string, { provider: TEEProvider; instance: TEEInstance }> =
		new Map();

	constructor(config: TEEManagerConfig) {
		// Initialize AWS provider (PRIMARY for Phase 1)
		if (config.aws) {
			this.providers.set('aws', new AWSNitroEnclavesProvider(config.aws));
		}

		// Initialize GCP provider (DEPRECATED - fallback only)
		if (config.gcp) {
			this.providers.set('gcp', new GCPConfidentialSpaceProvider(config.gcp));
		}

		// Future providers
		// if (config.azure) {
		//   this.providers.set('azure', new AzureConfidentialVMProvider(config.azure));
		// }

		if (this.providers.size === 0) {
			throw new Error('No TEE providers configured');
		}
	}

	/**
	 * Deploy TEE instance on specified provider (or auto-select)
	 */
	async deployTEE(
		config: TEEDeploymentConfig,
		providerName?: 'gcp' | 'aws' | 'azure'
	): Promise<string> {
		const provider = providerName
			? this.providers.get(providerName)
			: this.selectOptimalProvider(config);

		if (!provider) {
			throw new Error(`Provider not available: ${providerName || 'none'}`);
		}

		console.log(`Deploying TEE on ${provider.name}...`);

		const instance = await provider.deploy(config);
		this.activeInstances.set(instance.id, { provider, instance });

		console.log(`TEE deployed successfully: ${instance.id}`);
		console.log(`Endpoint: ${instance.endpoint}`);
		console.log(`Attestation: ${instance.attestationEndpoint}`);

		return instance.id;
	}

	/**
	 * Submit encrypted message to TEE for decryption and CWC forwarding
	 */
	async submitMessage(
		instanceId: string,
		payload: EncryptedPayload,
		verifyAttestation = true
	): Promise<TEEResponse> {
		const entry = this.activeInstances.get(instanceId);
		if (!entry) {
			throw new Error(`TEE instance not found: ${instanceId}`);
		}

		// Verify attestation before submission (default: enabled)
		if (verifyAttestation) {
			console.log('Verifying TEE attestation...');

			const attestation = await entry.provider.getAttestationToken(instanceId);
			const expectedHash = String(entry.instance.providerMetadata.imageDigest || '');

			const valid = await entry.provider.verifyAttestation(attestation, expectedHash);

			if (!valid) {
				throw new Error('TEE attestation verification failed - refusing to submit encrypted data');
			}

			console.log('TEE attestation verified ✓');
		}

		// Submit encrypted payload
		console.log('Submitting encrypted payload to TEE...');
		return entry.provider.submitEncryptedPayload(instanceId, payload);
	}

	/**
	 * Terminate TEE instance
	 */
	async terminateTEE(instanceId: string): Promise<void> {
		const entry = this.activeInstances.get(instanceId);
		if (!entry) {
			console.warn(`TEE instance not found: ${instanceId}`);
			return;
		}

		console.log(`Terminating TEE instance: ${instanceId}`);
		await entry.provider.terminate(instanceId);
		this.activeInstances.delete(instanceId);
		console.log(`TEE instance terminated: ${instanceId}`);
	}

	/**
	 * Health check for all active TEEs
	 */
	async healthCheckAll(): Promise<Map<string, boolean>> {
		const results = new Map<string, boolean>();

		for (const [id, entry] of this.activeInstances) {
			try {
				const health = await entry.provider.healthCheck(id);
				results.set(id, health.healthy);

				if (!health.healthy) {
					console.warn(`TEE instance unhealthy: ${id}`);
				}
			} catch (error) {
				console.error(`TEE health check failed for ${id}:`, error);
				results.set(id, false);
			}
		}

		return results;
	}

	/**
	 * Get active TEE instances
	 */
	getActiveInstances(): string[] {
		return Array.from(this.activeInstances.keys());
	}

	/**
	 * Get instance details
	 */
	getInstance(instanceId: string): TEEInstance | undefined {
		return this.activeInstances.get(instanceId)?.instance;
	}

	/**
	 * Select optimal provider based on security, cost, and availability
	 */
	private selectOptimalProvider(config: TEEDeploymentConfig): TEEProvider {
		// Priority: AWS > GCP > Azure (based on security + cost)
		// AWS Nitro: No Intel ME/AMD PSP, independently audited, 15-30% cheaper
		// GCP: Kept as fallback only (AMD PSP present)

		const preferences = ['aws', 'gcp', 'azure'];

		for (const name of preferences) {
			const provider = this.providers.get(name);
			if (provider) {
				console.log(`Auto-selected TEE provider: ${provider.name}`);
				return provider;
			}
		}

		throw new Error('No TEE providers available');
	}
}

/**
 * Create TEE manager from environment variables
 */
export function createTEEManagerFromEnv(): TEEManager {
	const config: TEEManagerConfig = {};

	// AWS configuration (PRIMARY for Phase 1)
	if (process.env.AWS_REGION) {
		config.aws = {
			region: process.env.AWS_REGION,
			accessKeyId: process.env.AWS_ACCESS_KEY_ID,
			secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
			instanceType: process.env.AWS_NITRO_INSTANCE_TYPE,
			vpcId: process.env.AWS_VPC_ID,
			subnetId: process.env.AWS_SUBNET_ID,
			securityGroupIds: process.env.AWS_SECURITY_GROUP_IDS?.split(','),
			iamInstanceProfile: process.env.AWS_IAM_INSTANCE_PROFILE
		};
	}

	// GCP configuration (DEPRECATED - fallback only)
	if (process.env.GCP_PROJECT_ID && process.env.GCP_REGION) {
		config.gcp = {
			projectId: process.env.GCP_PROJECT_ID,
			region: process.env.GCP_REGION,
			serviceAccountEmail: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
			workloadIdentityPoolId: process.env.GCP_WORKLOAD_IDENTITY_POOL_ID,
			workloadIdentityProviderId: process.env.GCP_WORKLOAD_IDENTITY_PROVIDER_ID
		};
	}

	// Azure configuration (future)
	// if (process.env.AZURE_SUBSCRIPTION_ID) {
	//   config.azure = {
	//     subscriptionId: process.env.AZURE_SUBSCRIPTION_ID,
	//     resourceGroup: process.env.AZURE_RESOURCE_GROUP,
	//     region: process.env.AZURE_REGION
	//   };
	// }

	return new TEEManager(config);
}

/**
 * Singleton TEE manager instance
 */
let teeManager: TEEManager | null = null;

/**
 * Get or create global TEE manager
 */
export function getTEEManager(): TEEManager {
	if (!teeManager) {
		teeManager = createTEEManagerFromEnv();
	}
	return teeManager;
}
