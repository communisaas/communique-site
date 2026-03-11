/**
 * POST /api/v1/keys — Create a new API key. Returns the full key ONCE.
 *
 * Requires session auth (org owner/editor), NOT API key auth.
 * This is the only endpoint that uses session auth in the v1 namespace.
 */

import { db } from '$lib/core/db';
import { loadOrgContext, requireRole } from '$lib/server/org';
import { generateApiKey } from '$lib/core/security/api-key';
import { apiOk, apiError } from '$lib/server/api-v1/response';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return apiError('UNAUTHORIZED', 'Authentication required', 401);

	let body: Record<string, unknown>;
	try { body = await request.json(); } catch { return apiError('BAD_REQUEST', 'Invalid JSON body', 400); }

	const { orgSlug, name, scopes } = body as { orgSlug?: string; name?: string; scopes?: string[] };
	if (!orgSlug) return apiError('BAD_REQUEST', 'orgSlug is required', 400);

	const { org, membership } = await loadOrgContext(orgSlug, locals.user.id);
	requireRole(membership.role, 'editor');

	// Validate scopes
	const validScopes = ['read', 'write'];
	const keyScopes = scopes?.filter((s) => validScopes.includes(s)) ?? ['read'];
	if (keyScopes.length === 0) keyScopes.push('read');

	const { plaintext, hash, prefix } = await generateApiKey();

	const apiKey = await db.apiKey.create({
		data: {
			orgId: org.id,
			keyHash: hash,
			keyPrefix: prefix,
			name: name?.trim() || 'Default',
			scopes: keyScopes,
			createdBy: locals.user.id
		}
	});

	return apiOk({
		id: apiKey.id,
		key: plaintext, // Shown ONCE — never stored or returned again
		prefix: apiKey.keyPrefix,
		name: apiKey.name,
		scopes: apiKey.scopes,
		createdAt: apiKey.createdAt.toISOString()
	}, undefined, 201);
};
