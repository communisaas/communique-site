/**
 * Computational Geometry Utilities for Cryptographic Substrate
 *
 * Implements:
 * - Poisson disc sampling with variable density
 * - Delaunay triangulation for graph edges
 * - Activity heat mapping for edge strength calculation
 */

import { Delaunay } from 'd3-delaunay';

export interface NetworkNode {
	x: number; // Percentage of viewport width (0-100)
	y: number; // Percentage of viewport height (0-100)
	weight: number; // Activity density (0-1)
}

export interface NetworkEdge {
	from: number; // Node index
	to: number; // Node index
	strength: number; // Visual weight (0-1)
}

export interface CryptographicMesh {
	nodes: NetworkNode[];
	edges: NetworkEdge[];
}

/**
 * Activity heat map: defines coordination density across viewport
 * Higher values = denser mesh, stronger edges
 */
class ActivityHeatMap {
	private zones: Array<{ x: number; y: number; width: number; height: number; intensity: number }>;

	constructor() {
		// Define high-activity coordination zones
		this.zones = [
			// Hero area (top-left, 0-35% height)
			{ x: 0, y: 0, width: 100, height: 35, intensity: 0.9 },

			// Channel selector ("Who Are You Reaching?", 38-63% height)
			{ x: 0, y: 38, width: 100, height: 25, intensity: 0.85 },

			// Template list area (65-90% height) - medium activity
			{ x: 0, y: 65, width: 100, height: 25, intensity: 0.5 },

			// Footer (90-100% height) - low activity
			{ x: 0, y: 90, width: 100, height: 10, intensity: 0.2 }
		];
	}

	/**
	 * Get activity intensity at point (x, y)
	 * Returns 0-1, where 1 = highest coordination activity
	 */
	getValue(x: number, y: number): number {
		for (const zone of this.zones) {
			if (x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height) {
				return zone.intensity;
			}
		}
		return 0.2; // Default low activity
	}

	/**
	 * Get minimum separation radius for Poisson disc sampling
	 * Higher activity = smaller radius = denser points
	 */
	getRadius(y: number): number {
		const activity = this.getValue(50, y); // Sample from center X

		// Map activity (0.2-0.9) to radius (120-40)
		// High activity → small radius → dense mesh
		// Low activity → large radius → sparse mesh
		return 120 - activity * 80; // 120px to 40px
	}
}

/**
 * Poisson disc sampling with variable density
 * Generates evenly distributed points with no clustering
 *
 * Based on Bridson's algorithm (SIGGRAPH 2007)
 * Modified for variable radius based on activity heat map
 */
export function poissonDiscSampling(
	width: number,
	height: number,
	activityMap: ActivityHeatMap,
	maxAttempts = 30
): NetworkNode[] {
	const points: NetworkNode[] = [];
	const active: NetworkNode[] = [];
	const cellSize = 40; // Grid cell size for spatial lookup
	const cols = Math.ceil(width / cellSize);
	const rows = Math.ceil(height / cellSize);
	const grid: Array<NetworkNode | null> = new Array(cols * rows).fill(null);

	// Helper: Convert point to grid index
	const gridIndex = (x: number, y: number): number => {
		const col = Math.floor(x / cellSize);
		const row = Math.floor(y / cellSize);
		return row * cols + col;
	};

	// Helper: Check if point is valid (not too close to existing points)
	const isValid = (x: number, y: number, radius: number): boolean => {
		if (x < 0 || x >= width || y < 0 || y >= height) return false;

		const col = Math.floor(x / cellSize);
		const row = Math.floor(y / cellSize);

		// Check neighboring cells (3×3 grid around point)
		for (let i = -2; i <= 2; i++) {
			for (let j = -2; j <= 2; j++) {
				const neighborCol = col + i;
				const neighborRow = row + j;

				if (neighborCol < 0 || neighborCol >= cols || neighborRow < 0 || neighborRow >= rows)
					continue;

				const neighbor = grid[neighborRow * cols + neighborCol];
				if (neighbor) {
					const dx = x - neighbor.x;
					const dy = y - neighbor.y;
					const distance = Math.sqrt(dx * dx + dy * dy);

					// Minimum separation = average of two radii
					const neighborRadius = activityMap.getRadius((neighbor.y / height) * 100);
					const minDistance = (radius + neighborRadius) / 2;

					if (distance < minDistance) return false;
				}
			}
		}

		return true;
	};

	// Start with random point in hero area (high activity)
	const firstX = Math.random() * width;
	const firstY = Math.random() * height * 0.3; // Top 30%
	const firstRadius = activityMap.getRadius((firstY / height) * 100);
	const firstNode: NetworkNode = {
		x: (firstX / width) * 100,
		y: (firstY / height) * 100,
		weight: activityMap.getValue((firstX / width) * 100, (firstY / height) * 100)
	};

	points.push(firstNode);
	active.push(firstNode);
	grid[gridIndex(firstX, firstY)] = firstNode;

	// Generate points around active points
	while (active.length > 0) {
		const randomIndex = Math.floor(Math.random() * active.length);
		const point = active[randomIndex];
		const pointX = (point.x / 100) * width;
		const pointY = (point.y / 100) * height;
		const radius = activityMap.getRadius(point.y);

		let found = false;

		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			// Generate random point in annulus (radius to 2*radius)
			const angle = Math.random() * Math.PI * 2;
			const distance = radius + Math.random() * radius;
			const newX = pointX + Math.cos(angle) * distance;
			const newY = pointY + Math.sin(angle) * distance;
			const newRadius = activityMap.getRadius((newY / height) * 100);

			if (isValid(newX, newY, newRadius)) {
				const newNode: NetworkNode = {
					x: (newX / width) * 100,
					y: (newY / height) * 100,
					weight: activityMap.getValue((newX / width) * 100, (newY / height) * 100)
				};

				points.push(newNode);
				active.push(newNode);
				grid[gridIndex(newX, newY)] = newNode;
				found = true;
				break;
			}
		}

		// Remove point from active list if no new points found
		if (!found) {
			active.splice(randomIndex, 1);
		}
	}

	return points;
}

/**
 * Generate Delaunay triangulation edges from nodes
 * Returns natural connections based on proximity
 */
function generateDelaunayEdges(nodes: NetworkNode[]): NetworkEdge[] {
	// Convert to coordinate pairs for d3-delaunay
	const points: [number, number][] = nodes.map((n) => [n.x, n.y]);

	// Compute Delaunay triangulation
	const delaunay = Delaunay.from(points);

	// Extract unique edges from triangles
	const edgeSet = new Set<string>();
	const edges: NetworkEdge[] = [];

	// Triangles are stored as flat array: [a, b, c, d, e, f, ...]
	// Each triplet is one triangle
	for (let i = 0; i < delaunay.triangles.length; i += 3) {
		const a = delaunay.triangles[i];
		const b = delaunay.triangles[i + 1];
		const c = delaunay.triangles[i + 2];

		// Add three edges of triangle (avoid duplicates)
		[
			[a, b],
			[b, c],
			[c, a]
		].forEach(([from, to]) => {
			const key = from < to ? `${from}-${to}` : `${to}-${from}`;
			if (!edgeSet.has(key)) {
				edgeSet.add(key);
				edges.push({ from, to, strength: 0 }); // Strength calculated later
			}
		});
	}

	return edges;
}

/**
 * Calculate edge strength based on activity heat map
 * Edges in high-activity zones are stronger (higher opacity)
 */
function calculateEdgeStrength(
	nodeA: NetworkNode,
	nodeB: NetworkNode,
	activityMap: ActivityHeatMap
): number {
	// Sample activity at edge midpoint
	const midX = (nodeA.x + nodeB.x) / 2;
	const midY = (nodeA.y + nodeB.y) / 2;

	return activityMap.getValue(midX, midY);
}

/**
 * Generate complete cryptographic mesh with nodes and edges
 *
 * @param width - Viewport width in pixels
 * @param height - Viewport height in pixels
 * @returns Mesh with nodes (Poisson sampling) and edges (Delaunay triangulation)
 */
export function generateCryptographicMesh(width: number, height: number): CryptographicMesh {
	const activityMap = new ActivityHeatMap();

	// Step 1: Generate nodes via Poisson disc sampling
	const nodes = poissonDiscSampling(width, height, activityMap);

	// Step 2: Generate edges via Delaunay triangulation
	let edges = generateDelaunayEdges(nodes);

	// Step 3: Calculate edge strength based on activity
	edges = edges.map((edge) => ({
		...edge,
		strength: calculateEdgeStrength(nodes[edge.from], nodes[edge.to], activityMap)
	}));

	return { nodes, edges };
}

/**
 * Convert edges to SVG path string
 * Single path for performance (avoid thousands of <line> elements)
 */
export function generateGraphPathString(edges: NetworkEdge[], nodes: NetworkNode[]): string {
	return edges
		.map((edge) => {
			const from = nodes[edge.from];
			const to = nodes[edge.to];
			// M = moveto, L = lineto
			return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
		})
		.join(' ');
}
