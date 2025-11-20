/**
 * Build-time mesh generation for AtmosphericBackground
 *
 * Generates cryptographic mesh once at build time, commits to repo.
 * Zero runtime cost, instant page load.
 *
 * Usage:
 *   npx tsx scripts/generate-static-mesh.ts > src/lib/data/cryptographic-mesh.json
 */

import {
	generateFastMesh,
	generateGraphPathString,
	generateVoronoiCells
} from '../src/lib/utils/fast-mesh-generation';
import { Delaunay } from 'd3-delaunay';

// Make Delaunay available globally for Voronoi generation
(globalThis as any).Delaunay = Delaunay;

const VIEWPORT_WIDTH = 1920;
const VIEWPORT_HEIGHT = 1080;
const TARGET_NODES = 60; // Reduced from 80-120 for performance

console.error('[BUILD] Generating cryptographic mesh (fast O(n) algorithm)...');
console.time('[BUILD] Total generation time');

// Generate mesh using fast jittered grid
const mesh = generateFastMesh(VIEWPORT_WIDTH, VIEWPORT_HEIGHT, TARGET_NODES);
console.error(`[BUILD] Generated ${mesh.nodes.length} nodes, ${mesh.edges.length} edges`);

// Generate SVG path string
const pathString = generateGraphPathString(mesh.edges, mesh.nodes);
console.error(`[BUILD] Path string: ${(pathString.length / 1024).toFixed(2)}KB`);

// Phase 2: Generate Voronoi cells
const voronoiCells = generateVoronoiCells(mesh.nodes);
console.error(`[BUILD] Generated ${voronoiCells.length} Voronoi cells`);

// Output JSON to stdout
const output = {
	viewport: {
		width: VIEWPORT_WIDTH,
		height: VIEWPORT_HEIGHT
	},
	mesh: {
		nodes: mesh.nodes,
		edges: mesh.edges,
		voronoiCells
	},
	pathString,
	generated: new Date().toISOString(),
	nodeCount: mesh.nodes.length,
	edgeCount: mesh.edges.length,
	voronoiCellCount: voronoiCells.length
};

console.log(JSON.stringify(output, null, 2));

console.timeEnd('[BUILD] Total generation time');
console.error('[BUILD] Done. Mesh saved to stdout.');
