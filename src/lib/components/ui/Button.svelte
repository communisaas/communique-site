<script lang="ts">
	let {
		variant = 'primary',
		type = 'button',
		cursor = 'pointer',
		classNames = '',
		text = undefined,
		href = undefined,
		rel = undefined,
		buttonElement = $bindable(),
		testId = undefined,
		disabled = false,
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
		text?: string | undefined;
		href?: string | undefined;
		rel?: string | undefined;
		buttonElement?: HTMLButtonElement | undefined;
		testId?: string | undefined;
		disabled?: boolean;
		onclick?: (event: MouseEvent) => void;
		onmouseover?: (event: MouseEvent) => void;
		onmouseenter?: (event: MouseEvent) => void;
		onmouseleave?: (event: MouseEvent) => void;
		onfocus?: (event: FocusEvent) => void;
		onblur?: (event: FocusEvent) => void;
		children?: import('svelte').Snippet;
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
		data-testid={testId}
		class="flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-medium transition-all duration-200 sm:text-base cursor-{cursor} select-none no-underline {classNames}"
		aria-label={text}
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
		{#if !children && text}{text}{/if}
	</a>
{:else}
	<button
		bind:this={buttonElement}
		{type}
		{disabled}
		data-testid={testId}
		class="flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-medium transition-all duration-200 sm:text-base cursor-{cursor} {classNames}"
		aria-label={text}
		class:bg-blue-600={variant === 'primary' && !disabled}
		class:bg-gray-300={variant === 'primary' && disabled}
		class:text-white={variant === 'primary'}
		class:hover:bg-blue-700={variant === 'primary' && !disabled}
		class:bg-white={variant === 'secondary' && !disabled}
		class:bg-gray-100={variant === 'secondary' && disabled}
		class:text-blue-600={variant === 'secondary' && !disabled}
		class:text-gray-400={variant === 'secondary' && disabled}
		class:border={variant === 'secondary'}
		class:border-blue-200={variant === 'secondary' && !disabled}
		class:border-gray-200={variant === 'secondary' && disabled}
		class:hover:border-blue-300={variant === 'secondary' && !disabled}
		class:opacity-50={disabled}
		class:cursor-not-allowed={disabled}
		{onclick}
		{onmouseover}
		{onmouseenter}
		{onmouseleave}
		{onfocus}
		{onblur}
	>
		{@render children?.()}
		{#if !children && text}{text}{/if}
	</button>
{/if}
