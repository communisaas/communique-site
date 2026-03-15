<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let name = $state('');
	let slug = $state('');
	let description = $state('');
	let slugManual = $state(false);
	let saving = $state(false);
	let errorMsg = $state('');

	function toSlug(input: string): string {
		return input
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/[\s_]+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 50);
	}

	function onNameInput() {
		if (!slugManual) {
			slug = toSlug(name);
		}
	}

	function onSlugInput() {
		slugManual = true;
	}

	async function submit() {
		const trimmedName = name.trim();
		const trimmedSlug = slug.trim();

		if (trimmedName.length < 3 || trimmedName.length > 100) {
			errorMsg = 'Name must be between 3 and 100 characters';
			return;
		}
		if (trimmedSlug.length < 3 || trimmedSlug.length > 50) {
			errorMsg = 'Slug must be between 3 and 50 characters';
			return;
		}

		saving = true;
		errorMsg = '';

		try {
			const res = await fetch(`/api/org/${data.org.slug}/networks`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: trimmedName,
					slug: trimmedSlug,
					description: description.trim() || null
				})
			});

			if (res.ok) {
				const result = await res.json();
				window.location.href = `/org/${data.org.slug}/networks/${result.id}`;
			} else {
				const body = await res.json().catch(() => null);
				errorMsg = body?.error ?? `Failed to create network (${res.status})`;
			}
		} catch {
			errorMsg = 'Network error';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Create Network | {data.org.name}</title>
</svelte:head>

<div class="min-h-screen bg-surface-raised text-text-primary">
	<div class="mx-auto max-w-4xl px-4 py-8">
		<!-- Back link -->
		<a href="/org/{data.org.slug}/networks" class="mb-6 inline-block text-sm text-text-tertiary hover:text-text-primary">
			&larr; All Networks
		</a>

		<h1 class="mb-8 text-2xl font-bold text-text-primary">Create Network</h1>

		<!-- Error -->
		{#if errorMsg}
			<div class="mb-6 rounded-lg border border-red-800/60 bg-red-950/30 px-4 py-3 text-sm text-red-400">
				{errorMsg}
			</div>
		{/if}

		<!-- Form -->
		<div class="space-y-4 rounded-lg border border-surface-border p-4">
			<div>
				<label for="net-name" class="mb-1 block text-sm font-medium text-text-tertiary">Name</label>
				<input
					id="net-name"
					type="text"
					bind:value={name}
					oninput={onNameInput}
					placeholder="e.g. Climate Action Coalition"
					maxlength="100"
					class="w-full rounded-lg border border-surface-border-strong bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder-text-quaternary focus:border-text-tertiary focus:outline-none"
				/>
				<p class="mt-1 text-xs text-text-tertiary">{name.trim().length}/100 characters</p>
			</div>

			<div>
				<label for="net-slug" class="mb-1 block text-sm font-medium text-text-tertiary">Slug</label>
				<input
					id="net-slug"
					type="text"
					bind:value={slug}
					oninput={onSlugInput}
					placeholder="climate-action-coalition"
					maxlength="50"
					class="w-full rounded-lg border border-surface-border-strong bg-surface-raised px-3 py-2 text-sm font-mono text-text-primary placeholder-text-quaternary focus:border-text-tertiary focus:outline-none"
				/>
				<p class="mt-1 text-xs text-text-tertiary">URL-friendly identifier ({slug.trim().length}/50)</p>
			</div>

			<div>
				<label for="net-desc" class="mb-1 block text-sm font-medium text-text-tertiary">Description (optional)</label>
				<textarea
					id="net-desc"
					bind:value={description}
					placeholder="What is this network for?"
					rows="3"
					maxlength="500"
					class="w-full rounded-lg border border-surface-border-strong bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder-text-quaternary focus:border-text-tertiary focus:outline-none"
				></textarea>
				<p class="mt-1 text-xs text-text-tertiary">{description.trim().length}/500 characters</p>
			</div>
		</div>

		<!-- Actions -->
		<div class="mt-6 flex items-center justify-end gap-3">
			<a
				href="/org/{data.org.slug}/networks"
				class="rounded-lg border border-surface-border-strong px-4 py-2 text-sm text-text-secondary hover:border-text-tertiary hover:text-text-primary"
			>
				Cancel
			</a>
			<button
				onclick={submit}
				disabled={saving}
				class="rounded-lg bg-surface-overlay px-4 py-2 text-sm font-semibold text-text-primary hover:bg-surface-raised disabled:opacity-50"
			>
				{saving ? 'Creating...' : 'Create Network'}
			</button>
		</div>
	</div>
</div>
