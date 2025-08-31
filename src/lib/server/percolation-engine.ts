import { db } from '$lib/core/db';

/**
 * PERCOLATION ENGINE - Information Cascade Analysis
 *
 * Implements Edmonds–Karp max flow/min-cut and a percolation-style
 * connectivity threshold heuristic on our civic information network built
 * from real template/campaign data. The threshold detection here is a
 * practical proxy (edge-weight connectivity with giant-component check),
 * not a statistically validated percolation exponent analysis.
 */

export interface NetworkNode {
  user_id: string;
  state: string;
  district: string;
  template_count: number;
  activation_probability: number;
}

export interface NetworkEdge {
  from_user: string;
  to_user: string;
  weight: number; // Information flow strength
  resistance: number; // 1/weight
}

export interface CascadeAnalysis {
  threshold_probability: number;
  critical_nodes: string[];
  bottleneck_edges: NetworkEdge[];
  max_flow_capacity: number;
  cascade_potential: 'subcritical' | 'critical' | 'supercritical';
}

/**
 * Build information flow network from actual user activation data
 */
export async function buildInformationNetwork(): Promise<{
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}> {
  
  // Get users who have created templates (information sources)
  const templateCreators = await db.user.findMany({
    where: {
      templates: {
        some: {}
      }
    },
    include: {
      templates: {
        include: {
          template_campaign: {
            select: {
              status: true,
              created_at: true
            }
          }
        }
      },
      activations: {
        where: {
          activation_time: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        },
        include: {
          source_user: {
            select: { id: true }
          }
        }
      }
    },
    take: 100 // Limit for performance
  });

  const nodes: NetworkNode[] = templateCreators.map(user => {
    const totalCampaigns = user.templates.reduce((sum, template) => 
      sum + template.template_campaign.length, 0
    );
    
    const successfulCampaigns = user.templates.reduce((sum, template) => 
      sum + template.template_campaign.filter(c => c.status === 'delivered').length, 0
    );
    
    // Activation probability = success rate
    const activation_probability = totalCampaigns > 0 ? 
      successfulCampaigns / totalCampaigns : 0;

    return {
      user_id: user.id,
      state: user.state || 'unknown',
      district: user.congressional_district || 'unknown',
      template_count: user.templates.length,
      activation_probability
    };
  });

  // Build edges from user activation patterns
  const edges: NetworkEdge[] = [];
  const userActivations = new Map<string, Set<string>>();
  
  // Group activations by source user
  templateCreators.forEach(user => {
    user.activations.forEach(activation => {
      if (activation.source_user?.id) {
        if (!userActivations.has(activation.source_user.id)) {
          userActivations.set(activation.source_user.id, new Set());
        }
        userActivations.get(activation.source_user.id)!.add(user.id);
      }
    });
  });

  // Convert to weighted edges
  userActivations.forEach((activatedUsers, sourceUserId) => {
    const sourceNode = nodes.find(n => n.user_id === sourceUserId);
    if (!sourceNode) return;

    activatedUsers.forEach(targetUserId => {
      const targetNode = nodes.find(n => n.user_id === targetUserId);
      if (!targetNode) return;

      // Weight based on source activation probability and geographic proximity
      const sameState = sourceNode.state === targetNode.state;
      const sameDistrict = sourceNode.district === targetNode.district;
      
      let weight = sourceNode.activation_probability;
      if (sameDistrict) weight *= 2.0; // Same district = stronger connection
      else if (sameState) weight *= 1.5; // Same state = moderate connection
      
      edges.push({
        from_user: sourceUserId,
        to_user: targetUserId,
        weight,
        resistance: 1 / Math.max(weight, 0.01)
      });
    });
  });

  return { nodes, edges };
}

/**
 * Calculate percolation threshold using bond percolation on network
 */
export function calculatePercolationThreshold(
  nodes: NetworkNode[], 
  edges: NetworkEdge[]
): number {
  
  // Sort edges by weight (bond-percolation-style: remove weakest edges first)
  const sortedEdges = [...edges].sort((a, b) => a.weight - b.weight);
  
  // Binary search for critical threshold
  let low = 0;
  let high = 1;
  let threshold = 0.5;
  
  for (let iter = 0; iter < 20; iter++) { // Binary search iterations
    const testThreshold = (low + high) / 2;
    
    // Remove edges below threshold
    const activeEdges = sortedEdges.filter(e => e.weight >= testThreshold);
    
    // Check if giant component exists
    const hasGiantComponent = checkGiantComponent(nodes, activeEdges);
    
    if (hasGiantComponent) {
      high = testThreshold; // Threshold too low
      threshold = testThreshold;
    } else {
      low = testThreshold; // Threshold too high
    }
  }
  
  return threshold;
}

/**
 * Check if network has giant component (connected component with >50% of nodes)
 */
function checkGiantComponent(nodes: NetworkNode[], edges: NetworkEdge[]): boolean {
  const nodeIds = new Set(nodes.map(n => n.user_id));
  const adjacency = new Map<string, Set<string>>();
  
  // Build adjacency list
  nodeIds.forEach(id => adjacency.set(id, new Set()));
  edges.forEach(edge => {
    adjacency.get(edge.from_user)?.add(edge.to_user);
    adjacency.get(edge.to_user)?.add(edge.from_user);
  });
  
  // Find largest connected component using DFS
  const visited = new Set<string>();
  let maxComponentSize = 0;
  
  for (const nodeId of nodeIds) {
    if (visited.has(nodeId)) continue;
    
    // DFS from this node
    const componentSize = dfsComponentSize(nodeId, adjacency, visited);
    maxComponentSize = Math.max(maxComponentSize, componentSize);
  }
  
  // Giant component = more than 50% of nodes
  return maxComponentSize > nodes.length * 0.5;
}

/**
 * DFS to calculate connected component size
 */
function dfsComponentSize(
  startNode: string,
  adjacency: Map<string, Set<string>>,
  visited: Set<string>
): number {
  if (visited.has(startNode)) return 0;
  
  visited.add(startNode);
  let size = 1;
  
  const neighbors = adjacency.get(startNode) || new Set();
  for (const neighbor of neighbors) {
    size += dfsComponentSize(neighbor, adjacency, visited);
  }
  
  return size;
}

/**
 * Find network bottlenecks using max flow algorithm
 */
export function findNetworkBottlenecks(
  nodes: NetworkNode[],
  edges: NetworkEdge[]
): NetworkEdge[] {
  
  // Find nodes with highest and lowest activation probability
  const sortedNodes = [...nodes].sort((a, b) => b.activation_probability - a.activation_probability);
  if (sortedNodes.length < 2) return [];
  
  const source = sortedNodes[0].user_id;
  const sink = sortedNodes[sortedNodes.length - 1].user_id;
  
  // Run max flow algorithm to find min cut
  const { maxFlow, minCutEdges } = maxFlowMinCut(source, sink, edges);
  
  return minCutEdges;
}

/**
 * Ford-Fulkerson max flow algorithm
 */
function maxFlowMinCut(
  source: string,
  sink: string,
  edges: NetworkEdge[]
): { maxFlow: number; minCutEdges: NetworkEdge[] } {
  
  // Build capacity matrix
  const nodeSet = new Set<string>();
  edges.forEach(e => {
    nodeSet.add(e.from_user);
    nodeSet.add(e.to_user);
  });
  
  if (!nodeSet.has(source) || !nodeSet.has(sink)) {
    return { maxFlow: 0, minCutEdges: [] };
  }
  
  const nodes = Array.from(nodeSet);
  const nodeIndex = new Map(nodes.map((node, i) => [node, i]));
  const n = nodes.length;
  
  // Capacity matrix
  const capacity = Array(n).fill(0).map(() => Array(n).fill(0));
  edges.forEach(edge => {
    const from = nodeIndex.get(edge.from_user)!;
    const to = nodeIndex.get(edge.to_user)!;
    capacity[from][to] = edge.weight;
  });
  
  // Edmonds-Karp algorithm (BFS-based Ford-Fulkerson)
  const sourceIdx = nodeIndex.get(source)!;
  const sinkIdx = nodeIndex.get(sink)!;
  let maxFlow = 0;
  
  while (true) {
    // BFS to find augmenting path
    const parent = Array(n).fill(-1);
    const visited = Array(n).fill(false);
    const queue = [sourceIdx];
    visited[sourceIdx] = true;
    
    while (queue.length > 0 && !visited[sinkIdx]) {
      const u = queue.shift()!;
      
      for (let v = 0; v < n; v++) {
        if (!visited[v] && capacity[u][v] > 0) {
          visited[v] = true;
          parent[v] = u;
          queue.push(v);
        }
      }
    }
    
    // No augmenting path found
    if (!visited[sinkIdx]) break;
    
    // Find minimum capacity along path
    let pathFlow = Infinity;
    for (let v = sinkIdx; v !== sourceIdx; v = parent[v]) {
      const u = parent[v];
      pathFlow = Math.min(pathFlow, capacity[u][v]);
    }
    
    // Update capacities
    for (let v = sinkIdx; v !== sourceIdx; v = parent[v]) {
      const u = parent[v];
      capacity[u][v] -= pathFlow;
      capacity[v][u] += pathFlow;
    }
    
    maxFlow += pathFlow;
  }
  
  // Find min cut edges (edges crossing the final BFS cut)
  const minCutEdges: NetworkEdge[] = [];
  const finalBFS = Array(n).fill(false);
  const queue = [sourceIdx];
  finalBFS[sourceIdx] = true;
  
  while (queue.length > 0) {
    const u = queue.shift()!;
    for (let v = 0; v < n; v++) {
      if (!finalBFS[v] && capacity[u][v] > 0) {
        finalBFS[v] = true;
        queue.push(v);
      }
    }
  }
  
  // Edges from reachable to unreachable nodes
  edges.forEach(edge => {
    const fromIdx = nodeIndex.get(edge.from_user)!;
    const toIdx = nodeIndex.get(edge.to_user)!;
    
    if (finalBFS[fromIdx] && !finalBFS[toIdx]) {
      minCutEdges.push(edge);
    }
  });
  
  return { maxFlow, minCutEdges };
}

/**
 * Run complete percolation analysis on civic information network
 */
export async function analyzeCivicInformationCascades(): Promise<CascadeAnalysis> {
  
  // Build network from actual user data
  const { nodes, edges } = await buildInformationNetwork();
  
  if (nodes.length < 5 || edges.length < 3) {
    return {
      threshold_probability: 0.5,
      critical_nodes: [],
      bottleneck_edges: [],
      max_flow_capacity: 0,
      cascade_potential: 'subcritical'
    };
  }
  
  // Calculate percolation threshold
  const threshold = calculatePercolationThreshold(nodes, edges);
  
  // Find network bottlenecks
  const bottlenecks = findNetworkBottlenecks(nodes, edges);
  
  // Identify critical nodes (highest activation probability)
  const criticalNodes = nodes
    .filter(n => n.activation_probability > threshold)
    .sort((a, b) => b.activation_probability - a.activation_probability)
    .slice(0, 5)
    .map(n => n.user_id);
  
  // Calculate max flow capacity
  const totalCapacity = edges.reduce((sum, e) => sum + e.weight, 0);
  
  // Determine cascade potential
  const avgActivation = nodes.reduce((sum, n) => sum + n.activation_probability, 0) / nodes.length;
  let cascadePotential: 'subcritical' | 'critical' | 'supercritical';
  
  if (avgActivation < threshold * 0.8) {
    cascadePotential = 'subcritical';
  } else if (avgActivation < threshold * 1.2) {
    cascadePotential = 'critical';
  } else {
    cascadePotential = 'supercritical';
  }
  
  return {
    threshold_probability: threshold,
    critical_nodes: criticalNodes,
    bottleneck_edges: bottlenecks,
    max_flow_capacity: totalCapacity,
    cascade_potential: cascadePotential
  };
}

/**
 * Store analysis results in political_flow table
 */
export async function storeCascadeAnalysis(analysis: CascadeAnalysis): Promise<void> {
  try {
    await db.political_flow.create({
      data: {
        flow_sources: { from_community: 'percolation_analysis' },
        flow_sinks: { to_community: 'network_wide' },
        flow_direction: { type: 'information_cascade' },
        flow_strength: analysis.max_flow_capacity,
        flow_velocity: { direction: analysis.cascade_potential === 'supercritical' ? 'amplifying' : 'dampening' },
        dominant_issues: {
          threshold: analysis.threshold_probability,
          critical_nodes: analysis.critical_nodes,
          bottleneck_count: analysis.bottleneck_edges.length,
          analysis_timestamp: new Date().toISOString()
        }
      }
    });
    
  } catch (error) {
    // Silently handle database errors in development
  }
}