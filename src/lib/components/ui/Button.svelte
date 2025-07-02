<script lang="ts">
	export let variant: 'primary' | 'secondary' = 'primary';
	export let type: 'button' | 'submit' = 'button';
	export let cursor: 'default' | 'help' | 'alias' | 'pointer' = 'pointer';
	export let classNames: string = '';
	export let href: string | undefined = undefined;
	export let rel: string | undefined = undefined;

	// Forward the button element reference with a different name
	export let buttonElement: HTMLButtonElement | undefined = undefined;

	// Forward all events
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

	interface $$Slots {
		default: Record<string, never>;
		trigger?: Record<string, never>;
	}
</script>

{#if href}
	<a
		{href}
		{rel}
		target={href.startsWith('mailto:') ? undefined : '_blank'}
		class="flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-medium transition-all duration-200 sm:text-base cursor-{cursor} select-none no-underline {classNames}"
		class:bg-blue-600={variant === 'primary'}
		class:text-white={variant === 'primary'}
		class:hover:bg-blue-700={variant === 'primary'}
		class:bg-white={variant === 'secondary'}
		class:text-blue-600={variant === 'secondary'}
		class:border={variant === 'secondary'}
		class:border-blue-200={variant === 'secondary'}
		class:hover:border-blue-300={variant === 'secondary'}
		on:click={(e) => {
			// Let browser handle mailto links naturally - no preventDefault needed
			dispatch('click', e);
		}}
		on:mouseover
		on:mouseenter
		on:mouseleave
		on:focus
		on:blur
	>
		<slot />
	</a>
{:else}
	<button
		bind:this={buttonElement}
		{type}
		class="flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-medium transition-all duration-200 sm:text-base cursor-{cursor} {classNames}"
		class:bg-blue-600={variant === 'primary'}
		class:text-white={variant === 'primary'}
		class:hover:bg-blue-700={variant === 'primary'}
		class:bg-white={variant === 'secondary'}
		class:text-blue-600={variant === 'secondary'}
		class:border={variant === 'secondary'}
		class:border-blue-200={variant === 'secondary'}
		class:hover:border-blue-300={variant === 'secondary'}
		on:click
		on:mouseover
		on:mouseenter
		on:mouseleave
		on:focus
		on:blur
	>
		<slot />
	</button>
{/if}
