/**
 * Cloud-Agnostic TEE Provider Interface
 *
 * Abstraction layer for Trusted Execution Environments across:
 * - GCP Confidential Space (AMD SEV-SNP)
 * - AWS Nitro Enclaves (Hypervisor-backed)
 * - Azure Confidential VMs (AMD SEV-SNP / Intel SGX)
 *
 * Enables switching cloud providers without rewriting core logic.
 */

/**
 * Provider interface - all cloud providers must implement this
 */
export interface TEEProvider {
	/**
	 * Provider identifier
	 */
	readonly name: 'gcp' | 'aws' | 'azure';

	/**
	 * Deploy TEE instance with given configuration
	 */
	deploy(config: TEEDeploymentConfig): Promise<TEEInstance>;

	/**
	 * Get attestation token from running TEE
	 */
	getAttestationToken(instanceId: string): Promise<AttestationToken>;

	/**
	 * Verify attestation token is valid and matches expected code
	 */
	verifyAttestation(token: AttestationToken, expectedCodeHash: string): Promise<boolean>;

	/**
	 * Send encrypted payload to TEE for decryption and CWC forwarding
	 */
	submitEncryptedPayload(instanceId: string, payload: EncryptedPayload): Promise<TEEResponse>;

	/**
	 * Terminate TEE instance
	 */
	terminate(instanceId: string): Promise<void>;

	/**
	 * Health check for TEE instance
	 */
	healthCheck(instanceId: string): Promise<TEEHealthStatus>;
}

/**
 * TEE deployment configuration (cloud-agnostic)
 */
export interface TEEDeploymentConfig {
	/** Container image with decryption code */
	containerImage: string;

	/** Container image digest (for attestation verification) */
	imageDigest: string;

	/** Environment variables (secrets) */
	env: Record<string, string>;

	/** Resource allocation */
	resources: {
		cpus: number;
		memoryGB: number;
	};

	/** Region for deployment */
	region: string;

	/** Tags for resource management */
	tags?: Record<string, string>;
}

/**
 * TEE instance (running container in hardware-isolated environment)
 */
export interface TEEInstance {
	/** Unique instance identifier */
	id: string;

	/** Provider-specific instance details */
	providerMetadata: Record<string, unknown>;

	/** Internal endpoint for encrypted payload submission */
	endpoint: string;

	/** Attestation endpoint */
	attestationEndpoint: string;

	/** Status */
	status: 'pending' | 'running' | 'stopped' | 'failed';
}

/**
 * Attestation token (cryptographic proof of TEE integrity)
 */
export interface AttestationToken {
	/** Provider that issued token */
	provider: 'gcp' | 'aws' | 'azure';

	/** Raw token (JWT for GCP/Azure, CBOR for AWS) */
	rawToken: string;

	/** Parsed claims */
	claims: {
		/** Container image hash */
		imageDigest: string;

		/** Hardware platform */
		hardware: string;

		/** Software version */
		softwareVersion: string;

		/** Timestamp */
		issuedAt: number;

		/** Custom claims (provider-specific) */
		[key: string]: unknown;
	};
}

/**
 * Encrypted payload for TEE processing
 */
export interface EncryptedPayload {
	/** XChaCha20-Poly1305 encrypted message */
	ciphertext: string;

	/** Nonce (24 bytes, hex-encoded) */
	nonce: string;

	/** Ephemeral public key (hex-encoded) for ECDH */
	ephemeralPublicKey: string;

	/** Template identifier */
	templateId: string;

	/** Recipient information */
	recipient: {
		name: string;
		office: 'senate' | 'house';
		state: string;
		district?: string;
	};
}

/**
 * TEE response after processing encrypted payload
 */
export interface TEEResponse {
	/** Success status */
	success: boolean;

	/** CWC API confirmation (if successful) */
	cwcConfirmation?: string;

	/** Error message (if failed) */
	error?: string;

	/** Attestation token proving TEE integrity */
	attestationToken: string;

	/** Timestamp */
	timestamp: string;
}

/**
 * TEE health status
 */
export interface TEEHealthStatus {
	/** Overall health */
	healthy: boolean;

	/** Last heartbeat */
	lastHeartbeat: Date;

	/** CPU usage (0-1) */
	cpuUsage: number;

	/** Memory usage (0-1) */
	memoryUsage: number;

	/** Request queue depth */
	queueDepth: number;
}
