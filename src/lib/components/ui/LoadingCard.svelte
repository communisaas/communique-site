<script lang="ts">
	export let variant: 'template' | 'message' | 'compact' = 'template';
	export let animate: boolean = true;
</script>

<div class="loading-card" class:animate>
	{#if variant === 'template'}
		<!-- Template List Item Loading State -->
		<div class="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
			<!-- Header -->
			<div class="flex items-start justify-between">
				<div class="flex-1 space-y-3">
					<div class="loading-bar h-6 w-3/4 bg-slate-200"></div>
					<div class="loading-bar h-4 w-1/2 bg-slate-100"></div>
				</div>
				<div class="loading-circle h-8 w-8 rounded-full bg-slate-200"></div>
			</div>

			<!-- Content Lines -->
			<div class="space-y-2">
				<div class="loading-bar h-4 w-full bg-slate-100"></div>
				<div class="loading-bar h-4 w-5/6 bg-slate-100"></div>
				<div class="loading-bar h-4 w-4/5 bg-slate-100"></div>
			</div>

			<!-- Metrics -->
			<div class="flex items-center space-x-6 border-t border-slate-100 pt-4">
				<div class="flex items-center space-x-2">
					<div class="loading-circle h-4 w-4 rounded-full bg-slate-200"></div>
					<div class="loading-bar h-3 w-12 bg-slate-100"></div>
				</div>
				<div class="flex items-center space-x-2">
					<div class="loading-circle h-4 w-4 rounded-full bg-slate-200"></div>
					<div class="loading-bar h-3 w-16 bg-slate-100"></div>
				</div>
			</div>
		</div>
	{:else if variant === 'message'}
		<!-- Message Preview Loading State -->
		<div class="space-y-6 rounded-lg border border-slate-200 bg-white p-8">
			<!-- Header -->
			<div class="space-y-4">
				<div class="loading-bar h-8 w-2/3 bg-slate-200"></div>
				<div class="loading-bar h-5 w-1/3 bg-slate-100"></div>
			</div>

			<!-- Message Body -->
			<div class="space-y-3">
				<div class="loading-bar h-4 w-full bg-slate-100"></div>
				<div class="loading-bar h-4 w-11/12 bg-slate-100"></div>
				<div class="loading-bar h-4 w-full bg-slate-100"></div>
				<div class="loading-bar h-4 w-3/4 bg-slate-100"></div>
				<div class="loading-bar h-4 w-5/6 bg-slate-100"></div>
				<div class="loading-bar h-4 w-2/3 bg-slate-100"></div>
			</div>

			<!-- Action Area -->
			<div class="border-t border-slate-100 pt-6">
				<div class="loading-bar h-12 w-32 rounded-md bg-blue-100"></div>
			</div>
		</div>
	{:else if variant === 'compact'}
		<!-- Compact Loading State -->
		<div class="flex items-center space-x-3 p-4">
			<div class="loading-circle h-10 w-10 rounded-lg bg-slate-200"></div>
			<div class="flex-1 space-y-2">
				<div class="loading-bar h-4 w-3/4 bg-slate-200"></div>
				<div class="loading-bar h-3 w-1/2 bg-slate-100"></div>
			</div>
		</div>
	{/if}
</div>

<style>
	.loading-card {
		@apply relative overflow-hidden;
	}

	.loading-bar,
	.loading-circle {
		@apply relative overflow-hidden;
		background: linear-gradient(
			90deg,
			theme('colors.slate.200') 0%,
			theme('colors.slate.100') 50%,
			theme('colors.slate.200') 100%
		);
	}

	.loading-card.animate .loading-bar::before,
	.loading-card.animate .loading-circle::before {
		content: '';
		@apply absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent;
		animation: shimmer 1.8s ease-in-out infinite;
		transform: translateX(-100%);
	}

	@keyframes shimmer {
		0% {
			transform: translateX(-100%);
		}
		50% {
			transform: translateX(0%);
		}
		100% {
			transform: translateX(100%);
		}
	}

	/* Swiss/Bauhaus inspired timing - mathematical progression */
	.loading-card.animate .loading-bar:nth-child(1)::before {
		animation-delay: 0ms;
	}
	.loading-card.animate .loading-bar:nth-child(2)::before {
		animation-delay: 150ms;
	}
	.loading-card.animate .loading-bar:nth-child(3)::before {
		animation-delay: 300ms;
	}
	.loading-card.animate .loading-bar:nth-child(4)::before {
		animation-delay: 450ms;
	}
	.loading-card.animate .loading-bar:nth-child(5)::before {
		animation-delay: 600ms;
	}
	.loading-card.animate .loading-bar:nth-child(6)::before {
		animation-delay: 750ms;
	}
</style>
