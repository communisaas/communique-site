import express from 'express';
import cbor from 'cbor';
const { decodeFirst } = cbor;

const app = express();
app.use(express.text({ type: 'application/xml', limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));

// ==================== Configuration ====================

const PORT = process.env.PORT || 8080;
const ALLOWED_PCR0s = process.env.ALLOWED_PCR0S ? process.env.ALLOWED_PCR0S.split(',') : [];

// ==================== Middleware ====================

/**
 * Verify Nitro Attestation Token
 */
async function verifyAttestation(req, res, next) {
    console.log('Proxy received headers:', JSON.stringify(req.headers));
    const token = req.headers['x-attestation-token'];

    if (!token) {
        return res.status(401).json({ error: 'Missing attestation token' });
    }

    try {
        const buffer = Buffer.from(token, 'base64');
        let pcr0;

        try {
            // Try decoding as COSE/CBOR (Production format)
            // Decode COSE Sign1 structure
            // Structure: [protected, unprotected, payload, signature]
            const decodedCose = await decodeFirst(buffer);

            // Payload is at index 2 (CBOR encoded attestation document)
            const attestationDoc = await decodeFirst(decodedCose.value[2]);

            // Extract PCR0 (Enclave Image Hash)
            // PCRs are in index 1 map
            const pcrs = attestationDoc.pcrs || attestationDoc.get(1);
            pcr0 = pcrs && (pcrs[0] || pcrs.get(0));
        } catch (cborError) {
            // Fallback: Try decoding as JSON (Mock format)
            try {
                const jsonClaims = JSON.parse(buffer.toString('utf8'));
                if (jsonClaims.warning && jsonClaims.warning.includes('MOCK TOKEN')) {
                    console.warn('Using MOCK attestation token (JSON format)');
                    // Mock tokens don't have PCRs usually, or we can fake it
                    // For now, allow it
                    next();
                    return;
                }
            } catch (jsonError) {
                throw cborError; // Throw original CBOR error if not valid JSON either
            }
        }

        if (pcr0) {
            const pcr0Hex = pcr0.toString('hex');
            console.log(`Request from enclave with PCR0: ${pcr0Hex}`);

            if (ALLOWED_PCR0s.length > 0 && !ALLOWED_PCR0s.includes(pcr0Hex)) {
                throw new Error(`Unauthorized enclave image (PCR0: ${pcr0Hex})`);
            }
        } else {
            // If we got here via JSON fallback, pcr0 is undefined, which is fine for mock
            // console.warn('No PCR0 found in attestation document');
        }

        // TODO: Verify COSE signature using AWS Nitro PKI

        next();
    } catch (error) {
        console.error('Attestation verification failed:', error);
        res.status(403).json({ error: 'Invalid attestation token', details: error.message });
    }
}

// ==================== Routes ====================

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

/**
 * Proxy request to CWC API
 */
app.post('/submit', verifyAttestation, async (req, res) => {
    const targetEndpoint = req.headers['x-target-endpoint'];

    if (!targetEndpoint) {
        return res.status(400).json({ error: 'Missing X-Target-Endpoint header' });
    }

    // Validate target endpoint is a CWC URL
    const allowedDomains = ['soapbox.senate.gov', 'forms.house.gov'];
    if (process.env.NODE_ENV !== 'production') {
        allowedDomains.push('localhost', '127.0.0.1');
    }
    try {
        const url = new URL(targetEndpoint);
        if (!allowedDomains.includes(url.hostname)) {
            return res.status(403).json({ error: 'Target endpoint not allowed' });
        }
    } catch (e) {
        return res.status(400).json({ error: 'Invalid target endpoint URL' });
    }

    console.log(`Proxying request to ${targetEndpoint}`);

    try {
        const response = await fetch(targetEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/xml',
                'User-Agent': 'Communique-GCP-Proxy/1.0'
            },
            body: req.body // XML body
        });

        const responseText = await response.text();

        res.status(response.status).send(responseText);
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(502).json({ error: 'Upstream proxy error', message: error.message });
    }
});

// ==================== Startup ====================

app.listen(PORT, () => {
    console.log(`GCP Proxy Server listening on port ${PORT}`);
});
