<script lang="ts">
	interface Props {
		size?: 'sm' | 'md' | 'lg';
		color?: 'blue' | 'slate' | 'white';
	}

	const { size = 'md', color = 'blue' }: Props = $props();

	const sizeClasses = {
		sm: 'h-4 w-4',
		md: 'h-8 w-8',
		lg: 'h-12 w-12'
	};

	const colorClasses = {
		blue: 'text-blue-600',
		slate: 'text-slate-400',
		white: 'text-white'
	};
</script>

<div
	class="loading-spinner {sizeClasses[size]} {colorClasses[color]}"
	role="status"
	aria-label="Loading"
>
	<svg class="animate-spin" fill="none" viewBox="0 0 24 24">
		<!-- Swiss-inspired geometric loading pattern -->
		<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
		<path
			class="opacity-75"
			fill="currentColor"
			d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
		/>
		<!-- Bauhaus-inspired geometric accent -->
		<rect class="animate-pulse opacity-50" x="11" y="2" width="2" height="4" fill="currentColor" />
	</svg>
</div>

<style>
	.loading-spinner {
		@apply inline-block;
	}

	.animate-spin {
		animation: spin 1.2s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
