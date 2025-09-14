<script lang="ts">
	import { CheckCircle2, Link2, Users, Mail, Target, ExternalLink } from '@lucide/svelte';
	import type { TemplateFormData, TemplateCreationContext } from '$lib/types/template';
	import { page } from '$app/stores';
	import Badge from '$lib/components/ui/Badge.svelte';

	let { data, context }: { data: TemplateFormData; context: TemplateCreationContext } = $props();

	// Generate preview URL using dynamic hostname
	const previewUrl = $derived(
		data.objective.slug ? `${$page.url.origin}/${data.objective.slug}` : null
	);

	// Format recipient display
	const recipientDisplay = $derived.by(() => {
		if (context.channelId === 'certified') {
			return 'Congressional Representatives (auto-routed)';
		}
		const count = data.audience.recipientEmails.length;
		return count === 1 ? '1 recipient' : `${count} recipients`;
	});
</script>

<div class="space-y-6">
	<!-- Success Header -->
	<div class="rounded-lg border border-green-200 bg-green-50 p-3 md:p-4">
		<div class="flex items-start gap-3">
			<CheckCircle2 class="mt-0.5 h-4 md:h-5 w-4 md:w-5 shrink-0 text-green-600" />
			<div>
				<h4 class="text-sm md:text-base font-medium text-green-900">Ready to Launch</h4>
				<p class="mt-1 text-xs md:text-sm text-green-700">Your campaign is ready to go live and start making an impact.</p>
			</div>
		</div>
	</div>

	<!-- Template Summary -->
	<div class="space-y-4">
		<!-- Objective Section -->
		<div class="rounded-lg border border-slate-200 bg-white p-3 md:p-4">
			<div class="mb-3 flex items-center gap-2">
				<Target class="h-3 md:h-4 w-3 md:w-4 text-slate-400" />
				<h3 class="text-sm md:text-base font-medium text-slate-900">Campaign Objective</h3>
			</div>
			<dl class="space-y-2 text-xs md:text-sm">
				<div>
					<dt class="text-slate-500">Title</dt>
					<dd class="font-medium text-slate-900">{data.objective.title}</dd>
				</div>
			</dl>
		</div>

		<!-- Deep Link Section -->
		{#if previewUrl}
			<div class="rounded-lg border border-slate-200 bg-white p-3 md:p-4">
				<div class="mb-3 flex items-center gap-2">
					<Link2 class="h-3 md:h-4 w-3 md:w-4 text-slate-400" />
					<h3 class="text-sm md:text-base font-medium text-slate-900">Campaign Link</h3>
				</div>
				<div class="space-y-3">
					<div class="rounded-md bg-slate-50 p-2 md:p-2.5 font-mono text-xs md:text-sm text-slate-700 break-all">
						{previewUrl}
					</div>
					<div class="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 text-xs text-slate-600">
						<span>✓ Shareable on social media</span>
						<span>✓ Tracks campaign views</span>
						<span>✓ Mobile-friendly</span>
					</div>
					<a
						href={previewUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
					>
						Preview your campaign page
						<ExternalLink class="h-3 w-3" />
					</a>
				</div>
			</div>
		{/if}

		<!-- Audience Section -->
		<div class="rounded-lg border border-slate-200 bg-white p-3 md:p-4">
			<div class="mb-3 flex items-center gap-2">
				<Users class="h-3 md:h-4 w-3 md:w-4 text-slate-400" />
				<h3 class="text-sm md:text-base font-medium text-slate-900">Target Audience</h3>
			</div>
			<div class="flex items-center gap-3">
				<Badge type={context.channelId} />
				<span class="text-xs md:text-sm text-slate-700">{recipientDisplay}</span>
			</div>
			{#if data.audience.recipientEmails.length > 0}
				<div class="mt-2 text-xs text-slate-500">
					{data.audience.recipientEmails.join(', ')}
				</div>
			{/if}
		</div>

		<!-- Message Preview Section -->
		<div class="rounded-lg border border-slate-200 bg-white p-3 md:p-4">
			<div class="mb-3 flex items-center gap-2">
				<Mail class="h-3 md:h-4 w-3 md:w-4 text-slate-400" />
				<h3 class="text-sm md:text-base font-medium text-slate-900">Message Preview</h3>
			</div>
			<div class="rounded-md bg-slate-50 p-2 md:p-3">
				<p class="whitespace-pre-wrap text-xs md:text-sm text-slate-700">
					{data.content.preview.substring(0, 200)}
					{data.content.preview.length > 200 ? '...' : ''}
				</p>
			</div>
			{#if data.content.variables.length > 0}
				<div class="mt-2">
					<span class="text-xs text-slate-500">Variables used: </span>
					<span class="text-xs font-medium text-slate-700">
						{data.content.variables.join(', ')}
					</span>
				</div>
			{/if}
		</div>
	</div>

	<!-- Next Steps -->
	<div class="rounded-md bg-blue-50 p-3 md:p-4">
		<h4 class="mb-2 text-xs md:text-sm font-medium text-blue-900">What happens next?</h4>
		<ul class="space-y-1 text-xs md:text-sm text-blue-700">
			<li>• Your template will be saved as a draft</li>
			{#if previewUrl}
				<li>• Share your campaign link to start gathering support</li>
			{/if}
			<li>• You can edit or publish it from your dashboard</li>
			<li>• Track engagement metrics in real-time</li>
		</ul>
	</div>
</div>
