<script lang="ts">
	/**
	 * TrustJourney — Shows how your message arrives at the recipient's desk.
	 *
	 * Not badges you've earned. Signal strength your voice carries.
	 * Each tier changes what the congressional office SEES when your message lands.
	 *
	 * Perceptual engineering: the bar isn't "progress" — it's substance.
	 * Your voice gaining mass.
	 */
	import { User, MapPin, ShieldCheck, Fingerprint, ArrowRight } from '@lucide/svelte';
	import { spring } from 'svelte/motion';
	import { fly } from 'svelte/transition';

	let {
		trustTier = 1,
		onVerifyAddress,
		onVerifyIdentity,
		onGenerateProof
	}: {
		trustTier: number;
		onVerifyAddress?: () => void;
		onVerifyIdentity?: () => void;
		onGenerateProof?: () => void;
	} = $props();

	const tier = $derived(Math.max(0, Math.min(4, Math.floor(trustTier))));

	// What the RECIPIENT sees at each level — not user achievements
	const levels = [
		{
			signal: 'Noise',
			arrives: 'General inbox. No constituent status. Likely unread.',
			weight: 8,
			gradient: 'from-slate-200 to-slate-300',
			text: 'text-slate-500',
			accent: 'text-slate-600',
			bg: 'bg-slate-50',
			border: 'border-slate-200',
			icon: User
		},
		{
			signal: 'Weak',
			arrives: 'Named sender. No district proof. Low priority.',
			weight: 18,
			gradient: 'from-blue-300 to-blue-400',
			text: 'text-blue-600',
			accent: 'text-blue-700',
			bg: 'bg-blue-50/50',
			border: 'border-blue-200',
			icon: User
		},
		{
			signal: 'Constituent',
			arrives: 'Confirmed constituent. Flagged for your district. Gets read.',
			weight: 62,
			gradient: 'from-emerald-400 to-emerald-500',
			text: 'text-emerald-600',
			accent: 'text-emerald-700',
			bg: 'bg-emerald-50/50',
			border: 'border-emerald-200',
			icon: MapPin
		},
		{
			signal: 'Verified',
			arrives: 'Verified identity. Cryptographic proof. Cannot be faked or botted.',
			weight: 82,
			gradient: 'from-purple-400 to-purple-500',
			text: 'text-purple-600',
			accent: 'text-purple-700',
			bg: 'bg-purple-50/50',
			border: 'border-purple-200',
			icon: ShieldCheck
		},
		{
			signal: 'Undeniable',
			arrives: 'Zero-knowledge proof of residency. Mathematically verified. Maximum weight.',
			weight: 100,
			gradient: 'from-indigo-500 to-indigo-600',
			text: 'text-indigo-600',
			accent: 'text-indigo-700',
			bg: 'bg-indigo-50/50',
			border: 'border-indigo-200',
			icon: Fingerprint
		}
	];

	const current = $derived(levels[tier]);
	const signalWidth = spring(current.weight, { stiffness: 0.06, damping: 0.65 });
	let prevTier = $state(tier);
	let justChanged = $state(false);

	$effect(() => {
		signalWidth.set(current.weight);
		if (tier !== prevTier) {
			justChanged = true;
			prevTier = tier;
			setTimeout(() => (justChanged = false), 1200);
		}
	});

	const nextStep = $derived.by(() => {
		if (tier === 1)
			return {
				label: 'Verify your address',
				sub: 'Be counted as a constituent',
				action: onVerifyAddress
			};
		if (tier === 2)
			return {
				label: 'Verify your identity',
				sub: 'Cryptographic proof of personhood',
				action: onVerifyIdentity
			};
		if (tier === 3)
			return {
				label: 'Generate ZK proof',
				sub: 'Mathematical proof of district residency',
				action: onGenerateProof
			};
		return null;
	});

	const Icon = $derived(current.icon);
</script>

<div
	class="overflow-hidden rounded-xl border transition-colors duration-700 {current.border} {current.bg}"
	class:ring-2={justChanged}
	class:ring-emerald-300={justChanged && tier === 2}
	class:ring-purple-300={justChanged && tier === 3}
	class:ring-indigo-300={justChanged && tier === 4}
>
	<!-- Signal header -->
	<div class="px-4 pt-3 pb-1.5">
		<div class="mb-1.5 flex items-center justify-between">
			<span class="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
				Your voice
			</span>
			{#key tier}
				<div
					class="flex items-center gap-1.5"
					in:fly={{ y: -8, duration: 300 }}
				>
					<Icon class="h-3.5 w-3.5 {current.text}" />
					<span class="text-xs font-bold {current.accent}">{current.signal}</span>
				</div>
			{/key}
		</div>

		<!-- Signal bar — substance, not progress -->
		<div class="relative h-2.5 overflow-hidden rounded-full bg-slate-100">
			<div
				class="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r {current.gradient}"
				style="width: {$signalWidth}%; transition: background 700ms ease"
			></div>
			<!-- Subtle shine on the bar -->
			<div
				class="absolute inset-y-0 left-0 rounded-full bg-gradient-to-b from-white/20 to-transparent"
				style="width: {$signalWidth}%"
			></div>
		</div>
	</div>

	<!-- What the recipient sees -->
	<div class="px-4 pb-3 pt-1.5">
		{#key tier}
			<p
				class="text-[13px] leading-relaxed text-slate-600"
				in:fly={{ y: 6, duration: 300, delay: 100 }}
			>
				{current.arrives}
			</p>
		{/key}
	</div>

	<!-- Next step — one action, not a ladder -->
	{#if nextStep}
		<div class="border-t {current.border}">
			<button
				class="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/60"
				onclick={() => nextStep.action?.()}
			>
				<div class="flex-1 min-w-0">
					<span class="text-sm font-medium text-slate-800">{nextStep.label}</span>
					<span class="block text-[11px] text-slate-500">{nextStep.sub}</span>
				</div>
				<ArrowRight
					class="h-4 w-4 flex-shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5"
				/>
			</button>
		</div>
	{:else}
		<div class="border-t {current.border} px-4 py-2.5">
			<span class="text-[11px] font-semibold {current.text}">Maximum signal strength</span>
		</div>
	{/if}
</div>
