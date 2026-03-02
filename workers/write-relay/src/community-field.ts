/**
 * Community Field Endpoints
 *
 * Contribution dedup (epoch nullifier), proof verification (via sidecar),
 * and epoch info queries.
 */

import type { D1Adapter } from './d1-adapter';
import type { TreeServiceClient } from './tree-client';

// --------------------------------------------------------------------------
// Validation
// --------------------------------------------------------------------------

const HEX_RE = /^0x[0-9a-fA-F]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface ContributeBody {
	proof: string;
	publicInputs: string[];
	epochDate: string;
}

function validateContributeBody(body: unknown): ContributeBody | string {
	if (!body || typeof body !== 'object') return 'Request body must be an object';

	const { proof, publicInputs, epochDate } = body as Record<string, unknown>;

	if (typeof proof !== 'string' || !HEX_RE.test(proof)) {
		return 'proof must be a 0x-prefixed hex string';
	}
	if (!Array.isArray(publicInputs) || publicInputs.length !== 5) {
		return 'publicInputs must be an array of 5 field elements';
	}
	for (const pi of publicInputs) {
		if (typeof pi !== 'string' || !HEX_RE.test(pi)) {
			return 'Each publicInput must be a 0x-prefixed hex string';
		}
	}
	if (typeof epochDate !== 'string' || !DATE_RE.test(epochDate)) {
		return 'epochDate must be YYYY-MM-DD format';
	}

	return { proof, publicInputs: publicInputs as string[], epochDate };
}

// --------------------------------------------------------------------------
// Handlers
// --------------------------------------------------------------------------

export async function handleContribute(
	request: Request,
	storage: D1Adapter,
	tree: TreeServiceClient,
): Promise<Response> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return jsonResponse({ error: 'Invalid JSON body' }, 400);
	}

	const parsed = validateContributeBody(body);
	if (typeof parsed === 'string') {
		return jsonResponse({ error: parsed }, 400);
	}

	const { proof, publicInputs, epochDate } = parsed;

	// publicInputs layout: [engagementRoot, epochDomain, cellSetRoot, epochNullifier, cellCount]
	const cellSetRoot = publicInputs[2];
	const epochNullifier = publicInputs[3];

	// Check epoch nullifier dedup in D1
	const existing = await storage.findContribution(epochDate, epochNullifier);
	if (existing) {
		return jsonResponse(
			{ error: 'Already contributed for this epoch', code: 'DUPLICATE_CONTRIBUTION' },
			409,
		);
	}

	// Forward to sidecar for proof verification
	let verifyResult: { cellSetRoot: string };
	try {
		verifyResult = await tree.verifyContributionProof(proof, publicInputs, epochDate);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return jsonResponse({ error: `Proof verification failed: ${msg}` }, 502);
	}

	// Store contribution
	const proofHash = await hashProof(proof);
	await storage.insertContribution(epochDate, epochNullifier, cellSetRoot, proofHash);

	return jsonResponse({
		success: true,
		cellSetRoot: verifyResult.cellSetRoot,
		epochNullifier,
		epochDate,
	});
}

export async function handleInfo(storage: D1Adapter): Promise<Response> {
	const today = new Date().toISOString().slice(0, 10);
	const epoch = await storage.getEpochContributions(today);

	return jsonResponse({
		success: true,
		epochDate: today,
		contributionsToday: epoch.count,
		status: 'active',
	});
}

export async function handleEpoch(
	epochDate: string,
	storage: D1Adapter,
): Promise<Response> {
	if (!DATE_RE.test(epochDate)) {
		return jsonResponse({ error: 'Invalid date format, expected YYYY-MM-DD' }, 400);
	}

	const epoch = await storage.getEpochContributions(epochDate);

	return jsonResponse({
		success: true,
		epochDate,
		count: epoch.count,
		cellRoots: epoch.cellRoots,
	});
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

async function hashProof(proof: string): Promise<string> {
	const clean = proof.startsWith('0x') ? proof.slice(2) : proof;
	const bytes = new Uint8Array(clean.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
	}
	const hash = await crypto.subtle.digest('SHA-256', bytes);
	return (
		'0x' +
		Array.from(new Uint8Array(hash))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('')
	);
}
