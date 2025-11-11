<script lang="ts">
	/**
	 * TemplatePreviewCard: Greyed-out preview showing next precision level templates
	 *
	 * DESIGN PHILOSOPHY:
	 * - Create pull toward location refinement through visual teasing
	 * - Blur effect indicates "unlock with better location"
	 * - Clear affordance to upgrade precision (GPS or address)
	 */

	interface TemplatePreviewCardProps {
		templateCount: number;
		precisionLevel: 'county' | 'district';
		onUnlock: () => void;
	}

	let { templateCount, precisionLevel, onUnlock }: TemplatePreviewCardProps = $props();

	const precisionLabel = precisionLevel === 'county' ? 'county-level' : 'district-level';
	const actionLabel = precisionLevel === 'county' ? 'Enable GPS' : 'Enter address';
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
	<div class="absolute inset-0 flex flex-col items-center justify-center space-y-3">
		<!-- Lock icon -->
		<div class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
			<svg class="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
				/>
			</svg>
		</div>

		<!-- Preview text -->
		<div class="text-center">
			<p class="text-sm font-semibold text-slate-900">
				{templateCount}
				{precisionLabel}
				{templateCount === 1 ? 'template' : 'templates'}
			</p>
			<p class="mt-0.5 text-xs text-slate-600">
				{actionLabel} to see local advocacy
			</p>
		</div>

		<!-- Unlock button -->
		<button
			onclick={onUnlock}
			class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:bg-blue-800"
		>
			{actionLabel} →
		</button>
	</div>
</div>
