<script lang="ts">
	import { Mail, Sparkles, User, Edit3 } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { fade, fly, scale } from 'svelte/transition';
	import AnimatedPopover from '$lib/components/ui/AnimatedPopover.svelte';
	import VerificationBadge from '$lib/components/ui/VerificationBadge.svelte';
	import type { Template } from '$lib/types/template';
	import { popover as popoverStore } from '$lib/stores/popover';
	import { coordinated, useTimerCleanup } from '$lib/utils/timerCoordinator';

	let {
		preview,
		template = undefined,
		user = null,
		onScroll,
		onscrollStateChange,
		ontouchStateChange,
		onvariableSelect,
		onvariableChange
	}: {
		preview: string;
		template?: Template | undefined;
		user?: {
			id: string;
			name: string | null;
			street?: string;
			city?: string;
			state?: string;
			zip?: string;
			is_verified?: boolean;
			verification_method?: string;
		} | null;
		onScroll: (isAtBottom: boolean, scrollProgress?: number) => void;
		onscrollStateChange?: (scrollState: unknown) => void;
		ontouchStateChange?: (touchState: unknown) => void;
		onvariableSelect?: (event: { variableName: string; active: boolean }) => void;
		onvariableChange?: (event: { name: string; value: string }) => void;
	} = $props();
	let scrollContainer: HTMLDivElement;
	let isAtTop = $state(true);
	let isAtBottom = $state(false);
	let isScrollable = $state(false);
	let variableValues: Record<string, string> = $state({});

	// Define which variables are system-populated vs user-editable
	const systemVariables = new Set(['Name', 'Address', 'Representative Name']);
	const userEditableVariables = new Set(['Personal Connection']);

	// Function to resolve template variables with user data
	function resolveTemplateVariables(text: string): string {
		if (!user) return text;

		let resolvedText = text;

		// Replace [Name] with user's name
		if (user.name) {
			resolvedText = resolvedText.replace(/\[Name\]/g, user.name);
		}

		// Replace [Address] with user's address if available
		if (user.street && user.city && user.state && user.zip) {
			const userAddress = `${user.street}, ${user.city}, ${user.state} ${user.zip}`;
			resolvedText = resolvedText.replace(/\[Address\]/g, userAddress);
		}

		// Note: [Representative Name] and [Personal Connection] are handled by the editing system
		// or filled in server-side for congressional delivery

		return resolvedText;
	}

	// Resolved preview text with user data substituted
	const resolvedPreview = $derived(resolveTemplateVariables(preview));

	// Contextual hints and suggestions
	const variableHints: Record<string, { prompt: string; placeholder: string }> = {
		'Personal Connection': {
			prompt: 'Personal Connection',
			placeholder: 'Share why this issue matters to you - your story, reasoning, or perspective...'
		}
	};

	const systemVariableHints: Record<string, { title: string; description: string }> = {
		'Representative Name': {
			title: 'Auto-filled Variable',
			description:
				"This will be replaced with the representative's name based on the sender's address."
		},
		Name: {
			title: 'Auto-filled Variable',
			description: 'This will be replaced with the your name from your user profile.'
		},
		Address: {
			title: 'Auto-filled Variable',
			description: 'This will be replaced with the your address from your user profile.'
		}
	};

	interface Segment {
		type: 'text' | 'variable';
		content: string;
		name?: string;
		instanceId?: string;
	}

	interface DismissStateEvent {
		isDismissing: boolean;
	}

	let modalDismissing = false;

	// Component ID for timer coordination
	const componentId = 'message-preview-' + Math.random().toString(36).substring(2, 15);

	// Parse template content into segments
	function parseTemplate(text: string): Segment[] {
		const segments: Segment[] = [];
		let currentIndex = 0;
		const variablePattern = /\[(.*?)\]/g;
		let match: RegExpExecArray | null;
		const instanceCounts = new Map<string, number>();

		while ((match = variablePattern.exec(text)) !== null) {
			// Add text before variable if exists
			if (match.index > currentIndex) {
				segments.push({
					type: 'text',
					content: text.slice(currentIndex, match.index)
				});
			}

			// Track instances of each variable type
			const variableName = match[1];
			const currentCount = instanceCounts.get(variableName) || 0;
			const instanceNumber = currentCount + 1;
			instanceCounts.set(variableName, instanceNumber);

			// Add variable with unique instance ID
			segments.push({
				type: 'variable',
				name: variableName,
				content: match[0],
				instanceId: `${variableName}-${instanceNumber}`
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

		return segments;
	}

	// Reactive declaration for parsed segments
	const templateSegments = $derived(parseTemplate(resolvedPreview));

	// Initialize variable values when segments change
	$effect(() => {
		if (Object.keys(variableValues).length === 0) {
			for (const segment of templateSegments) {
				if (segment.type === 'variable' && segment.name) {
					// Default to empty, which will show the bracketed name
					variableValues[segment.name] = '';
				}
			}
		}
	});

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
			useTimerCleanup(componentId)();
		};
	});

	function updateScrollState() {
		if (!scrollContainer) return;

		const { scrollHeight, clientHeight, scrollTop } = scrollContainer;
		isScrollable = scrollHeight > clientHeight;
		isAtTop = scrollTop <= 0;
		isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 1;

		const detail = {
			isScrollable,
			isAtTop,
			isAtBottom,
			scrollProgress: scrollTop / (scrollHeight - clientHeight)
		};
		// Dispatch custom event so modal can intercept
		scrollContainer.dispatchEvent(new CustomEvent('scrollStateChange', { detail, bubbles: true }));
		onscrollStateChange?.(detail);
	}

	function handleScroll() {
		updateScrollState();
		onScroll(isAtBottom);

		// Close any open popovers when scrolling
		if ($popoverStore) {
			popoverStore.close($popoverStore.id);
		}
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

		// Dispatch custom event so modal can adjust gesture handling
		scrollContainer.dispatchEvent(
			new CustomEvent('touchStateChange', { detail: touchState, bubbles: true })
		);
		ontouchStateChange?.(touchState);
	}

	function handleTouchEnd() {
		if (modalDismissing) {
			modalDismissing = false;
		}
	}

	function handleVariableClick(variableName: string) {
		// The popover handles opening/closing automatically
		// We just need to notify the parent component
		if (userEditableVariables.has(variableName)) {
			onvariableSelect?.({ variableName, active: true });
		}
	}


	function handleInput(e: Event, name: string) {
		const target = e.target as HTMLInputElement | HTMLTextAreaElement;
		variableValues[name] = target.value;

		// Bubble variable changes up to parent for JS-land template updates
		onvariableChange?.({ name, value: target.value });

		// Automatically resize textarea
		if (target.tagName.toLowerCase() === 'textarea') {
			target.style.height = 'auto';
			target.style.height = `${target.scrollHeight}px`;
		}

		// No heuristics here – personalization is purely user-driven.
	}


	$effect(() => {
		if (browser && preview) {
			coordinated.setTimeout(
				() => {
					updateScrollState();
				},
				0,
				'dom',
				componentId
			);
		}
	});

	// Update variable styling with more delightful interactions
	function getVariableClasses(variableName: string): string {
		const isSystemVariable = systemVariables.has(variableName);
		const isUserEditable = userEditableVariables.has(variableName);
		const isEmpty = !variableValues[variableName] || variableValues[variableName].trim() === '';

		if (isSystemVariable) {
			return `
				inline-flex items-center gap-1
				px-1 py-0.5 rounded-sm
				font-mono text-xs leading-none
				transition-colors duration-150
				bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200
				cursor-default align-baseline
			`;
		} else if (isUserEditable) {
			const baseClasses = `
				inline-flex items-center gap-1
				px-1 py-0.5 rounded-sm
				font-mono text-xs leading-none
				cursor-pointer transition-all duration-150
				align-baseline transform
			`;

			if (isEmpty) {
				return (
					baseClasses +
					' bg-purple-50 text-purple-700 ring-1 ring-purple-200 hover:bg-purple-100 hover:ring-purple-300'
				);
			} else {
				return (
					baseClasses +
					' bg-blue-50 text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100 hover:ring-blue-300'
				);
			}
		} else {
			// Default styling for unknown variables
			return `
				inline-flex items-center
				px-1 py-0.5 rounded-sm
				font-mono text-xs leading-none
				cursor-pointer transition-colors duration-150
				bg-slate-50 text-slate-600 ring-1 ring-slate-200
				align-baseline
			`;
		}
	}
</script>

<div class="relative flex h-full cursor-text flex-col">
	<!-- Subject/Title Header -->
	{#if template?.subject || template?.title}
		<div class="mb-3 rounded-md bg-blue-50 border border-blue-200 px-3 py-2">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2 text-xs font-medium text-blue-700 mb-1">
					<Mail class="h-3 w-3" />
					Subject Line
				</div>
				{#if user?.is_verified}
					<VerificationBadge size="sm" />
				{/if}
			</div>
			<div class="font-medium text-blue-900 text-sm">
				{template.subject || template.title}
			</div>
		</div>
	{:else}
		<!-- Fallback header when no subject/title -->
		<div class="mb-2 flex shrink-0 items-center gap-2">
			<Mail class="h-4 w-4 shrink-0 text-slate-500" />
			<h3 class="text-sm font-medium text-slate-900 sm:text-base">Message Preview</h3>
			{#if user?.is_verified}
				<VerificationBadge size="sm" />
			{/if}
		</div>
	{/if}


	<div class="relative flex-1 min-h-[16rem]">
		<div
			class="styled-scrollbar-track scrollbar-thumb-slate-300 scrollbar-track-slate-100/10 absolute inset-0 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50/70 p-4"
			bind:this={scrollContainer}
			onscroll={handleScroll}
			ontouchstart={handleTouchStart}
			ontouchmove={handleTouch}
			ontouchend={handleTouchEnd}
			data-scrollable={isScrollable}
		>
			<div class="min-h-[12rem] font-mono text-sm leading-normal text-slate-600">
				{#each templateSegments as segment}
					{#if segment.type === 'text'}
						{segment.content}
					{:else if segment.name}
						<span class="relative inline-block">
							<AnimatedPopover
								id={`variable-${segment.instanceId}`}
								animationStyle="expand"
								duration={250}
							>
								<svelte:fragment slot="trigger" let:triggerAction>
									<button
										use:triggerAction
										class={getVariableClasses(segment.name)}
										onclick={() => handleVariableClick(segment.name ?? '')}
									>
										{#if systemVariables.has(segment.name)}
											<User class="h-2.5 w-2.5 text-emerald-600" />
										{:else if userEditableVariables.has(segment.name) && (!variableValues[segment.name] || variableValues[segment.name].trim() === '')}
											<Sparkles class="h-2.5 w-2.5 text-purple-600" />
										{:else if userEditableVariables.has(segment.name)}
											<Edit3 class="h-2.5 w-2.5 text-blue-600" />
										{/if}
										{variableValues[segment.name] || segment.name}
										{#if segment.name === 'Personal Connection' && (variableValues[segment.name] || '').trim().length > 0}
											<span
												class="ml-1 rounded bg-emerald-50 px-1 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200"
												>Personalized</span
											>
										{/if}
									</button>
								</svelte:fragment>

								<!-- User-editable variables with input in popover -->
								{#if userEditableVariables.has(segment.name)}
									<div class="mb-2 flex items-center gap-1.5">
										<Sparkles class="h-3 w-3 text-purple-500" />
										<span class="text-[11px] font-medium tracking-tight text-slate-700">
											{variableHints[segment.name]?.prompt || segment.name}
										</span>
									</div>
									
									{#if segment.name.toLowerCase().includes('connection') || segment.name.toLowerCase().includes('story') || segment.name.toLowerCase().includes('reasoning')}
										<textarea
											value={variableValues[segment.name]}
											oninput={(e) => handleInput(e, segment.name ?? '')}
											placeholder={variableHints[segment.name]?.placeholder || `Enter your ${segment.name}...`}
											class="w-full min-w-[280px] resize-none rounded-lg border border-slate-300 bg-white p-3
													font-sans text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500 focus:ring-opacity-20"
											rows="4"
										></textarea>
										<!-- Character count and encouragement -->
										{#if variableValues[segment.name]?.length > 10}
											<div class="mt-1 text-xs text-purple-600">
												{variableValues[segment.name].length} characters • Looking great!
											</div>
										{/if}
									{:else}
										<input
											value={variableValues[segment.name]}
											oninput={(e) => handleInput(e, segment.name ?? '')}
											placeholder={`Enter ${segment.name}...`}
											class="w-full min-w-[240px] rounded-lg border border-slate-300 bg-white px-3 py-2
													font-sans text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500 focus:ring-opacity-20"
										/>
									{/if}
								{/if}

								<!-- System-populated hint popup -->
								{#if systemVariables.has(segment.name) && systemVariableHints[segment.name]}
									<div class="mb-1 flex items-center gap-1.5">
										<User class="h-3 w-3 text-emerald-500" />
										<span class="text-[11px] font-medium tracking-tight text-slate-700">
											{systemVariableHints[segment.name].title}
										</span>
									</div>
									<p class="text-[11px] leading-tight text-slate-500">
										{systemVariableHints[segment.name].description}
									</p>
								{/if}
							</AnimatedPopover>
						</span>
					{/if}
				{/each}
			</div>
		</div>
	</div>
</div>
