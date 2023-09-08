<script lang="ts">
	import { createEventDispatcher, onMount, type DispatchOptions } from 'svelte/internal';
	import type { Writable } from 'svelte/store';
	export let item: string;
	export let selected: Selectable;
	export let style = '';

	let store: Writable<UserState>;

	const dispatch = createEventDispatcher();

	let tag: HTMLButtonElement;
	let canvas: HTMLCanvasElement, context: CanvasRenderingContext2D;
	let tagWidth: number;
	$: context ? (tagWidth = context.measureText(item).width + 20) : null,
		onMount(async () => {
			store = (await import('$lib/data/sessionStorage')).store;

			canvas = document.createElement('canvas');
			context = canvas.getContext('2d') as CanvasRenderingContext2D;
			if (context && tag) {
				context.font = getComputedStyle(tag).font;
				tagWidth = context.measureText(item).width + 20;
			}
		});

	function handleSelect() {
		if (selected.id != item) {
			selected.id = item;
		}
		dispatch('select', selected);
	}
</script>

<span class="max-w-fit">
	<button
		aria-label={item}
		class="cursor-pointer text-center px-2 py-1 rounded overflow-visible {style} "
		style:width="{tagWidth}px"
		bind:this={tag}
		on:click|stopPropagation={() => {
			handleSelect();
		}}
		on:keypress|stopPropagation={(e) => {
			if (e.key === 'Enter') {
				handleSelect();
			}
		}}
		on:blur
	>
		{item}
	</button>
</span>

<style lang="scss">
	button {
		margin: 0;
		transition: 0.1s ease-in;
		&:hover {
			margin-top: -0.25rem;
			box-shadow: rgba(0, 0, 0, 0.16) 0 1px 4px;

			transition: 0.1s ease-in;
		}
		&:active {
			margin-top: 0;
			transition: 0.1s ease-in;
		}
	}
</style>
