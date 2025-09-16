<script lang="ts">
	import SkeletonText from './SkeletonText.svelte';
	import SkeletonAvatar from './SkeletonAvatar.svelte';

	let {
		items = 3,
		showAvatar = false,
		showActions = false,
		animate = true,
		classNames = ''
	}: {
		items?: number;
		showAvatar?: boolean;
		showActions?: boolean;
		animate?: boolean;
		classNames?: string;
	} = $props();
</script>

<div class="skeleton-list space-y-3 {classNames}">
	{#each Array(items) as _, i}
		<div
			class="skeleton-list-item flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4"
		>
			{#if showAvatar}
				<SkeletonAvatar size="md" {animate} />
			{/if}

			<div class="flex-1 space-y-2">
				<SkeletonText lines={1} width="75%" lineHeight="h-5" {animate} />
				<SkeletonText lines={2} width={['100%', '80%']} lineHeight="h-3" spacing="mb-1" {animate} />
			</div>

			{#if showActions}
				<div class="flex gap-2">
					<div class="h-8 w-8 rounded bg-slate-200 {animate ? 'animate-pulse' : ''}"></div>
					<div class="h-8 w-8 rounded bg-slate-200 {animate ? 'animate-pulse' : ''}"></div>
				</div>
			{/if}
		</div>
	{/each}
</div>
