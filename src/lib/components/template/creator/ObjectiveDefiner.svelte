<script lang="ts">
	import { Lightbulb, Sparkles } from '@lucide/svelte';
	import { untrack } from 'svelte';
	import type { TemplateCreationContext } from '$lib/types/template';
	import { templateValidationRules } from '$lib/utils/validation';
	import ValidatedInput from '$lib/components/ui/ValidatedInput.svelte';
	import SlugCustomizer from './SlugCustomizer.svelte';
	import SubjectLineGenerator from './SubjectLineGenerator.svelte';

	interface Props {
		data: {
			rawInput: string;
			title: string;
			description: string;
			category: string;
			topics?: string[];
			slug?: string;
			voiceSample?: string;
			aiGenerated?: boolean;
		};
		context: TemplateCreationContext;
	}

	/**
	 * Normalize topics to lowercase, hyphenated format
	 * "Tuition Hikes" → "tuition-hikes"
	 */
	function normalizeTopics(topics: string[]): string[] {
		return topics.map((t) =>
			t
				.toLowerCase()
				.trim()
				.replace(/\s+/g, '-')
				.replace(/[^a-z0-9-]/g, '')
		);
	}

	let { data = $bindable(), context }: Props = $props();

	// State for AI suggestion
	let showGenerator = $state(false);

	// Handle suggestion acceptance
	function handleSuggestionAccept(suggestion: {
		subject_line: string;
		core_issue: string;
		topics: string[];
		url_slug: string;
		voice_sample: string;
	}) {
		data.title = suggestion.subject_line;
		data.description = suggestion.core_issue;
		data.slug = suggestion.url_slug;
		data.voiceSample = suggestion.voice_sample; // Emotional peak for downstream agents
		// Normalize and store all topics
		const normalized = normalizeTopics(suggestion.topics);
		data.topics = normalized;
		// Use primary topic as category (capitalize first letter of first word)
		const primaryTopic = normalized[0] || 'general';
		data.category =
			primaryTopic.split('-')[0].charAt(0).toUpperCase() + primaryTopic.split('-')[0].slice(1);
		data.aiGenerated = true; // Mark as AI-generated to prevent slug overwriting
		showGenerator = false;
	}

	// Initialize data if empty (using untrack to avoid mutation warnings)
	$effect(() => {
		untrack(() => {
			if (!data.title) data.title = '';
			if (!data.description) data.description = '';
			if (!data.slug) data.slug = '';
		});
	});

	const _isTitleValid = $derived(data.title.trim().length > 0);
</script>

<div class="space-y-4 md:space-y-6">
	<!-- Subject Line Input -->
	<div class="space-y-3 md:space-y-4">
		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<label for="title-input" class="block text-sm font-medium text-slate-700">
					Subject line
				</label>

				{#if !showGenerator}
					<button
						type="button"
						onclick={() => (showGenerator = true)}
						class="inline-flex items-center gap-1 text-xs text-participation-primary-600 hover:text-participation-primary-700 md:text-sm"
					>
						<Sparkles class="h-3.5 w-3.5 md:h-4 md:w-4" />
						Need help?
					</button>
				{/if}
			</div>

			<ValidatedInput
				bind:value={data.title}
				placeholder="e.g., University Raised Tuition 40% While Sitting on $8B Endowment"
				rules={templateValidationRules.title}
			/>
		</div>
	</div>

	<!-- AI-Assisted Generator (collapsed by default) -->
	{#if showGenerator}
		<div class="rounded-lg border-2 border-slate-200 bg-slate-50 p-4">
			<div class="flex items-start justify-between gap-3">
				<div class="flex items-start gap-3">
					<Sparkles class="mt-0.5 h-5 w-5 text-participation-primary-600" />
					<div class="flex-1">
						<h4 class="text-sm font-medium text-slate-900 md:text-base">
							Let's craft this together
						</h4>
						<p class="mt-1 text-xs text-slate-600 md:text-sm">
							Describe what's pissing you off. We'll write the subject line.
						</p>
					</div>
				</div>
				<button
					type="button"
					onclick={() => (showGenerator = false)}
					class="text-slate-400 hover:text-slate-600"
					aria-label="Close"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						></path>
					</svg>
				</button>
			</div>

			<div class="mt-4 border-t border-slate-200 pt-4">
				<SubjectLineGenerator
					bind:description={data.rawInput}
					onaccept={handleSuggestionAccept}
					oncancel={() => (showGenerator = false)}
				/>
			</div>
		</div>
	{/if}

	<!-- Live Template Link Generation -->
	<div class="space-y-3">
		<SlugCustomizer
			title={data.title}
			bind:slug={data.slug}
			aiGenerated={data.aiGenerated}
			{context}
		/>
	</div>

	<!-- Reference Tips - Available When Needed -->
	<div class="space-y-3 border-t border-slate-100 pt-4">
		<details class="group">
			<summary
				class="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
			>
				<Lightbulb
					class="h-4 w-4 text-participation-primary-600 group-open:text-participation-primary-700"
				/>
				Tips for Effective Advocacy
				<span class="ml-auto text-xs text-slate-500 group-open:hidden">Click to expand</span>
			</summary>
			<div
				class="mt-3 rounded-lg border border-participation-primary-100 bg-participation-primary-50 p-3"
			>
				<ul class="space-y-1.5 text-xs leading-relaxed text-participation-primary-700 md:text-sm">
					<li>• Be specific about the issue or bill you're addressing</li>
					<li>• Clear subject lines get opened - save emotion for the message</li>
					<li>• Officials need to quickly understand what action you want</li>
				</ul>
			</div>
		</details>
	</div>
</div>
