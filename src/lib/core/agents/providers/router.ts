/**
 * Decision-Maker Router
 *
 * Routes resolution requests to the appropriate provider based on target type.
 * Handles fallback logic and provider prioritization.
 */

import type {
	DecisionMakerProvider,
	ResolveContext,
	DecisionMakerResult,
	ProviderRegistration,
	RouterOptions,
	DecisionMakerTargetType
} from './types';

// ============================================================================
// Router Implementation
// ============================================================================

export class DecisionMakerRouter {
	private providers: Map<string, ProviderRegistration> = new Map();
	private targetTypeIndex: Map<DecisionMakerTargetType, ProviderRegistration[]> = new Map();

	/**
	 * Register a provider with optional priority
	 */
	register(provider: DecisionMakerProvider, priority: number = 10): void {
		const registration: ProviderRegistration = { provider, priority };

		// Add to provider map
		this.providers.set(provider.name, registration);

		// Index by supported target types
		for (const targetType of provider.supportedTargetTypes) {
			const existing = this.targetTypeIndex.get(targetType) || [];
			existing.push(registration);
			// Sort by priority (descending)
			existing.sort((a, b) => b.priority - a.priority);
			this.targetTypeIndex.set(targetType, existing);
		}

		console.log(`[router] Registered provider: ${provider.name} (priority: ${priority})`);
		console.log(
			`[router] Supports target types: ${provider.supportedTargetTypes.join(', ')}`
		);
	}

	/**
	 * Get providers for a target type, sorted by priority
	 */
	private getProvidersForTargetType(targetType: DecisionMakerTargetType): DecisionMakerProvider[] {
		const registrations = this.targetTypeIndex.get(targetType) || [];
		return registrations.map((r) => r.provider);
	}

	/**
	 * Find the best provider for a resolution context
	 */
	private selectProvider(
		context: ResolveContext,
		options?: RouterOptions
	): DecisionMakerProvider | null {
		// Check preferred provider first
		if (options?.preferredProvider) {
			const registration = this.providers.get(options.preferredProvider);
			if (registration && registration.provider.canResolve(context)) {
				return registration.provider;
			}
		}

		// Get providers for this target type
		const candidates = this.getProvidersForTargetType(context.targetType);

		// Find first provider that can resolve
		for (const provider of candidates) {
			if (provider.canResolve(context)) {
				return provider;
			}
		}

		return null;
	}

	/**
	 * Resolve decision-makers using the appropriate provider
	 */
	async resolve(
		context: ResolveContext,
		options?: RouterOptions
	): Promise<DecisionMakerResult> {
		const startTime = Date.now();

		console.log('[router] Resolving decision-makers:', {
			targetType: context.targetType,
			targetEntity: context.targetEntity,
			subjectLine: context.subjectLine.slice(0, 50) + '...'
		});

		// Select primary provider
		const provider = this.selectProvider(context, options);

		if (!provider) {
			throw new Error(
				`No provider available for target type: ${context.targetType}. Supported types: ${Array.from(this.targetTypeIndex.keys()).join(', ')}`
			);
		}

		console.log(`[router] Selected provider: ${provider.name}`);

		try {
			// Attempt resolution with primary provider
			const result = await this.resolveWithTimeout(provider, context, options?.timeoutMs);
			console.log(`[router] Resolution successful via ${provider.name} in ${Date.now() - startTime}ms`);
			return result;
		} catch (error) {
			console.error(`[router] Provider ${provider.name} failed:`, error);

			// Try fallback if enabled
			if (options?.allowFallback) {
				return await this.attemptFallback(context, provider, options);
			}

			throw error;
		}
	}

	/**
	 * Attempt resolution with timeout
	 */
	private async resolveWithTimeout(
		provider: DecisionMakerProvider,
		context: ResolveContext,
		timeoutMs: number = 60000
	): Promise<DecisionMakerResult> {
		return Promise.race([
			provider.resolve(context),
			new Promise<DecisionMakerResult>((_, reject) =>
				setTimeout(
					() => reject(new Error(`Resolution timeout after ${timeoutMs}ms`)),
					timeoutMs
				)
			)
		]);
	}

	/**
	 * Attempt fallback to other providers
	 */
	private async attemptFallback(
		context: ResolveContext,
		failedProvider: DecisionMakerProvider,
		options?: RouterOptions
	): Promise<DecisionMakerResult> {
		console.log(`[router] Attempting fallback after ${failedProvider.name} failure`);

		const candidates = this.getProvidersForTargetType(context.targetType);

		// Try other providers in priority order
		for (const provider of candidates) {
			if (provider.name === failedProvider.name) {
				continue; // Skip the one that already failed
			}

			if (!provider.canResolve(context)) {
				continue;
			}

			console.log(`[router] Trying fallback provider: ${provider.name}`);

			try {
				const result = await this.resolveWithTimeout(provider, context, options?.timeoutMs);
				console.log(`[router] Fallback successful via ${provider.name}`);
				return result;
			} catch (error) {
				console.error(`[router] Fallback provider ${provider.name} also failed:`, error);
				// Continue to next provider
			}
		}

		// All providers failed
		throw new Error(
			`All providers failed for target type: ${context.targetType}. Last error from ${failedProvider.name}.`
		);
	}

	/**
	 * Get all registered providers
	 */
	getProviders(): DecisionMakerProvider[] {
		return Array.from(this.providers.values()).map((r) => r.provider);
	}

	/**
	 * Get provider by name
	 */
	getProvider(name: string): DecisionMakerProvider | undefined {
		return this.providers.get(name)?.provider;
	}
}

// ============================================================================
// Singleton Router Instance
// ============================================================================

/** Global router instance */
export const decisionMakerRouter = new DecisionMakerRouter();
