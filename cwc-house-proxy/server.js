/**
 * CWC House Proxy
 *
 * Thin reverse proxy that forwards pre-built CWC XML to the House CWC API
 * from a whitelisted IP address (35.209.173.125).
 *
 * The Communique backend (Cloudflare Workers) generates the XML client-side
 * and sends it here in a JSON envelope { xml, jobId, officeCode }.
 * This proxy validates the bearer token, then forwards the raw XML.
 */

const express = require('express');
const crypto = require('crypto');

const app = express();

// --- Configuration ---
const PORT = parseInt(process.env.PORT || '8080', 10);
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const HOUSE_CWC_ENDPOINT = process.env.HOUSE_CWC_ENDPOINT || 'https://cwc.house.gov/';
const MAX_XML_BYTES = 64 * 1024; // 64KB

if (!AUTH_TOKEN) {
	console.error('FATAL: AUTH_TOKEN environment variable is required');
	process.exit(1);
}

// --- Middleware ---
app.use(express.json({ limit: '100kb' }));

// In-memory rate limiter: 30 requests per minute per IP
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;

function rateLimit(req, res, next) {
	const ip = req.ip || req.socket.remoteAddress;
	const now = Date.now();

	if (!rateLimitMap.has(ip)) {
		rateLimitMap.set(ip, []);
	}

	const timestamps = rateLimitMap.get(ip).filter((t) => now - t < RATE_WINDOW_MS);

	if (timestamps.length >= RATE_MAX) {
		return res.status(429).json({
			error: 'Rate limit exceeded',
			status: 'failed',
			retryAfter: Math.ceil(RATE_WINDOW_MS / 1000)
		});
	}

	timestamps.push(now);
	rateLimitMap.set(ip, timestamps);
	next();
}

// Cleanup stale rate limit entries every 5 minutes
setInterval(() => {
	const now = Date.now();
	for (const [ip, timestamps] of rateLimitMap) {
		const active = timestamps.filter((t) => now - t < RATE_WINDOW_MS);
		if (active.length === 0) {
			rateLimitMap.delete(ip);
		} else {
			rateLimitMap.set(ip, active);
		}
	}
}, 5 * 60_000);

// Bearer token auth with constant-time comparison
function authenticate(req, res, next) {
	const authHeader = req.headers.authorization;
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return res
			.status(401)
			.json({ error: 'Missing or invalid Authorization header', status: 'failed' });
	}

	const token = authHeader.slice(7);

	// Constant-time comparison to prevent timing attacks
	const tokenBuf = Buffer.from(token);
	const authBuf = Buffer.from(AUTH_TOKEN);

	if (tokenBuf.length !== authBuf.length || !crypto.timingSafeEqual(tokenBuf, authBuf)) {
		return res.status(403).json({ error: 'Invalid authentication token', status: 'failed' });
	}

	next();
}

// --- Routes ---

app.get('/health', (_req, res) => {
	res.json({
		status: 'ok',
		uptime: process.uptime(),
		timestamp: new Date().toISOString()
	});
});

app.post('/api/house/submit', rateLimit, authenticate, async (req, res) => {
	const { xml, jobId, officeCode } = req.body;
	const requestId = req.headers['x-request-id'] || jobId || 'unknown';

	if (!xml || typeof xml !== 'string') {
		return res.status(400).json({ error: 'Missing or invalid "xml" field', status: 'failed' });
	}

	if (!jobId || typeof jobId !== 'string') {
		return res
			.status(400)
			.json({ error: 'Missing or invalid "jobId" field', status: 'failed' });
	}

	const xmlBytes = Buffer.byteLength(xml, 'utf8');
	if (xmlBytes > MAX_XML_BYTES) {
		return res.status(413).json({
			error: `XML payload too large: ${xmlBytes} bytes (max ${MAX_XML_BYTES})`,
			status: 'failed'
		});
	}

	if (!xml.includes('<?xml') || !xml.includes('<CWC')) {
		return res
			.status(400)
			.json({ error: 'Payload does not appear to be valid CWC XML', status: 'failed' });
	}

	console.log(
		`[${new Date().toISOString()}] Forward request=${requestId} office=${officeCode || 'N/A'} size=${xmlBytes}B`
	);

	try {
		const cwcResponse = await fetch(HOUSE_CWC_ENDPOINT, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/xml',
				'User-Agent': 'Communique-CWC-Proxy/1.0'
			},
			body: xml,
			signal: AbortSignal.timeout(25_000)
		});

		const responseText = await cwcResponse.text();

		console.log(
			`[${new Date().toISOString()}] CWC response request=${requestId} status=${cwcResponse.status} size=${responseText.length}B`
		);

		if (!cwcResponse.ok) {
			return res.status(502).json({
				error: `House CWC API returned HTTP ${cwcResponse.status}: ${responseText.substring(0, 500)}`,
				status: 'failed',
				submissionId: jobId
			});
		}

		res.json({
			submissionId: jobId,
			status: 'submitted',
			cwcStatus: cwcResponse.status,
			cwcResponse: responseText.substring(0, 1000)
		});
	} catch (err) {
		const errMsg = err instanceof Error ? err.message : String(err);
		console.error(`[${new Date().toISOString()}] CWC forward error request=${requestId}:`, errMsg);

		res.status(502).json({
			error: `Failed to reach House CWC API: ${errMsg}`,
			status: 'failed',
			submissionId: jobId
		});
	}
});

// 404 for unmatched routes
app.use((_req, res) => {
	res.status(404).json({ error: 'Not found' });
});

// --- Start ---
app.listen(PORT, '0.0.0.0', () => {
	console.log(`CWC House Proxy listening on http://0.0.0.0:${PORT}`);
	console.log(`Forwarding to: ${HOUSE_CWC_ENDPOINT}`);
});
