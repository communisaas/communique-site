<script lang="ts">
	import { Eye, Mail, User, Building2, Lock, CheckCircle } from '@lucide/svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import type { Template } from '$lib/types/template';

	interface Props {
		template: Template;
		personalStory?: string;
		senderName?: string;
		deliveryMethod?: 'preview' | 'email' | 'congressional';
	}

	const {
		template,
		personalStory = '',
		senderName = 'Your Name',
		deliveryMethod = 'preview'
	}: Props = $props();

	// Combine template message with personal story
	const fullMessage = $derived(
		personalStory
			? `${template.message_body}\n\n--- PERSONAL STORY ---\n\n${personalStory}`
			: template.message_body
	);

	// Format date for email preview
	const today = new Date().toLocaleDateString('en-US', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});

	const isCongressional = $derived(template.deliveryMethod === 'cwc');
</script>

<div class="flex flex-col gap-6">
	<!-- Preview Header -->
	<div class="flex items-start justify-between gap-4">
		<div class="flex items-center gap-3">
			<div class="rounded-full bg-blue-100 p-2">
				<Eye class="h-5 w-5 text-blue-600" aria-hidden="true" />
			</div>
			<div>
				<h2 class="text-lg font-semibold text-gray-900 md:text-xl">Message Preview</h2>
				<p class="text-sm text-gray-600">
					What {isCongressional ? 'congressional staff' : 'recipients'} will see
				</p>
			</div>
		</div>

		<!-- Privacy Badges Preview (placeholder for now) -->
		<div class="flex flex-wrap gap-2">
			<Badge variant="success" size="sm">
				<Lock class="h-3 w-3" aria-hidden="true" />
				Anonymous
			</Badge>
			<Badge variant="congressional" size="sm">
				<CheckCircle class="h-3 w-3" aria-hidden="true" />
				Verified
			</Badge>
		</div>
	</div>

	<!-- Email-style Preview -->
	<div class="overflow-hidden rounded-lg border-2 border-gray-200 bg-white shadow-sm">
		<!-- Email Header -->
		<div class="border-b border-gray-200 bg-gray-50 px-4 py-3 md:px-6 md:py-4">
			<div class="flex items-start gap-3">
				<div class="rounded-full bg-congressional-100 p-2">
					<Mail class="h-5 w-5 text-congressional-600" aria-hidden="true" />
				</div>
				<div class="min-w-0 flex-1">
					<div class="flex items-baseline gap-2">
						<span class="text-sm font-medium text-gray-700">From:</span>
						<span class="truncate text-sm text-gray-900">{senderName}</span>
						<Badge variant="success" size="sm">Verified Constituent</Badge>
					</div>
					<div class="mt-1 flex items-baseline gap-2">
						<span class="text-sm font-medium text-gray-700">To:</span>
						<span class="text-sm text-gray-600">
							{isCongressional
								? 'Your Representative'
								: template.recipientEmails?.join(', ') || 'Recipients'}
						</span>
					</div>
					<div class="mt-1 flex items-baseline gap-2">
						<span class="text-sm font-medium text-gray-700">Date:</span>
						<span class="text-sm text-gray-600">{today}</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Subject Line -->
		<div class="border-b border-gray-200 bg-white px-4 py-3 md:px-6">
			<div class="flex items-baseline gap-2">
				<span class="shrink-0 text-sm font-medium text-gray-700">Subject:</span>
				<span class="text-sm font-semibold text-gray-900">
					{template.subject || template.title}
				</span>
			</div>
		</div>

		<!-- Message Body -->
		<div class="bg-white px-4 py-6 md:px-6 md:py-8">
			<div class="prose prose-sm max-w-none md:prose-base">
				<!-- Template Message -->
				<div class="whitespace-pre-wrap text-gray-800">
					{template.message_body}
				</div>

				{#if personalStory}
					<!-- Personal Story Section -->
					<div class="mt-6 border-t border-gray-200 pt-6">
						<p class="text-sm font-semibold uppercase tracking-wide text-gray-700">
							Personal Story
						</p>
						<div class="mt-3 whitespace-pre-wrap italic text-gray-800">
							{personalStory}
						</div>
					</div>
				{/if}

				<!-- Signature -->
				<div class="mt-8 border-t border-gray-200 pt-6">
					<p class="text-gray-800">Sincerely,</p>
					<p class="mt-2 font-medium text-gray-900">{senderName}</p>
					{#if isCongressional}
						<p class="mt-1 text-sm text-gray-600">
							<span class="inline-flex items-center gap-1">
								<Building2 class="h-4 w-4" aria-hidden="true" />
								Verified Constituent
							</span>
						</p>
					{/if}
				</div>
			</div>
		</div>

		<!-- Delivery Footer -->
		<div class="border-t border-gray-200 bg-gray-50 px-4 py-3 md:px-6">
			<div class="flex items-center gap-2 text-xs text-gray-500">
				<Lock class="h-3 w-3" aria-hidden="true" />
				<span>
					Your identity and address are protected. Only your message content is visible.
				</span>
			</div>
		</div>
	</div>

	<!-- Privacy Explanation -->
	<div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
		<h3 class="text-sm font-semibold text-blue-900">How Privacy Works</h3>
		<ul class="mt-2 space-y-1 text-sm text-blue-700">
			<li>
				• <strong>Anonymous:</strong> Your address is encrypted and never shared publicly
			</li>
			<li>
				• <strong>Verified:</strong> We prove you're a constituent without revealing who you are
			</li>
			<li>
				• <strong>Message Content:</strong> Only the text above is visible to recipients
			</li>
			{#if isCongressional}
				<li>
					• <strong>Zero-Knowledge Proof:</strong> Cryptographic proof of district membership (8-15s
					to generate)
				</li>
			{/if}
		</ul>
	</div>

	<!-- What Happens Next -->
	<details class="group rounded-lg border border-gray-200 bg-white">
		<summary
			class="flex cursor-pointer items-center justify-between px-4 py-3 font-medium text-gray-900 hover:bg-gray-50"
		>
			What happens when I send?
			<svg
				class="h-5 w-5 text-gray-500 transition-transform group-open:rotate-180"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"
				></path>
			</svg>
		</summary>
		<div class="border-t border-gray-200 px-4 py-4 text-sm text-gray-700">
			<ol class="space-y-3">
				{#if isCongressional}
					<li>
						<strong>1. Zero-Knowledge Proof Generation</strong> (8-15 seconds)
						<p class="mt-1 text-gray-600">
							Your browser generates a cryptographic proof that you're a constituent without
							revealing your identity.
						</p>
					</li>
					<li>
						<strong>2. Address Encryption</strong>
						<p class="mt-1 text-gray-600">
							Your address is encrypted in your browser and sent to a secure enclave (TEE).
						</p>
					</li>
					<li>
						<strong>3. Congressional Delivery</strong>
						<p class="mt-1 text-gray-600">
							The secure enclave delivers your message to your representative through the official
							CWC system.
						</p>
					</li>
					<li>
						<strong>4. Reputation Update</strong>
						<p class="mt-1 text-gray-600">
							Your on-chain reputation score increases. No personal data is stored.
						</p>
					</li>
				{:else}
					<li>
						<strong>1. Message Delivery</strong>
						<p class="mt-1 text-gray-600">
							Your message is delivered directly to the email addresses you selected.
						</p>
					</li>
					<li>
						<strong>2. Delivery Confirmation</strong>
						<p class="mt-1 text-gray-600">
							You'll receive confirmation when your message has been sent.
						</p>
					</li>
				{/if}
			</ol>
		</div>
	</details>
</div>
