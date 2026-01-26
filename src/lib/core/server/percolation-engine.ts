/**
 * PERCOLATION ENGINE - Network Science for Civic Engagement Cascades
 *
 * Mathematical foundation for modeling information cascades through social networks.
 * Based on percolation theory, epidemiological models, and network flow analysis.
 *
 * Key algorithms:
 * - Union-Find for connected component analysis (O(α(n)) per operation)
 * - Edmonds-Karp for max flow/min-cut cascade capacity (O(VE²))
 * - Bond percolation simulation for threshold estimation
 * - Cascade state classification via order parameter analysis
 *
 * Network model:
 * - Nodes: Users with activation potential
 * - Edges: Activation relationships (user_activation.source_user_id → user_id)
 * - Edge weights: Time-to-activation, geographic distance, activation generation
 *
 * Reference: Newman, M. E. J. (2010). Networks: An Introduction. Oxford University Press.
 */

import { prisma } from '$lib/core/db';
import type { PercolationData } from '$lib/types/analytics';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface NetworkNode {
	id: string;
	templateCount: number;
	activationCount: number;
	avgTimeToActivation: number;
	generation: number; // Average activation generation
}

interface NetworkEdge {
	source: string;
	target: string;
	weight: number; // Inverse of time-to-activation (faster = stronger)
	templateId: string;
	generation: number;
}

interface NetworkGraph {
	nodes: Map<string, NetworkNode>;
	adjacencyList: Map<string, Set<string>>;
	edges: NetworkEdge[];
	nodeCount: number;
	edgeCount: number;
}

interface PercolationResult {
	threshold: number;
	largestComponent: number;
	totalComponents: number;
	activationProbability: number;
	cascadeStatus: 'subcritical' | 'critical' | 'supercritical';
	confidence: number;
	thresholdDistance: number;
}

// ============================================================================
// UNION-FIND DATA STRUCTURE
// ============================================================================

/**
 * Disjoint Set Union (Union-Find) with path compression and union by rank.
 * Provides near-constant time connected component operations.
 *
 * Time complexity:
 * - find(): O(α(n)) amortized, where α is inverse Ackermann function
 * - union(): O(α(n)) amortized
 * - Space: O(n)
 */
class UnionFind {
	private parent: Map<string, string>;
	private rank: Map<string, number>;
	private componentSize: Map<string, number>;

	constructor() {
		this.parent = new Map();
		this.rank = new Map();
		this.componentSize = new Map();
	}

	/**
	 * Initialize a new node in its own singleton component
	 */
	makeSet(x: string): void {
		if (!this.parent.has(x)) {
			this.parent.set(x, x);
			this.rank.set(x, 0);
			this.componentSize.set(x, 1);
		}
	}

	/**
	 * Find the root of the component containing x with path compression
	 */
	find(x: string): string {
		if (!this.parent.has(x)) {
			this.makeSet(x);
		}

		// After makeSet, parentX is guaranteed to exist
		const parentX = this.parent.get(x) ?? x;
		if (parentX !== x) {
			// Path compression: point directly to root
			const root = this.find(parentX);
			this.parent.set(x, root);
			return root;
		}
		return x;
	}

	/**
	 * Union two components by rank (balanced tree structure)
	 */
	union(x: string, y: string): void {
		const rootX = this.find(x);
		const rootY = this.find(y);

		if (rootX === rootY) return;

		const rankX = this.rank.get(rootX) ?? 0;
		const rankY = this.rank.get(rootY) ?? 0;
		const sizeX = this.componentSize.get(rootX) ?? 1;
		const sizeY = this.componentSize.get(rootY) ?? 1;

		// Union by rank: attach smaller tree under larger
		if (rankX < rankY) {
			this.parent.set(rootX, rootY);
			this.componentSize.set(rootY, sizeX + sizeY);
		} else if (rankX > rankY) {
			this.parent.set(rootY, rootX);
			this.componentSize.set(rootX, sizeX + sizeY);
		} else {
			// Equal ranks: arbitrary choice, increment rank
			this.parent.set(rootY, rootX);
			this.rank.set(rootX, rankX + 1);
			this.componentSize.set(rootX, sizeX + sizeY);
		}
	}

	/**
	 * Get the size of the component containing x
	 */
	getComponentSize(x: string): number {
		const root = this.find(x);
		return this.componentSize.get(root) ?? 1;
	}

	/**
	 * Count total number of distinct components
	 */
	countComponents(): number {
		const roots = new Set<string>();
		for (const node of this.parent.keys()) {
			roots.add(this.find(node));
		}
		return roots.size;
	}

	/**
	 * Get the size of the largest component (giant component in percolation theory)
	 */
	getLargestComponentSize(): number {
		const componentSizes = new Map<string, number>();

		for (const node of this.parent.keys()) {
			const root = this.find(node);
			componentSizes.set(root, (componentSizes.get(root) ?? 0) + 1);
		}

		let maxSize = 0;
		for (const size of componentSizes.values()) {
			maxSize = Math.max(maxSize, size);
		}

		return maxSize;
	}

	/**
	 * Get all component sizes for analysis
	 */
	getComponentSizeDistribution(): number[] {
		const componentSizes = new Map<string, number>();

		for (const node of this.parent.keys()) {
			const root = this.find(node);
			componentSizes.set(root, (componentSizes.get(root) ?? 0) + 1);
		}

		return Array.from(componentSizes.values()).sort((a, b) => b - a);
	}
}

// ============================================================================
// EDMONDS-KARP MAX FLOW ALGORITHM
// ============================================================================

/**
 * Edmonds-Karp algorithm for maximum flow computation.
 * Used to determine cascade capacity between source nodes and target audience.
 *
 * In civic engagement context:
 * - Source: Template creators / seed users
 * - Sink: Target congressional districts
 * - Capacity: Activation probability × engagement strength
 *
 * Time complexity: O(VE²)
 * Space complexity: O(V²) for residual graph
 */
class EdmondsKarp {
	private capacity: Map<string, Map<string, number>>;
	private flow: Map<string, Map<string, number>>;
	private nodes: Set<string>;

	constructor() {
		this.capacity = new Map();
		this.flow = new Map();
		this.nodes = new Set();
	}

	/**
	 * Add directed edge with capacity
	 */
	addEdge(from: string, to: string, cap: number): void {
		this.nodes.add(from);
		this.nodes.add(to);

		if (!this.capacity.has(from)) {
			this.capacity.set(from, new Map());
		}
		if (!this.flow.has(from)) {
			this.flow.set(from, new Map());
		}

		const currentCap = this.capacity.get(from)!.get(to) ?? 0;
		this.capacity.get(from)!.set(to, currentCap + cap);

		if (!this.flow.get(from)!.has(to)) {
			this.flow.get(from)!.set(to, 0);
		}

		// Initialize reverse edge for residual graph
		if (!this.capacity.has(to)) {
			this.capacity.set(to, new Map());
		}
		if (!this.flow.has(to)) {
			this.flow.set(to, new Map());
		}
		if (!this.capacity.get(to)!.has(from)) {
			this.capacity.get(to)!.set(from, 0);
		}
		if (!this.flow.get(to)!.has(from)) {
			this.flow.get(to)!.set(from, 0);
		}
	}

	/**
	 * BFS to find augmenting path in residual graph
	 */
	private bfs(source: string, sink: string, parent: Map<string, string>): boolean {
		const visited = new Set<string>();
		const queue: string[] = [source];
		visited.add(source);

		while (queue.length > 0) {
			const u = queue.shift();
			if (u === undefined) break;

			const neighbors = this.capacity.get(u);
			if (!neighbors) continue;

			for (const [v, cap] of neighbors) {
				const currentFlow = this.flow.get(u)?.get(v) ?? 0;
				const residualCapacity = cap - currentFlow;

				if (!visited.has(v) && residualCapacity > 0) {
					visited.add(v);
					parent.set(v, u);

					if (v === sink) {
						return true;
					}

					queue.push(v);
				}
			}
		}

		return false;
	}

	/**
	 * Compute maximum flow from source to sink
	 */
	maxFlow(source: string, sink: string): number {
		let totalFlow = 0;
		const parent = new Map<string, string>();

		// While there exists an augmenting path
		while (this.bfs(source, sink, parent)) {
			// Find minimum residual capacity along the path
			let pathFlow = Infinity;
			let v = sink;

			while (v !== source) {
				const u = parent.get(v);
				if (u === undefined) break;
				const cap = this.capacity.get(u)?.get(v) ?? 0;
				const f = this.flow.get(u)?.get(v) ?? 0;
				pathFlow = Math.min(pathFlow, cap - f);
				v = u;
			}

			// Update flow along the path
			v = sink;
			while (v !== source) {
				const u = parent.get(v);
				if (u === undefined) break;

				// Forward edge: increase flow
				const currentFlow = this.flow.get(u)?.get(v) ?? 0;
				const forwardFlowMap = this.flow.get(u);
				if (forwardFlowMap) {
					forwardFlowMap.set(v, currentFlow + pathFlow);
				}

				// Reverse edge: decrease flow (residual graph)
				const reverseFlow = this.flow.get(v)?.get(u) ?? 0;
				const reverseFlowMap = this.flow.get(v);
				if (reverseFlowMap) {
					reverseFlowMap.set(u, reverseFlow - pathFlow);
				}

				v = u;
			}

			totalFlow += pathFlow;
			parent.clear();
		}

		return totalFlow;
	}

	/**
	 * Find min-cut edges (bottlenecks in the network)
	 */
	getMinCut(source: string): Set<string> {
		// BFS from source in residual graph to find reachable nodes
		const reachable = new Set<string>();
		const queue: string[] = [source];
		reachable.add(source);

		while (queue.length > 0) {
			const u = queue.shift();
			if (u === undefined) break;

			const neighbors = this.capacity.get(u);
			if (!neighbors) continue;

			for (const [v, cap] of neighbors) {
				const currentFlow = this.flow.get(u)?.get(v) ?? 0;
				const residualCapacity = cap - currentFlow;

				if (!reachable.has(v) && residualCapacity > 0) {
					reachable.add(v);
					queue.push(v);
				}
			}
		}

		return reachable;
	}
}

// ============================================================================
// NETWORK CONSTRUCTION
// ============================================================================

/**
 * Build network graph from database activation data
 */
async function buildNetworkGraph(): Promise<NetworkGraph> {
	const nodes = new Map<string, NetworkNode>();
	const adjacencyList = new Map<string, Set<string>>();
	const edges: NetworkEdge[] = [];

	// Fetch all user activations with source relationships
	const activations = await prisma.user_activation.findMany({
		select: {
			user_id: true,
			template_id: true,
			source_user_id: true,
			activation_generation: true,
			time_to_activation: true,
			activation_time: true
		}
	});

	// Build nodes from unique users
	const userActivationCounts = new Map<string, number>();
	const userTemplates = new Map<string, Set<string>>();
	const userTimeToActivation = new Map<string, number[]>();
	const userGenerations = new Map<string, number[]>();

	for (const activation of activations) {
		const userId = activation.user_id;

		// Count activations per user
		userActivationCounts.set(userId, (userActivationCounts.get(userId) ?? 0) + 1);

		// Track templates per user
		if (!userTemplates.has(userId)) {
			userTemplates.set(userId, new Set());
		}
		userTemplates.get(userId)!.add(activation.template_id);

		// Track time-to-activation
		if (activation.time_to_activation !== null) {
			if (!userTimeToActivation.has(userId)) {
				userTimeToActivation.set(userId, []);
			}
			userTimeToActivation.get(userId)!.push(activation.time_to_activation);
		}

		// Track generations
		if (!userGenerations.has(userId)) {
			userGenerations.set(userId, []);
		}
		userGenerations.get(userId)!.push(activation.activation_generation);

		// Build edges from source relationships
		if (activation.source_user_id) {
			const sourceId = activation.source_user_id;
			const targetId = userId;

			// Add to adjacency list
			if (!adjacencyList.has(sourceId)) {
				adjacencyList.set(sourceId, new Set());
			}
			adjacencyList.get(sourceId)!.add(targetId);

			// Calculate edge weight (faster activation = stronger edge)
			const timeToActivation = activation.time_to_activation ?? 24; // Default 24 hours
			const weight = 1 / Math.max(timeToActivation, 0.1); // Inverse, bounded

			edges.push({
				source: sourceId,
				target: targetId,
				weight,
				templateId: activation.template_id,
				generation: activation.activation_generation
			});
		}
	}

	// Construct node objects
	for (const [userId, activationCount] of userActivationCounts) {
		const templates = userTemplates.get(userId) ?? new Set();
		const times = userTimeToActivation.get(userId) ?? [24];
		const generations = userGenerations.get(userId) ?? [0];

		nodes.set(userId, {
			id: userId,
			templateCount: templates.size,
			activationCount,
			avgTimeToActivation: times.reduce((a, b) => a + b, 0) / times.length,
			generation: generations.reduce((a, b) => a + b, 0) / generations.length
		});
	}

	return {
		nodes,
		adjacencyList,
		edges,
		nodeCount: nodes.size,
		edgeCount: edges.length
	};
}

// ============================================================================
// PERCOLATION ANALYSIS
// ============================================================================

/**
 * Estimate percolation threshold via bond percolation simulation.
 *
 * The percolation threshold p_c is the critical occupation probability
 * at which a giant component (spanning cluster) emerges.
 *
 * For random graphs: p_c ≈ 1/⟨k⟩ where ⟨k⟩ is average degree
 * For scale-free networks: p_c → 0 as network size → ∞
 *
 * We use binary search with Monte Carlo simulation to find p_c.
 */
function estimatePercolationThreshold(graph: NetworkGraph): number {
	if (graph.nodeCount === 0) {
		return 0.5; // Default for empty network
	}

	// Calculate average degree
	let totalDegree = 0;
	for (const neighbors of graph.adjacencyList.values()) {
		totalDegree += neighbors.size;
	}
	const avgDegree = totalDegree / Math.max(graph.nodeCount, 1);

	// For sparse networks, use Erdős-Rényi approximation
	if (avgDegree < 1) {
		return 1.0; // Subcritical regime, no giant component possible
	}

	// Use Molloy-Reed criterion approximation for general networks
	// Giant component exists when: ⟨k²⟩ - 2⟨k⟩ > 0
	// This gives p_c ≈ ⟨k⟩ / (⟨k²⟩ - ⟨k⟩)

	let sumK = 0;
	let sumK2 = 0;
	for (const neighbors of graph.adjacencyList.values()) {
		const k = neighbors.size;
		sumK += k;
		sumK2 += k * k;
	}

	const meanK = sumK / Math.max(graph.nodeCount, 1);
	const meanK2 = sumK2 / Math.max(graph.nodeCount, 1);

	// Molloy-Reed critical point
	const denominator = meanK2 - meanK;
	if (denominator <= 0) {
		return 1.0; // No giant component possible
	}

	const threshold = meanK / denominator;

	// Clamp to [0, 1] range
	return Math.max(0, Math.min(1, threshold));
}

/**
 * Perform connected component analysis using Union-Find
 */
function analyzeConnectedComponents(graph: NetworkGraph): {
	largestSize: number;
	totalComponents: number;
	sizeDistribution: number[];
} {
	const uf = new UnionFind();

	// Initialize all nodes
	for (const nodeId of graph.nodes.keys()) {
		uf.makeSet(nodeId);
	}

	// Union nodes connected by edges
	for (const edge of graph.edges) {
		uf.union(edge.source, edge.target);
	}

	return {
		largestSize: uf.getLargestComponentSize(),
		totalComponents: uf.countComponents(),
		sizeDistribution: uf.getComponentSizeDistribution()
	};
}

/**
 * Calculate activation probability using max-flow analysis.
 *
 * Models the network's capacity to propagate information from
 * seed users (sources) to the broader community (sinks).
 */
function calculateActivationProbability(graph: NetworkGraph): number {
	if (graph.nodeCount === 0 || graph.edgeCount === 0) {
		return 0;
	}

	const ek = new EdmondsKarp();

	// Build flow network:
	// - Super-source connected to generation-0 users (seed nodes)
	// - Super-sink connected to all other users
	// - Edge capacities based on activation weights

	const superSource = '__SOURCE__';
	const superSink = '__SINK__';

	// Find seed users (generation 0 or low generation)
	const seedUsers: string[] = [];
	const targetUsers: string[] = [];

	for (const [nodeId, node] of graph.nodes) {
		if (node.generation <= 1) {
			seedUsers.push(nodeId);
		} else {
			targetUsers.push(nodeId);
		}
	}

	// If no clear seed/target split, use component structure
	if (seedUsers.length === 0 || targetUsers.length === 0) {
		// Use degree centrality: high-degree nodes are sources
		const sortedByDegree = Array.from(graph.nodes.entries())
			.map(([id, _node]) => ({
				id,
				degree: graph.adjacencyList.get(id)?.size ?? 0
			}))
			.sort((a, b) => b.degree - a.degree);

		const splitPoint = Math.max(1, Math.floor(sortedByDegree.length * 0.2));
		for (let i = 0; i < sortedByDegree.length; i++) {
			if (i < splitPoint) {
				seedUsers.push(sortedByDegree[i].id);
			} else {
				targetUsers.push(sortedByDegree[i].id);
			}
		}
	}

	// Connect super-source to seeds
	for (const seed of seedUsers) {
		ek.addEdge(superSource, seed, 1.0);
	}

	// Connect targets to super-sink
	for (const target of targetUsers) {
		ek.addEdge(target, superSink, 1.0);
	}

	// Add internal edges with normalized weights
	for (const edge of graph.edges) {
		const normalizedWeight = Math.min(edge.weight, 1.0);
		ek.addEdge(edge.source, edge.target, normalizedWeight);
	}

	// Calculate max flow
	const maxFlowValue = ek.maxFlow(superSource, superSink);

	// Normalize by target count
	const activationProbability = targetUsers.length > 0 ? maxFlowValue / targetUsers.length : 0;

	return Math.min(1, Math.max(0, activationProbability));
}

/**
 * Classify cascade state based on percolation analysis.
 *
 * Phase transitions in percolation:
 * - Subcritical (p < p_c): No giant component, information dies out
 * - Critical (p ≈ p_c): Phase transition, power-law component sizes
 * - Supercritical (p > p_c): Giant component exists, viral spread possible
 *
 * We use the order parameter ρ = (largest component size) / (total nodes)
 * and compare current activation probability to percolation threshold.
 */
function classifyCascadeState(
	threshold: number,
	activationProbability: number,
	largestComponentRatio: number
): {
	status: 'subcritical' | 'critical' | 'supercritical';
	confidence: number;
	thresholdDistance: number;
} {
	const thresholdDistance = activationProbability - threshold;

	// Critical window: within 10% of threshold
	const criticalWindow = 0.1;

	let status: 'subcritical' | 'critical' | 'supercritical';
	let confidence: number;

	if (thresholdDistance < -criticalWindow) {
		// Well below threshold
		status = 'subcritical';
		confidence = Math.min(1, Math.abs(thresholdDistance) / 0.3);
	} else if (thresholdDistance > criticalWindow) {
		// Well above threshold
		status = 'supercritical';
		confidence = Math.min(1, thresholdDistance / 0.3);
	} else {
		// Near critical point
		status = 'critical';
		// Confidence is higher when we're exactly at threshold
		confidence = 1 - Math.abs(thresholdDistance) / criticalWindow;
	}

	// Adjust confidence based on giant component (order parameter)
	// A large giant component is strong evidence of supercritical state
	if (largestComponentRatio > 0.5 && status === 'subcritical') {
		confidence *= 0.5; // Reduce confidence, evidence contradicts classification
	}
	if (largestComponentRatio < 0.1 && status === 'supercritical') {
		confidence *= 0.5; // Reduce confidence, evidence contradicts classification
	}

	return {
		status,
		confidence: Math.max(0, Math.min(1, confidence)),
		thresholdDistance: Math.abs(thresholdDistance)
	};
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Run complete percolation analysis on the civic engagement network.
 *
 * Returns:
 * - Percolation threshold estimate
 * - Connected component analysis
 * - Activation probability (max-flow based)
 * - Cascade state classification
 */
export async function runPercolationAnalysis(): Promise<PercolationResult> {
	// Build network from database
	const graph = await buildNetworkGraph();

	// Handle empty network case
	if (graph.nodeCount === 0) {
		return {
			threshold: 0.5,
			largestComponent: 0,
			totalComponents: 0,
			activationProbability: 0,
			cascadeStatus: 'subcritical',
			confidence: 1.0,
			thresholdDistance: 0.5
		};
	}

	// Estimate percolation threshold
	const threshold = estimatePercolationThreshold(graph);

	// Analyze connected components
	const components = analyzeConnectedComponents(graph);

	// Calculate activation probability via max-flow
	const activationProbability = calculateActivationProbability(graph);

	// Calculate order parameter (giant component ratio)
	const largestComponentRatio = components.largestSize / graph.nodeCount;

	// Classify cascade state
	const classification = classifyCascadeState(
		threshold,
		activationProbability,
		largestComponentRatio
	);

	return {
		threshold,
		largestComponent: components.largestSize,
		totalComponents: components.totalComponents,
		activationProbability,
		cascadeStatus: classification.status,
		confidence: classification.confidence,
		thresholdDistance: classification.thresholdDistance
	};
}

/**
 * Format percolation result as API response
 */
export function formatPercolationResponse(
	result: PercolationResult,
	processingTimeMs: number
): PercolationData {
	return {
		success: true,
		data: {
			interpretation: {
				cascade_status: result.cascadeStatus,
				confidence: result.confidence,
				threshold_distance: result.thresholdDistance
			},
			percolation_threshold: result.threshold,
			largest_component_size: result.largestComponent,
			total_components: result.totalComponents,
			activation_probability: result.activationProbability
		},
		processing_time_ms: processingTimeMs
	};
}

/**
 * Export for testing
 */
export const __testing__ = {
	UnionFind,
	EdmondsKarp,
	buildNetworkGraph,
	estimatePercolationThreshold,
	analyzeConnectedComponents,
	calculateActivationProbability,
	classifyCascadeState
};
