/**
 * Pre-generated Static Cryptographic Mesh
 *
 * Generated lazily on first access (browser only), cached for subsequent uses.
 * Massive performance win: 0ms blocking on import, runs async after hydration
 */

import {
	generateCryptographicMesh,
	generateGraphPathString,
	type CryptographicMesh
} from './computational-geometry';

// Viewport dimensions for mesh generation
const VIEWPORT_WIDTH = 1920;
const VIEWPORT_HEIGHT = 1080;

// Lazy-generated mesh (only runs in browser, after module loads)
let cachedMesh: CryptographicMesh | null = null;
let cachedPath: string | null = null;

export function getStaticMesh(): CryptographicMesh {
	if (!cachedMesh) {
		console.time('[STATIC] Generate Cryptographic Mesh');
		cachedMesh = generateCryptographicMesh(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
		console.timeEnd('[STATIC] Generate Cryptographic Mesh');
		console.log(
			`[STATIC] Mesh: ${cachedMesh.nodes.length} nodes, ${cachedMesh.edges.length} edges`
		);
	}
	return cachedMesh;
}

export function getStaticGraphPath(): string {
	if (!cachedPath) {
		console.time('[STATIC] Generate Graph Path');
		const mesh = getStaticMesh();
		cachedPath = generateGraphPathString(mesh.edges, mesh.nodes);
		console.timeEnd('[STATIC] Generate Graph Path');
		console.log(`[STATIC] Path: ${(cachedPath.length / 1024).toFixed(2)}KB`);
	}
	return cachedPath;
}

// Export viewport dimensions for viewBox
export const STATIC_VIEWPORT = {
	width: VIEWPORT_WIDTH,
	height: VIEWPORT_HEIGHT
} as const;
