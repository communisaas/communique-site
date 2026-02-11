<script lang="ts">
	/**
	 * Demo page for TargetTypeSelector component
	 *
	 * This page demonstrates the TargetTypeSelector in action,
	 * showing how it handles different target types and entity input.
	 */

	import { TargetTypeSelector } from '$lib/components/targets';
	import type { DecisionMakerTargetType } from '$lib/core/agents/providers/types';

	let selectedType = $state<DecisionMakerTargetType | null>(null);
	let entityName = $state('');
	let disabled = $state(false);

	// Track selection history for demo
	let selectionHistory = $state<Array<{ type: DecisionMakerTargetType; entity?: string }>>([]);

	function handleSelect(type: DecisionMakerTargetType) {
		console.log('Target type selected:', type);
	}

	function handleEntityChange(entity: string) {
		console.log('Entity changed:', entity);
	}

	// Add to history when both type and entity (if required) are set
	$effect(() => {
		if (selectedType) {
			const requiresEntity = [
				'corporate',
				'nonprofit',
				'education',
				'healthcare',
				'labor',
				'media'
			].includes(selectedType);

			if (!requiresEntity || (requiresEntity && entityName.trim())) {
				// Add to history (avoid duplicates)
				const lastEntry = selectionHistory[selectionHistory.length - 1];
				if (
					!lastEntry ||
					lastEntry.type !== selectedType ||
					lastEntry.entity !== entityName
				) {
					selectionHistory = [
						...selectionHistory,
						{ type: selectedType, entity: entityName || undefined }
					];
				}
			}
		}
	});

	function reset() {
		selectedType = null;
		entityName = '';
	}
</script>

<svelte:head>
	<title>TargetTypeSelector Demo | Communiqué</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12">
	<div class="mx-auto max-w-4xl px-4">
		<!-- Header -->
		<header class="mb-8">
			<h1 class="text-3xl font-bold text-slate-900">TargetTypeSelector Component</h1>
			<p class="mt-2 text-slate-600">
				A perceptually-engineered interface for selecting decision-maker target types
			</p>
		</header>

		<!-- Demo Controls -->
		<div class="mb-6 rounded-lg border border-slate-200 bg-white p-4">
			<h2 class="mb-3 text-sm font-semibold text-slate-700">Demo Controls</h2>
			<div class="flex items-center gap-4">
				<label class="flex items-center gap-2">
					<input type="checkbox" bind:checked={disabled} class="rounded" />
					<span class="text-sm text-slate-700">Disabled</span>
				</label>
				<button
					type="button"
					onclick={reset}
					class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium
						text-slate-700 transition-colors hover:bg-slate-50"
				>
					Reset Selection
				</button>
			</div>
		</div>

		<!-- Component Demo -->
		<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
			<TargetTypeSelector
				bind:selected={selectedType}
				bind:entity={entityName}
				{disabled}
				onselect={handleSelect}
				onentitychange={handleEntityChange}
			/>
		</div>

		<!-- Current State Display -->
		<div class="mt-6 grid gap-4 md:grid-cols-2">
			<!-- Selected State -->
			<div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
				<h3 class="mb-2 text-sm font-semibold text-slate-700">Current Selection</h3>
				<div class="space-y-2 font-mono text-sm">
					<div>
						<span class="text-slate-500">Type:</span>
						<span class="ml-2 font-semibold text-slate-900">
							{selectedType || 'null'}
						</span>
					</div>
					<div>
						<span class="text-slate-500">Entity:</span>
						<span class="ml-2 font-semibold text-slate-900">
							{entityName || '""'}
						</span>
					</div>
				</div>
			</div>

			<!-- Selection History -->
			<div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
				<h3 class="mb-2 text-sm font-semibold text-slate-700">Selection History</h3>
				<div class="max-h-32 overflow-y-auto">
					{#if selectionHistory.length === 0}
						<p class="text-sm italic text-slate-400">No selections yet</p>
					{:else}
						<ol class="space-y-1 text-sm">
							{#each selectionHistory as entry, i}
								<li class="font-mono text-slate-700">
									{i + 1}. {entry.type}
									{#if entry.entity}
										<span class="text-slate-500">→ "{entry.entity}"</span>
									{/if}
								</li>
							{/each}
						</ol>
					{/if}
				</div>
			</div>
		</div>

		<!-- Design Principles -->
		<div class="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-6">
			<h2 class="mb-3 text-lg font-semibold text-blue-900">Perceptual Engineering Principles</h2>
			<ul class="space-y-2 text-sm text-blue-800">
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-blue-600">•</span>
					<span
						><strong>Visual Hierarchy:</strong> Government targets (most common) are always visible,
						organizations are collapsible</span
					>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-blue-600">•</span>
					<span
						><strong>Color Coding:</strong> Blue for authority (government), varied colors for
						organization sectors</span
					>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-blue-600">•</span>
					<span
						><strong>Progressive Disclosure:</strong> Entity input appears only when needed,
						reducing cognitive load</span
					>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-blue-600">•</span>
					<span
						><strong>Clear Affordances:</strong> Hover states, smooth transitions, and visual
						feedback signal interactivity</span
					>
				</li>
				<li class="flex items-start gap-2">
					<span class="mt-0.5 text-blue-600">•</span>
					<span
						><strong>Accessibility:</strong> Full keyboard navigation, ARIA labels, focus rings,
						44px touch targets</span
					>
				</li>
			</ul>
		</div>

		<!-- Usage Example -->
		<div class="mt-6 rounded-lg border border-slate-200 bg-slate-900 p-6">
			<h3 class="mb-3 text-sm font-semibold text-slate-300">Usage Example</h3>
			<pre class="overflow-x-auto text-sm text-slate-300"><code
					>{`${'<'}script lang="ts"${'>'}
  import { TargetTypeSelector } from '$lib/components/targets';
  import type { DecisionMakerTargetType } from '$lib/core/agents/providers/types';

  let targetType = $state${'<'}DecisionMakerTargetType | null${'>'} (null);
  let entity = $state('');

  function handleSelect(type: DecisionMakerTargetType) {
    console.log('Selected:', type);
  }

  function handleEntityChange(value: string) {
    console.log('Entity:', value);
  }
${'<'}/script${'>'}

${'<'}TargetTypeSelector
  bind:selected={targetType}
  bind:entity={entity}
  onselect={handleSelect}
  onentitychange={handleEntityChange}
/>`}</code
				></pre>
		</div>

		<!-- API Reference -->
		<div class="mt-6 rounded-lg border border-slate-200 bg-white p-6">
			<h3 class="mb-3 text-lg font-semibold text-slate-900">API Reference</h3>
			<dl class="space-y-3 text-sm">
				<div>
					<dt class="font-mono font-semibold text-slate-900">selected</dt>
					<dd class="ml-4 text-slate-600">
						<code class="rounded bg-slate-100 px-1 py-0.5 text-xs"
							>DecisionMakerTargetType | null</code
						>
						- Currently selected target type (bindable)
					</dd>
				</div>
				<div>
					<dt class="font-mono font-semibold text-slate-900">entity</dt>
					<dd class="ml-4 text-slate-600">
						<code class="rounded bg-slate-100 px-1 py-0.5 text-xs">string</code>
						- Entity name for organization targets (bindable)
					</dd>
				</div>
				<div>
					<dt class="font-mono font-semibold text-slate-900">disabled</dt>
					<dd class="ml-4 text-slate-600">
						<code class="rounded bg-slate-100 px-1 py-0.5 text-xs">boolean</code>
						- Disable all interactions (default: false)
					</dd>
				</div>
				<div>
					<dt class="font-mono font-semibold text-slate-900">onselect</dt>
					<dd class="ml-4 text-slate-600">
						<code class="rounded bg-slate-100 px-1 py-0.5 text-xs"
							>(type: DecisionMakerTargetType) =&gt; void</code
						>
						- Callback when target type is selected
					</dd>
				</div>
				<div>
					<dt class="font-mono font-semibold text-slate-900">onentitychange</dt>
					<dd class="ml-4 text-slate-600">
						<code class="rounded bg-slate-100 px-1 py-0.5 text-xs"
							>(entity: string) =&gt; void</code
						>
						- Callback when entity name changes
					</dd>
				</div>
			</dl>
		</div>
	</div>
</div>
