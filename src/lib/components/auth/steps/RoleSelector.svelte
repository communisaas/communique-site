<script lang="ts">
	import { User } from '@lucide/svelte';
	
	let {
		templateContext,
		selectedRole = $bindable(),
		customRole = $bindable(),
		organization = $bindable(),
		roleError = $bindable(),
		isTransitioning,
		onNext,
		onCancel
	}: {
		templateContext: string;
		selectedRole: string;
		customRole: string;
		organization: string;
		roleError: string;
		isTransitioning: boolean;
		onNext: () => void;
		onCancel: () => void;
	} = $props();
	
	const roleOptions = $derived(getRoleOptions(templateContext));
	
	function getRoleOptions(context: string) {
		const baseOptions = [
			'Resident',
			'Business Owner', 
			'Employee',
			'Student',
			'Community Volunteer'
		];
		
		if (context === 'corporate') {
			return [
				'Customer',
				'Employee', 
				'Shareholder',
				'Business Partner',
				'Industry Professional',
				...baseOptions
			];
		}
		
		if (context === 'local-government') {
			return [
				'Local Resident',
				'Voter',
				'Taxpayer',
				'Business Owner',
				'Parent',
				'Community Leader',
				...baseOptions
			];
		}
		
		return baseOptions;
	}
</script>

<div class="text-center mb-6">
	<div class="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
		<User class="h-6 w-6 text-blue-600" />
	</div>
	<h2 class="text-xl font-bold text-slate-900 mb-2">
		Strengthen your voice
	</h2>
	<p class="text-slate-600">
		Adding your role and credentials increases your message's impact
	</p>
</div>

<div class="space-y-4 mb-6">
	<div>
		<label class="block text-sm font-medium text-slate-700 mb-3">
			What's your role?
		</label>
		<div class="grid grid-cols-2 gap-2">
			{#each roleOptions as role}
				<button
					type="button"
					onclick={() => selectedRole = role.toLowerCase().replace(/\s+/g, '-')}
					class="text-left p-3 border rounded-lg text-sm transition-all hover:border-blue-300 {
						selectedRole === role.toLowerCase().replace(/\s+/g, '-') 
							? 'border-blue-500 bg-blue-50 text-blue-900' 
							: 'border-slate-300 text-slate-700'
					}"
				>
					{role}
				</button>
			{/each}
			<button
				type="button"
				onclick={() => selectedRole = 'other'}
				class="text-left p-3 border rounded-lg text-sm transition-all hover:border-blue-300 {
					selectedRole === 'other' 
						? 'border-blue-500 bg-blue-50 text-blue-900' 
						: 'border-slate-300 text-slate-700'
				}"
			>
				Other
			</button>
		</div>
		
		{#if selectedRole === 'other'}
			<input
				type="text"
				bind:value={customRole}
				placeholder="Enter your role"
				class="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
			/>
		{/if}
	</div>
	
	<div>
		<label for="organization" class="block text-sm font-medium text-slate-700 mb-2">
			Organization (optional but recommended)
		</label>
		<input
			id="organization"
			type="text"
			bind:value={organization}
			placeholder="Company, school, or organization"
			class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
		/>
		<p class="mt-1 text-xs text-slate-500">
			Adding your organization increases credibility
		</p>
	</div>
	
	{#if roleError}
		<p class="text-sm text-red-600">{roleError}</p>
	{/if}
</div>

<div class="flex gap-3">
	<button
		type="button"
		class="flex-1 bg-white text-blue-600 border border-blue-200 hover:border-blue-300 rounded-lg px-6 py-3 text-sm font-medium transition-all"
		onclick={onCancel}
	>
		Cancel
	</button>
	<button
		type="button"
		class="flex-1 bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-6 py-3 text-sm font-medium transition-all disabled:opacity-50"
		onclick={onNext}
		disabled={isTransitioning}
	>
		Continue
	</button>
</div>