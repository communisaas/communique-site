# Cloud-Agnostic TEE Abstraction Layer

**Date:** 2025-10-22
**Purpose:** Abstract Trusted Execution Environment (TEE) operations to support GCP, AWS, and Azure
**Status:** Design document for Week 13-14 implementation

---

## Executive Summary

We need a **cloud-agnostic abstraction layer** for TEE operations because:

1. **Vendor lock-in avoidance** - Can switch cloud providers without rewriting core logic
2. **Multi-cloud deployment** - Run TEEs in different regions for compliance (GDPR, data sovereignty)
3. **Cost optimization** - Leverage spot pricing or multi-cloud bidding
4. **Future-proofing** - New TEE technologies (Intel TDX, ARM CCA) can be added without breaking changes

### Supported Providers (Phase 1):

| Provider | Technology | Status | Cost/Month |
|----------|-----------|--------|------------|
| **GCP** | Confidential Space (AMD SEV-SNP) | ✅ Primary | ~$350 |
| **AWS** | Nitro Enclaves | 🟡 Fallback | ~$400 |
| **Azure** | Confidential VMs (AMD SEV-SNP) | 🔵 Future | ~$380 |

---

## Cloud Provider Comparison (2025)

### **1. GCP Confidential Space**

**Hardware:** AMD SEV-SNP (Secure Encrypted Virtualization - Secure Nested Paging)

**Deployment:** Container-based workloads on Confidential VMs

**Attestation:** OIDC tokens with Workload Identity Federation

**Pros:**
- ✅ Container-native (Docker images)
- ✅ Automatic attestation token generation
- ✅ Workload Identity Federation (seamless credential exchange)
- ✅ Intel TDX + GPU support (2025 update)

**Cons:**
- ⚠️ GCP-specific APIs (Artifact Registry, Workload Identity Pools)
- ⚠️ Higher cost than AWS (for equivalent resources)

**APIs (2025):**
```bash
# Required APIs
cloudapis.googleapis.com
cloudkms.googleapis.com
confidentialcomputing.googleapis.com
artifactregistry.googleapis.com
iamcredentials.googleapis.com
```

**Attestation Format (OIDC JWT):**
```json
{
  "iss": "https://confidentialcomputing.googleapis.com",
  "sub": "https://www.googleapis.com/compute/v1/projects/PROJECT_ID/zones/ZONE/instances/INSTANCE_ID",
  "aud": "//iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID",
  "google": {
    "compute_engine": {
      "instance_id": "...",
      "zone": "...",
      "project_id": "...",
      "instance_name": "..."
    }
  },
  "hwmodel": "GCP_AMD_SEV",
  "swname": "CONFIDENTIAL_SPACE",
  "swversion": ["1", "14"],
  "submods": {
    "container": {
      "image_digest": "sha256:abc123...",
      "image_reference": "gcr.io/PROJECT/IMAGE:TAG"
    }
  }
}
```

---

### **2. AWS Nitro Enclaves**

**Hardware:** AWS Nitro System (hypervisor-backed isolation, no Intel SGX/AMD SEV required)

**Deployment:** Enclaves attached to EC2 instances (separate isolated environment)

**Attestation:** Cryptographic attestation documents (CBOR-encoded)

**Pros:**
- ✅ Flexible resource allocation (any CPU/memory combination)
- ✅ All EC2 instances (since 2018) support Nitro Enclaves
- ✅ No need for specialized hardware (software-backed isolation)
- ✅ Lower cost per instance (~$400/month)

**Cons:**
- ⚠️ Enclave must run alongside parent EC2 instance
- ⚠️ More complex setup (enclave image format, vsock communication)
- ⚠️ Attestation less standardized than OIDC

**APIs (2025):**
```bash
# AWS Services
ec2.amazonaws.com             # Nitro Enclave instances
kms.amazonaws.com             # Key management
acm.amazonaws.com             # Certificate management (attestation)
```

**Attestation Format (Cryptographic Attestation Document):**
```json
{
  "module_id": "i-0123456789abcdef0-enc0123456789abcdef",
  "digest": "SHA384",
  "timestamp": 1698765432000,
  "pcrs": {
    "0": "...",  // Boot measurement
    "1": "...",  // Kernel measurement
    "2": "...",  // Application measurement (enclave image)
    "8": "..."   // Kernel + app measurement
  },
  "certificate": "...",  // X.509 certificate
  "cabundle": ["..."]    // Certificate chain
}
```

---

### **3. Azure Confidential VMs**

**Hardware:** AMD SEV-SNP (same as GCP) or Intel SGX Enclaves (DCsv2/DCsv3 series)

**Deployment:** Confidential VMs with encrypted memory

**Attestation:** Microsoft Azure Attestation (MAA) service

**Pros:**
- ✅ AMD SEV-SNP (hardware-backed like GCP)
- ✅ Integration with Azure services (Key Vault, Managed Identity)
- ✅ Intel SGX support for smaller workloads

**Cons:**
- ⚠️ Limited VM series (DCsv2/DCsv3 for SGX, DCasv5/ECasv5 for SEV-SNP)
- ⚠️ Attestation requires Microsoft Attestation service
- ⚠️ Higher complexity for multi-region deployments

**APIs (2025):**
```bash
# Azure Services
compute.azure.com             # Confidential VMs
attestation.azure.com         # MAA attestation service
keyvault.azure.com            # Key management
```

**Attestation Format (MAA JWT):**
```json
{
  "iss": "https://sharedeus2.eus2.attest.azure.net",
  "jti": "...",
  "x-ms-ver": "1.0",
  "x-ms-attestation-type": "sevsnpvm",
  "x-ms-policy-hash": "...",
  "x-ms-runtime": {
    "vm-configuration": {
      "console-enabled": false,
      "secure-boot": true
    },
    "keys": [...],
    "tpm-report": {...}
  }
}
```

---

## Abstraction Layer Design

### **Interface: TEE Provider**

All cloud providers must implement this interface:

```typescript
// src/lib/core/tee/provider.ts

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
   * Send encrypted payload to TEE for decryption
   */
  submitEncryptedPayload(
    instanceId: string,
    payload: EncryptedPayload
  ): Promise<TEEResponse>;

  /**
   * Terminate TEE instance
   */
  terminate(instanceId: string): Promise<void>;

  /**
   * Health check for TEE instance
   */
  healthCheck(instanceId: string): Promise<TEEHealthStatus>;
}

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

export interface EncryptedPayload {
  /** XChaCha20-Poly1305 encrypted message */
  ciphertext: string;

  /** Nonce (24 bytes, hex-encoded) */
  nonce: string;

  /** User identifier (for key derivation) */
  userId: string;

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
```

---

## Provider Implementations

### **1. GCP Confidential Space Provider**

**File:** `src/lib/core/tee/providers/gcp.ts`

```typescript
import { TEEProvider, TEEDeploymentConfig, TEEInstance, AttestationToken } from '../provider';
import { GoogleAuth } from 'google-auth-library';

export class GCPConfidentialSpaceProvider implements TEEProvider {
  readonly name = 'gcp' as const;
  private auth: GoogleAuth;

  constructor(private config: { projectId: string; region: string }) {
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
  }

  async deploy(config: TEEDeploymentConfig): Promise<TEEInstance> {
    const client = await this.auth.getClient();

    // 1. Upload container to Artifact Registry
    const imageUri = await this.uploadContainer(config.containerImage);

    // 2. Create Confidential VM instance
    const instance = await this.createConfidentialVM({
      name: `tee-${Date.now()}`,
      machineType: `zones/${config.region}/machineTypes/n2d-standard-${config.resources.cpus}`,
      containerImage: imageUri,
      imageDigest: config.imageDigest,
      env: config.env
    });

    return {
      id: instance.id,
      providerMetadata: instance,
      endpoint: `http://${instance.networkInterfaces[0].accessConfigs[0].natIP}:8080`,
      attestationEndpoint: `https://confidentialcomputing.googleapis.com/v1/projects/${this.config.projectId}/locations/${config.region}/attestations`,
      status: 'running'
    };
  }

  async getAttestationToken(instanceId: string): Promise<AttestationToken> {
    const client = await this.auth.getClient();

    // GCP automatically generates OIDC tokens via Workload Identity
    const response = await client.request({
      url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/tee-workload@${this.config.projectId}.iam.gserviceaccount.com:generateIdToken`,
      method: 'POST',
      data: {
        audience: `//iam.googleapis.com/projects/${this.config.projectId}/locations/global/workloadIdentityPools/tee-pool/providers/tee-provider`,
        includeEmail: true
      }
    });

    const rawToken = response.data.token;
    const claims = this.parseJWT(rawToken);

    return {
      provider: 'gcp',
      rawToken,
      claims: {
        imageDigest: claims.submods.container.image_digest,
        hardware: claims.hwmodel,
        softwareVersion: claims.swversion.join('.'),
        issuedAt: claims.iat,
        ...claims
      }
    };
  }

  async verifyAttestation(
    token: AttestationToken,
    expectedCodeHash: string
  ): Promise<boolean> {
    // Verify JWT signature from Google
    const ticket = await this.auth.verifyIdToken({
      idToken: token.rawToken,
      audience: `//iam.googleapis.com/projects/${this.config.projectId}/locations/global/workloadIdentityPools/tee-pool/providers/tee-provider`
    });

    const payload = ticket.getPayload();
    if (!payload) return false;

    // Verify container image hash matches expected
    const actualHash = payload.submods?.container?.image_digest;
    return actualHash === expectedCodeHash;
  }

  async submitEncryptedPayload(
    instanceId: string,
    payload: EncryptedPayload
  ): Promise<TEEResponse> {
    const instance = await this.getInstance(instanceId);

    const response = await fetch(`${instance.endpoint}/decrypt-and-forward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return response.json();
  }

  async terminate(instanceId: string): Promise<void> {
    const client = await this.auth.getClient();

    await client.request({
      url: `https://compute.googleapis.com/compute/v1/projects/${this.config.projectId}/zones/${this.config.region}/instances/${instanceId}`,
      method: 'DELETE'
    });
  }

  async healthCheck(instanceId: string): Promise<TEEHealthStatus> {
    const instance = await this.getInstance(instanceId);

    const response = await fetch(`${instance.endpoint}/health`);
    return response.json();
  }

  // Helper methods
  private async uploadContainer(localPath: string): Promise<string> {
    // Upload to GCR or Artifact Registry
    // Return: gcr.io/PROJECT_ID/IMAGE:TAG
    throw new Error('Not implemented');
  }

  private async createConfidentialVM(params: unknown): Promise<unknown> {
    // Create Confidential VM via Compute Engine API
    throw new Error('Not implemented');
  }

  private async getInstance(instanceId: string): Promise<TEEInstance> {
    // Fetch instance details
    throw new Error('Not implemented');
  }

  private parseJWT(token: string): any {
    const parts = token.split('.');
    return JSON.parse(Buffer.from(parts[1], 'base64').toString());
  }
}
```

---

### **2. AWS Nitro Enclaves Provider**

**File:** `src/lib/core/tee/providers/aws.ts`

```typescript
import { TEEProvider, TEEDeploymentConfig, TEEInstance, AttestationToken } from '../provider';
import { EC2Client, RunInstancesCommand } from '@aws-sdk/client-ec2';

export class AWSNitroEnclavesProvider implements TEEProvider {
  readonly name = 'aws' as const;
  private ec2Client: EC2Client;

  constructor(private config: { region: string }) {
    this.ec2Client = new EC2Client({ region: config.region });
  }

  async deploy(config: TEEDeploymentConfig): Promise<TEEInstance> {
    // 1. Build Nitro Enclave image (.eif file)
    const encl aveImagePath = await this.buildEnclaveImage(config.containerImage);

    // 2. Launch EC2 instance with Nitro Enclave support
    const instance = await this.launchEC2WithEnclave({
      instanceType: `m5.${config.resources.cpus}xlarge`,
      enclaveImage: enclaveImagePath,
      env: config.env
    });

    return {
      id: instance.InstanceId!,
      providerMetadata: instance,
      endpoint: `http://${instance.PublicIpAddress}:8080`,
      attestationEndpoint: `http://${instance.PublicIpAddress}:8080/attestation`,
      status: 'running'
    };
  }

  async getAttestationToken(instanceId: string): Promise<AttestationToken> {
    const instance = await this.getInstance(instanceId);

    // Request attestation document from enclave
    const response = await fetch(`${instance.endpoint}/attestation`);
    const attestationDoc = await response.arrayBuffer();

    // Parse CBOR-encoded attestation document
    const claims = this.parseAttestationDocument(attestationDoc);

    return {
      provider: 'aws',
      rawToken: Buffer.from(attestationDoc).toString('base64'),
      claims: {
        imageDigest: claims.pcrs['2'], // PCR2 = application measurement
        hardware: 'AWS_NITRO',
        softwareVersion: claims.module_id.split('-')[1],
        issuedAt: claims.timestamp,
        ...claims
      }
    };
  }

  async verifyAttestation(
    token: AttestationToken,
    expectedCodeHash: string
  ): Promise<boolean> {
    const attestationDoc = Buffer.from(token.rawToken, 'base64');

    // Verify certificate chain
    const valid = await this.verifyCertificateChain(attestationDoc);
    if (!valid) return false;

    // Verify PCR2 (application measurement) matches expected
    return token.claims.imageDigest === expectedCodeHash;
  }

  async submitEncryptedPayload(
    instanceId: string,
    payload: EncryptedPayload
  ): Promise<TEEResponse> {
    const instance = await this.getInstance(instanceId);

    const response = await fetch(`${instance.endpoint}/decrypt-and-forward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return response.json();
  }

  async terminate(instanceId: string): Promise<void> {
    await this.ec2Client.send(
      new TerminateInstancesCommand({ InstanceIds: [instanceId] })
    );
  }

  async healthCheck(instanceId: string): Promise<TEEHealthStatus> {
    const instance = await this.getInstance(instanceId);

    const response = await fetch(`${instance.endpoint}/health`);
    return response.json();
  }

  // Helper methods
  private async buildEnclaveImage(dockerImage: string): Promise<string> {
    // Convert Docker image to Nitro Enclave Image Format (.eif)
    // nitro-cli build-enclave --docker-uri ${dockerImage} --output-file enclave.eif
    throw new Error('Not implemented');
  }

  private async launchEC2WithEnclave(params: unknown): Promise<any> {
    // Launch EC2 instance with EnclaveOptions enabled
    throw new Error('Not implemented');
  }

  private async getInstance(instanceId: string): Promise<TEEInstance> {
    // Fetch instance details
    throw new Error('Not implemented');
  }

  private parseAttestationDocument(cbor: ArrayBuffer): any {
    // Decode CBOR attestation document
    throw new Error('Not implemented');
  }

  private async verifyCertificateChain(attestationDoc: ArrayBuffer): Promise<boolean> {
    // Verify X.509 certificate chain from AWS
    throw new Error('Not implemented');
  }
}
```

---

### **3. Azure Confidential VMs Provider**

**File:** `src/lib/core/tee/providers/azure.ts`

```typescript
import { TEEProvider, TEEDeploymentConfig, TEEInstance, AttestationToken } from '../provider';
import { ComputeManagementClient } from '@azure/arm-compute';
import { DefaultAzureCredential } from '@azure/identity';

export class AzureConfidentialVMProvider implements TEEProvider {
  readonly name = 'azure' as const;
  private computeClient: ComputeManagementClient;

  constructor(private config: { subscriptionId: string; resourceGroup: string }) {
    const credential = new DefaultAzureCredential();
    this.computeClient = new ComputeManagementClient(credential, config.subscriptionId);
  }

  async deploy(config: TEEDeploymentConfig): Promise<TEEInstance> {
    // Create Confidential VM with AMD SEV-SNP
    const vm = await this.computeClient.virtualMachines.beginCreateOrUpdateAndWait(
      this.config.resourceGroup,
      `tee-${Date.now()}`,
      {
        location: config.region,
        hardwareProfile: {
          vmSize: `Standard_DC${config.resources.cpus}s_v3` // DCsv3 series
        },
        securityProfile: {
          securityType: 'ConfidentialVM',
          uefiSettings: {
            secureBootEnabled: true,
            vTpmEnabled: true
          }
        },
        storageProfile: {
          imageReference: {
            publisher: 'canonical',
            offer: 'ubuntu-24_04-lts',
            sku: 'server-cvm',
            version: 'latest'
          }
        }
      }
    );

    return {
      id: vm.id!,
      providerMetadata: vm,
      endpoint: `http://${vm.networkProfile?.networkInterfaces?.[0]?.ipAddress}:8080`,
      attestationEndpoint: `https://sharedeus2.eus2.attest.azure.net`,
      status: 'running'
    };
  }

  async getAttestationToken(instanceId: string): Promise<AttestationToken> {
    // Request MAA attestation token
    const response = await fetch(
      `https://sharedeus2.eus2.attest.azure.net/attest/SevSnpVm?api-version=2020-10-01`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runtime_data: Buffer.from(instanceId).toString('base64')
        })
      }
    );

    const { token } = await response.json();
    const claims = this.parseJWT(token);

    return {
      provider: 'azure',
      rawToken: token,
      claims: {
        imageDigest: claims['x-ms-runtime']?.keys?.[0]?.digest || '',
        hardware: 'AMD_SEV_SNP',
        softwareVersion: claims['x-ms-ver'],
        issuedAt: claims.iat,
        ...claims
      }
    };
  }

  async verifyAttestation(
    token: AttestationToken,
    expectedCodeHash: string
  ): Promise<boolean> {
    // Verify JWT signature from MAA service
    // TODO: Implement JWT verification with Azure public keys
    return token.claims.imageDigest === expectedCodeHash;
  }

  async submitEncryptedPayload(
    instanceId: string,
    payload: EncryptedPayload
  ): Promise<TEEResponse> {
    const instance = await this.getInstance(instanceId);

    const response = await fetch(`${instance.endpoint}/decrypt-and-forward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return response.json();
  }

  async terminate(instanceId: string): Promise<void> {
    await this.computeClient.virtualMachines.beginDeleteAndWait(
      this.config.resourceGroup,
      instanceId
    );
  }

  async healthCheck(instanceId: string): Promise<TEEHealthStatus> {
    const instance = await this.getInstance(instanceId);

    const response = await fetch(`${instance.endpoint}/health`);
    return response.json();
  }

  // Helper methods
  private async getInstance(instanceId: string): Promise<TEEInstance> {
    // Fetch VM details
    throw new Error('Not implemented');
  }

  private parseJWT(token: string): any {
    const parts = token.split('.');
    return JSON.parse(Buffer.from(parts[1], 'base64').toString());
  }
}
```

---

## Unified TEE Manager

**File:** `src/lib/core/tee/manager.ts`

```typescript
import { TEEProvider, TEEDeploymentConfig, TEEInstance, EncryptedPayload } from './provider';
import { GCPConfidentialSpaceProvider } from './providers/gcp';
import { AWSNitroEnclavesProvider } from './providers/aws';
import { AzureConfidentialVMProvider } from './providers/azure';

export class TEEManager {
  private providers: Map<string, TEEProvider> = new Map();
  private activeInstances: Map<string, { provider: TEEProvider; instance: TEEInstance }> =
    new Map();

  constructor(config: TEEManagerConfig) {
    // Initialize providers based on configuration
    if (config.gcp) {
      this.providers.set('gcp', new GCPConfidentialSpaceProvider(config.gcp));
    }
    if (config.aws) {
      this.providers.set('aws', new AWSNitroEnclavesProvider(config.aws));
    }
    if (config.azure) {
      this.providers.set('azure', new AzureConfidentialVMProvider(config.azure));
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
      throw new Error(`Provider not available: ${providerName}`);
    }

    const instance = await provider.deploy(config);
    this.activeInstances.set(instance.id, { provider, instance });

    return instance.id;
  }

  /**
   * Submit encrypted message to TEE for decryption and CWC forwarding
   */
  async submitMessage(instanceId: string, payload: EncryptedPayload) {
    const entry = this.activeInstances.get(instanceId);
    if (!entry) {
      throw new Error(`TEE instance not found: ${instanceId}`);
    }

    // Verify attestation before submission
    const attestation = await entry.provider.getAttestationToken(instanceId);
    const valid = await entry.provider.verifyAttestation(
      attestation,
      entry.instance.providerMetadata.imageDigest as string
    );

    if (!valid) {
      throw new Error('TEE attestation verification failed');
    }

    // Submit encrypted payload
    return entry.provider.submitEncryptedPayload(instanceId, payload);
  }

  /**
   * Terminate TEE instance
   */
  async terminateTEE(instanceId: string): Promise<void> {
    const entry = this.activeInstances.get(instanceId);
    if (!entry) return;

    await entry.provider.terminate(instanceId);
    this.activeInstances.delete(instanceId);
  }

  /**
   * Health check for all active TEEs
   */
  async healthCheckAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [id, entry] of this.activeInstances) {
      const health = await entry.provider.healthCheck(id);
      results.set(id, health.healthy);
    }

    return results;
  }

  /**
   * Select optimal provider based on cost, latency, and availability
   */
  private selectOptimalProvider(config: TEEDeploymentConfig): TEEProvider {
    // Priority: GCP > AWS > Azure (based on cost and maturity)
    if (this.providers.has('gcp')) return this.providers.get('gcp')!;
    if (this.providers.has('aws')) return this.providers.get('aws')!;
    if (this.providers.has('azure')) return this.providers.get('azure')!;

    throw new Error('No TEE providers configured');
  }
}

export interface TEEManagerConfig {
  gcp?: { projectId: string; region: string };
  aws?: { region: string };
  azure?: { subscriptionId: string; resourceGroup: string };
}
```

---

## Environment Configuration

**File:** `.env.example`

```bash
# TEE Provider Selection (gcp | aws | azure)
TEE_PROVIDER=gcp

# GCP Confidential Space
GCP_PROJECT_ID=communique-production
GCP_REGION=us-central1
GCP_SERVICE_ACCOUNT_KEY=...  # JSON key file path

# AWS Nitro Enclaves
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Azure Confidential VMs
AZURE_SUBSCRIPTION_ID=...
AZURE_RESOURCE_GROUP=communique-tee
AZURE_REGION=eastus2

# TEE Container Image
TEE_CONTAINER_IMAGE=gcr.io/communique-production/tee:latest
TEE_CONTAINER_DIGEST=sha256:abc123...

# Secrets (injected into TEE)
CWC_API_KEY=...
ENCRYPTION_KEY=...  # XChaCha20-Poly1305 key derivation secret
```

---

## Deployment Examples

### **Deploy on GCP (Primary):**

```typescript
import { TEEManager } from '$lib/core/tee/manager';

const manager = new TEEManager({
  gcp: {
    projectId: process.env.GCP_PROJECT_ID,
    region: process.env.GCP_REGION
  }
});

const instanceId = await manager.deployTEE({
  containerImage: 'gcr.io/communique-production/tee:latest',
  imageDigest: 'sha256:abc123...',
  env: {
    CWC_API_KEY: process.env.CWC_API_KEY,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY
  },
  resources: { cpus: 2, memoryGB: 8 },
  region: 'us-central1'
});
```

### **Failover to AWS:**

```typescript
const manager = new TEEManager({
  gcp: { projectId: '...', region: 'us-central1' },
  aws: { region: 'us-east-1' } // Fallback
});

try {
  // Try GCP first
  const instanceId = await manager.deployTEE(config, 'gcp');
} catch (error) {
  // Fallback to AWS if GCP unavailable
  const instanceId = await manager.deployTEE(config, 'aws');
}
```

---

## Testing Cloud-Agnostic Abstraction

**File:** `tests/integration/tee-abstraction.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { TEEManager } from '$lib/core/tee/manager';

describe('Cloud-Agnostic TEE Abstraction', () => {
  it('should deploy TEE on any provider', async () => {
    const manager = new TEEManager({
      gcp: { projectId: 'test-project', region: 'us-central1' }
    });

    const instanceId = await manager.deployTEE({
      containerImage: 'test-image',
      imageDigest: 'sha256:test',
      env: {},
      resources: { cpus: 2, memoryGB: 8 },
      region: 'us-central1'
    });

    expect(instanceId).toBeDefined();
  });

  it('should submit encrypted message via abstraction layer', async () => {
    const manager = new TEEManager({ gcp: { projectId: 'test', region: 'us' } });
    const instanceId = 'test-instance';

    const response = await manager.submitMessage(instanceId, {
      ciphertext: 'encrypted',
      nonce: '123',
      userId: 'user_1',
      templateId: 'tpl_1',
      recipient: {
        name: 'Senator Smith',
        office: 'senate',
        state: 'CA'
      }
    });

    expect(response.success).toBe(true);
  });

  it('should verify attestation across providers', async () => {
    // Test GCP OIDC attestation
    // Test AWS CBOR attestation
    // Test Azure MAA attestation
    // All should return boolean validation
  });
});
```

---

## Migration Path

**Week 13-14: GCP Only (Primary)**
- Implement `GCPConfidentialSpaceProvider` fully
- Deploy to production with GCP
- Test attestation + encryption pipeline

**Week 15-16: Add AWS Support (Fallback)**
- Implement `AWSNitroEnclavesProvider`
- Test failover from GCP → AWS
- Document cost comparison

**Phase 2: Add Azure Support (Future)**
- Implement `AzureConfidentialVMProvider`
- Multi-cloud deployment for GDPR compliance
- Regional failover (US → EU)

---

## Next Steps

1. **Implement GCP provider first** (Week 13)
2. **Test abstraction layer** with mock providers (Week 13)
3. **Deploy GCP TEE** to production (Week 14)
4. **Add AWS provider** as fallback (Week 15-16)
5. **Document provider selection criteria** (cost, latency, features)
