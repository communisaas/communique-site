<script lang="ts">
	import { Building2, MapPin, Users, CheckCircle2 } from '@lucide/svelte';
	import AgencyRibbon from '$lib/components/ui/AgencyRibbon.svelte';

	type CompletePayload = {
		role: string;
		organization?: string;
		location?: string;
		connection: string;
		connectionDetails?: string;
	};

	interface TemplateLike {
		title: string;
		deliveryMethod: string;
		category?: string;
	}

	let {
		template,
		onclose,
		oncomplete
	}: {
		template: TemplateLike;
		onclose?: () => void;
		oncomplete?: (data: CompletePayload) => void;
	} = $props();

	// Form state (single-screen)
	let role = $state('');
	let customRole = $state('');
	let organization = $state('');
	let location = $state('');
	let connection = $state('');
	let connectionDetails = $state('');

	// Simple validation flags
	let roleError = $state('');
	let connectionError = $state('');

	function getTemplateContext(t: TemplateLike): 'local-government' | 'corporate' | 'general' {
		const title = (t.title || '').toLowerCase();
		const category = (t.category || '').toLowerCase();
		if (title.includes('council') || title.includes('mayor') || category.includes('local'))
			return 'local-government';
		if (title.includes('ceo') || title.includes('board') || category.includes('corporate'))
			return 'corporate';
		return 'general';
	}

	const templateContext = $derived(getTemplateContext(template));

	interface Option {
		value: string;
		label: string;
	}

	function getRoleOptions(context: ReturnType<typeof getTemplateContext>): Option[] {
		switch (context) {
			case 'local-government':
				return [
					{ value: 'resident', label: 'Resident' },
					{ value: 'parent', label: 'Parent' },
					{ value: 'small_business_owner', label: 'Small Business Owner' },
					{ value: 'community_organizer', label: 'Community Organizer' },
					{ value: 'other', label: 'Other' }
				];
			case 'corporate':
				return [
					{ value: 'employee', label: 'Employee' },
					{ value: 'shareholder', label: 'Shareholder' },
					{ value: 'customer', label: 'Customer' },
					{ value: 'partner', label: 'Partner' },
					{ value: 'other', label: 'Other' }
				];
			default:
				return [
					{ value: 'constituent', label: 'Constituent' },
					{ value: 'volunteer', label: 'Volunteer' },
					{ value: 'professional', label: 'Professional' },
					{ value: 'student', label: 'Student' },
					{ value: 'other', label: 'Other' }
				];
		}
	}

	function getConnectionOptions(): Option[] {
		return [
			{ value: 'personal_experience', label: 'I have direct personal experience' },
			{ value: 'community_impact', label: 'I’ve seen community impact' },
			{ value: 'professional_expertise', label: 'I have relevant expertise' },
			{ value: 'other', label: 'Other' }
		];
	}

	const roleOptions: Option[] = $derived(getRoleOptions(templateContext));
	const connectionOptions: Option[] = $derived(getConnectionOptions());

	function validate(): boolean {
		roleError = '';
		connectionError = '';
		const roleValue = role === 'other' ? customRole.trim() : role;
		if (!roleValue) roleError = 'Please select or enter your role';
		const connectionValue = connection === 'other' ? connectionDetails.trim() : connection;
		if (!connectionValue) connectionError = 'Please choose how you’re connected to this issue';
		return !roleError && !connectionError;
	}

	function handleSubmit() {
		if (!validate()) return;
		const finalRole = role === 'other' ? customRole.trim() : role;
		const finalConnection = connection === 'other' ? connectionDetails.trim() : connection;
		oncomplete?.({
			role: finalRole,
			organization: organization.trim() || undefined,
			location: location.trim() || undefined,
			connection: finalConnection,
			connectionDetails: connection === 'other' ? connectionDetails.trim() : undefined
		});
	}

	function handleSkip() {
		onclose?.();
	}
</script>

<div
	class="fixed inset-0 z-[1010] bg-black/40 backdrop-blur-sm"
	role="dialog"
	aria-modal="true"
	aria-label="Complete your profile"
>
	<div
		class="fixed inset-x-4 top-1/2 mx-auto max-w-xl -translate-y-1/2 rounded-2xl bg-white shadow-2xl"
	>
		<div class="border-b border-slate-100 p-5">
			<h2 class="text-lg font-semibold text-slate-900">Make your message more persuasive</h2>
			<p class="mt-1 text-sm text-slate-600">
				A few details help decision makers understand your stake and respond.
			</p>
		</div>

		<div class="p-5">
			<AgencyRibbon />

			<!-- Role -->
			<label class="mb-1 block text-sm font-medium text-slate-800" for="role-select"
				>Your role</label
			>
			<div class="relative mb-2">
				<select
					id="role-select"
					class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
					bind:value={role}
					aria-invalid={roleError ? 'true' : 'false'}
				>
					<option value="" disabled selected>Select a role</option>
					{#each roleOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</div>
			{#if role === 'other'}
				<input
					id="custom-role"
					class="mb-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
					placeholder="Describe your role"
					bind:value={customRole}
				/>
			{/if}
			{#if roleError}
				<div class="mb-2 text-xs text-red-600">{roleError}</div>
			{/if}

			<!-- Organization + Location (optional) -->
			<div class="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div>
					<label
						class="mb-1 block flex items-center gap-1 text-sm font-medium text-slate-800"
						for="org-input"
						><Building2 class="h-4 w-4 text-slate-500" /> Organization (optional)</label
					>
					<input
						id="org-input"
						class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
						placeholder="e.g., Riverbend PTA"
						bind:value={organization}
					/>
				</div>
				<div>
					<label
						class="mb-1 block flex items-center gap-1 text-sm font-medium text-slate-800"
						for="loc-input"><MapPin class="h-4 w-4 text-slate-500" /> Location (optional)</label
					>
					<input
						id="loc-input"
						class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
						placeholder="City, State"
						bind:value={location}
					/>
				</div>
			</div>

			<!-- Connection -->
			<div class="mt-4">
				<label
					class="mb-1 block flex items-center gap-1 text-sm font-medium text-slate-800"
					for="connection-select"
					><Users class="h-4 w-4 text-slate-500" /> How are you connected?</label
				>
				<div class="relative mb-2">
					<select
						id="connection-select"
						class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
						bind:value={connection}
						aria-invalid={connectionError ? 'true' : 'false'}
					>
						<option value="" disabled selected>Select one</option>
						{#each connectionOptions as opt}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				</div>
				{#if connection === 'other'}
					<textarea
						id="connection-details"
						class="mb-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
						rows="2"
						placeholder="Briefly describe your connection"
						bind:value={connectionDetails}
					></textarea>
				{/if}
				{#if connectionError}
					<div class="mb-2 text-xs text-red-600">{connectionError}</div>
				{/if}
			</div>

			<!-- Live nudge: minimum viable completion -->
			<div class="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
				<div class="flex items-center gap-2">
					<CheckCircle2 class="h-4 w-4 text-green-600" /> You can proceed once role and connection are
					set. You can refine later.
				</div>
			</div>

			<!-- Actions -->
			<div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
				<button
					class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
					onclick={handleSkip}
				>
					Skip for now
				</button>
				<button
					class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
					disabled={!role || !connection}
					onclick={handleSubmit}
				>
					Continue
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	:global(select) {
		appearance: none;
	}
</style>
