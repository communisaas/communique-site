<script lang="ts">
	import type { email } from '@prisma/client';
	import { createEventDispatcher, onMount, afterUpdate, tick } from 'svelte';
	import Selector from './Selector.svelte';
	import Tag from './Tag.svelte';
	import Reader from './Reader.svelte';
	import RecipientIcon from './icon/Recipient.svelte';
	import SentIcon from './icon/Sent.svelte';
	import MenuIcon from './icon/Menu.svelte';
	import { scale, fade, slide, fly } from 'svelte/transition';
	import { expoIn, expoOut, quintOut } from 'svelte/easing';
	import Menu from './Menu.svelte';
	import { handleCopy } from '$lib/data/select';
	import { page } from '$app/stores';
	import type { Writable } from 'svelte/store';
	import Preferences from './input/Preferences.svelte';

	export let item: email;
	export let selected: Selectable;
	export let style = '';

	let sessionStore: Writable<UserState>;

	$: scrollPosition = {
		header: { x: 0, remainingWidth: 0, startX: 0, startScrollLeft: 0 },
		card: { x: 0, remainingWidth: 0, startX: 0, startScrollLeft: 0 }
	};
	let header: HTMLHeadingElement;
	let card: HTMLButtonElement;
	let menu: HTMLElement;
	let scrollableElements: { [key: string]: HTMLElement };
	// state
	let scrollToCard = false;
	let expand = false;
	let nestedHover = false;
	let activationState: 'click' | 'focus' | null = null;
	let showMenu = false;
	let menuItems = [
		{
			name: 'Get link',
			key: 'copy',
			class: 'menu__item',
			show: true,
			actionToggled: false,
			actionComponent: undefined,

			onClick: async () => {
				await handleCopy('link', $page.url.host + '/' + item.shortid);
				menuItems[0].name = 'Copied!';
				setTimeout(() => {
					menuItems[0].name = 'Get link';
				}, 2000);
			}
		},
		{
			name: 'Not interested...',
			key: 'interest',
			class: 'menu__item',
			show: true,
			actionToggled: false,
			actionComponent: Preferences,

			onClick: () => {
				menuItems = menuItems.map((item) => {
					if (item.key !== 'interest' && item.key !== 'back') {
						item.show = false;
					} else {
						item.show = true;
					}
					return item;
				});
			}
		},
		{
			name: 'Report',
			key: 'moderation',
			class: 'menu__item',
			show: true,
			actionToggled: true,
			actionComponent: undefined,

			onClick: () => {
				menuItems = menuItems.map((item) => {
					if (item.key !== 'moderation' && item.key !== 'back') {
						item.show = false;
					} else {
						item.show = true;
					}
					return item;
				});
			}
		},
		{
			name: 'Close',
			key: 'close',
			class: 'menu__item menu__item--close',
			show: true,
			actionToggled: false,
			actionComponent: undefined,
			onClick: () => {
				card.focus();
				showMenu = false;
				nestedHover = false;
				menuItems = menuItems.map((item) => {
					if (item.key !== 'back') {
						item.show = true;
					} else {
						item.show = false;
					}
					return item;
				});
			}
		},
		{
			name: 'Back',
			key: 'back',
			class: 'menu__item menu__item--close',
			show: false,
			actionToggled: false,
			actionComponent: undefined,
			onClick: ({ focusableElements }: MenuItemClickArgs) => {
				menuItems = menuItems.map((item) => {
					if (item.key !== 'back') {
						item.show = true;
					} else {
						item.show = false;
					}
					return item;
				});
				if (focusableElements) focusableElements[0].focus();
			}
		}
	];

	onMount(async () => {
		sessionStore = (await import('$lib/data/sessionStorage')).store;
	});

	afterUpdate(() => {
		if (scrollToCard) {
			// TODO more contextual fix for resolving pending events after DOM update
			setTimeout(() => {
				card.scrollIntoView({ behavior: 'smooth', block: 'center' });
			});
			scrollToCard = false;
		}
		if (card && header) {
			scrollableElements = { card, header };
			updateScrollableElements(scrollableElements);
		}
	});

	function updateScrollableElements(scrollableElements: { [key: string]: HTMLElement }) {
		for (const [name, element] of Object.entries(scrollableElements)) {
			scrollPosition[name as keyof typeof scrollPosition].remainingWidth =
				element.scrollWidth - element.clientWidth;
		}
	}

	const dispatch = createEventDispatcher();

	function setExpand(value: boolean) {
		expand = value;
		dispatch('expand', expand);
	}

	let justFocused = false;

	async function handleSelect() {
		if (selected.id != item.rowid) {
			selected.id = item.rowid;
		}
		if (expand && !justFocused && !showMenu) {
			dispatch('externalAction', { type: 'email', context: item });
			setExpand(false);
		} else {
			setExpand(true);
			scrollToCard = true;
			$sessionStore.email.id = item.rowid;
			$sessionStore.email.content = item;
		}
		dispatch('select', selected);
	}

	function handleBlur(event: FocusEvent) {
		if (
			(card && card.contains(event.relatedTarget as Node)) ||
			(menu && (event.target as HTMLElement).id === 'back') ||
			(card.contains(event.relatedTarget as Node) &&
				(event.relatedTarget as HTMLElement).classList.contains('menu__item')) ||
			(menu && menu.contains(event.relatedTarget as Node))
		)
			return; // keep expanded if focus is on the card
		setExpand(false);
		if (!expand) {
			header.scrollLeft = 0;
			scrollPosition.header.x = 0;
		} else {
			scrollPosition.header.x = 1;
		}
		showMenu = false;
		activationState = null;
		menuItems = menuItems.map((item) => {
			if (item.key !== 'back') {
				item.show = true;
			} else {
				item.show = false;
			}
			return item;
		});
	}
</script>

<button
	bind:this={card}
	on:focus={() => {
		handleSelect();
		justFocused = true;
		setTimeout(() => {
			justFocused = false;
		}, 350);
	}}
	on:click={() => {
		handleSelect();
	}}
	on:blur={handleBlur}
	aria-label="Email with a subject: {item.subject}"
	class="card flex p-2 m-1 rounded bg-artistBlue-600 items-center relative
		justify-center w-48 {style}"
	class:cursor-alias={expand}
	class:clickable={!nestedHover}
	style="min-width: {expand ? '99%' : '95%'};"
>
	{#if showMenu}
		<div
			bind:this={menu}
			on:click|stopPropagation={async () => {
				if (expand) {
					showMenu = false;
				} else {
					setExpand(true);
					handleSelect();
				} // if menu recently closed but not yet destroyed, still expand the card
			}}
			on:keypress|stopPropagation={(e) => {
				if (e.key === 'Enter') {
					if (expand) {
						showMenu = false;
					} else {
						setExpand(true);
						handleSelect();
					}
				}
			}}
		>
			<Menu on:mouseenter={() => (nestedHover = true)} on:blur={handleBlur} items={menuItems} />
		</div>
	{/if}
	<section
		class="flex flex-col relative {!expand
			? 'cardWrapper'
			: ''} min-w-full min-h-fit overflow-hidden"
	>
		{#if sessionStore}
			<span class="flex max-w-full items-center h-fit relative">
				<h1
					aria-label="Subject line"
					aria-describedby={item.subject}
					title={scrollPosition.header.x > 0 ? item.subject : null}
					bind:this={header}
					on:wheel={(e) => {
						if (scrollPosition.header.remainingWidth > 0) {
							e.stopPropagation();
							e.preventDefault();
							header.scrollLeft += Math.abs(e.deltaX) > 0 ? e.deltaX : e.deltaY * 0.33;
							scrollPosition.header.x = header.scrollLeft;
						}
					}}
					on:touchstart={(e) => {
						if (scrollPosition.header.remainingWidth > 0) {
							scrollPosition.header.startX = e.touches[0].pageX;
							scrollPosition.header.startScrollLeft = header.scrollLeft;
						}
					}}
					on:touchmove={(e) => {
						if (scrollPosition.header.remainingWidth > 0) {
							e.stopPropagation();
							e.preventDefault();
							const x = e.touches[0].pageX;
							const walk = (x - scrollPosition.header.startX) * 2;
							header.scrollLeft = scrollPosition.header.startScrollLeft - walk;
							scrollPosition.header.x = header.scrollLeft;
						}
					}}
					on:touchend={() => {
						if (scrollPosition.header.remainingWidth > 0) {
							scrollPosition.header.startX = 0;
							scrollPosition.header.startScrollLeft = 0;
						}
					}}
					class:scrollable={scrollPosition.header.remainingWidth > 0}
					class:scrolled={scrollPosition.header.x > 1}
					class:scrolled__max={scrollPosition.header.remainingWidth > 0 &&
						scrollPosition.header.remainingWidth == scrollPosition.header.x}
					class=" inline-block mr-1"
				>
					{item.subject}
				</h1>
				{#if expand}
					<button
						title="Menu"
						on:click|stopPropagation={() => {
							showMenu = !showMenu;
						}}
						on:keypress|stopPropagation
						on:mouseenter={() => (nestedHover = true)}
						on:mouseleave={() => (nestedHover = false)}
						class="z-10 max-w-[28px] max-h-fit cursor-context-menu mx-1 hover:scale-125 ease-in-out duration-150"
						in:fade={{ delay: 50, duration: 200, easing: expoIn }}
						out:scale={{ delay: 50, duration: 300, easing: expoOut }}
					>
						<MenuIcon />
					</button>
				{/if}
			</span>
			<article
				class="flex grow justify-between min-w-full h-full flex-col"
				class:md:flex-row={!expand}
			>
				<div class="flex flex-col min-h-full">
					<div class="stats p-1 flex flex-row gap-x-5">
						<span title="Read count" aria-label="Number of reads" class="flex items-center">
							<icon
								title="Recipient"
								class="max-w-[36px]"
								style="filter: drop-shadow(1px 1px 1px rgb(0 0 0 / 0.4));"
							>
								<RecipientIcon color="#94D2BD" />
							</icon>
							{item.open_count != BigInt(0) ? item.open_count : '?'}
						</span>
						<span
							title="Send count"
							aria-label="Number of sends"
							class="flex items-center gap-x-1.5"
						>
							<icon
								title="Envelope"
								class="max-w-[36px]"
								style="filter: drop-shadow(1px 0.75px 0.75px rgb(0 0 0 / 0.4));"
							>
								<SentIcon color="#94D2BD" />
							</icon>
							{item.send_count != BigInt(0) ? item.send_count : '?'}
						</span>
					</div>

					<div
						class="tags min-w-[25rem] h-full justify-between"
						aria-label="Topic and recepient lists"
						style="max-width: {!expand ? '35rem' : '100%'};"
					>
						<div aria-label="Topic list">
							<Selector
								selectable={Tag}
								items={item.topic_list}
								itemStyle="text-[11px] text-paper-500 bg-peacockFeather-500 hover:-translate-y-0.5"
								alignment="start"
								overflow="wrap"
								target="email"
								bind:selectedContent={$sessionStore.topic}
								on:select={(e) => {
									setExpand(false);
									dispatch('select', e.detail);
								}}
								on:blur={handleBlur}
							/>
						</div>
						<div aria-label="Receipient list">
							<Selector
								selectable={Tag}
								items={item.recipient_list}
								itemStyle="text-[11px] text-paper-500 bg-peacockFeather-600 hover:-translate-y-0.5"
								alignment="start"
								overflow="wrap"
								target="email"
								bind:selectedContent={$sessionStore.recipient}
								on:select={(e) => {
									setExpand(false);
									dispatch('select', e.detail);
								}}
								on:blur={handleBlur}
							/>
						</div>
					</div>
				</div>
				{#if expand}
					<p aria-label="Info text" class="text-center mt-1"><i>click again to send...</i></p>
				{/if}
				<details
					style="text-align: initial; margin-top: {!expand ? '-1.5rem' : '0'};"
					class="whitespace-normal flex flex-col appearance-none self-center"
					class:w-full={expand}
				>
					<summary
						tabindex="-1"
						aria-expanded={expand}
						aria-label="Email body"
						on:click={(e) => {
							if (e.target instanceof HTMLElement && e.target.tagName === 'A') {
								e.stopPropagation();
							}
						}}
						on:keypress={(e) => {
							if (e.key === 'Enter') {
								if (e.target instanceof HTMLElement && e.target.tagName === 'A') {
									e.stopPropagation();
								}
							}
						}}
					>
						<Reader bind:expand item={item.body} />
					</summary>
				</details>
			</article>
		{/if}
	</section>
</button>

<style lang="scss">
	.cardWrapper {
		&::after {
			background: linear-gradient(to top, theme('colors.artistBlue.600') 0%, transparent 10%);
			content: '';
			position: absolute;
			bottom: -1px;
			margin-bottom: -1px;
			height: 100%;
			width: 100%;
		}
	}
	.card {
		transition: all 0.2s ease-out;
		color: theme('colors.paper.500');
		&:hover {
			box-shadow: theme('colors.larimarGreen.700') 0 0 2px 2px;
			transition: 0.1s ease-in;
		}
	}

	.clickable {
		&:active {
			transform: scale(0.9927);
			box-shadow: unset;
			transition: 0.1s ease-out;
		}
	}
	h1 {
		font-size: 1.4rem;
		font-weight: 600;
		white-space: nowrap;
		overflow-x: overlay;
		padding-bottom: 0;
	}
	.stats {
		text-align: start;
		display: flex;
		flex-direction: row;
	}
	.tags {
		white-space: normal;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-bottom: 1rem;
	}

	.scrollable {
		scrollbar-width: none;
		&::-webkit-scrollbar {
			display: none;
		}

		&:hover {
			overflow: scroll;
			/* prevent scrollbar from changing container dimensions in webkit */
			overflow: overlay;
		}

		&::before {
			content: '';
			display: block;
			position: absolute;
			top: 0;
			right: 0;
			bottom: 0;
			left: 0;
			background: linear-gradient(to right, transparent 85%, theme('colors.artistBlue.600') 97%);
		}
	}

	.scrolled::before {
		background: linear-gradient(
			to right,
			theme('colors.artistBlue.600') 3%,
			transparent 15%,
			transparent 85%,
			theme('colors.artistBlue.600') 97%
		);
	}

	.scrolled__max::before {
		content: '';
		display: block;
		top: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(to right, theme('colors.artistBlue.600') 3%, transparent 15%);
	}

	summary {
		transition: 0.2s ease-out;
		list-style: none;
		&::-webkit-details-marker {
			display: none;
		}
	}
</style>
