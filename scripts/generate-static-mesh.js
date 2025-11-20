#!/usr/bin/env node
/**
 * Build-time mesh generation for AtmosphericBackground
 *
 * Generates cryptographic mesh once at build time, commits to repo.
 * Zero runtime cost, instant page load.
 *
 * Usage:
 *   node scripts/generate-static-mesh.js > src/lib/data/cryptographic-mesh.json
 */

import {
	generateCryptographicMesh,
	generateGraphPathString
} from '../src/lib/utils/computational-geometry.js';

const VIEWPORT_WIDTH = 1920;
const VIEWPORT_HEIGHT = 1080;

console.error('[BUILD] Generating cryptographic mesh...');
console.time('[BUILD] Total generation time');

// Generate mesh
const mesh = generateCryptographicMesh(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
console.error(`[BUILD] Generated ${mesh.nodes.length} nodes, ${mesh.edges.length} edges`);

// Generate SVG path string
const pathString = generateGraphPathString(mesh.edges, mesh.nodes);
console.error(`[BUILD] Path string: ${(pathString.length / 1024).toFixed(2)}KB`);

// Output JSON to stdout
const output = {
	viewport: {
		width: VIEWPORT_WIDTH,
		height: VIEWPORT_HEIGHT
	},
	mesh,
	pathString,
	generated: new Date().toISOString(),
	nodeCount: mesh.nodes.length,
	edgeCount: mesh.edges.length
};

console.log(JSON.stringify(output, null, 2));

console.timeEnd('[BUILD] Total generation time');
console.error('[BUILD] Done. Mesh saved to stdout.');
