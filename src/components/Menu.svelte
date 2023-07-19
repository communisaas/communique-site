<script lang="ts">
	import { trapFocus, updateFocusableElements } from '$lib/ui/ux';
	import { onMount, afterUpdate } from 'svelte';
	import { expoIn, expoOut, quintOut } from 'svelte/easing';
	import { fade, slide } from 'svelte/transition';

	let menu: HTMLElement;
	let focusableElements: HTMLElement[];
	let firstFocusableElement: HTMLElement;
	let lastFocusableElement: HTMLElement;

	onMount(() => {
		[focusableElements, firstFocusableElement, lastFocusableElement] = updateFocusableElements(
			menu
		) as [HTMLElement[], HTMLElement, HTMLElement];
		trapFocus(menu, firstFocusableElement, lastFocusableElement, focusableElements);
	});

	afterUpdate(() => {
		[focusableElements, firstFocusableElement, lastFocusableElement] = updateFocusableElements(
			menu
		) as [HTMLElement[], HTMLElement, HTMLElement];
	});
</script>

<aside
	class="menu rounded absolute top-0 left-0 min-h-full min-w-full z-20 flex justify-center"
	in:fade={{ delay: 25, duration: 300, easing: expoIn }}
	out:fade={{ delay: 50, duration: 300, easing: expoOut }}
	on:mouseenter
	on:mouseleave
>
	<div
		role="menu"
		tabindex="0"
		on:click|stopPropagation
		on:keypress|stopPropagation
		class="pt-[0.75rem] w-full"
	>
		<ul
			bind:this={menu}
			transition:slide={{ delay: 50, axis: 'x', easing: quintOut }}
			class="flex flex-col gap-y-2"
		>
			<slot />
		</ul>
	</div>
</aside>

<style lang="scss">
	.menu {
		background: rgba(0, 0, 0, 0.2);
		backdrop-filter: blur(8px);
		cursor: initial;
		overflow: hidden;
	}
</style>
