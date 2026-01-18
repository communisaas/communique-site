<script lang="ts">
	/**
	 * AuthGateOverlay - Progressive Auth for Template Creation
	 *
	 * Perceptual Engineering Principles:
	 * - Preserve visible progress (sunk cost visible, not lost)
	 * - Frame auth as capability unlock, not toll booth
	 * - Minimize context switch (overlay, not navigation)
	 * - Use recognition over recall (show what they'll get)
	 *
	 * This component overlays the creator when auth is required,
	 * preserving the user's flow state and momentum.
	 */

	import { Search, Shield, Users, Sparkles } from '@lucide/svelte';

	interface Props {
		/** The subject line they've created (shows their progress) */
		subjectLine: string;
		/** Core issue description */
		coreIssue?: string;
		/** Callback when user initiates auth */
		onauthstart?: (provider: 'google' | 'discord') => void;
		/** Callback when user wants to go back */
		onback?: () => void;
	}

	let { subjectLine, coreIssue, onauthstart, onback }: Props = $props();

	function handleAuth(provider: 'google' | 'discord') {
		onauthstart?.(provider);
	}
</script>

<!--
  Overlay design: Semi-transparent backdrop with centered card
  The creator is still visible behind, preserving spatial context
-->
<div class="absolute inset-0 z-10 flex items-center justify-center bg-white/95 backdrop-blur-sm">
	<div class="mx-4 w-full max-w-lg">
		<!-- Progress Preservation: Show what they've built -->
		<div class="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
			<div class="flex items-start gap-3">
				<div class="rounded-full bg-emerald-100 p-2">
					<Sparkles class="h-5 w-5 text-emerald-600" />
				</div>
				<div class="flex-1 min-w-0">
					<p class="text-sm font-medium text-emerald-800">Your issue is ready</p>
					<p class="mt-1 text-sm text-emerald-700 font-medium truncate">
						"{subjectLine}"
					</p>
					{#if coreIssue}
						<p class="mt-1 text-xs text-emerald-600 line-clamp-2">{coreIssue}</p>
					{/if}
				</div>
			</div>
		</div>

		<!-- Value Proposition: What they're unlocking -->
		<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
			<div class="text-center">
				<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-participation-primary-100">
					<Search class="h-7 w-7 text-participation-primary-600" />
				</div>

				<h2 class="text-xl font-semibold text-slate-900">
					Unlock Decision-Maker Research
				</h2>

				<p class="mt-2 text-sm text-slate-600">
					Create a free account to access AI-powered research that finds the specific people who can act on your issue.
				</p>
			</div>

			<!-- What they'll get: Recognition over recall -->
			<div class="mt-6 space-y-3">
				<div class="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
					<Users class="h-5 w-5 flex-shrink-0 text-slate-500" />
					<div class="text-sm">
						<span class="font-medium text-slate-700">Real decision-makers</span>
						<span class="text-slate-500"> — names, titles, and why they have power</span>
					</div>
				</div>

				<div class="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
					<Search class="h-5 w-5 flex-shrink-0 text-slate-500" />
					<div class="text-sm">
						<span class="font-medium text-slate-700">Verified sources</span>
						<span class="text-slate-500"> — Google Search-grounded research</span>
					</div>
				</div>

				<div class="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
					<Shield class="h-5 w-5 flex-shrink-0 text-slate-500" />
					<div class="text-sm">
						<span class="font-medium text-slate-700">Your progress is saved</span>
						<span class="text-slate-500"> — continue right where you left off</span>
					</div>
				</div>
			</div>

			<!-- Auth Options -->
			<div class="mt-6 space-y-3">
				<button
					onclick={() => handleAuth('google')}
					class="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-400"
				>
					<svg class="h-5 w-5" viewBox="0 0 24 24">
						<path
							fill="#4285F4"
							d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
						/>
						<path
							fill="#34A853"
							d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
						/>
						<path
							fill="#FBBC05"
							d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
						/>
						<path
							fill="#EA4335"
							d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
						/>
					</svg>
					Continue with Google
				</button>

				<button
					onclick={() => handleAuth('discord')}
					class="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-400"
				>
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="#5865F2">
						<path
							d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
						/>
					</svg>
					Continue with Discord
				</button>
			</div>

			<!-- Back option (preserve escape hatch) -->
			<div class="mt-4 text-center">
				<button
					onclick={() => onback?.()}
					class="text-sm text-slate-500 hover:text-slate-700 transition-colors"
				>
					Go back and edit your issue
				</button>
			</div>

			<!-- Trust signal -->
			<p class="mt-4 text-center text-xs text-slate-400">
				Your draft is automatically saved. You'll continue right where you left off.
			</p>
		</div>
	</div>
</div>
