<script lang="ts">
	import { onMount } from 'svelte';
	import { Search, BookOpen, FileText, CheckCircle2 } from '@lucide/svelte';

	const phases = [
		{
			icon: Search,
			text: 'Researching legislative context',
			subtext: 'Analyzing bills, voting records, and committee assignments',
			duration: 5000
		},
		{
			icon: BookOpen,
			text: 'Finding credible sources',
			subtext: 'Cross-referencing journalism, research, and official records',
			duration: 6000
		},
		{
			icon: FileText,
			text: 'Crafting persuasive message',
			subtext: 'Writing with citations, clarity, and political awareness',
			duration: 7000
		},
		{
			icon: CheckCircle2,
			text: 'Finalizing delivery strategy',
			subtext: 'Verifying contact paths and optimizing for impact',
			duration: 5000
		}
	];

	let currentPhaseIndex = $state(0);
	let progress = $state(0);

	onMount(() => {
		// Cycle through phases with realistic timing
		const cyclePhases = () => {
			const currentPhase = phases[currentPhaseIndex];
			const nextIndex = (currentPhaseIndex + 1) % phases.length;

			// Smooth progress bar for current phase
			const progressInterval = setInterval(() => {
				progress = Math.min(progress + 2, 100);
			}, currentPhase.duration / 50);

			// Switch to next phase
			const phaseTimeout = setTimeout(() => {
				clearInterval(progressInterval);
				currentPhaseIndex = nextIndex;
				progress = 0;
				cyclePhases();
			}, currentPhase.duration);

			return () => {
				clearInterval(progressInterval);
				clearTimeout(phaseTimeout);
			};
		};

		const cleanup = cyclePhases();
		return cleanup;
	});
</script>

<div class="mx-auto max-w-2xl space-y-8 py-12">
	<!-- Phase indicator -->
	<div class="space-y-4">
		{#snippet phaseIcon()}
			{@const IconComponent = phases[currentPhaseIndex].icon}
			<div class="flex items-center justify-center gap-4">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-participation-primary-500 to-participation-primary-600 shadow-lg"
				>
					<IconComponent class="h-8 w-8 text-white" />
				</div>
			</div>
		{/snippet}
		{@render phaseIcon()}

		<!-- Phase text -->
		<div class="text-center">
			<h3 class="text-xl font-semibold text-slate-900 md:text-2xl">
				{phases[currentPhaseIndex].text}
			</h3>
			<p class="mt-2 text-sm text-slate-600 md:text-base">
				{phases[currentPhaseIndex].subtext}
			</p>
		</div>

		<!-- Progress bar (not tied to actual agent progress) -->
		<div class="mx-auto w-full max-w-md">
			<div class="h-1.5 overflow-hidden rounded-full bg-slate-100">
				<div
					class="h-full bg-gradient-to-r from-participation-primary-500 to-participation-primary-600 transition-all duration-300 ease-out"
					style="width: {progress}%"
				></div>
			</div>
		</div>
	</div>

	<!-- Educational context -->
	<div class="rounded-lg border border-slate-200 bg-slate-50 p-6">
		<p class="text-sm leading-relaxed text-slate-700 md:text-base">
			<span class="font-semibold text-slate-900">Why this takes time:</span>
			Generic templates get ignored. We're researching your issue, finding credible sources, and
			crafting a message that demonstrates you understand the political landscape. This isn't
			template spam—it's strategic civic action.
		</p>
	</div>

	<!-- Phase timeline -->
	<div class="flex items-center justify-center gap-2">
		{#each phases as _phase, i}
			<div
				class="h-2 w-2 rounded-full transition-all duration-300"
				class:bg-participation-primary-600={i === currentPhaseIndex}
				class:bg-slate-300={i !== currentPhaseIndex}
				class:scale-125={i === currentPhaseIndex}
			></div>
		{/each}
	</div>
</div>
