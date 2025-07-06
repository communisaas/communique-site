<script lang="ts">
	import { Mail, Sparkles, User, Edit3 } from 'lucide-svelte';
	import { createEventDispatcher, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { fade, fly, scale } from 'svelte/transition';

	export let preview: string;
	export let onScroll: (isAtBottom: boolean, scrollProgress?: number) => void;

	const dispatch = createEventDispatcher();
	let scrollContainer: HTMLDivElement;
	let isAtTop = true;
	let isAtBottom = false;
	let isScrollable = false;
	let activeVariable: string | null = null;
	let variableValues: Record<string, string> = {};
	let hoveredVariable: string | null = null;
	let showingHint: string | null = null;

	// Define which variables are system-populated vs user-editable
	const systemVariables = new Set(['Name', 'Address', 'Representative Name']);
	const userEditableVariables = new Set(['Personal Story', 'Personal Reasoning']);

	// Contextual hints and suggestions
	const variableHints: Record<string, { prompt: string; examples: string[]; placeholder: string }> =
		{
			'Personal Story': {
				prompt: '✨ Share your experience',
				examples: [
					'How has this issue affected your family?',
					'Tell about a moment when this mattered to you',
					'Share a personal experience that illustrates why this is important'
				],
				placeholder: 'Share your personal experience with this issue...'
			},
			'Personal Reasoning': {
				prompt: '💭 Add your perspective',
				examples: [
					'Why does this matter to you personally?',
					'What would change if this policy were enacted?',
					'How do you see this impacting your community?'
				],
				placeholder: 'Explain why this issue is important to you...'
			}
		};

	const systemVariableHints: Record<string, { prompt: string; detail: string }> = {
		Name: {
			prompt: '👤 Auto-filled Name',
			detail: 'This is automatically populated using your profile name.'
		},
		Address: {
			prompt: '🏠 Auto-filled Address',
			detail: 'We use your address from your profile for verification.'
		},
		'Representative Name': {
			prompt: '🏛️ Auto-filled Official',
			detail: 'This is set to the correct representative for your district.'
		}
	};

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
					// Default to empty, which will show the bracketed name
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
		// Only allow editing of user-editable variables
		if (!userEditableVariables.has(variableName)) {
			return;
		}
		activeVariable = activeVariable === variableName ? null : variableName;
		showingHint = null; // Hide hint when editing starts
		dispatch('variableSelect', { variableName, active: activeVariable === variableName });
	}

	function handleVariableHover(variableName: string | null) {
		if (activeVariable) return; // Don't show hints while editing
		hoveredVariable = variableName;

		if (variableName) {
			setTimeout(() => {
				if (hoveredVariable === variableName && !activeVariable) {
					showingHint = variableName;
				}
			}, 300); // Slightly faster pop-up
		} else {
			showingHint = null;
		}
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
		showingHint = null;
	}

	function getRandomExample(variableName: string): string {
		const hints = variableHints[variableName];
		if (!hints) return '';
		return hints.examples[Math.floor(Math.random() * hints.examples.length)];
	}

	$: if (browser && preview) {
		setTimeout(() => {
			updateScrollState();
		}, 0);
	}

	// Update variable styling with more delightful interactions
	function getVariableClasses(isActive: boolean, variableName: string, isHovered: boolean): string {
		const isSystemVariable = systemVariables.has(variableName);
		const isUserEditable = userEditableVariables.has(variableName);
		const isEmpty = !variableValues[variableName] || variableValues[variableName].trim() === '';

		const baseClasses = `
			inline-flex items-center gap-1
			px-1.5 rounded leading-tight
			font-mono text-sm
			cursor-pointer transition-colors duration-200
			align-baseline
		`;

		if (isSystemVariable) {
			return `
				${baseClasses}
				bg-emerald-100/60 text-emerald-800 ring-1 ring-emerald-200/50
				cursor-default
			`;
		} else if (isUserEditable) {
			if (isActive) {
				return `${baseClasses} bg-blue-100 text-blue-700 ring-2 ring-blue-300`;
			} else if (isEmpty) {
				return `${baseClasses} bg-purple-100/70 text-purple-800 ring-1 ring-purple-200/80 hover:bg-purple-100`;
			} else {
				return `${baseClasses} bg-blue-100/80 text-blue-800 ring-1 ring-blue-200/80 hover:bg-blue-100`;
			}
		} else {
			// Default styling for unknown variables
			return `
				${baseClasses}
				bg-slate-100 text-slate-700 ring-1 ring-slate-200
			`;
		}
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
						<span class="relative inline-block">
							{#if activeVariable === segment.name && userEditableVariables.has(segment.name)}
								{#if segment.name.toLowerCase().includes('story') || segment.name
										.toLowerCase()
										.includes('reasoning')}
									<div class="relative" transition:scale={{ duration: 200 }}>
										<textarea
											value={variableValues[segment.name]}
											on:input={(e) => handleInput(e, segment.name ?? '')}
											on:blur={handleBlur}
											placeholder={variableHints[segment.name]?.placeholder ||
												`Enter your ${segment.name}...`}
											class="w-full min-w-[400px] resize-none overflow-hidden rounded-lg border-2 border-blue-300 bg-white p-3
													font-sans text-sm shadow-lg focus:border-blue-500 focus:ring-blue-500 focus:ring-opacity-50"
											rows="4"
											autofocus
										/>
										<!-- Character count and encouragement -->
										{#if variableValues[segment.name]?.length > 10}
											<div class="absolute -bottom-6 right-0 text-xs text-blue-600" transition:fade>
												{variableValues[segment.name].length} characters • Looking great! 🎉
											</div>
										{/if}
									</div>
								{:else}
									<input
										value={variableValues[segment.name]}
										on:input={(e) => handleInput(e, segment.name ?? '')}
										on:blur={handleBlur}
										placeholder={`Enter ${segment.name}...`}
										class="inline-block w-64 rounded-lg border-2 border-blue-300 bg-white px-3 py-1.5 align-baseline
												font-sans text-sm shadow-lg focus:border-blue-500 focus:ring-blue-500 focus:ring-opacity-50"
										autofocus
									/>
								{/if}
							{:else}
								<button
									class={getVariableClasses(
										activeVariable === segment.name,
										segment.name,
										hoveredVariable === segment.name
									)}
									on:click={() => handleVariableClick(segment.name ?? '')}
									on:mouseenter={() => handleVariableHover(segment.name ?? null)}
									on:mouseleave={() => handleVariableHover(null)}
								>
									{#if systemVariables.has(segment.name)}
										<User class="h-3 w-3 text-emerald-600" />
									{:else if userEditableVariables.has(segment.name) && (!variableValues[segment.name] || variableValues[segment.name].trim() === '')}
										<Sparkles class="h-3 w-3 text-purple-500" />
									{/if}
									{variableValues[segment.name] || segment.name}
								</button>

								<!-- Contextual hint popup -->
								{#if showingHint === segment.name}
									{#if userEditableVariables.has(segment.name) && variableHints[segment.name]}
										<div
											class="absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 shadow-xl"
											transition:fly={{ y: 8, duration: 200 }}
										>
											<div
												class="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800"
											>
												<Sparkles class="h-4 w-4 text-purple-500" />
												{variableHints[segment.name].prompt}
											</div>
											<p class="mb-3 text-xs italic text-slate-500">
												"{getRandomExample(segment.name)}"
											</p>
											<div class="text-center text-xs text-slate-400">
												Click the purple tag to start writing
											</div>
										</div>
									{:else if systemVariables.has(segment.name) && systemVariableHints[segment.name]}
										<div
											class="absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 shadow-xl"
											transition:fly={{ y: 8, duration: 200 }}
										>
											<div
												class="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800"
											>
												{systemVariableHints[segment.name].prompt}
											</div>
											<p class="text-xs text-slate-500">
												{systemVariableHints[segment.name].detail}
											</p>
										</div>
									{/if}
								{/if}
							{/if}
						</span>
					{/if}
				{/each}
			</p>
		</div>
	</div>
</div>
