<script lang="ts">
	import SkeletonText from './SkeletonText.svelte';

	let { 
		animate = true,
		variant: variantProp = 'list',
		classNames = ''
	}: {
		animate?: boolean;
		variant?: 'list' | 'preview' | 'compact';
		classNames?: string;
	} = $props();
</script>

{#if variantProp === 'list'}
	<!-- Template List Item Skeleton -->
	<div class="template-skeleton rounded-lg border-2 border-l-4 border-slate-200 p-3 md:p-4 {classNames}">
		<div class="flex items-start justify-between gap-3">
			<div class="min-w-0 flex-1 space-y-3">
				<!-- Badges -->
				<div class="flex items-center gap-2">
					<div class="h-6 w-24 rounded-full bg-slate-200 {animate ? 'animate-pulse' : ''}"></div>
					<div class="h-6 w-16 rounded bg-slate-100 {animate ? 'animate-pulse' : ''}"></div>
				</div>

				<!-- Title -->
				<SkeletonText 
					lines={1} 
					width="75%" 
					lineHeight="h-5"
					{animate}
				/>

				<!-- Description -->
				<SkeletonText 
					lines={2} 
					width={['100%', '85%']}
					lineHeight="h-3"
					spacing="mb-1"
					{animate}
				/>

				<!-- Metrics -->
				<div class="flex items-center gap-4 pt-2">
					<div class="flex items-center gap-1">
						<div class="h-3 w-3 rounded-full bg-slate-200 {animate ? 'animate-pulse' : ''}"></div>
						<div class="h-3 w-8 rounded bg-slate-100 {animate ? 'animate-pulse' : ''}"></div>
					</div>
					<div class="flex items-center gap-1">
						<div class="h-3 w-3 rounded-full bg-slate-200 {animate ? 'animate-pulse' : ''}"></div>
						<div class="h-3 w-12 rounded bg-slate-100 {animate ? 'animate-pulse' : ''}"></div>
					</div>
				</div>
			</div>

			<!-- Chevron for mobile -->
			<div class="h-5 w-5 rounded bg-slate-200 md:hidden {animate ? 'animate-pulse' : ''}"></div>
		</div>
	</div>

{:else if variantProp === 'preview'}
	<!-- Template Preview Skeleton -->
	<div class="template-skeleton-preview rounded-xl border border-slate-200 bg-white p-6 {classNames}">
		<!-- Header -->
		<div class="mb-6">
			<SkeletonText lines={1} width="66%" lineHeight="h-7" {animate} />
			<div class="mt-3">
				<SkeletonText lines={1} width="40%" lineHeight="h-4" {animate} />
			</div>
		</div>

		<!-- Body -->
		<div class="space-y-3 mb-6">
			<SkeletonText lines={5} width={['100%', '95%', '100%', '80%', '90%']} {animate} />
		</div>

		<!-- Action Button -->
		<div class="h-12 w-32 rounded-lg bg-blue-100 {animate ? 'animate-pulse' : ''}"></div>
	</div>

{:else if variantProp === 'compact'}
	<!-- Compact Template Skeleton -->
	<div class="template-skeleton-compact flex items-center gap-3 p-3 bg-slate-50 rounded-lg {classNames}">
		<div class="flex-1">
			<SkeletonText lines={1} width="60%" lineHeight="h-4" {animate} />
			<div class="flex items-center gap-2 mt-1">
				<div class="h-5 w-16 rounded bg-slate-200 {animate ? 'animate-pulse' : ''}"></div>
				<SkeletonText lines={1} width="30%" lineHeight="h-3" {animate} />
			</div>
		</div>
		<div class="h-8 w-16 rounded bg-slate-200 {animate ? 'animate-pulse' : ''}"></div>
	</div>
{/if}

<style>
	.template-skeleton {
		border-left-color: theme('colors.slate.300');
	}
</style>