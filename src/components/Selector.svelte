<script lang="ts">
	import { onMount, type ComponentType } from 'svelte';

	export let items: Selectable[] | string[];
	export let selectable: ComponentType; // item component template
	export let selectedContent: Selectable;
	export let target: SelectableKey;
	export let alignment: 'start' | 'end' | 'center' | 'justify' | 'match-parent';
	export let overflow: 'scroll' | 'hidden' | 'visible' | 'wrap' | 'auto' = 'auto';
	export let scrollable = true;
	export let itemStyle: string = '';
	export let selectorStyle: string = '';
	export let backgroundColor: string = '';

	const listStyle = `p-1 flex grow h-full items-${alignment} ${
		alignment == 'end' ? 'flex-row-reverse' : 'flex-row'
	} gap-3 gap-y-1.5 ${
		overflow == 'wrap'
			? 'whitespace-normal flex-wrap gap-y-1'
			: 'whitespace-nowrap overflow-' + overflow
	} ${selectorStyle}`;

	let scrollPosition = {
		x: 0,
		y: 0,
		remainingWidth: 0,
		remainingHeight: 0,
		startX: 0,
		startY: 0,
		startScrollLeft: 0,
		startScrollTop: 0
	};

	let scrollX = {
		scrolled: false,
		scrolledMax: false
	};
	let scrollY = {
		scrolled: false,
		scrolledMax: false
	};

	let resizeObserver: ResizeObserver;
	let list: HTMLElement;
	onMount(async () => {
		selectedContent.target = target;
		resizeObserver = new ResizeObserver(() => {
			updateScrollableElements();
		});

		resizeObserver.observe(list);
	});

	function updateScrollableElements() {
		if (list) {
			scrollPosition.remainingWidth = list.scrollWidth - list.clientWidth;
			scrollPosition.remainingHeight = list.scrollHeight - list.clientHeight;
			scrollable =
				scrollPosition.remainingWidth == 0 && scrollPosition.remainingHeight == 0 ? false : true;

			scrollX.scrolled = scrollPosition.x > 1;
			scrollX.scrolledMax =
				scrollX.scrolled && scrollPosition.remainingWidth - scrollPosition.x <= 1;

			scrollY.scrolled = scrollPosition.y > 1;
			scrollY.scrolledMax =
				scrollY.scrolled && scrollPosition.remainingHeight - scrollPosition.y <= 1;
		}
	}

	$: {
		if (items && list && scrollable) {
			// update if new list litems
			updateScrollableElements();
		}
	}
</script>

<section class="relative h-full overflow-auto">
	<div
		bind:this={list}
		style="--backgroundColor: {backgroundColor}"
		class={listStyle}
		class:scrollable
		class:scrollableX={scrollable && scrollPosition.remainingWidth > 0}
		class:scrollableY={scrollable && scrollPosition.remainingHeight > 0}
		class:scrolledX={scrollX.scrolled}
		class:scrolledY={scrollY.scrolled}
		class:scrolledX__max={scrollX.scrolledMax}
		class:scrolledY__max={scrollY.scrolledMax}
		on:wheel={(e) => {
			if (scrollable) {
				e.preventDefault();
				list.scrollLeft += Math.abs(e.deltaX) > 0 ? e.deltaX : e.deltaY * 0.33;
				list.scrollTop += Math.abs(e.deltaY) > 0 ? e.deltaY : e.deltaX * 0.33;
				scrollPosition.x = list.scrollLeft + 1;
				scrollPosition.y = list.scrollTop + 1;
			}
		}}
		on:touchstart={(e) => {
			if (scrollable) {
				e.preventDefault();
				scrollPosition.startX = e.touches[0].clientX;
				scrollPosition.startY = e.touches[0].clientY;
				scrollPosition.startScrollTop = list.scrollTop;
				scrollPosition.startScrollLeft = list.scrollLeft;
			}
		}}
		on:touchmove={(e) => {
			if (scrollable) {
				const deltaX = e.touches[0].clientX - scrollPosition.startX;
				const deltaY = e.touches[0].clientY - scrollPosition.startY;

				if (Math.abs(deltaY) > Math.abs(deltaX) && list.scrollHeight > list.clientHeight) {
					// Scroll vertically
					list.scrollTop = scrollPosition.startScrollTop - deltaY;
				} else {
					// Scroll horizontally
					const walk = deltaX * 2;
					list.scrollLeft = scrollPosition.startScrollLeft - walk;
					scrollPosition.x = list.scrollLeft + 1;
				}
			}
		}}
		on:touchend={() => {
			if (scrollable) {
				scrollPosition.startX = 0;
				scrollPosition.startY = 0;
				scrollPosition.startScrollLeft = 0;
				scrollPosition.startScrollTop = 0;
			}
		}}
	>
		{#each items as item}
			<svelte:component
				this={selectable}
				bind:selected={selectedContent}
				style={itemStyle}
				{item}
				on:select
				on:blur
				on:externalAction
			/>
		{/each}
	</div>
</section>

<style lang="scss">
	.scrollable {
		scrollbar-width: none;
		&::-webkit-scrollbar {
			display: none;
		}

		&:hover {
			overflow: scroll;
			overflow: overlay; // prevent scrollbar from changing container dimensions in webkit
		}

		&X {
			&::before {
				pointer-events: none;
				content: '';
				pointer-events: none;
				display: block;
				position: absolute;
				top: 0;
				right: 0;
				bottom: 0;
				left: 0;
				background-image: linear-gradient(to right, transparent 85%, var(--backgroundColor) 97%);
				background-repeat: no-repeat;
			}
		}

		&Y {
			&::before {
				content: '';
				pointer-events: none;
				display: block;
				position: absolute;
				top: 0;
				right: 0;
				bottom: 0;
				left: 0;
				background-image: linear-gradient(to bottom, transparent 85%, var(--backgroundColor) 97%);
				background-repeat: no-repeat;
			}
		}
	}

	.scrolledX {
		&::before {
			pointer-events: none;
			background-image: linear-gradient(
				to right,
				var(--backgroundColor) 3%,
				transparent 15%,
				transparent 85%,
				var(--backgroundColor) 97%
			);
			background-repeat: no-repeat;
		}
	}

	.scrolledX__max {
		&::before {
			pointer-events: none;
			content: '';
			display: block;
			top: 0;
			right: 0;
			bottom: 0;
			background-image: linear-gradient(to right, var(--backgroundColor) 3%, transparent 15%),
				linear-gradient(to bottom, var(--backgroundColor) 3%, transparent 15%);
			background-repeat: no-repeat;
		}
	}

	.scrolledY {
		&::before {
			background-image: linear-gradient(
					to bottom,
					var(--backgroundColor) 3%,
					transparent 15%,
					transparent 85%,
					var(--backgroundColor) 97%
				),
				linear-gradient(
					to bottom,
					var(--backgroundColor) 3%,
					transparent 15%,
					transparent 85%,
					var(--backgroundColor) 97%
				);
			background-repeat: no-repeat;
		}
	}

	.scrolledY__max {
		&::before {
			content: '';
			display: block;
			top: 0;
			right: 0;
			bottom: 0;
			background-image: linear-gradient(to right, var(--backgroundColor) 3%, transparent 15%),
				linear-gradient(to bottom, var(--backgroundColor) 3%, transparent 15%);
			background-repeat: no-repeat;
		}
	}
</style>
