<script lang="ts">
	import { trapFocus, updateFocusableElements } from '$lib/ui/ux';
	import { onMount, afterUpdate, onDestroy } from 'svelte';
	import { flip } from 'svelte/animate';
	import { expoIn, expoOut, quintOut } from 'svelte/easing';
	import { writable } from 'svelte/store';
	import { fade, fly, scale, slide } from 'svelte/transition';

	export let items: MenuItem[];

	let menu: HTMLElement;
	let focusableElements = writable<HTMLElement[]>([]);
	let firstFocusableElement = writable<HTMLElement | null>(null);
	let lastFocusableElement = writable<HTMLElement | null>(null);

	let focusHandler: (e: KeyboardEvent) => void;

	onMount(() => {
		const [focusElems, firstElem, lastElem] = updateFocusableElements(menu) as [
			HTMLElement[],
			HTMLElement,
			HTMLElement
		];
		focusableElements.set(focusElems);
		firstFocusableElement.set(firstElem);
		lastFocusableElement.set(lastElem);

		firstFocusableElement.update((first) => {
			if (first) {
				first.focus();
				return null;
			}
			return first;
		});

		focusHandler = (e) => {
			trapFocus(e, $focusableElements);
		};

		menu.addEventListener('keydown', focusHandler);
	});

	afterUpdate(() => {
		const [focusElems, firstElem, lastElem] = updateFocusableElements(menu) as [
			HTMLElement[],
			HTMLElement,
			HTMLElement
		];
		focusableElements.set(
			focusElems.filter((element) => {
				const shownItems = items.filter((item) => item.show && item.key).map((item) => item.key);
				if (shownItems.includes(element.id)) return element;
			})
		);
	});

	onDestroy(() => {
		menu.removeEventListener('keydown', focusHandler);
	});
</script>

<aside
	class="menu rounded absolute top-0 left-0 min-h-full min-w-full z-20 flex justify-center"
	in:fade={{ delay: 25, duration: 300, easing: expoIn }}
	out:fade={{ delay: 50, duration: 300, easing: expoOut }}
	on:mouseenter
	on:mouseleave
	on:click|preventDefault
	on:keypress|preventDefault
>
	<section role="menu" tabindex="0" class="pt-[0.75rem] w-full">
		<div
			bind:this={menu}
			transition:slide={{ delay: 50, axis: 'x', easing: quintOut }}
			class="flex flex-col gap-y-2"
		>
			{#each items.filter((item) => item.show) as item, index (item.key)}
				<button
					class={item.class}
					id={item.key}
					animate:flip={{ delay: 0, duration: 250, easing: quintOut }}
					out:fly={{
						delay: 0,
						duration: 250,
						x: 500,
						easing: quintOut
					}}
					in:fade={{ delay: 0, duration: 250, easing: expoIn }}
					on:click|stopPropagation={(e) => {
						item.onClick({ event: e, focusableElements: $focusableElements });
					}}
					on:keypress={(e) => {
						if (e.key === 'Enter') {
							item.onClick({ event: e, focusableElements: $focusableElements });
						}
					}}
					on:blur
				>
					<span transition:scale={{ delay: 50, duration: 250, easing: expoIn }}>
						{item.name}
					</span>
					{#if item.actionToggled && item.actionComponent !== undefined}
						<svelte:component this={item.actionComponent} />
					{/if}
				</button>
			{/each}
		</div>
	</section>
</aside>

<style lang="scss">
	.menu {
		background: rgba(0, 0, 0, 0.2);
		backdrop-filter: blur(8px);
		cursor: initial;
		overflow: hidden;
		&__item {
			min-width: 200%;
			background-color: theme('colors.peacockFeather.500');
			padding: 0.33em;
			margin-top: 0.5em;
			margin-left: -50%;
			cursor: pointer;
			transition: ease-in-out 0.2s;
			&--close {
				margin-top: 2em;
				background-color: theme('colors.peacockFeather.600');
			}
		}
		&__item:hover {
			transform: scale(1.08);
		}
		&__item:active {
			transform: scale(0.92);
		}
	}
</style>
