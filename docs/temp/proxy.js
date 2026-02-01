const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');

const app = express();

// House CWC API Endpoints
const HOUSE_UAT_URL = 'https://uat-cwc.house.gov';
const HOUSE_PROD_URL = 'https://cwc.house.gov';

// House CWC API Key (same key for both environments per House docs)
const HOUSE_API_KEY = '113a7ef7e1151325f11ad846db13bd42795fb799';

// Proxy authentication tokens (for clients authenticating TO this proxy)
const PROD_TOKEN = '7f814313e927d68eb38af01cebdff36cd28a005f0afb2657a1dbcb4828bba35d';
const DEV_TOKEN = 'ad4f26050db94a6bed25ace5f5400c837f7e6fb414d3f18895e04751d8a19ab2';

// Parse raw body for XML forwarding
app.use(express.raw({ type: 'application/xml', limit: '1mb' }));
app.use(express.text({ type: '*/*', limit: '1mb' }));

// Authentication middleware
const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Allow requests without auth for now (client doesn't send Bearer token)
  // TODO: Re-enable auth after client is updated
  if (!authHeader) {
    console.log(`[${new Date().toISOString()}] Request without auth header - allowing for now`);
    return next();
  }

  if (req.path.startsWith('/cwc-house-test') && authHeader === `Bearer ${DEV_TOKEN}`) {
    next();
  } else if (req.path.startsWith('/cwc-house') && !req.path.includes('-test') && authHeader === `Bearer ${PROD_TOKEN}`) {
    next();
  } else if (authHeader === `Bearer ${PROD_TOKEN}` || authHeader === `Bearer ${DEV_TOKEN}`) {
    // Accept either token for flexibility
    next();
  } else {
    console.log(`[${new Date().toISOString()}] Auth failed for ${req.path}`);
    res.sendStatus(401);
  }
};

app.use(auth);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Production House CWC endpoint
app.post('/cwc-house', async (req, res) => {
  const targetUrl = `${HOUSE_PROD_URL}/v2/message?apikey=${HOUSE_API_KEY}`;
  console.log(`[${new Date().toISOString()}] Forwarding to PROD: ${HOUSE_PROD_URL}/v2/message`);
  await forwardRequest(req, res, targetUrl);
});

// Test/UAT House CWC endpoint
app.post('/cwc-house-test', async (req, res) => {
  const targetUrl = `${HOUSE_UAT_URL}/v2/message?apikey=${HOUSE_API_KEY}`;
  console.log(`[${new Date().toISOString()}] Forwarding to UAT: ${HOUSE_UAT_URL}/v2/message`);
  await forwardRequest(req, res, targetUrl);
});

// Forward request to House CWC
async function forwardRequest(req, res, targetUrl) {
  try {
    const url = new URL(targetUrl);
    const requestId = req.headers['x-request-id'] || `proxy-${Date.now()}`;

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        'User-Agent': 'Communique-CWC-Proxy/1.0',
        'X-Request-ID': requestId,
        'Content-Length': Buffer.byteLength(req.body)
      }
    };

    console.log(`[${new Date().toISOString()}] Request ${requestId}: ${options.method} ${url.hostname}${options.path.split('?')[0]}`);

    const proxyReq = https.request(options, (proxyRes) => {
      let data = '';

      proxyRes.on('data', (chunk) => {
        data += chunk;
      });

      proxyRes.on('end', () => {
        console.log(`[${new Date().toISOString()}] Response ${requestId}: ${proxyRes.statusCode} (${data.length} bytes)`);
        res.status(proxyRes.statusCode);

        // Forward relevant headers
        if (proxyRes.headers['content-type']) {
          res.set('Content-Type', proxyRes.headers['content-type']);
        }

        res.send(data);
      });
    });

    proxyReq.on('error', (error) => {
      console.error(`[${new Date().toISOString()}] Proxy error ${requestId}:`, error.message);
      res.status(502).json({
        error: 'Proxy error',
        message: error.message,
        requestId
      });
    });

    // Send the XML body
    proxyReq.write(req.body);
    proxyReq.end();

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Forward error:`, error.message);
    res.status(500).json({
      error: 'Internal proxy error',
      message: error.message
    });
  }
}

// SSL configuration
const sslConfig = {
  cert: fs.readFileSync('/etc/letsencrypt/live/house.communi.email/fullchain.pem'),
  key: fs.readFileSync('/etc/letsencrypt/live/house.communi.email/privkey.pem')
};

// Start HTTPS server
https.createServer(sslConfig, app).listen(443, () => {
  console.log(`[${new Date().toISOString()}] CWC Proxy server running on port 443`);
  console.log(`  - /cwc-house -> ${HOUSE_PROD_URL}`);
  console.log(`  - /cwc-house-test -> ${HOUSE_UAT_URL}`);
});

// Also listen on HTTP for health checks (optional)
http.createServer(app).listen(8080, () => {
  console.log(`[${new Date().toISOString()}] Health check server running on port 8080`);
});
