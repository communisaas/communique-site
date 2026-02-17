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
import crypto from 'node:crypto';

/**
 * TEE Manager configuration
 */
export interface TEEManagerConfig {
	/** AWS Nitro Enclaves configuration (PRIMARY - Phase 1) */
	aws?: AWSProviderConfig;

	/** Azure Confidential VMs configuration (future) */
	azure?: {
		subscriptionId: string;
		resourceGroup: string;
		region: string;
	};

	/** Preferred provider (defaults to AWS) */
	preferredProvider?: 'aws' | 'azure';
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
		providerName?: 'aws' | 'azure'
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
	 * Encrypt and submit message to TEE
	 * Implements "Digital Faraday Cage" flow:
	 * 1. Get TEE attestation (and public key)
	 * 2. Verify attestation
	 * 3. Encrypt payload with TEE public key (ECDH + AES-GCM)
	 * 4. Submit encrypted payload
	 */
	async encryptAndSubmit(
		instanceId: string,
		data: {
			userId: string;
			templateId: string;
			recipient: {
				name: string;
				office: 'senate' | 'house';
				state: string;
				district?: string;
			};
			message: string;
		}
	): Promise<TEEResponse> {
		const entry = this.activeInstances.get(instanceId);
		if (!entry) {
			throw new Error(`TEE instance not found: ${instanceId}`);
		}

		// 1. Get attestation and public key
		console.log('Fetching TEE attestation for encryption...');
		const attestation = await entry.provider.getAttestationToken(instanceId);

		// 2. Verify attestation
		const expectedHash = String(entry.instance.providerMetadata.imageDigest || '');
		const valid = await entry.provider.verifyAttestation(attestation, expectedHash);

		if (!valid) {
			throw new Error('TEE attestation verification failed - refusing to encrypt');
		}

		// 3. Encrypt payload
		// We need the TEE's public key from the attestation
		const teePublicKeyB64 = attestation.claims.publicKey as string;
		if (!teePublicKeyB64) {
			throw new Error('TEE attestation missing public key');
		}

		// Import TEE public key
		// Assuming it's SPKI DER encoded (base64)
		const teePublicKey = crypto.createPublicKey({
			key: Buffer.from(teePublicKeyB64, 'base64'),
			format: 'der',
			type: 'spki'
		});

		// Generate ephemeral keypair
		const ephemeralKeyPair = crypto.generateKeyPairSync('ec', {
			namedCurve: 'P-256'
		});

		// Derive shared secret (ECDH)
		const sharedSecret = crypto.diffieHellman({
			privateKey: ephemeralKeyPair.privateKey,
			publicKey: teePublicKey
		});

		// Derive AES key (HKDF-SHA256)
		const aesKey = crypto.hkdfSync('sha256', sharedSecret, Buffer.alloc(0), Buffer.alloc(0), 32);

		// Encrypt message (AES-256-GCM)
		const iv = crypto.randomBytes(12);
		// Ensure aesKey is a Buffer/Uint8Array
		const aesKeyBuffer = Buffer.from(aesKey);
		const cipher = crypto.createCipheriv('aes-256-gcm', aesKeyBuffer, iv);

		let ciphertext = cipher.update(data.message, 'utf8');
		ciphertext = Buffer.concat([ciphertext, cipher.final()]);
		const authTag = cipher.getAuthTag();

		// Append auth tag to ciphertext (standard practice for GCM in some libs, or send separately)
		// Our TEE implementation expects tag appended
		const finalCiphertext = Buffer.concat([ciphertext, authTag]);

		// 4. Submit encrypted payload
		const payload: EncryptedPayload = {
			ciphertext: finalCiphertext.toString('base64'),
			nonce: iv.toString('base64'),
			ephemeralPublicKey: ephemeralKeyPair.publicKey
				.export({ format: 'der', type: 'spki' })
				.toString('hex'),
			templateId: data.templateId,
			recipient: data.recipient
		};

		return this.submitMessage(instanceId, payload, false); // Skip re-verification since we just did it
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
	 * Get all healthy TEE instances
	 */
	async getHealthyInstances(): Promise<TEEInstance[]> {
		const healthyInstances: TEEInstance[] = [];

		// Check health of all active instances
		// Note: In production, we might cache health status to avoid spamming checks
		const healthStatuses = await this.healthCheckAll();

		for (const [id, isHealthy] of healthStatuses) {
			if (isHealthy) {
				const instance = this.getInstance(id);
				if (instance) {
					healthyInstances.push(instance);
				}
			}
		}

		return healthyInstances;
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
		// Priority: AWS > Azure (based on security + cost)
		// AWS Nitro: No Intel ME/AMD PSP, independently audited, 15-30% cheaper

		const preferences = ['aws', 'azure'];

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
