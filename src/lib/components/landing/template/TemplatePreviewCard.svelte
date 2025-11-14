<script lang="ts">
	/**
	 * TemplatePreviewCard: Greyed-out preview showing next precision level templates
	 *
	 * DESIGN PHILOSOPHY:
	 * - Create pull toward location refinement through visual teasing
	 * - Blur effect indicates "unlock with better location"
	 * - Clear affordance to upgrade precision (GPS or address)
	 *
	 * BEHAVIORAL PSYCHOLOGY:
	 * - Loss aversion framing (Kahneman & Tversky): "You're missing X" > "Unlock X"
	 * - Social proof: Show what neighbors are seeing
	 * - Preview/teaser pattern: Visual evidence of hidden value
	 */

	interface TemplatePreviewCardProps {
		templateCount: number;
		precisionLevel: 'county' | 'district';
		onUnlock: () => void;
		currentCount?: number; // Current precision level count (for loss framing)
	}

	let {
		templateCount,
		precisionLevel,
		onUnlock,
		currentCount = 0
	}: TemplatePreviewCardProps = $props();

	const precisionLabel = precisionLevel === 'county' ? 'county-level' : 'district-level';
	const actionLabel = precisionLevel === 'county' ? 'Enable GPS' : 'Enter address';

	// Collective power: Show coordination strength, open invitation
	const coordinatingCount = templateCount;
	const locationContext =
		precisionLevel === 'county' ? 'in your area' : 'at this precision level';
</script>

<div class="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
	<!-- Blur overlay effect -->
	<div class="absolute inset-0 bg-gradient-to-b from-white/60 to-white/80 backdrop-blur-sm"></div>

	<!-- Preview content (deliberately vague) -->
	<div class="relative space-y-2 opacity-40">
		<div class="h-5 w-3/4 rounded-md bg-slate-200"></div>
		<div class="h-4 w-full rounded-md bg-slate-100"></div>
		<div class="h-4 w-5/6 rounded-md bg-slate-100"></div>
		<div class="mt-3 flex items-center gap-2">
			<div class="h-3 w-20 rounded-md bg-slate-100"></div>
			<div class="h-3 w-16 rounded-md bg-slate-100"></div>
		</div>
	</div>

	<!-- Unlock affordance (centered overlay) -->
	<div class="absolute inset-0 flex flex-col items-center justify-center space-y-3 px-4">
		<!-- Lock icon with pulse animation (urgency) -->
		<div
			class="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 shadow-sm"
		>
			<svg class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
				/>
			</svg>
		</div>

		<!-- Collective power framing (empowering, not anxiety-inducing) -->
		<div class="text-center">
			<p class="text-base font-bold text-slate-900">
				{coordinatingCount.toLocaleString()}
				{coordinatingCount === 1 ? 'person' : 'people'} coordinating
			</p>
			<p class="mt-1 text-sm text-slate-600">{locationContext}</p>

			<!-- Social proof with open invitation (research: 3-5x more persuasive) -->
			{#if currentCount > 0}
				<p class="mt-2 text-xs font-medium text-blue-600">
					Seeing {currentCount.toLocaleString()} now · Join {coordinatingCount.toLocaleString()} more {locationContext}
				</p>
			{/if}
		</div>

		<!-- Unlock button with clear value proposition -->
		<button
			onclick={onUnlock}
			class="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg active:bg-blue-800"
		>
			{actionLabel} to see all →
		</button>

		<!-- Trust signal (privacy reassurance) -->
		<p class="mt-2 text-center text-xs text-slate-500">
			{precisionLevel === 'district' ? '🔒 Zero-knowledge proof · Address encrypted' : '📍 GPS-based · No tracking'}
		</p>
	</div>
</div>
