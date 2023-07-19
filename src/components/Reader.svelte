<script lang="ts">
	import { onMount, afterUpdate, beforeUpdate, createEventDispatcher } from 'svelte';
	import type { Writable } from 'svelte/store';
	import DOMPurify from 'dompurify';

	export let expand = true;
	export let inModal = false;
	export let item: string;

	let expandable: HTMLElement;
	let focusableElements: NodeListOf<Element>;
	let lastFocusableElement: HTMLElement;

	let store: Writable<UserState>;
	const dispatch = createEventDispatcher();

	onMount(async () => {
		store = (await import('$lib/data/sessionStorage')).store;
		expandable.scrollTop = 0;
	});

	beforeUpdate(() => {
		// Remove the blur event listener from the last focusable element
		if (lastFocusableElement) {
			lastFocusableElement.removeEventListener('blur', transferFocus);
		}
	});
	afterUpdate(() => {
		focusableElements = expandable.querySelectorAll(
			'a, button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
		);
		focusableElements.forEach((element: Element) => {
			if (expand) {
				element.removeAttribute('tabindex');
			} else {
				element.setAttribute('tabindex', '-1');
			}
		});
		// Add a blur event listener to each focusable element
		focusableElements.forEach((element: Element) => {
			(element as HTMLElement).addEventListener('blur', transferFocus);
		});
	});

	function transferFocus(event: FocusEvent) {
		if (!expandable.contains(event.relatedTarget as Node)) {
			expand = false; // set expand to false if the focus is outside of the expandable element
		}
	}

	function setPopover(value: boolean) {
		dispatch('popover', value);
	}
</script>

<section class="flex flex-col gap-2 markdown-content {inModal ? 'm-10 ' : 'w-full'}">
	<aside
		tabindex="-1"
		style="text-align: initial;"
		class="
		{expand ? 'bg-artistBlue-800 p-5' : 'mt-[1.5rem]'} 
		{inModal ? ' overflow-auto max-h-[80vh] bg-artistBlue-800' : 'mt-6 w-full max-h-fit'}
		rounded appearance-none"
		bind:this={expandable}
	>
		<div
			tabindex="-1"
			aria-label="content"
			style="max-height: {expand
				? 'fit-content'
				: inModal
				? 'fit-content'
				: '11rem'}; pointer-events: {expand ? 'auto' : 'none'}"
		>
			{@html DOMPurify.sanitize(item)}
		</div>
	</aside>
	{#if inModal}
		<button class="w-full h-10" on:click={() => setPopover(false)}> Close </button>
	{/if}
</section>

<style lang="scss">
	button {
		background: rgba(255, 255, 255, 0.15);
		border-radius: 0 0 16px 16px;
		box-shadow: 0 1px 2px 1px rgba(0, 0, 0, 0.1);
		padding: 2px 5px;
		transition: ease-in-out 0.1s;

		&:hover {
			background: rgba(255, 255, 255, 0.25);
			transform: translateY(-1px);
		}
		&:active {
			transform: translateY(1px);
			background: rgba(255, 255, 255, 0.15);
		}
	}
</style>
