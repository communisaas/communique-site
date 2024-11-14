<script lang="ts">
    export let variant: 'primary' | 'secondary' = 'primary';
    export let type: 'button' | 'submit' = 'button';
    export let cursor: 'default' | 'help' | 'alias' | 'pointer' = 'pointer';
    export let classNames: string = '';
    export let href: string | undefined = undefined;
    export let rel: string | undefined = undefined;

    // Forward the button element reference with a different name
    export let buttonElement: HTMLButtonElement | undefined = undefined;

    interface $$Slots {
        default: Record<string, never>;
        trigger?: Record<string, never>;
    }
</script>

{#if href}
    <a
        {href}
        {rel}
        target={href.startsWith('mailto:') ? undefined : "_blank"}
        class="px-6 py-3 sm:text-base text-sm rounded-lg font-medium flex items-center justify-center gap-2 transition-all duration-200 cursor-{cursor} no-underline select-none {classNames}"
        class:bg-blue-600={variant === 'primary'}
        class:text-white={variant === 'primary'}
        class:hover:bg-blue-700={variant === 'primary'}
        class:bg-white={variant === 'secondary'}
        class:text-blue-600={variant === 'secondary'}
        class:border={variant === 'secondary'}
        class:border-blue-200={variant === 'secondary'}
        class:hover:border-blue-300={variant === 'secondary'}
        on:click={(e) => {
            if (href?.startsWith('mailto:')) {
                e.preventDefault();
                window.location.href = href;
            }
        }}
    >
        <slot />
    </a>
{:else}
    <button
        bind:this={buttonElement}
        {type}
        class="px-6 py-3 sm:text-base text-sm rounded-lg font-medium flex items-center justify-center gap-2 transition-all duration-200 cursor-{cursor} {classNames}"
        class:bg-blue-600={variant === 'primary'}
        class:text-white={variant === 'primary'}
        class:hover:bg-blue-700={variant === 'primary'}
        class:bg-white={variant === 'secondary'}
        class:text-blue-600={variant === 'secondary'}
        class:border={variant === 'secondary'}
        class:border-blue-200={variant === 'secondary'}
        class:hover:border-blue-300={variant === 'secondary'}
    >
        <slot />
    </button>
{/if}
