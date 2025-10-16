/**
 * RPC Metrics API - Real-Time Observability
 *
 * Provides visibility into RPC layer health and performance:
 * - Provider health status
 * - Success rates and latency
 * - Circuit breaker states
 * - Recent request traces
 * - Call distribution
 *
 * This endpoint enables production monitoring without external tools.
 */

import { json } from '@sveltejs/kit';
import { rpc } from '$lib/core/blockchain/rpc';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		// Get comprehensive metrics from RPC manager
		const metrics = rpc.getMetrics();

		// Get recent traces for debugging
		const traces = rpc.getTraces(10);

		// Get all providers with their status
		const providers = rpc.getProviders().map((provider) => ({
			name: provider.config.name,
			priority: provider.config.priority,
			enabled: provider.config.enabled,
			mainnet: {
				url: provider.config.mainnet,
				health: provider.config.mainnet ? provider.getHealth('mainnet') : null
			},
			testnet: {
				url: provider.config.testnet,
				health: provider.config.testnet ? provider.getHealth('testnet') : null
			},
			limits: provider.config.limits,
			privacy: provider.config.privacy
		}));

		// Calculate uptime percentages
		const uptimePercentage =
			metrics.totalCalls > 0 ? (metrics.successfulCalls / metrics.totalCalls) * 100 : 100;

		// Identify current primary provider
		const primaryProvider = providers
			.filter((p) => p.enabled && p.mainnet.url)
			.sort((a, b) => a.priority - b.priority)[0];

		// Check if any providers are in degraded state
		const degradedProviders = providers.filter(
			(p) =>
				p.mainnet.health?.status === 'degraded' ||
				p.mainnet.health?.status === 'unhealthy' ||
				p.mainnet.health?.status === 'circuit-open' ||
				p.testnet.health?.status === 'degraded' ||
				p.testnet.health?.status === 'unhealthy' ||
				p.testnet.health?.status === 'circuit-open'
		);

		// Compile dashboard data
		const dashboard = {
			timestamp: new Date().toISOString(),
			summary: {
				totalCalls: metrics.totalCalls,
				successfulCalls: metrics.successfulCalls,
				failedCalls: metrics.failedCalls,
				averageLatency: Math.round(metrics.averageLatency),
				uptimePercentage: Math.round(uptimePercentage * 100) / 100,
				primaryProvider: primaryProvider?.name || 'None'
			},
			providers,
			degradedProviders: degradedProviders.map((p) => p.name),
			callDistribution: {
				byProvider: metrics.callsByProvider,
				byMethod: metrics.callsByMethod,
				byNetwork: metrics.callsByNetwork
			},
			recentTraces: traces.map((trace) => ({
				traceId: trace.traceId,
				method: trace.method,
				network: trace.network,
				startTime: trace.startTime,
				duration: trace.duration,
				success: trace.result.success,
				provider: trace.result.provider,
				attempts: trace.attempts.length,
				error: trace.result.error
			})),
			health: {
				status: degradedProviders.length === providers.length ? 'critical' :
				        degradedProviders.length > 0 ? 'degraded' : 'healthy',
				message: degradedProviders.length === providers.length
					? 'All providers are degraded or unhealthy'
					: degradedProviders.length > 0
						? `${degradedProviders.length} provider(s) degraded: ${degradedProviders.map(p => p.name).join(', ')}`
						: 'All providers operational'
			}
		};

		return json(dashboard);
	} catch (error) {
		console.error('[RPC Metrics] Error fetching metrics:', error);
		return json(
			{
				error: 'Failed to fetch RPC metrics',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

/**
 * Reset RPC metrics and health
 *
 * Useful for testing or after resolving provider issues
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();

		if (body.action === 'reset_health') {
			// Reset all provider health and circuit breakers
			rpc.resetAllHealth();

			return json({
				success: true,
				message: 'All provider health reset successfully'
			});
		}

		if (body.action === 'enable_provider' && body.providerName) {
			// Enable a specific provider
			rpc.setProviderEnabled(body.providerName, true);

			return json({
				success: true,
				message: `Provider ${body.providerName} enabled`
			});
		}

		if (body.action === 'disable_provider' && body.providerName) {
			// Disable a specific provider
			rpc.setProviderEnabled(body.providerName, false);

			return json({
				success: true,
				message: `Provider ${body.providerName} disabled`
			});
		}

		return json(
			{
				error: 'Invalid action',
				validActions: ['reset_health', 'enable_provider', 'disable_provider']
			},
			{ status: 400 }
		);
	} catch (error) {
		console.error('[RPC Metrics] Error processing action:', error);
		return json(
			{
				error: 'Failed to process action',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
