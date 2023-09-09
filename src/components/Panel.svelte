<script lang="ts">
	import Selector from './Selector.svelte';
	import { createEventDispatcher, onMount, type ComponentType } from 'svelte';
	import type { Writable } from 'svelte/store';
	import TagInput from './input/Tag.svelte';
	import { debounce, fetchSearchResults, handleSelect } from '$lib/data/select';

	export let header: string;
	export let alignment: 'start' | 'end' | 'center' | 'justify' | 'match-parent';

	export let selectable: ComponentType;
	export let selectorTarget: 'topic' | 'recipient' | 'spotlight';
	export let selected: Selectable;
	export let initialSelection: Descriptor<string>;
	export let items: Selectable[];
	export let filterable = false;
	let searchResults: Descriptor<string>[] = [];

	const dispatch = createEventDispatcher();

	let store: Writable<UserState>;
	let selectionList: Descriptor<string>[] = [initialSelection];

	let lastItems: Selectable[] = [];
	let oldInitialSelection: Descriptor<string> = initialSelection;
	let lastSelection: Descriptor<string> = initialSelection;

	$: if (initialSelection !== oldInitialSelection) {
		selectionList = [initialSelection];
		oldInitialSelection = initialSelection;
	}

	async function handleAutocomplete(e: CustomEvent<string>) {
		try {
			searchResults = (
				(await debounce(600, fetchSearchResults, e.detail, fetch)) as QueryResult[]
			).map((result) => {
				let fieldName: string,
					iterable = false;
				switch (result.source) {
					case 'recipient':
						fieldName = 'recipient_list';
						iterable = true;
						break;
					case 'topic':
						fieldName = 'topic_list';
						iterable = true;
						break;
					case 'email':
						fieldName = 'subject';
						iterable = false;
						break;
					default: {
						throw new Error('Invalid source type');
					}
				}
				return {
					type: result.source === 'recipient' ? 'email' : 'topic',
					item: result.id,
					field: fieldName,
					iterable: iterable,
					source: result.source
				} as Descriptor<string>;
			});
		} catch (error) {
			console.error('Error in fetching search results:', error);
		}
	}

	async function handleFilter(e) {
		// Grouping by fields
		const grouped = selectionList.reduce((accumulator: Descriptor<string>, { item, source }) => {
			if (!accumulator[source]) accumulator[source] = [];
			accumulator[source].push(item);
			return accumulator;
		}, {} as Descriptor<string>);

		// Construct the query string from the grouped object
		const tagString = Object.entries(grouped)
			.map(([field, items]) => `${field}=${encodeURIComponent(items.join('␞'))}`)
			.join('&');
		return await (await fetch(`data/email?${tagString}`)).json();
	}

	onMount(async () => {
		store = (await import('$lib/data/sessionStorage')).store;
	});
</script>

<section class="flex flex-col relative px-5 gradient-background h-full">
	<aside class="flex pb-3" style="justify-content: {alignment}">
		{#if filterable && selectorTarget != 'spotlight'}
			<h1
				class="text-paper-500 h-fit self-center justify-self-start mx-2 my-1"
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
						autocomplete={true}
						bind:tagList={selectionList}
						bind:searchResults
						on:autocomplete={async (e) => {
							handleAutocomplete(e);
						}}
						on:delete={async (e) => {
							lastSelection = e.detail;
							lastItems = items;
							items = await handleFilter(e);
						}}
						on:add={async (e) => {
							items = await handleFilter(e);
						}}
						on:blur={() => {
							if (selectionList.length < 1) {
								selectionList = [lastSelection];
								items = lastItems;
							}
						}}
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
		selectorStyle="flex-col items-center min-h-[13rem] max-w-7xl m-auto"
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
		display: flex;
		height: 100%;
	}

	.tab {
		filter: drop-shadow(1px 2px 1px theme('colors.artistBlue.500'));
		position: relative;
		z-index: 20;
		&__start {
			margin-left: -1.25rem;
			align-items: start;
			& .space {
				padding: 0.5em 0;
				padding-right: 2em;
				justify-content: center;
				&::before {
					content: '';
					position: absolute;
					top: 0;
					left: 0;
					right: 0;
					bottom: 0;
					width: 100%;
					clip-path: polygon(0 0, 100% 0, 90% 100%, 0 100%);

					background-color: theme('colors.peacockFeather.700');
				}
			}
		}
		&__end {
			margin-right: -1.25rem;
			& .space {
				padding: 0.5em 1.25em;
				padding-left: 0.5em;
				align-items: center;

				&::before {
					content: '';
					position: absolute;
					top: 0;
					left: 0;
					right: 0;
					bottom: 0;
					width: 100%;
					clip-path: polygon(0 0, 100% 0, 100% 100%, 2em 100%);
					background-color: theme('colors.peacockFeather.700');
				}
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
