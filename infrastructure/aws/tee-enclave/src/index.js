/**
 * Universal TEE Workload
 *
 * Cloud-agnostic container for:
 * 1. XChaCha20-Poly1305 decryption
 * 2. CWC API forwarding
 * 3. Remote attestation
 *
 * Runs on:
 * - GCP Confidential Space (AMD SEV-SNP)
 * - AWS Nitro Enclaves (hypervisor-backed)
 * - Azure Confidential VMs (AMD SEV-SNP / Intel SGX)
 */

import express from 'express';
import { register, Counter, Histogram, Gauge } from 'prom-client';
import { decrypt, initCrypto, getEnclavePublicKey } from './crypto.js';
import { forwardToCWC } from './cwc-client.js';
import { getAttestationToken } from './attestation.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

// ==================== Metrics ====================

const decryptionCounter = new Counter({
	name: 'tee_decryptions_total',
	help: 'Total number of decryption requests'
});

const decryptionErrorCounter = new Counter({
	name: 'tee_decryption_errors_total',
	help: 'Total number of decryption errors'
});

const cwcForwardCounter = new Counter({
	name: 'tee_cwc_forwards_total',
	help: 'Total number of CWC API forwards'
});

const decryptionDuration = new Histogram({
	name: 'tee_decryption_duration_seconds',
	help: 'Decryption duration in seconds',
	buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0]
});

const queueDepthGauge = new Gauge({
	name: 'tee_queue_depth',
	help: 'Current request queue depth'
});

// ==================== Health Check ====================

app.get('/health', (req, res) => {
	res.json({
		status: 'healthy',
		uptime: process.uptime(),
		memory_usage: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal,
		cpu_usage: process.cpuUsage().user / 1000000, // Convert to seconds
		queue_depth: queueDepthGauge.get().values[0]?.value || 0,
		timestamp: new Date().toISOString()
	});
});

// ==================== Metrics Endpoint ====================

app.get('/metrics', async (req, res) => {
	res.set('Content-Type', register.contentType);
	res.end(await register.metrics());
});

// ==================== Attestation Endpoint ====================

app.get('/attestation', async (req, res) => {
	try {
		// Get enclave public key to include in attestation
		const publicKey = getEnclavePublicKey();

		const token = await getAttestationToken(publicKey);

		res.setHeader('Content-Type', 'application/json');
		res.setHeader('X-Attestation-Token', token.rawToken);

		res.json({
			provider: token.provider,
			claims: token.claims,
			attestation_document: token.rawToken, // Alias for client compatibility
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error('Attestation error:', error);
		res.status(500).json({
			error: 'Failed to generate attestation token',
			message: error.message
		});
	}
});

// ==================== Main Decryption Endpoint ====================

/**
 * POST /decrypt-and-forward
 *
 * Decrypts AES-256-GCM encrypted message (using ECDH shared secret) and forwards to CWC API
 *
 * THIS IS THE ONLY PLACE PLAINTEXT EXISTS OUTSIDE THE BROWSER
 */
app.post('/decrypt-and-forward', async (req, res) => {
	const timer = decryptionDuration.startTimer();
	queueDepthGauge.inc();

	try {
		const { ciphertext, nonce, ephemeralPublicKey, templateId, recipient } = req.body;

		// Validate required fields
		if (!ciphertext || !nonce || !ephemeralPublicKey || !templateId || !recipient) {
			return res.status(400).json({
				error: 'Missing required fields',
				required: ['ciphertext', 'nonce', 'ephemeralPublicKey', 'templateId', 'recipient']
			});
		}

		console.log('Decryption request:', {
			templateId,
			recipient: recipient.name,
			timestamp: new Date().toISOString()
		});

		// 1. Decrypt message (PLAINTEXT EXISTS HERE ONLY)
		const plaintext = await decrypt(ciphertext, nonce, ephemeralPublicKey);

		console.log('Message decrypted successfully (length:', plaintext.length, 'bytes)');

		// 2. Generate attestation token (for proxy auth and response)
		const publicKey = getEnclavePublicKey();
		const attestationToken = await getAttestationToken(publicKey);

		// 3. Forward plaintext to CWC API
		const cwcConfirmation = await forwardToCWC({
			message: plaintext,
			recipient,
			templateId,
			attestationToken: attestationToken.rawToken
		});

		console.log('CWC forwarding successful:', cwcConfirmation);

		// 4. Metrics
		decryptionCounter.inc();
		cwcForwardCounter.inc();
		timer();

		// 5. Return success (NO PLAINTEXT IN RESPONSE)
		res.setHeader('X-Attestation-Token', attestationToken.rawToken);
		res.json({
			success: true,
			cwc_confirmation: cwcConfirmation,
			attestation_document: attestationToken.rawToken, // Alias for client compatibility
			timestamp: new Date().toISOString()
		});

		// CRITICAL: Plaintext is cleared from memory after this function
		// Node.js garbage collector will handle memory cleanup
	} catch (error) {
		decryptionErrorCounter.inc();
		timer();

		console.error('Decryption/forwarding error:', error);

		res.status(500).json({
			success: false,
			error: error.message || 'Decryption or forwarding failed',
			timestamp: new Date().toISOString()
		});
	} finally {
		queueDepthGauge.dec();
	}
});

// ==================== Error Handling ====================

app.use((error, req, res, next) => {
	console.error('Unhandled error:', error);

	res.status(500).json({
		error: 'Internal server error',
		message: process.env.NODE_ENV === 'development' ? error.message : undefined
	});
});

// ==================== Startup ====================

const PORT = process.env.PORT || 8080;

// Initialize crypto (generate keypair) before starting server
initCrypto()
	.then(() => {
		const server = app.listen(PORT, '0.0.0.0', () => {
			console.log('='.repeat(60));
			console.log('TEE Workload Server Started');
			console.log('='.repeat(60));
			console.log('Port:', PORT);
			console.log('Environment:', process.env.NODE_ENV || 'production');
			console.log('Cloud Provider:', detectCloudProvider());
			console.log('Endpoints:');
			console.log('  POST /decrypt-and-forward - Decrypt and forward to CWC');
			console.log('  GET  /health              - Health check');
			console.log('  GET  /metrics             - Prometheus metrics');
			console.log('  GET  /attestation         - Remote attestation token');
			console.log('='.repeat(60));
			console.log('TEE is ready to process encrypted messages');
			console.log('='.repeat(60));
		});

		// Graceful shutdown
		process.on('SIGTERM', () => {
			console.log('SIGTERM received, shutting down gracefully...');

			server.close(() => {
				console.log('Server closed');
				process.exit(0);
			});

			// Force shutdown after 10 seconds
			setTimeout(() => {
				console.error('Forced shutdown after timeout');
				process.exit(1);
			}, 10000);
		});
	})
	.catch((err) => {
		console.error('Failed to initialize TEE workload:', err);
		process.exit(1);
	});

/**
 * Detect cloud provider from environment
 */
function detectCloudProvider() {
	if (process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT) {
		return 'GCP Confidential Space';
	}
	if (process.env.AWS_EXECUTION_ENV || process.env.AWS_REGION) {
		return 'AWS Nitro Enclaves';
	}
	if (process.env.AZURE_SUBSCRIPTION_ID) {
		return 'Azure Confidential VMs';
	}
	return 'Unknown (local development?)';
}
