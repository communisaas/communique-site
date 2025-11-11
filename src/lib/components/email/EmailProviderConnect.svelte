<script lang="ts">
	import { Mail, Check } from '@lucide/svelte';

	interface EmailProvider {
		id: string;
		name: string;
		color: string;
		icon: string;
	}

	let {
		template,
		onConnect,
		onSkip
	}: {
		template: { title: string };
		onConnect: (providerId: string) => void;
		onSkip?: () => void;
	} = $props();

	const providers: EmailProvider[] = [
		{
			id: 'gmail',
			name: 'Gmail',
			color: 'bg-red-500',
			icon: 'M'
		},
		{
			id: 'outlook',
			name: 'Outlook / Hotmail',
			color: 'bg-blue-500',
			icon: 'O'
		},
		{
			id: 'yahoo',
			name: 'Yahoo Mail',
			color: 'bg-purple-500',
			icon: 'Y'
		},
		{
			id: 'icloud',
			name: 'iCloud Mail',
			color: 'bg-slate-500',
			icon: 'i'
		}
	];

	function handleConnect(providerId: string) {
		onConnect(providerId);
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="text-center">
		<div class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
			<Mail class="h-6 w-6 text-blue-600" />
		</div>
		<h2 class="mb-2 text-2xl font-bold text-slate-900">Verify your message</h2>
		<p class="text-sm text-slate-600">Connect your email to prove delivery and track responses.</p>
	</div>

	<!-- Template Context -->
	<div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
		<div class="flex items-center gap-2">
			<svg class="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
				/>
			</svg>
			<span class="text-sm text-slate-700">You're sending: <strong>{template.title}</strong></span>
		</div>
	</div>

	<!-- Provider Buttons -->
	<div class="space-y-3">
		{#each providers as provider}
			<button
				type="button"
				onclick={() => handleConnect(provider.id)}
				class="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-all hover:border-blue-300 hover:bg-blue-50"
			>
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white {provider.color}"
				>
					<span class="text-xl font-bold">{provider.icon}</span>
				</div>
				<div class="flex-1 text-left">
					<p class="font-medium text-slate-900">{provider.name}</p>
					<p class="text-xs text-slate-500">Connect via OAuth</p>
				</div>
				<svg class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</button>
		{/each}
	</div>

	<!-- Benefits -->
	<div class="rounded-lg border border-green-200 bg-green-50 p-4">
		<div class="space-y-2 text-sm text-green-900">
			<div class="flex items-start gap-2">
				<Check class="mt-0.5 h-4 w-4 shrink-0" />
				<span>Proves you actually sent the message</span>
			</div>
			<div class="flex items-start gap-2">
				<Check class="mt-0.5 h-4 w-4 shrink-0" />
				<span>Tracks when they open & reply</span>
			</div>
			<div class="flex items-start gap-2">
				<Check class="mt-0.5 h-4 w-4 shrink-0" />
				<span>Your credentials are never stored</span>
			</div>
		</div>
	</div>

	<!-- Progressive Disclosure -->
	<details class="text-center">
		<summary class="cursor-pointer text-xs text-slate-500 hover:text-slate-700">
			Why connect email? →
		</summary>
		<div class="mt-3 space-y-2 text-xs leading-relaxed text-slate-600">
			<p>
				We verify your message was sent by checking your Sent folder (via OAuth API). This proves
				delivery and lets us notify you when they respond.
			</p>
			<p>
				Your email credentials are <strong>never stored</strong>. We use OAuth (same as "Sign in
				with Google") - you stay in control.
			</p>
		</div>
	</details>

	<!-- Skip Option (if provided) -->
	{#if onSkip}
		<div class="border-t border-slate-200 pt-4 text-center">
			<button
				type="button"
				onclick={onSkip}
				class="text-sm text-slate-500 underline hover:text-slate-700"
			>
				Skip verification (send without proof)
			</button>
		</div>
	{/if}
</div>
