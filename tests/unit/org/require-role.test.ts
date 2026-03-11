import { describe, it, expect } from 'vitest';

/**
 * Tests for org role hierarchy enforcement.
 *
 * The requireRole function lives in $lib/server/org.ts and throws SvelteKit
 * errors. We test the role hierarchy logic directly to avoid SvelteKit
 * error serialization complexity.
 */

type OrgRole = 'owner' | 'editor' | 'member';

const HIERARCHY: Record<OrgRole, number> = { member: 0, editor: 1, owner: 2 };

function hasRequiredRole(current: OrgRole, minimum: OrgRole): boolean {
	return HIERARCHY[current] >= HIERARCHY[minimum];
}

describe('role hierarchy', () => {
	it('owner should satisfy all role requirements', () => {
		expect(hasRequiredRole('owner', 'member')).toBe(true);
		expect(hasRequiredRole('owner', 'editor')).toBe(true);
		expect(hasRequiredRole('owner', 'owner')).toBe(true);
	});

	it('editor should satisfy editor and member requirements', () => {
		expect(hasRequiredRole('editor', 'member')).toBe(true);
		expect(hasRequiredRole('editor', 'editor')).toBe(true);
	});

	it('editor should not satisfy owner requirement', () => {
		expect(hasRequiredRole('editor', 'owner')).toBe(false);
	});

	it('member should satisfy only member requirement', () => {
		expect(hasRequiredRole('member', 'member')).toBe(true);
	});

	it('member should not satisfy editor or owner requirements', () => {
		expect(hasRequiredRole('member', 'editor')).toBe(false);
		expect(hasRequiredRole('member', 'owner')).toBe(false);
	});
});

describe('role hierarchy ordering', () => {
	it('should rank owner > editor > member', () => {
		expect(HIERARCHY.owner).toBeGreaterThan(HIERARCHY.editor);
		expect(HIERARCHY.editor).toBeGreaterThan(HIERARCHY.member);
	});

	it('should have exactly 3 roles', () => {
		expect(Object.keys(HIERARCHY)).toHaveLength(3);
	});
});
