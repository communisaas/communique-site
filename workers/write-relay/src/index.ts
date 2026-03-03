/**
 * Write Relay — CF Worker entry point
 *
 * Thin relay that owns mutable state (D1) and delegates tree computation
 * to Shadow Atlas sidecar. Routes:
 *   POST /v1/register           — Insert leaf into registration tree
 *   POST /v1/register/replace   — Replace leaf (credential recovery)
 *   POST /v1/engagement/register — Register engagement identity
 *   POST /v1/community-field/contribute — Submit community field contribution
 *   GET  /v1/community-field/info       — Current epoch info
 *   GET  /v1/community-field/epoch/:date — Epoch contribution data
 *   GET  /v1/health                      — Health check
 */

import { D1Adapter } from './d1-adapter';
import { TreeServiceClient } from './tree-client';
import { handleContribute, handleInfo, handleEpoch } from './community-field';

interface Env {
	DB: D1Database;
	RELAY_AUTH_TOKEN: string;
	SIDECAR_AUTH_TOKEN: string;
	SHADOW_ATLAS_SIDECAR_URL: string;
}

// --------------------------------------------------------------------------
// Rate limiting (in-memory sliding window, reset per isolate)
// --------------------------------------------------------------------------

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 30; // requests per window per IP
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRate(ip: string): boolean {
	const now = Date.now();
	const bucket = rateBuckets.get(ip);
	if (!bucket || now > bucket.resetAt) {
		rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
		return true;
	}
	bucket.count++;
	return bucket.count <= RATE_LIMIT;
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function jsonResponse(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

function errorResponse(message: string, status: number, code?: string): Response {
	return jsonResponse({ success: false, error: { code: code ?? 'ERROR', message } }, status);
}

const HEX_RE = /^0x[0-9a-fA-F]+$/;

// --------------------------------------------------------------------------
// Registration handlers
// --------------------------------------------------------------------------

async function handleRegister(
	request: Request,
	storage: D1Adapter,
	tree: TreeServiceClient,
): Promise<Response> {
	let body: { leaf?: string; attestationHash?: string };
	try {
		body = await request.json() as typeof body;
	} catch {
		return errorResponse('Invalid JSON body', 400, 'INVALID_BODY');
	}

	const { leaf, attestationHash } = body;
	if (typeof leaf !== 'string' || !HEX_RE.test(leaf)) {
		return errorResponse('leaf must be a 0x-prefixed hex string', 400, 'INVALID_PARAMETERS');
	}

	// Idempotency check
	const idempotencyKey = request.headers.get('X-Idempotency-Key');
	if (idempotencyKey) {
		const cached = await storage.getIdempotencyResult(idempotencyKey);
		if (cached) {
			return new Response(cached, {
				status: 200,
				headers: { 'Content-Type': 'application/json', 'X-Idempotent-Replay': 'true' },
			});
		}
	}

	// Duplicate leaf check
	const existing = await storage.findLeaf(leaf);
	if (existing) {
		const proof = await tree.getRegistrationProof(existing.leafIndex);
		const responseBody = JSON.stringify({
			success: true,
			data: { leafIndex: existing.leafIndex, ...proof },
			duplicate: true,
		});
		return new Response(responseBody, {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	// Capacity check
	const [size, capacity] = await Promise.all([storage.getTreeSize(), storage.getTreeCapacity()]);
	if (size >= capacity) {
		return errorResponse('Registration tree is full', 503, 'TREE_FULL');
	}

	// Insert leaf in D1
	const newIndex = size;
	await storage.insertLeaf(leaf, newIndex, attestationHash);

	// Notify sidecar for tree computation
	const proof = await tree.notifyInsertion(leaf, newIndex);

	const responseBody = JSON.stringify({
		success: true,
		data: { leafIndex: newIndex, ...proof },
	});

	// Cache idempotency result (1hr)
	if (idempotencyKey) {
		await storage.setIdempotencyResult(idempotencyKey, responseBody, 3_600_000);
	}

	return new Response(responseBody, {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
}

async function handleReplace(
	request: Request,
	storage: D1Adapter,
	tree: TreeServiceClient,
): Promise<Response> {
	let body: { newLeaf?: string; oldLeafIndex?: number };
	try {
		body = await request.json() as typeof body;
	} catch {
		return errorResponse('Invalid JSON body', 400, 'INVALID_BODY');
	}

	const { newLeaf, oldLeafIndex } = body;
	if (typeof newLeaf !== 'string' || !HEX_RE.test(newLeaf)) {
		return errorResponse('newLeaf must be a 0x-prefixed hex string', 400, 'INVALID_PARAMETERS');
	}
	if (typeof oldLeafIndex !== 'number' || oldLeafIndex < 0) {
		return errorResponse('oldLeafIndex must be a non-negative integer', 400, 'INVALID_PARAMETERS');
	}

	// Idempotency
	const idempotencyKey = request.headers.get('X-Idempotency-Key');
	if (idempotencyKey) {
		const cached = await storage.getIdempotencyResult(idempotencyKey);
		if (cached) {
			return new Response(cached, {
				status: 200,
				headers: { 'Content-Type': 'application/json', 'X-Idempotent-Replay': 'true' },
			});
		}
	}

	// Verify old leaf exists
	const oldLeaf = await storage.getLeafAt(oldLeafIndex);
	if (!oldLeaf) {
		return errorResponse(`No leaf at index ${oldLeafIndex}`, 404, 'LEAF_NOT_FOUND');
	}

	// Capacity check
	const [size, capacity] = await Promise.all([storage.getTreeSize(), storage.getTreeCapacity()]);
	if (size >= capacity) {
		return errorResponse('Registration tree is full', 503, 'TREE_FULL');
	}
	const newIndex = size;

	// Replace in D1
	await storage.replaceLeaf(newLeaf, oldLeafIndex, newIndex);

	// Notify sidecar
	const proof = await tree.notifyReplacement(newLeaf, oldLeafIndex, newIndex);

	const responseBody = JSON.stringify({
		success: true,
		data: { leafIndex: newIndex, ...proof },
	});

	if (idempotencyKey) {
		await storage.setIdempotencyResult(idempotencyKey, responseBody, 3_600_000);
	}

	return new Response(responseBody, {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
}

// --------------------------------------------------------------------------
// Engagement handler
// --------------------------------------------------------------------------

async function handleEngagementRegister(
	request: Request,
	storage: D1Adapter,
	tree: TreeServiceClient,
): Promise<Response> {
	let body: { signerAddress?: string; identityCommitment?: string };
	try {
		body = await request.json() as typeof body;
	} catch {
		return errorResponse('Invalid JSON body', 400, 'INVALID_BODY');
	}

	const { signerAddress, identityCommitment } = body;
	if (typeof signerAddress !== 'string' || !signerAddress) {
		return errorResponse('signerAddress is required', 400, 'INVALID_PARAMETERS');
	}
	if (typeof identityCommitment !== 'string' || !HEX_RE.test(identityCommitment)) {
		return errorResponse('identityCommitment must be a 0x-prefixed hex string', 400, 'INVALID_PARAMETERS');
	}

	// Duplicate check
	const [icExists, signerExists] = await Promise.all([
		storage.isIdentityRegistered(identityCommitment),
		storage.isSignerRegistered(signerAddress),
	]);
	if (icExists || signerExists) {
		return errorResponse('Identity or signer already registered', 400, 'INVALID_PARAMETERS');
	}

	// Get current tree size for leaf index
	const info = await tree.getEngagementInfo();
	const leafIndex = info.size;

	// Register in D1
	await storage.registerEngagementIdentity(identityCommitment, signerAddress, leafIndex);

	// Notify sidecar
	const result = await tree.notifyEngagementRegistration(identityCommitment, signerAddress, leafIndex);

	return jsonResponse({
		success: true,
		data: { leafIndex, engagementRoot: result.engagementRoot },
	});
}

// --------------------------------------------------------------------------
// Router
// --------------------------------------------------------------------------

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		const method = request.method;

		// Health check (no auth)
		if (path === '/v1/health' && method === 'GET') {
			return jsonResponse({ status: 'ok', service: 'write-relay' });
		}

		// Bearer auth
		const authHeader = request.headers.get('Authorization');
		const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
		if (!token || token !== env.RELAY_AUTH_TOKEN) {
			return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
		}

		// Rate limiting
		const ip = request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For') ?? 'unknown';
		if (!checkRate(ip)) {
			return errorResponse('Rate limit exceeded', 429, 'RATE_LIMITED');
		}

		// Init services
		const storage = new D1Adapter(env.DB);
		const tree = new TreeServiceClient(env.SHADOW_ATLAS_SIDECAR_URL, env.SIDECAR_AUTH_TOKEN);

		try {
			// Registration
			if (path === '/v1/register' && method === 'POST') {
				return await handleRegister(request, storage, tree);
			}
			if (path === '/v1/register/replace' && method === 'POST') {
				return await handleReplace(request, storage, tree);
			}

			// Engagement
			if (path === '/v1/engagement/register' && method === 'POST') {
				return await handleEngagementRegister(request, storage, tree);
			}

			// Community field
			if (path === '/v1/community-field/contribute' && method === 'POST') {
				return await handleContribute(request, storage, tree);
			}
			if (path === '/v1/community-field/info' && method === 'GET') {
				return await handleInfo(storage);
			}
			const epochMatch = path.match(/^\/v1\/community-field\/epoch\/(\d{4}-\d{2}-\d{2})$/);
			if (epochMatch && method === 'GET') {
				return await handleEpoch(epochMatch[1], storage);
			}

			return errorResponse('Not found', 404, 'NOT_FOUND');
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.error(`[write-relay] ${method} ${path} error:`, message);
			return errorResponse('Internal server error', 500, 'INTERNAL_ERROR');
		}
	},
} satisfies ExportedHandler<Env>;
