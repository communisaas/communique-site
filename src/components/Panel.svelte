<script lang="ts">
	import Selector from './Selector.svelte';
	import { createEventDispatcher, onMount, type ComponentType } from 'svelte';
	import type { Writable } from 'svelte/store';
	import TagInput from './input/Tag.svelte';

	export let header: string;
	export let alignment: 'start' | 'end' | 'center' | 'justify' | 'match-parent';

	export let selectable: ComponentType;
	export let selector: ComponentType;
	export let selectorTarget: 'topic' | 'recipient' | 'spotlight';
	export let selected: Selectable;
	export let initialSelection: string;
	export let items: Selectable[];
	export let filterable = false;

	const dispatch = createEventDispatcher();

	let store: Writable<UserState>;

	onMount(async () => {
		store = (await import('$lib/data/sessionStorage')).store;
	});
</script>

<section class="flex flex-col relative pb-5 px-5 gradient-background">
	<aside class="flex pb-3" style="justify-content: {alignment}">
		{#if filterable && selectorTarget != 'spotlight'}
			<h1
				class="text-paper-500 h-fit self-center justify-self-start"
				style="background-color: transparent; padding: unset"
			>
				{header}
			</h1>
		{/if}
		<div class="tab tab__{alignment}">
			<span class="space">
				{#if filterable && selectorTarget != 'spotlight'}
					<TagInput
						type="search"
						name="search item"
						placeholder={'Search'}
						style="h-14 w-fit bg-transparent"
						tagStyle="text-xl underline font-bold bg-transparent rounded px-2 pr-1 text-paper-500"
						addIconStyle="add bg-peacockFeather-500 h-12 w-12 text-5xl inline-block leading-12"
						tagList={[initialSelection]}
					/>
				{:else}
					<h1 class="text-paper-500">
						{header + ' ' + initialSelection}
					</h1>
				{/if}
			</span>
		</div>
	</aside>
	<span class="control">
		<slot />
	</span>
	<Selector
		{selectable}
		{items}
		alignment="center"
		selectorStyle="flex-col min-h-[13rem]"
		target={selected.type}
		scrollable={false}
		bind:selectedContent={selected}
		on:select={async (e) => {
			if (e.detail.type === selected.type) {
			} else if (e.detail.type === 'topic' || e.detail.type === 'recipient') {
				window.scrollTo({ top: 0, behavior: 'smooth' }); // TODO handle this in parent page component
				dispatch('select', e.detail);
			} else {
				dispatch('select', e.detail);
			}
		}}
		on:externalAction
		on:blur
	/>
</section>

<style lang="scss">
	section {
		transition: all 0.5s ease-in-out;
	}
	h1 {
		text-align: right;
		vertical-align: middle;
		padding: 0 1rem;
	}

	.space {
		background-color: theme('colors.peacockFeather.700');
		display: flex;
	}

	.tab {
		filter: drop-shadow(1px 2px 1px theme('colors.artistBlue.500'));
		&__start {
			margin-left: -1.25rem;
			align-items: start;
			& .space {
				clip-path: polygon(0 0, 100% 0, 90% 100%, 0 100%);
				padding: 0.5em 0;
				padding-right: 2em;
				justify-content: center;
			}
		}
		&__end {
			margin-right: -1.25rem;
			& .space {
				padding: 0.5em 1.25em;
				padding-left: 0.5em;
				justify-content: start;
				align-items: center;
				clip-path: polygon(0 0, 100% 0, 100% 100%, 2em 100%);
			}
		}
	}

	.gradient-background {
		background: linear-gradient(
			90deg,
			theme('colors.peacockFeather.600'),
			theme('colors.teal.700')
		);
		background-repeat: no-repeat;
	}
</style>
