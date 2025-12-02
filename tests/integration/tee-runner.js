import { spawn } from 'child_process';
import http from 'http';
import crypto from 'node:crypto';

// Mock CWC Server
const cwcServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        console.log('[Mock CWC] Received request:', req.method, req.url);
        console.log('[Mock CWC] Headers:', req.headers);
        console.log('[Mock CWC] Body:', body);

        if (req.url === '/api/submit') {
            res.writeHead(200, { 'Content-Type': 'application/xml' });
            res.end('<Response><ConfirmationId>CWC-TEST-123</ConfirmationId></Response>');
        } else {
            res.writeHead(404);
            res.end();
        }
    });
});

async function startServers() {
    // Start Mock CWC
    await new Promise(resolve => cwcServer.listen(8083, () => {
        console.log('[Mock CWC] Listening on 8083');
        resolve();
    }));

    // Start GCP Proxy
    /** @type {NodeJS.ProcessEnv} */
    const proxyEnv = { ...process.env, PORT: '8082', ALLOWED_PCR0S: '', NODE_ENV: 'development' };
    const proxy = spawn('node', ['infrastructure/gcp-proxy/server.js'], { env: proxyEnv, stdio: 'inherit' });

    // Start TEE Workload
    // We need to configure it to use the GCP Proxy
    /** @type {NodeJS.ProcessEnv} */
    const teeEnv = {
        ...process.env,
        PORT: '8081',
        GCP_PROXY_URL: 'http://127.0.0.1:8082/submit',
        CWC_API_KEY: 'test-key',
        ENCRYPTION_KEY: 'master-secret', // Not used for ECDH but needed for startup check?
        CWC_SENATE_ENDPOINT: 'http://127.0.0.1:8083/api/submit',
        CWC_HOUSE_ENDPOINT: 'http://127.0.0.1:8083/api/submit'
    };
    const tee = spawn('node', ['infrastructure/aws/tee-enclave/src/index.js'], { env: teeEnv, stdio: 'inherit' });

    // Wait for servers to start
    await new Promise((resolve) => setTimeout(resolve, 5000));

    return { proxy, tee };
}

async function runTest() {
    console.log('Starting Integration Test...');
    const { proxy, tee } = await startServers();

    try {
        // 1. Fetch Attestation
        console.log('Fetching attestation...');
        const attResponse = await fetch('http://127.0.0.1:8081/attestation');
        const attData = await attResponse.json();
        console.log('Attestation received:', attData);

        const publicKeyB64 = attData.claims.publicKey;
        if (!publicKeyB64) throw new Error('No public key in attestation');

        // 2. Encrypt Message (Client Simulation)
        console.log('Encrypting message...');

        // Import TEE public key
        const teePublicKey = crypto.createPublicKey({
            key: Buffer.from(publicKeyB64, 'base64'),
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
        const aesKey = crypto.hkdfSync(
            'sha256',
            sharedSecret,
            Buffer.alloc(0),
            Buffer.alloc(0),
            32
        );

        // Encrypt message (AES-256-GCM)
        const message = 'Hello Congress!';
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(aesKey), iv);

        let ciphertext = cipher.update(message, 'utf8');
        ciphertext = Buffer.concat([ciphertext, cipher.final()]);
        const authTag = cipher.getAuthTag();
        const finalCiphertext = Buffer.concat([ciphertext, authTag]);

        const payload = {
            ciphertext: finalCiphertext.toString('base64'),
            nonce: iv.toString('base64'),
            ephemeralPublicKey: ephemeralKeyPair.publicKey.export({ format: 'der', type: 'spki' }).toString('hex'),
            templateId: 'test-template',
            recipient: {
                name: 'Senator Test',
                office: 'senate',
                state: 'CA'
            }
        };

        // 3. Submit to TEE
        console.log('Submitting to TEE...');
        const subResponse = await fetch('http://127.0.0.1:8081/decrypt-and-forward', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const subData = await subResponse.json();
        console.log('Submission response:', subData);

        if (subData.success && subData.cwc_confirmation === 'CWC-TEST-123') {
            console.log('TEST PASSED: Full flow verification successful');
        } else {
            console.error('TEST FAILED: Unexpected response');
            process.exit(1);
        }

    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    } finally {
        // @ts-ignore
        proxy.kill();
        // @ts-ignore
        tee.kill();
        cwcServer.close();
        process.exit(0);
    }
}

runTest();
