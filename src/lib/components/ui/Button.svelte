<script lang="ts">
	let { 
		variant = 'primary',
		type = 'button',
		cursor = 'pointer',
		classNames = '',
		href = undefined,
		rel = undefined,
		buttonElement = $bindable(),
		onclick,
		onmouseover,
		onmouseenter,
		onmouseleave,
		onfocus,
		onblur,
		children
	}: {
		variant?: 'primary' | 'secondary';
		type?: 'button' | 'submit';
		cursor?: 'default' | 'help' | 'alias' | 'pointer';
		classNames?: string;
		href?: string | undefined;
		rel?: string | undefined;
		buttonElement?: HTMLButtonElement | undefined;
		onclick?: (event: MouseEvent) => void;
		onmouseover?: (event: MouseEvent) => void;
		onmouseenter?: (event: MouseEvent) => void;
		onmouseleave?: (event: MouseEvent) => void;
		onfocus?: (event: FocusEvent) => void;
		onblur?: (event: FocusEvent) => void;
		children?: unknown;
	} = $props();

	// Event forwarding handled through on: directives

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
		{onclick}
		{onmouseover}
		{onmouseenter}
		{onmouseleave}
		{onfocus}
		{onblur}
	>
		{@render children?.()}
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
		{onclick}
		{onmouseover}
		{onmouseenter}
		{onmouseleave}
		{onfocus}
		{onblur}
	>
		{@render children?.()}
	</button>
{/if}
