# Communiqué TEE Workload

**Universal Trusted Execution Environment (TEE) container for XChaCha20-Poly1305 decryption and CWC API forwarding.**

Cloud-agnostic design supports:
- ✅ **GCP Confidential Space** (AMD SEV-SNP)
- 🟡 **AWS Nitro Enclaves** (Hypervisor-backed) - Future
- 🔵 **Azure Confidential VMs** (AMD SEV-SNP / Intel SGX) - Future

---

## Architecture

```
Browser (encrypted) → communique backend → TEE → CWC API → Congressional office
                                            ↑
                                    Plaintext exists
                                   ONLY in TEE memory
                                  (hardware-isolated)
```

### Security Guarantees:

1. **Hardware Memory Encryption** - AMD SEV-SNP encrypts VM memory (even from hypervisor)
2. **Remote Attestation** - Cryptographic proof of code integrity
3. **Minimal Attack Surface** - ~200 lines of decryption code (easy to audit)
4. **No PII Storage** - Plaintext cleared from memory after forwarding

---

## Deployment

### **Local Development:**

```bash
npm install
npm run dev
```

### **Build Docker Image:**

```bash
docker build -t gcr.io/PROJECT_ID/communique-tee:latest .
```

### **Run Locally:**

```bash
docker run -p 8080:8080 \
  -e CWC_API_KEY=your_api_key \
  -e ENCRYPTION_KEY=your_encryption_secret \
  gcr.io/PROJECT_ID/communique-tee:latest
```

### **Deploy to GCP Confidential Space:**

See `../docs/research/gcp-confidential-space-deployment.md` for detailed instructions.

### **Deploy to AWS Nitro Enclaves:**

```bash
# Convert Docker image to Nitro Enclave Image Format (.eif)
nitro-cli build-enclave \
  --docker-uri gcr.io/PROJECT_ID/communique-tee:latest \
  --output-file communique-tee.eif

# Run enclave on EC2 instance
nitro-cli run-enclave \
  --cpu-count 2 \
  --memory 4096 \
  --eif-path communique-tee.eif
```

---

## API Endpoints

### **POST /decrypt-and-forward**

Decrypts XChaCha20-Poly1305 encrypted message and forwards to CWC API.

**Request:**
```json
{
  "ciphertext": "hex-encoded encrypted message",
  "nonce": "hex-encoded 24-byte nonce",
  "userId": "user-id-for-key-derivation",
  "templateId": "template-id",
  "recipient": {
    "name": "Senator Jane Smith",
    "office": "senate",
    "state": "CA",
    "district": null
  }
}
```

**Response:**
```json
{
  "success": true,
  "cwc_confirmation": "cwc-confirmation-id",
  "timestamp": "2025-10-22T14:30:00Z"
}
```

**Headers:**
- `X-Attestation-Token`: OIDC token proving TEE integrity

---

### **GET /health**

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "uptime": 12345.67,
  "memory_usage": 0.42,
  "cpu_usage": 0.15,
  "queue_depth": 0,
  "timestamp": "2025-10-22T14:30:00Z"
}
```

---

### **GET /metrics**

Prometheus metrics for monitoring.

**Metrics:**
- `tee_decryptions_total` - Total decryption requests
- `tee_decryption_errors_total` - Failed decryptions
- `tee_cwc_forwards_total` - Successful CWC forwards
- `tee_decryption_duration_seconds` - Decryption latency histogram
- `tee_queue_depth` - Current request queue depth

---

### **GET /attestation**

Remote attestation token endpoint.

**Response:**
```json
{
  "provider": "gcp",
  "claims": {
    "imageDigest": "sha256:abc123...",
    "hardware": "GCP_AMD_SEV_SNP",
    "softwareVersion": "1.14",
    "issuedAt": 1698765432,
    "projectId": "communique-production",
    "instanceId": "1234567890"
  },
  "timestamp": "2025-10-22T14:30:00Z"
}
```

**Headers:**
- `X-Attestation-Token`: Raw OIDC/CBOR token

---

## Environment Variables

### **Required:**

```bash
# CWC API credentials
CWC_API_KEY=...                         # Congressional API key

# Encryption key derivation
ENCRYPTION_KEY=...                      # Master secret for key derivation
```

### **Optional:**

```bash
# Server configuration
PORT=8080                               # HTTP port (default: 8080)
NODE_ENV=production                     # Environment (default: production)

# GCP-specific
GCP_PROJECT_ID=...                      # GCP project ID
GCP_WORKLOAD_IDENTITY_AUDIENCE=...      # OIDC audience for attestation

# AWS-specific (future)
AWS_REGION=...                          # AWS region

# Azure-specific (future)
AZURE_ATTESTATION_ENDPOINT=...          # MAA endpoint
```

---

## Security

### **Threat Model:**

**Attackers CANNOT:**
- ❌ Access plaintext (hardware memory encryption)
- ❌ Tamper with code (remote attestation detects changes)
- ❌ Steal encryption keys (ephemeral, derived per-user)
- ❌ Read decrypted messages from logs (not logged)

**Attackers CAN (by design):**
- ✅ See encrypted ciphertexts (public)
- ✅ See CWC confirmations (public)
- ✅ Monitor network traffic (encrypted in transit)

### **Mitigations:**

1. **Remote Attestation** - Clients verify code hash before sending data
2. **Ephemeral Keys** - Derived per-user, never stored
3. **Memory Clearing** - Node.js GC clears plaintext after use
4. **Minimal Code** - ~200 lines of decryption logic (easy to audit)

---

## Testing

### **Unit Tests:**

```bash
npm test
```

### **Integration Test (Local):**

```bash
# Start TEE workload
npm start

# In another terminal, test decryption endpoint
curl -X POST http://localhost:8080/decrypt-and-forward \
  -H "Content-Type: application/json" \
  -d '{
    "ciphertext": "...",
    "nonce": "...",
    "userId": "test-user",
    "templateId": "test-template",
    "recipient": {
      "name": "Senator Test",
      "office": "senate",
      "state": "CA"
    }
  }'
```

---

## Monitoring

### **Prometheus Metrics:**

```bash
# Scrape metrics
curl http://localhost:8080/metrics
```

### **Health Check:**

```bash
# Kubernetes liveness probe
curl http://localhost:8080/health
```

---

## Attestation Verification

### **GCP OIDC Token Verification:**

```javascript
import { getTEEManager } from '$lib/core/tee/manager';

const manager = getTEEManager();
const attestation = await manager.getInstance('tee-instance-id').getAttestationToken();

// Verify:
// 1. JWT signature (Google public keys)
// 2. Issuer = https://confidentialcomputing.googleapis.com
// 3. Container image digest matches published version
// 4. Hardware = AMD_SEV_SNP
```

---

## Future Enhancements

### **Phase 2 (AWS Support):**
- [ ] AWS Nitro Enclaves attestation (CBOR documents)
- [ ] vsock communication with parent EC2 instance
- [ ] Convert Docker → Nitro Enclave Image Format (.eif)

### **Phase 3 (Azure Support):**
- [ ] Azure Confidential VM attestation (MAA service)
- [ ] Intel SGX support (DCsv2/DCsv3 series)
- [ ] Managed Identity integration

### **Phase 4 (Advanced Security):**
- [ ] Secure boot verification
- [ ] TPM-based key sealing
- [ ] Encrypted memory pages (beyond AMD SEV-SNP)
- [ ] Confidential containers (Kata Containers)

---

## License

MIT License - See `../LICENSE` for details.

---

## Support

**Documentation:** `../docs/architecture/cloud-agnostic-tee-abstraction.md`

**Issues:** https://github.com/communique/communique/issues

**Security:** security@communi.email
