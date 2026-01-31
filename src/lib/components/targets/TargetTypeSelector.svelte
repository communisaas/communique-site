<script lang="ts">
	/**
	 * TargetTypeSelector: Two-tier target type selection interface
	 *
	 * PERCEPTUAL ENGINEERING PRINCIPLES:
	 * 1. Visual hierarchy through spatial grouping (government top, organizations bottom)
	 * 2. Color coding creates instant recognition patterns (blue = authority, varied = sectors)
	 * 3. Progressive disclosure: organizations are collapsible to reduce initial cognitive load
	 * 4. Gestalt grouping: related items are spatially clustered
	 *
	 * COGNITIVE LOAD REDUCTION:
	 * - Government targets (most common) are always visible
	 * - Organization targets fold away to reduce visual noise
	 * - Icons provide pre-attentive processing cues
	 * - Color patterns enable parallel processing
	 *
	 * INTERACTION DESIGN:
	 * - Touch-friendly 44px minimum targets
	 * - Smooth transitions signal state changes
	 * - Entity input appears contextually (progressive disclosure)
	 * - Clear affordances through hover states
	 */

	import type { DecisionMakerTargetType } from '$lib/core/agents/providers/types';
	import TargetCard from './TargetCard.svelte';
	import {
		Building2,
		Landmark,
		MapPin,
		Building,
		Heart,
		GraduationCap,
		Stethoscope,
		HardHat,
		Newspaper,
		ChevronDown,
		ChevronUp
	} from '@lucide/svelte';
	import { slide } from 'svelte/transition';

	interface Props {
		selected: DecisionMakerTargetType | null;
		entity?: string;
		disabled?: boolean;
		onselect?: (type: DecisionMakerTargetType) => void;
		onentitychange?: (entity: string) => void;
	}

	let { selected = $bindable(), entity = $bindable(''), disabled = false, onselect, onentitychange }: Props = $props();

	// Track organization section expansion
	let organizationsExpanded = $state(false);

	// Government targets (primary tier)
	const governmentTargets = [
		{
			type: 'congress' as const,
			label: 'US Congress',
			description: 'Federal legislators',
			icon: Building2,
			colorScheme: 'blue' as const,
			requiresEntity: false
		},
		{
			type: 'state_legislature' as const,
			label: 'State Legislature',
			description: 'State senators & reps',
			icon: Landmark,
			colorScheme: 'blue' as const,
			requiresEntity: false
		},
		{
			type: 'local_government' as const,
			label: 'Local Government',
			description: 'City, county, school boards',
			icon: MapPin,
			colorScheme: 'blue' as const,
			requiresEntity: false
		}
	];

	// Organization targets (secondary tier, collapsible)
	const organizationTargets = [
		{
			type: 'corporate' as const,
			label: 'Corporation',
			description: 'Company leadership',
			icon: Building,
			colorScheme: 'gray' as const,
			requiresEntity: true,
			placeholder: 'e.g., Amazon, ExxonMobil'
		},
		{
			type: 'nonprofit' as const,
			label: 'Nonprofit',
			description: 'NGO, foundation',
			icon: Heart,
			colorScheme: 'green' as const,
			requiresEntity: true,
			placeholder: 'e.g., Red Cross, ACLU'
		},
		{
			type: 'education' as const,
			label: 'Education',
			description: 'University, school district',
			icon: GraduationCap,
			colorScheme: 'purple' as const,
			requiresEntity: true,
			placeholder: 'e.g., Stanford University'
		},
		{
			type: 'healthcare' as const,
			label: 'Healthcare',
			description: 'Hospital, health system',
			icon: Stethoscope,
			colorScheme: 'red' as const,
			requiresEntity: true,
			placeholder: 'e.g., Kaiser Permanente'
		},
		{
			type: 'labor' as const,
			label: 'Labor Union',
			description: 'Union leadership',
			icon: HardHat,
			colorScheme: 'orange' as const,
			requiresEntity: true,
			placeholder: 'e.g., UAW, SEIU'
		},
		{
			type: 'media' as const,
			label: 'Media',
			description: 'News organization',
			icon: Newspaper,
			colorScheme: 'cyan' as const,
			requiresEntity: true,
			placeholder: 'e.g., New York Times'
		}
	];

	// Find the selected target config
	const selectedTarget = $derived(
		[...governmentTargets, ...organizationTargets].find((t) => t.type === selected)
	);

	// Show entity input if selected target requires it
	const showEntityInput = $derived(selectedTarget?.requiresEntity ?? false);

	// Auto-expand organizations if an org type is selected
	$effect(() => {
		if (selected && organizationTargets.some((t) => t.type === selected)) {
			organizationsExpanded = true;
		}
	});

	function handleSelect(type: DecisionMakerTargetType) {
		selected = type;
		onselect?.(type);

		// Clear entity when switching to non-entity target
		const target = [...governmentTargets, ...organizationTargets].find((t) => t.type === type);
		if (!target?.requiresEntity && entity) {
			entity = '';
			onentitychange?.('');
		}
	}

	function handleEntityInput(event: Event) {
		const value = (event.target as HTMLInputElement).value;
		entity = value;
		onentitychange?.(value);
	}
</script>

<div class="target-type-selector space-y-6">
	<!-- Government Targets (Primary Tier - Always Visible) -->
	<section>
		<h3 class="mb-3 text-sm font-semibold text-slate-700">Government</h3>
		<div class="grid grid-cols-3 gap-3">
			{#each governmentTargets as target}
				<TargetCard
					label={target.label}
					description={target.description}
					icon={target.icon}
					colorScheme={target.colorScheme}
					selected={selected === target.type}
					{disabled}
					onclick={() => handleSelect(target.type)}
				/>
			{/each}
		</div>
	</section>

	<!-- Organizations (Secondary Tier - Collapsible) -->
	<section>
		<button
			type="button"
			onclick={() => (organizationsExpanded = !organizationsExpanded)}
			class="mb-3 flex w-full items-center justify-between text-left transition-colors
				hover:text-slate-900 focus:outline-none focus-visible:ring-2
				focus-visible:ring-participation-primary-500 focus-visible:ring-offset-2 rounded-md px-1"
			aria-expanded={organizationsExpanded}
		>
			<h3 class="text-sm font-semibold text-slate-700">Organizations</h3>
			<span class="text-slate-400 transition-transform" class:rotate-180={organizationsExpanded}>
				<ChevronDown class="h-4 w-4" strokeWidth={2} />
			</span>
		</button>

		{#if organizationsExpanded}
			<div class="grid grid-cols-3 gap-3" transition:slide={{ duration: 250 }}>
				{#each organizationTargets as target}
					<TargetCard
						label={target.label}
						description={target.description}
						icon={target.icon}
						colorScheme={target.colorScheme}
						selected={selected === target.type}
						{disabled}
						onclick={() => handleSelect(target.type)}
					/>
				{/each}
			</div>
		{/if}
	</section>

	<!-- Entity Input (Progressive Disclosure) -->
	{#if showEntityInput && selectedTarget}
		<section class="entity-input-section" transition:slide={{ duration: 200 }}>
			<label for="target-entity" class="mb-2 block text-sm font-medium text-slate-700">
				Which {selectedTarget.label.toLowerCase()}?
			</label>
			<input
				id="target-entity"
				type="text"
				value={entity}
				placeholder={selectedTarget.placeholder}
				oninput={handleEntityInput}
				{disabled}
				class="w-full rounded-lg border-2 border-slate-200 bg-white px-4 py-3
					text-base text-slate-900 placeholder:text-slate-400
					transition-all duration-200
					focus:border-participation-primary-500 focus:outline-none
					focus:ring-2 focus:ring-participation-primary-500/20
					disabled:cursor-not-allowed disabled:opacity-50"
				autocomplete="organization"
			/>
			<p class="mt-1.5 text-xs text-slate-500">
				Enter the organization's name to find the right decision-makers
			</p>
		</section>
	{/if}
</div>

<style>
	/* Smooth chevron rotation */
	.rotate-180 {
		transform: rotate(180deg);
	}

	/* Ensure consistent grid behavior on smaller screens */
	@media (max-width: 640px) {
		.grid-cols-3 {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 400px) {
		.grid-cols-3 {
			grid-template-columns: 1fr;
		}
	}
</style>
