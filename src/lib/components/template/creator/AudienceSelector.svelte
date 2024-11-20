<script lang="ts">
    import { Users, Building2, Lightbulb, X, Plus } from 'lucide-svelte';
    import type { TemplateCreationContext } from '$lib/types/template';

    export let data: {
        organizations: string[];
        roles: string[];
        emailPatterns: string[];
    };
    export let context: TemplateCreationContext;

    let newOrg = '';
    let newRole = '';
    let newEmail = '';

    function addOrganization() {
        if (newOrg && !data.organizations.includes(newOrg)) {
            data.organizations = [...data.organizations, newOrg];
            newOrg = '';
        }
    }

    function addRole() {
        if (newRole && !data.roles.includes(newRole)) {
            data.roles = [...data.roles, newRole];
            newRole = '';
        }
    }

    function addEmailPattern() {
        if (newEmail && !data.emailPatterns.includes(newEmail)) {
            data.emailPatterns = [...data.emailPatterns, newEmail];
            newEmail = '';
        }
    }

    function removeItem(array: string[], item: string) {
        const index = array.indexOf(item);
        if (index > -1) {
            array.splice(index, 1);
            data[array] = array; // Trigger reactivity
        }
    }
</script>

<div class="space-y-6">
    <!-- Organizations -->
    <div class="space-y-3">
        <label class="block">
            <span class="text-sm font-medium text-slate-700">Target Organizations</span>
            <div class="mt-1 flex gap-2">
                <input
                    type="text"
                    bind:value={newOrg}
                    placeholder="Add organization..."
                    class="block flex-1 rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    on:keydown={e => e.key === 'Enter' && addOrganization()}
                />
                <button
                    class="inline-flex items-center px-3 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    on:click={addOrganization}
                >
                    <Plus class="w-4 h-4" />
                </button>
            </div>
        </label>

        {#if data.organizations.length > 0}
            <div class="flex flex-wrap gap-2">
                {#each data.organizations as org}
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        {org}
                        <button
                            class="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200"
                            on:click={() => removeItem(data.organizations, org)}
                        >
                            <X class="w-3 h-3" />
                        </button>
                    </span>
                {/each}
            </div>
        {/if}
    </div>

    <!-- Roles -->
    <div class="space-y-3">
        <label class="block">
            <span class="text-sm font-medium text-slate-700">Decision Maker Roles</span>
            <div class="mt-1 flex gap-2">
                <input
                    type="text"
                    bind:value={newRole}
                    placeholder="Add role..."
                    class="block flex-1 rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    on:keydown={e => e.key === 'Enter' && addRole()}
                />
                <button
                    class="inline-flex items-center px-3 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    on:click={addRole}
                >
                    <Plus class="w-4 h-4" />
                </button>
            </div>
        </label>

        {#if data.roles.length > 0}
            <div class="flex flex-wrap gap-2">
                {#each data.roles as role}
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        {role}
                        <button
                            class="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-green-200"
                            on:click={() => removeItem(data.roles, role)}
                        >
                            <X class="w-3 h-3" />
                        </button>
                    </span>
                {/each}
            </div>
        {/if}
    </div>

    <!-- Email Patterns -->
    <div class="space-y-3">
        <label class="block">
            <span class="text-sm font-medium text-slate-700">Email Patterns</span>
            <div class="mt-1 flex gap-2">
                <input
                    type="text"
                    bind:value={newEmail}
                    placeholder="e.g., @company.com"
                    class="block flex-1 rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    on:keydown={e => e.key === 'Enter' && addEmailPattern()}
                />
                <button
                    class="inline-flex items-center px-3 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    on:click={addEmailPattern}
                >
                    <Plus class="w-4 h-4" />
                </button>
            </div>
        </label>

        {#if data.emailPatterns.length > 0}
            <div class="flex flex-wrap gap-2">
                {#each data.emailPatterns as pattern}
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                        {pattern}
                        <button
                            class="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-purple-200"
                            on:click={() => removeItem(data.emailPatterns, pattern)}
                        >
                            <X class="w-3 h-3" />
                        </button>
                    </span>
                {/each}
            </div>
        {/if}
    </div>

    <!-- AI Assistant -->
    <div class="p-4 bg-blue-50 rounded-lg border border-blue-100">
        <div class="flex items-start gap-3">
            <Lightbulb class="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div class="space-y-2">
                <h4 class="font-medium text-blue-900">Audience Tips</h4>
                <ul class="text-sm text-blue-700 space-y-1">
                    <li>• Target specific departments or teams</li>
                    <li>• Include both leadership and operational roles</li>
                    <li>• Consider common email formats (e.g., firstname.lastname@)</li>
                </ul>
            </div>
        </div>
    </div>
</div> 