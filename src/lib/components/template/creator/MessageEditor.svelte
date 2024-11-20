<script lang="ts">
    import { Mail, Variable, Lightbulb, Braces } from 'lucide-svelte';
    import type { TemplateCreationContext } from '$lib/types/template';

    export let data: {
        preview: string;
        variables: string[];
    };
    export let context: TemplateCreationContext;

    const commonVariables = [
        '[Your Name]',
        '[Organization Name]',
        '[Decision Maker]',
        '[Your Perspective]',
        '[Specific Request]'
    ];

    function insertVariable(variable: string) {
        const textarea = document.querySelector('textarea');
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;

        data.preview = text.substring(0, start) + variable + text.substring(end);
        if (!data.variables.includes(variable)) {
            data.variables = [...data.variables, variable];
        }

        // Reset cursor position after variable
        setTimeout(() => {
            textarea.focus();
            const newPosition = start + variable.length;
            textarea.setSelectionRange(newPosition, newPosition);
        }, 0);
    }

    function analyzeMessage() {
        // TODO: Implement AI analysis
        console.log('Analyzing message...');
    }

    $: messageLength = data.preview.length;
    $: wordCount = data.preview.trim().split(/\s+/).length;
    $: variableCount = (data.preview.match(/\[.*?\]/g) || []).length;
</script>

<div class="space-y-6">
    <!-- Message Composition -->
    <div class="space-y-4">
        <div class="flex items-center justify-between">
            <label class="block text-sm font-medium text-slate-700">
                Message Template
            </label>
            <div class="text-sm text-slate-500">
                {wordCount} words | {variableCount} variables
            </div>
        </div>

        <div class="relative">
            <textarea
                bind:value={data.preview}
                class="block w-full rounded-md border-slate-300 shadow-sm 
                       focus:border-blue-500 focus:ring-blue-500 font-mono text-sm
                       min-h-[300px] resize-y"
                placeholder="Dear [Decision Maker],

I am writing regarding...

Sincerely,
[Your Name]"
            />
        </div>
    </div>

    <!-- Variable Insertion -->
    <div class="space-y-3">
        <label class="block text-sm font-medium text-slate-700">
            <div class="flex items-center gap-2">
                <Braces class="w-4 h-4 text-slate-400" />
                Quick Variables
            </div>
        </label>

        <div class="flex items-center gap-2">
            <button class="btn btn-sm btn-outline-secondary" on:click={() => insertVariable('[Your Name]')}>
                <Mail class="w-4 h-4" />
            </button>
            <button class="btn btn-sm btn-outline-secondary" on:click={() => insertVariable('[Organization Name]')}>
                <Variable class="w-4 h-4" />
            </button>
            <button class="btn btn-sm btn-outline-secondary" on:click={() => insertVariable('[Decision Maker]')}>
                <Mail class="w-4 h-4" />
            </button>
            <button class="btn btn-sm btn-outline-secondary" on:click={() => insertVariable('[Your Perspective]')}>
                <Lightbulb class="w-4 h-4" />
            </button>
            <button class="btn btn-sm btn-outline-secondary" on:click={() => insertVariable('[Specific Request]')}>
                <Lightbulb class="w-4 h-4" />
            </button>
        </div>
    </div>

    <!-- AI Assistant placeholder -->
    <div class="p-4 bg-blue-50 rounded-lg border border-blue-100">
        <div class="flex items-center gap-2 text-blue-700">
            <Lightbulb class="w-4 h-4" />
            <span class="text-sm">AI Assistant will help improve message effectiveness...</span>
        </div>
    </div>
</div> 