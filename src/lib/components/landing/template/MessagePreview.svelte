<script lang="ts">
	import { Mail } from 'lucide-svelte';
	import { createEventDispatcher, onMount } from 'svelte';
	import { browser } from '$app/environment';

	export let preview: string;
	export let onScroll: (isAtBottom: boolean, scrollProgress?: number) => void;

	const dispatch = createEventDispatcher();
	let scrollContainer: HTMLDivElement;
	let isAtTop = true;
	let isAtBottom = false;
	let isScrollable = false;
	let activeVariable: string | null = null;
	let variableValues: Record<string, string> = {};

	interface Segment {
		type: 'text' | 'variable';
		content: string;
		name?: string;
	}

	interface DismissStateEvent {
		isDismissing: boolean;
	}

	let modalDismissing = false;

	// Parse template content into segments
	function parseTemplate(text: string): Segment[] {
		const segments: Segment[] = [];
		let currentIndex = 0;
		const variablePattern = /\[(.*?)\]/g;
		let match: RegExpExecArray | null;

		while ((match = variablePattern.exec(text)) !== null) {
			// Add text before variable if exists
			if (match.index > currentIndex) {
				segments.push({
					type: 'text',
					content: text.slice(currentIndex, match.index)
				});
			}

			// Add variable
			segments.push({
				type: 'variable',
				name: match[1],
				content: match[0]
			});

			currentIndex = match.index + match[0].length;
		}

		// Add remaining text if exists
		if (currentIndex < text.length) {
			segments.push({
				type: 'text',
				content: text.slice(currentIndex)
			});
		}

		// Initialize variable values
		if (Object.keys(variableValues).length === 0) {
			for (const segment of segments) {
				if (segment.type === 'variable' && segment.name) {
					variableValues[segment.name] = '';
				}
			}
		}

		return segments;
	}

	// Reactive declaration for parsed segments
	$: templateSegments = parseTemplate(preview);

	onMount(() => {
		const handleDismissState = (e: CustomEvent<DismissStateEvent>) => {
			modalDismissing = e.detail.isDismissing;
		};

		const handleTouchEnd = () => {
			if (modalDismissing) {
				modalDismissing = false;
			}
		};

		document.addEventListener('dismissStateChange', handleDismissState as EventListener);
		document.addEventListener('touchend', handleTouchEnd);

		return () => {
			document.removeEventListener('dismissStateChange', handleDismissState as EventListener);
			document.removeEventListener('touchend', handleTouchEnd);
		};
	});

	function updateScrollState() {
		if (!scrollContainer) return;

		const { scrollHeight, clientHeight, scrollTop } = scrollContainer;
		isScrollable = scrollHeight > clientHeight;
		isAtTop = scrollTop <= 0;
		isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 1;

		dispatch('scrollStateChange', {
			isScrollable,
			isAtTop,
			isAtBottom,
			scrollProgress: scrollTop / (scrollHeight - clientHeight)
		});
	}

	function handleScroll() {
		updateScrollState();
		onScroll(isAtBottom);
	}

	let touchStartY = 0;

	function handleTouchStart(event: TouchEvent) {
		touchStartY = event.touches[0].clientY;
		handleTouch(event);
	}

	function handleTouch(event: TouchEvent) {
		if (!scrollContainer) return;

		const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
		const touchY = event.touches[0].clientY;

		const touchState = {
			touchY,
			touchStartY,
			isScrollable: scrollHeight > clientHeight,
			isAtTop: scrollTop <= 0,
			isAtBottom: Math.abs(scrollHeight - clientHeight - scrollTop) < 1,
			scrollPosition: scrollTop,
			maxScroll: scrollHeight - clientHeight,
			isDismissing: modalDismissing
		};

		if (
			!modalDismissing &&
			touchState.isScrollable &&
			!(
				(touchState.isAtTop && touchY > touchStartY) ||
				(touchState.isAtBottom && touchY < touchStartY)
			)
		) {
			event.stopPropagation();
		}

		dispatch('touchStateChange', touchState);
	}

	function handleTouchEnd() {
		if (modalDismissing) {
			modalDismissing = false;
		}
	}

	function handleVariableClick(variableName: string) {
		activeVariable = activeVariable === variableName ? null : variableName;
		dispatch('variableSelect', { variableName, active: activeVariable === variableName });
	}

	function handleInput(e: Event, name: string) {
		const target = e.target as HTMLInputElement | HTMLTextAreaElement;
		variableValues[name] = target.value;

		// Automatically resize textarea
		if (target.tagName.toLowerCase() === 'textarea') {
			target.style.height = 'auto';
			target.style.height = `${target.scrollHeight}px`;
		}
	}

	function handleBlur() {
		activeVariable = null;
	}

	$: if (browser && preview) {
		setTimeout(() => {
			updateScrollState();
		}, 0);
	}

	// Update variable styling to be more subtle by default
	function getVariableClasses(isActive: boolean): string {
		return `
            inline-flex justify-center
            px-1 -my-0.5
            rounded-full
            font-mono text-sm
            leading-normal
            cursor-pointer
            transition-all duration-150
            ${
							isActive
								? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
								: 'bg-blue-50/40 text-blue-600/90 hover:bg-blue-50 hover:text-blue-600 ring-1 ring-blue-200/60'
						}
            focus:outline-none focus:ring-2 
            focus:ring-blue-200 focus:ring-offset-1
            cursor-pointer
            align-baseline
            max-w-full
        `;
	}
</script>

<div class="relative flex h-full cursor-text flex-col">
	<div class="mb-2 flex shrink-0 items-center gap-2">
		<Mail class="h-4 w-4 shrink-0 text-slate-500" />
		<h3 class="text-sm font-medium text-slate-900 sm:text-base">Message Preview</h3>
	</div>
	<div class="relative min-h-0 flex-1">
		<div
			bind:this={scrollContainer}
			on:scroll={handleScroll}
			on:touchstart={handleTouchStart}
			on:touchmove={handleTouch}
			on:touchend={handleTouchEnd}
			data-scrollable={isScrollable}
			class="styled-scrollbar-track scrollbar-thumb-slate-300 scrollbar-track-slate-100/10
                   absolute inset-0 overflow-y-auto whitespace-pre-wrap rounded-lg
                   bg-slate-50/70 p-4"
		>
			<p class="font-mono text-sm leading-normal text-slate-600">
				{#each templateSegments as segment}
					{#if segment.type === 'text'}
						{segment.content}
					{:else if segment.name}
						{#if activeVariable === segment.name}
							{#if segment.name.toLowerCase().includes('story') || segment.name
									.toLowerCase()
									.includes('reasoning')}
								<textarea
									value={variableValues[segment.name]}
									on:input={(e) => handleInput(e, segment.name ?? '')}
									on:blur={handleBlur}
									placeholder={`Enter your ${segment.name}...`}
									class="w-full resize-none overflow-hidden rounded-md border-blue-300 bg-white p-2
                                           font-sans text-sm shadow-inner focus:border-blue-500 focus:ring-blue-500"
									rows="3"
									autofocus
								/>
							{:else}
								<input
									value={variableValues[segment.name]}
									on:input={(e) => handleInput(e, segment.name ?? '')}
									on:blur={handleBlur}
									placeholder={`Enter ${segment.name}...`}
									class="inline-block w-48 rounded-md border-blue-300 bg-white px-2 py-1 align-baseline
                                           font-sans text-sm shadow-inner focus:border-blue-500 focus:ring-blue-500"
									autofocus
								/>
							{/if}
						{:else}
							<button
								class={getVariableClasses(activeVariable === segment.name)}
								on:click={() => handleVariableClick(segment.name ?? '')}
							>
								{variableValues[segment.name] || `[${segment.name}]`}
							</button>
						{/if}
					{/if}
				{/each}
			</p>
		</div>
	</div>
</div>
