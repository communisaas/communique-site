<script lang="ts">
    import { Target, Lightbulb, Tag } from 'lucide-svelte';
    import type { TemplateCreationContext } from '$lib/types/template';

    export let data: {
        title: string;
        description: string;
        category: string;
        goal: string;
    };
    export let context: TemplateCreationContext;

    // Debug data changes
    $: console.log('ObjectiveDefiner data:', data);

    // Initialize data if empty
    $: if (!data.title) data.title = '';
    $: if (!data.goal) data.goal = '';
    $: if (!data.category) data.category = '';
    $: if (!data.description) data.description = '';

    const categories = [
        'Technology',
        'Environment',
        'Healthcare',
        'Education',
        'Social Justice',
        'Economic Policy',
        'Other'
    ];

    $: isTitleValid = data.title.trim().length > 0;
    $: isGoalValid = data.goal.trim().length > 0;
</script>

<div class="space-y-6">
    <div class="space-y-4">
        <label class="block">
            <span class="text-sm font-medium text-slate-700">Template Title</span>
            <input
                type="text"
                bind:value={data.title}
                on:input={() => console.log('Title updated:', data.title)}
                class="mt-1 block w-full rounded-md border-slate-300 shadow-sm 
                       focus:border-blue-500 focus:ring-blue-500
                       {!isTitleValid && data.title ? 'border-red-300' : ''}"
                placeholder="e.g., Tech Ethics Initiative"
            />
            {#if !isTitleValid && data.title}
                <p class="mt-1 text-sm text-red-600">Title is required</p>
            {/if}
        </label>

        <label class="block">
            <span class="text-sm font-medium text-slate-700">Campaign Goal</span>
            <textarea
                bind:value={data.goal}
                on:input={() => console.log('Goal updated:', data.goal)}
                class="mt-1 block w-full rounded-md border-slate-300 shadow-sm 
                       focus:border-blue-500 focus:ring-blue-500
                       {!isGoalValid && data.goal ? 'border-red-300' : ''}"
                rows="3"
                placeholder="What specific change or action are you seeking?"
            />
            {#if !isGoalValid && data.goal}
                <p class="mt-1 text-sm text-red-600">Goal is required</p>
            {/if}
        </label>

        <label class="block">
            <span class="text-sm font-medium text-slate-700">Category</span>
            <select
                bind:value={data.category}
                class="mt-1 block w-full rounded-md border-slate-300 shadow-sm 
                       focus:border-blue-500 focus:ring-blue-500"
            >
                <option value="">Select a category...</option>
                {#each categories as category}
                    <option value={category}>{category}</option>
                {/each}
            </select>
        </label>
    </div>

    <!-- AI Assistant -->
    <div class="p-4 bg-blue-50 rounded-lg border border-blue-100">
        <div class="flex items-start gap-3">
            <Lightbulb class="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div class="space-y-2">
                <h4 class="font-medium text-blue-900">Writing Tips</h4>
                <ul class="text-sm text-blue-700 space-y-1">
                    <li>• Make your goal specific and measurable</li>
                    <li>• Focus on a single primary objective</li>
                    <li>• Consider both short and long-term impact</li>
                </ul>
            </div>
        </div>
    </div>
</div> 